import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, RagBaleType, RagSourceType, RagStatus } from '@prisma/client';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsString } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';

const ZERO = new Prisma.Decimal(0);

export class MixLotsDto {
  /** The lots to put together: two or more, each waiting to be sorted. */
  @IsArray() @ArrayMinSize(2) @ArrayMaxSize(50) @IsString({ each: true })
  ragIds!: string[];
}

/**
 * Mixing lots for sorting (owner, 2026-11-17: "received two containers or loose lots and mix those for workers
 * to sort"). The mix is a new lot whose weight and cost are those of its lots added up, so sorting, grading,
 * baling and costing work on it as on any lot. Each lot that went in is closed for sorting and keeps its own
 * cost; what the mix gives is shared back to it by weight (./lot-shares.ts). Until sorting starts a mix can be
 * taken apart again.
 */
@Injectable()
export class LotMixService {
  constructor(private readonly prisma: PrismaService) {}

  async mix(tenantId: string, dto: MixLotsDto, userId: string) {
    const ids = [...new Set(dto.ragIds)];
    if (ids.length < 2) throw new BadRequestException({ statusCode: 400, code: 'NEED_TWO', message: 'Pick two or more lots to mix' });
    const mix = await this.prisma.$transaction(async (tx) => {
      const lots = await tx.rag.findMany({ where: { tenantId, id: { in: ids } }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
      if (lots.length !== ids.length) throw new NotFoundException('Lot not found');
      for (const l of lots) {
        if (l.sourceType === RagSourceType.MIXED) throw new BadRequestException({ statusCode: 400, code: 'ALREADY_A_MIX', message: `${l.ragCode} is a mix already. Take it apart first, then mix all the lots together.` });
        if (l.status !== RagStatus.NOT_STARTED) throw new ConflictException({ statusCode: 409, code: 'NOT_WAITING', message: `${l.ragCode} is not waiting to be sorted any more` });
        // The mix is shared back by weight, so every lot needs one.
        if (!l.weightKg.greaterThan(0)) throw new BadRequestException({ statusCode: 400, code: 'NEEDS_WEIGHT', message: `${l.ragCode} has no weight. Lots are mixed by weight: enter its kg first.` });
      }
      // The guard against two people mixing the same lot at once: only lots still waiting are taken.
      const taken = await tx.rag.updateMany({ where: { tenantId, id: { in: ids }, status: RagStatus.NOT_STARTED }, data: { status: RagStatus.MIXED } });
      if (taken.count !== ids.length) throw new ConflictException({ statusCode: 409, code: 'NOT_WAITING', message: 'One of these lots was just taken. Please try again.' });

      const same = <T>(values: T[]): T | null => (values.every((v) => v === values[0]) ? values[0] : null);
      const created = await tx.rag.create({
        data: {
          tenantId,
          ragCode: await this.nextCode(tx, tenantId),
          sourceType: RagSourceType.MIXED,
          status: RagStatus.NOT_STARTED,
          ragBaleType: same(lots.map((l) => l.ragBaleType)) ?? RagBaleType.BOTH,
          // What all its lots share is kept; a mix of two suppliers or raw types has neither.
          rawCategoryId: same(lots.map((l) => l.rawCategoryId)),
          originCountry: same(lots.map((l) => l.originCountry)),
          weightKg: lots.reduce((t, l) => t.add(l.weightKg), ZERO),
          pieces: lots.every((l) => l.pieces) ? lots.reduce((t, l) => t + (l.pieces ?? 0), 0) : null,
          allocatedCost: lots.reduce((t, l) => t.add(l.allocatedCost), ZERO),
        },
      });
      await tx.lotMixSource.createMany({ data: lots.map((l) => ({ tenantId, mixRagId: created.id, sourceRagId: l.id, weightKg: l.weightKg, cost: l.allocatedCost, createdBy: userId })) });
      await tx.auditLog.create({
        data: { tenantId, userId, action: 'LOTS_MIXED', entityType: 'Rag', entityId: created.id, metadataJson: { mix: created.ragCode, lots: lots.map((l) => l.ragCode), kg: created.weightKg.toString() } },
      });
      return created;
    });
    return this.view(tenantId, mix.id);
  }

  /** Takes a mix apart again: only while nobody has started sorting it. Its lots wait to be sorted as before. */
  async unmix(tenantId: string, mixRagId: string, userId: string) {
    await this.prisma.$transaction(async (tx) => {
      const mix = await tx.rag.findFirst({ where: { id: mixRagId, tenantId, sourceType: RagSourceType.MIXED }, include: { mixSources: { select: { sourceRagId: true, source: { select: { ragCode: true } } } } } });
      if (!mix) throw new NotFoundException('Mix not found');
      const gone = await tx.rag.deleteMany({ where: { id: mix.id, tenantId, status: RagStatus.NOT_STARTED } });
      if (gone.count !== 1) throw new ConflictException({ statusCode: 409, code: 'SORTING_STARTED', message: 'Sorting of this mix has started, so it cannot be taken apart' });
      await tx.rag.updateMany({ where: { tenantId, id: { in: mix.mixSources.map((s) => s.sourceRagId) }, status: RagStatus.MIXED }, data: { status: RagStatus.NOT_STARTED } });
      await tx.auditLog.create({
        data: { tenantId, userId, action: 'LOTS_UNMIXED', entityType: 'Rag', entityId: mix.id, metadataJson: { mix: mix.ragCode, lots: mix.mixSources.map((s) => s.source.ragCode) } },
      });
    });
    return { ok: true };
  }

  /** A mix with the lots it was made from and each one's share by weight. */
  async view(tenantId: string, mixRagId: string) {
    const mix = await this.prisma.rag.findFirst({
      where: { id: mixRagId, tenantId, sourceType: RagSourceType.MIXED },
      select: {
        id: true, ragCode: true, status: true, weightKg: true, allocatedCost: true,
        mixSources: {
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          select: { weightKg: true, cost: true, source: { select: { id: true, ragCode: true, vendor: { select: { name: true } }, container: { select: { containerNumber: true, vendor: { select: { name: true } } } } } } },
        },
      },
    });
    if (!mix) throw new NotFoundException('Mix not found');
    return {
      id: mix.id, code: mix.ragCode, status: mix.status, kg: mix.weightKg, cost: mix.allocatedCost,
      sources: mix.mixSources.map((s) => ({
        id: s.source.id, code: s.source.ragCode, container: s.source.container?.containerNumber ?? null,
        supplier: s.source.container?.vendor?.name ?? s.source.vendor?.name ?? null,
        kg: s.weightKg, cost: s.cost,
        sharePercent: mix.weightKg.isZero() ? 0 : s.weightKg.div(mix.weightKg).mul(100).toDecimalPlaces(1).toNumber(),
      })),
    };
  }

  /** MIX-2026-001, MIX-2026-002… per business. */
  private async nextCode(tx: Prisma.TransactionClient, tenantId: string): Promise<string> {
    const year = new Date().getFullYear();
    const count = await tx.rag.count({ where: { tenantId, ragCode: { startsWith: `MIX-${year}-` } } });
    for (let seq = count + 1; seq <= count + 20; seq++) {
      const code = `MIX-${year}-${String(seq).padStart(3, '0')}`;
      if (!(await tx.rag.findFirst({ where: { tenantId, ragCode: code }, select: { id: true } }))) return code;
    }
    throw new ConflictException('Could not number the mix');
  }
}
