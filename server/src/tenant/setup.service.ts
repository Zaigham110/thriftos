import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { toE164 } from '../common/phone/phone';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { TenantSetupDto } from './dto/setup.dto';
import { DEFAULT_GRADES, DEFAULT_WASTE, KARACHI_CATEGORIES } from './setup-template';
import { TenantService } from './tenant.service';

const FLOOR_MODULES = ['RECEIVE', 'SORT', 'STOCK', 'SELL', 'KHATA'];

/** Trimmed, non-empty, first spelling of each name kept (case-insensitive). */
export function cleanNames(names: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of names) {
    const name = raw.trim().replace(/\s+/g, ' ');
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    out.push(name);
  }
  return out;
}

/** Modules for a business: no sorting → no Chhantai tab; extra modules the tenant had stay. */
export function modulesFor(sortingStages: number, current: string[]): string[] {
  const floor = sortingStages === 0 ? FLOOR_MODULES.filter((m) => m !== 'SORT') : FLOOR_MODULES;
  return [...floor, ...current.filter((m) => !FLOOR_MODULES.includes(m))];
}

/**
 * Journey 8 — the setup wizard, saved in one step: business name, currency, language, whether and how the
 * business sorts, its categories (from the Karachi list) and grade names, the Waste/Katran type, and an
 * optional munshi (phone + PIN). Everything stays editable later.
 */
@Injectable()
export class SetupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenants: TenantService,
    private readonly users: UsersService,
    private readonly audit: AuditService,
  ) {}

  /** What the wizard starts from: the tenant's own choices once set up, else the Karachi template. */
  async defaults(tenantId: string) {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    const done = !!tenant.setupCompletedAt;
    const [categories, grades] = done
      ? await Promise.all([
          this.prisma.category.findMany({ where: { tenantId, isActive: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }], select: { name: true } }),
          this.prisma.grade.findMany({ where: { tenantId, isActive: true }, orderBy: { rank: 'asc' }, select: { name: true } }),
        ])
      : [[], []];
    return {
      done,
      businessName: tenant.name,
      currency: tenant.currency,
      language: tenant.defaultLanguage,
      sortingStages: tenant.sortingStages,
      categories: done ? categories.map((c) => c.name) : KARACHI_CATEGORIES,
      grades: done ? grades.map((g) => g.name) : DEFAULT_GRADES,
      template: { categories: KARACHI_CATEGORIES, grades: DEFAULT_GRADES },
    };
  }

  async save(tenantId: string, dto: TenantSetupDto, userId: string) {
    const categories = cleanNames(dto.categories);
    const grades = cleanNames(dto.grades);
    if (dto.sortingStages >= 1 && !categories.length) throw new BadRequestException('Keep at least one category, or choose "No, I sell as bought".');
    if (dto.sortingStages === 2 && !grades.length) throw new BadRequestException('Add at least one grade name.');

    const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    if (dto.currency !== tenant.currency && (await this.tenants.isCurrencyLocked(tenantId))) {
      throw new BadRequestException('The currency cannot change after money has been recorded.');
    }
    const phone = dto.munshi ? toE164(dto.munshi.phone) : null;
    if (dto.munshi && !phone) throw new BadRequestException('Enter a valid phone number for the munshi, e.g. 0300 1234567');
    if (phone && (await this.prisma.user.findUnique({ where: { phone }, select: { id: true } }))) {
      throw new ConflictException("The munshi's phone already has a login");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.tenant.update({
        where: { id: tenantId },
        data: {
          name: dto.businessName.trim(),
          currency: dto.currency,
          defaultLanguage: dto.language,
          sortingStages: dto.sortingStages,
          enabledModules: modulesFor(dto.sortingStages, tenant.enabledModules),
          setupCompletedAt: new Date(),
        },
      });
      await this.keepOnly(tx, tenantId, 'category', categories);
      if (dto.sortingStages === 2) await this.keepOnly(tx, tenantId, 'grade', grades);
      await tx.wasteCategory.upsert({
        where: { tenantId_name: { tenantId, name: DEFAULT_WASTE } },
        update: { isActive: true },
        create: { tenantId, name: DEFAULT_WASTE, unitType: 'KG', defaultResalePrice: 0 },
      });
    });
    const munshi = dto.munshi ? await this.users.createMunshi(tenantId, dto.munshi, userId) : null;
    await this.audit.log({
      tenantId,
      userId,
      action: 'TENANT_SETUP_DONE',
      entityType: 'Tenant',
      entityId: tenantId,
      metadataJson: { sortingStages: dto.sortingStages, categories: categories.length, grades: grades.length, munshi: !!munshi },
    });
    return { ...(await this.defaults(tenantId)), munshi };
  }

  /** The chosen names are active, in this order (created if new); the tenant's others are switched off, never deleted. */
  private async keepOnly(tx: Prisma.TransactionClient, tenantId: string, kind: 'category' | 'grade', names: string[]) {
    const existing: { id: string; name: string }[] =
      kind === 'category'
        ? await tx.category.findMany({ where: { tenantId }, select: { id: true, name: true } })
        : await tx.grade.findMany({ where: { tenantId }, select: { id: true, name: true } });
    const byName = new Map(existing.map((e) => [e.name.toLowerCase(), e]));
    const kept = new Set<string>();
    for (const [i, name] of names.entries()) {
      const found = byName.get(name.toLowerCase());
      if (kind === 'category') {
        const row = found
          ? await tx.category.update({ where: { id: found.id }, data: { isActive: true, sortOrder: i, name } })
          : await tx.category.create({ data: { tenantId, name, sortOrder: i } });
        kept.add(row.id);
      } else {
        const row = found
          ? await tx.grade.update({ where: { id: found.id }, data: { isActive: true, rank: i + 1, name } })
          : await tx.grade.create({ data: { tenantId, name, rank: i + 1 } });
        kept.add(row.id);
      }
    }
    const off = existing.filter((e) => !kept.has(e.id)).map((e) => e.id);
    if (!off.length) return;
    if (kind === 'category') await tx.category.updateMany({ where: { tenantId, id: { in: off } }, data: { isActive: false } });
    else await tx.grade.updateMany({ where: { tenantId, id: { in: off } }, data: { isActive: false } });
  }
}
