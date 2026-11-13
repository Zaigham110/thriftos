import { assertModule } from '../../common/modules/module-check';
import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { CostingService } from '../../costing/costing.service';
import { Prisma } from '@prisma/client';
import { CreateRagDto, UpdateRagDto } from './dto';
import { ContainerStatus, RagStatus, RagSourceType, SequenceScope } from '@prisma/client';
import { defaultRawCategoryId } from '../shared/default-raw-category';
import { TenantSequenceService } from '../shared/tenant-sequence.service';
import { recordSupplierPayment } from '../supplier-khata';

const CHARGE_SELECT = { id: true, kind: true, amount: true, note: true } as const;

/**
 * A loose lot's price: the total typed, else kg × rate per kg, else pieces × rate per piece (to the paisa), else 0.
 */
export function lotPrice(kg: number, total?: number, ratePerKg?: number, byPiece?: { pieces?: number | null; rate?: number | null }): Prisma.Decimal {
  if (total !== undefined && total !== null) return new Prisma.Decimal(total);
  if (ratePerKg !== undefined && ratePerKg !== null) return new Prisma.Decimal(kg).mul(ratePerKg).toDecimalPlaces(2);
  if (byPiece?.rate !== undefined && byPiece.rate !== null && byPiece.pieces) return new Prisma.Decimal(byPiece.pieces).mul(byPiece.rate).toDecimalPlaces(2);
  return new Prisma.Decimal(0);
}

/** One way of pricing at a time; a rate per piece needs the number of pieces. */
function checkPricing(dto: { ratePerKg?: number; ratePerPiece?: number; pieces?: number }, piecesNow?: number | null): void {
  if (dto.ratePerKg !== undefined && dto.ratePerPiece !== undefined) throw new BadRequestException('Give a rate per kg or a rate per piece, not both');
  if (dto.ratePerPiece !== undefined && !(dto.pieces ?? piecesNow)) throw new BadRequestException('Enter how many pieces were bought');
}

export function sumCharges(charges: { amount: number | Prisma.Decimal }[]): Prisma.Decimal {
  return charges.reduce<Prisma.Decimal>((s, c) => s.add(c.amount), new Prisma.Decimal(0));
}

@Injectable()
export class RagService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private costing: CostingService,
    private tenantSequenceService: TenantSequenceService,
  ) {}

  async create(tenantId: string, dto: CreateRagDto, userId: string) {
    let container: any = null;
    // A lot in a container needs Containers; a lot bought loose needs Loose lots (v2 modules).
    await assertModule(this.prisma, tenantId, dto.containerId ? 'CONTAINERS' : 'LOOSE_LOTS');

    if (dto.containerId) {
      // Validate container if provided
      container = await this.prisma.container.findFirst({
        where: { id: dto.containerId, tenantId },
        include: {
          purchaseOrder: {
            select: { id: true, poNumber: true },
          },
          rags: {
            select: { weightKg: true },
          },
        },
      });

      if (!container) {
        throw new BadRequestException('Container not found');
      }

      if (container.status === ContainerStatus.CLOSED) {
        throw new ConflictException('Cannot add rags to a closed container');
      }
    }

    // Validate raw category exists and is active (none picked: the tenant's default)
    const rawCategoryId = dto.rawCategoryId ?? (await defaultRawCategoryId(this.prisma, tenantId));
    const rawCategory = await this.prisma.rawCategory.findFirst({
      where: { id: rawCategoryId, tenantId, isActive: true },
    });

    if (!rawCategory) {
      throw new BadRequestException('Raw category not found or inactive');
    }

    if (container) {
      // Validate total weight doesn't exceed container net weight
      const currentTotalWeight = container.rags.reduce(
        (sum: Prisma.Decimal, rag: { weightKg: Prisma.Decimal }) => sum.add(rag.weightKg),
        new Prisma.Decimal(0),
      );
      const available = new Prisma.Decimal(container.netWeight).sub(currentTotalWeight);
      if (!dto.weightKg) throw new BadRequestException('Enter the lot weight');
      if (new Prisma.Decimal(dto.weightKg).greaterThan(available)) {
        throw new BadRequestException(
          `Weight is more than the container has left (${available.toFixed(2)} kg). Enter ${available.toFixed(2)} or less.`,
        );
      }
    }

    // A lot is numbered LOT-2026-011 (v2 review): "bale" is the pack you sell (B-0101), not what you sort.
    // Older lots keep their BALE-/RAG- numbers, so papers already printed still match.
    const prefix = 'LOT';

    const { code: ragCode } = await this.tenantSequenceService.generateCode(
      tenantId,
      SequenceScope.RAG,
      { prefix, padSize: 3 },
      async (candidate) => {
        const collision = await this.prisma.rag.findFirst({
          where: { tenantId, ragCode: candidate },
          select: { id: true },
        });
        return !collision;
      },
    );

    let vendorId = dto.vendorId ?? container?.vendorId ?? null;
    if (dto.vendorId) {
      const vendor = await this.prisma.vendor.findFirst({ where: { id: dto.vendorId, tenantId }, select: { id: true } });
      if (!vendor) throw new BadRequestException('Supplier not found');
      vendorId = vendor.id;
    }
    const originCountry = container?.originCountry
      ?? (vendorId ? (await this.prisma.vendor.findUnique({ where: { id: vendorId }, select: { originCountry: true } }))?.originCountry : null)
      ?? null;
    if (container && (dto.ratePerKg !== undefined || dto.ratePerPiece !== undefined || dto.pieces !== undefined || dto.charges?.length)) {
      throw new BadRequestException('A container lot takes its cost from the container. Add charges to the container.');
    }
    // A loose lot: the price typed, or kg × rate per kg; its charges (transport, labour…) are part of its cost.
    if (!container) checkPricing(dto);
    // The weight may be left out only for a loose lot bought by the piece: it is then counted in pieces (weight 0).
    if (!dto.weightKg && (container || !dto.pieces)) throw new BadRequestException('Enter the lot weight');
    const weightKg = dto.weightKg ?? 0;
    const purchaseCost = container ? null : lotPrice(weightKg, dto.purchaseCost, dto.ratePerKg, { pieces: dto.pieces, rate: dto.ratePerPiece });
    const charges = container ? [] : (dto.charges ?? []);
    const lotCost = purchaseCost ? purchaseCost.add(sumCharges(charges)) : null;
    const boughtAt = container ? null : lotDate(dto.receivedAt);

    const rag = await this.prisma.$transaction(async (tx) => {
      const created = await tx.rag.create({
        data: {
          tenantId,
          containerId: container?.id ?? null,
          sourceType: container ? RagSourceType.CONTAINER : RagSourceType.LOOSE_BALE,
          ragCode,
          ragBaleType: dto.ragBaleType,
          rawCategoryId,
          vendorId,
          originCountry,
          weightKg,
          purchaseCost,
          // Supplier khata: a loose lot bought from a supplier is owed to them until paid.
          onKhata: !container && !!vendorId,
          ratePerKg: !container && dto.ratePerKg !== undefined ? new Prisma.Decimal(dto.ratePerKg) : null,
          pieces: !container && dto.pieces !== undefined ? dto.pieces : null,
          ratePerPiece: !container && dto.ratePerPiece !== undefined && dto.purchaseCost === undefined ? new Prisma.Decimal(dto.ratePerPiece) : null,
          allocatedCost: lotCost ?? 0,
          ...(charges.length ? { charges: { create: charges.map((c) => ({ tenantId, kind: c.kind, amount: new Prisma.Decimal(c.amount), note: c.note?.trim() || null })) } } : {}),
          notes: dto.notes,
          ...(boughtAt && { createdAt: boughtAt }),
        },
      });
      // A container lot takes its share of the landed cost; the other lots are re-split too.
      if (container) await this.costing.recalculateContainerTx(tx, tenantId, container.id, userId);
      if (!container && dto.paidNow) {
        if (!vendorId) throw new BadRequestException('Pick the supplier you paid');
        await recordSupplierPayment(tx, { tenantId, vendorId, amount: dto.paidNow, method: dto.paidMethod, note: ragCode, userId });
      }
      return tx.rag.findUniqueOrThrow({
        where: { id: created.id },
        include: {
          container: { select: { containerNumber: true } },
          rawCategory: { select: { id: true, name: true, rawType: true } },
          charges: { select: CHARGE_SELECT, orderBy: { createdAt: 'asc' } },
        },
      });
    });

    await this.auditService.log({
      userId,
      tenantId,
      action: 'RAG_CREATED',
      entityType: 'Rag',
      entityId: rag.id,
      metadataJson: {
        ragCode: rag.ragCode,
        containerNumber: container?.containerNumber || null,
        weightKg: dto.weightKg,
      },
    });

    return rag;
  }

  /**
   * Find all rags for a tenant.
   * 
   * Phase 2.5 Domain Rules:
   * - status filter allows filtering by RagStatus (NOT_STARTED, IN_SORTING, SORTED)
   * - sortableOnly = true filters to only NOT_STARTED rags (available for sorting)
   */
  async findAll(
    tenantId: string,
    options?: {
      containerId?: string;
      status?: RagStatus;
      sortableOnly?: boolean;
      page?: number;
      limit?: number;
    },
  ) {
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const skip = (page - 1) * limit;

    // Phase 2.5: Status-based filtering
    // sortableOnly = true filters to only NOT_STARTED rags
    let statusFilter: RagStatus | undefined = options?.status;
    if (options?.sortableOnly) {
      statusFilter = RagStatus.NOT_STARTED;
    }

    const where = {
      tenantId,
      ...(options?.containerId && { containerId: options.containerId }),
      ...(statusFilter && { status: statusFilter }),
    };

    const [data, total] = await Promise.all([
      this.prisma.rag.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          container: {
            select: {
              id: true,
              containerNumber: true,
              purchaseOrder: {
                select: { id: true, poNumber: true },
              },
            },
          },
          rawCategory: {
            select: { id: true, name: true, rawType: true },
          },
        },
      }),
      this.prisma.rag.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findOne(tenantId: string, id: string) {
    const rag = await this.prisma.rag.findFirst({
      where: { id, tenantId },
      include: {
        container: {
          select: {
            id: true,
            containerNumber: true,
            purchaseOrder: {
              select: { id: true, poNumber: true, vendor: true },
            },
          },
        },
        rawCategory: {
          select: { id: true, name: true, rawType: true },
        },
        charges: { select: CHARGE_SELECT, orderBy: { createdAt: 'asc' } },
        // Phase 2.5: One-to-one relation (Rag can only have one SortSession)
        sortSession: {
          select: { id: true, status: true },
        },
      },
    });

    if (!rag) {
      throw new NotFoundException('Rag not found');
    }

    return rag;
  }

  /** Corrects a lot and re-runs costs for everything made from it, in one transaction. */
  async update(tenantId: string, id: string, dto: UpdateRagDto, userId: string) {
    const rag = await this.findOne(tenantId, id);
    const reshapes = dto.weightKg !== undefined || dto.rawCategoryId !== undefined;
    if (reshapes && rag.status !== RagStatus.NOT_STARTED) {
      throw new ConflictException('Weight and type can only change before the lot is sorted');
    }
    if ((dto.purchaseCost !== undefined || dto.ratePerKg !== undefined || dto.ratePerPiece !== undefined || dto.pieces !== undefined || dto.charges !== undefined) && rag.containerId) {
      throw new BadRequestException('A container lot takes its cost from the container. Change the container purchase cost or charges.');
    }
    if (dto.rawCategoryId) {
      const raw = await this.prisma.rawCategory.findFirst({ where: { id: dto.rawCategoryId, tenantId, isActive: true } });
      if (!raw) throw new BadRequestException('Raw category not found or inactive');
    }
    if ((dto.vendorId !== undefined || dto.receivedAt !== undefined) && rag.containerId) {
      throw new BadRequestException('A container lot takes its supplier and date from the container. Edit the container.');
    }
    let vendor: { id: string; originCountry: string | null } | null = null;
    if (dto.vendorId) {
      vendor = await this.prisma.vendor.findFirst({ where: { id: dto.vendorId, tenantId }, select: { id: true, originCountry: true } });
      if (!vendor) throw new BadRequestException('Supplier not found');
    }
    const boughtAt = lotDate(dto.receivedAt);
    if (dto.weightKg !== undefined && rag.containerId) {
      const others = await this.prisma.rag.aggregate({
        where: { containerId: rag.containerId, NOT: { id: rag.id } },
        _sum: { weightKg: true },
      });
      const container = await this.prisma.container.findUniqueOrThrow({ where: { id: rag.containerId }, select: { netWeight: true } });
      const available = container.netWeight.sub(others._sum.weightKg ?? 0);
      if (new Prisma.Decimal(dto.weightKg).greaterThan(available)) {
        throw new BadRequestException(
          `Weight is more than the container has left (${available.toFixed(2)} kg). Enter ${available.toFixed(2)} or less.`,
        );
      }
    }

    // The price: typed, or kg × rate when only the rate (or the kg of a lot priced by rate) changes.
    const kgNow = dto.weightKg ?? Number(rag.weightKg);
    checkPricing(dto, rag.pieces);
    const rate = dto.ratePerKg !== undefined ? dto.ratePerKg : dto.purchaseCost === undefined && dto.ratePerPiece === undefined && rag.ratePerKg !== null && dto.weightKg !== undefined ? Number(rag.ratePerKg) : undefined;
    // By the piece: a new rate, or new pieces for a lot priced by the piece, gives pieces × rate.
    const piecesNow = dto.pieces ?? rag.pieces;
    const pieceRate = dto.ratePerPiece !== undefined ? dto.ratePerPiece : dto.purchaseCost === undefined && dto.ratePerKg === undefined && rag.ratePerPiece !== null && dto.pieces !== undefined ? Number(rag.ratePerPiece) : undefined;
    const newPrice =
      dto.purchaseCost !== undefined || rate !== undefined || pieceRate !== undefined
        ? lotPrice(kgNow, dto.purchaseCost, rate, { pieces: piecesNow, rate: pieceRate })
        : undefined;
    const costChanges = newPrice !== undefined || dto.charges !== undefined;

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.charges !== undefined) {
        await tx.lotCharge.deleteMany({ where: { ragId: id, tenantId } });
        if (dto.charges.length) {
          await tx.lotCharge.createMany({ data: dto.charges.map((c) => ({ tenantId, ragId: id, kind: c.kind, amount: new Prisma.Decimal(c.amount), note: c.note?.trim() || null })) });
        }
      }
      await tx.rag.update({
        where: { id },
        data: {
          ...(dto.rawCategoryId !== undefined && { rawCategoryId: dto.rawCategoryId }),
          ...(dto.weightKg !== undefined && { weightKg: new Prisma.Decimal(dto.weightKg) }),
          ...(newPrice !== undefined && { purchaseCost: newPrice }),
          ...(dto.ratePerKg !== undefined ? { ratePerKg: new Prisma.Decimal(dto.ratePerKg) } : dto.purchaseCost !== undefined || dto.ratePerPiece !== undefined ? { ratePerKg: null } : {}),
          ...(dto.ratePerPiece !== undefined ? { ratePerPiece: new Prisma.Decimal(dto.ratePerPiece) } : dto.purchaseCost !== undefined || dto.ratePerKg !== undefined ? { ratePerPiece: null } : {}),
          ...(dto.pieces !== undefined && { pieces: dto.pieces }),
          ...(dto.notes !== undefined && { notes: dto.notes }),
          ...(vendor && { vendorId: vendor.id, ...(vendor.originCountry ? { originCountry: vendor.originCountry } : {}) }),
          ...(boughtAt && { createdAt: boughtAt }),
        },
      });
      if (dto.weightKg !== undefined || costChanges) {
        await this.costing.recalculateLotChainTx(tx, tenantId, id, userId);
      }
      return tx.rag.findUniqueOrThrow({
        where: { id },
        include: {
          container: { select: { containerNumber: true } },
          rawCategory: { select: { id: true, name: true, rawType: true } },
          charges: { select: CHARGE_SELECT, orderBy: { createdAt: 'asc' } },
        },
      });
    });

    await this.auditService.log({
      userId,
      tenantId,
      action: 'RAG_UPDATED',
      entityType: 'Rag',
      entityId: id,
      metadataJson: { ragCode: rag.ragCode, changes: { ...dto } },
    });
    return updated;
  }

  async delete(tenantId: string, id: string, userId: string) {
    const rag = await this.findOne(tenantId, id);

    // Phase 2.5: Check if rag has been used in sorting (one-to-one relation)
    if (rag.sortSession) {
      throw new ConflictException('Cannot delete rag that has been used in sorting');
    }

    // Phase 2.5: Additional check - only NOT_STARTED rags can be deleted
    if (rag.status !== RagStatus.NOT_STARTED) {
      throw new ConflictException(`Cannot delete rag with status ${rag.status}`);
    }

    const container = rag.container;

    await this.prisma.$transaction(async (tx) => {
      await tx.rag.delete({ where: { id } });
      // The remaining lots share the container's landed cost again.
      if (container) await this.costing.recalculateContainerTx(tx, tenantId, container.id, userId);
    });

    await this.auditService.log({
      userId,
      tenantId,
      action: 'RAG_DELETED',
      entityType: 'Rag',
      entityId: id,
      metadataJson: {
        ragCode: rag.ragCode,
        containerNumber: container?.containerNumber ?? null,
      },
    });

    return { success: true };
  }
}

/** A loose lot's own day from the form: valid and not later than tomorrow (clock differences). */
function lotDate(value?: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new BadRequestException('The date is not valid');
  if (d.getTime() > Date.now() + 36 * 3600 * 1000) throw new BadRequestException('The date cannot be in the future');
  return d;
}
