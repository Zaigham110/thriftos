import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, StockUnit } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';

export class PriceEntryDto {
  @IsString() @MinLength(1) @MaxLength(40) group!: string;
  @IsString() categoryId!: string;
  @IsOptional() @IsString() gradeId?: string | null;
  @IsEnum(StockUnit) unit!: StockUnit;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) price!: number;
}

export class PriceGroupDto {
  /** null or empty removes the customer from any price list. */
  @ValidateIf((o: PriceGroupDto) => o.group !== null && o.group !== '')
  @IsString()
  @MaxLength(40)
  group!: string | null;
}

/** A group's new name. */
export class PriceGroupRenameDto {
  @IsString() @MinLength(1) @MaxLength(40) name!: string;
}

/** The group's price for a category (exact grade first, then "any grade"), or null. */
export async function priceListPrice(db: PrismaService | Prisma.TransactionClient, tenantId: string, group: string | null, item: { categoryId: string | null; gradeId: string | null }, unit: StockUnit) {
  if (!group || !item.categoryId) return null;
  const entries = await db.priceListEntry.findMany({ where: { tenantId, group, categoryId: item.categoryId, unit, OR: [{ gradeId: item.gradeId ?? undefined }, { gradeId: null }] } });
  return entries.find((e) => item.gradeId && e.gradeId === item.gradeId) ?? entries.find((e) => e.gradeId === null) ?? null;
}

/**
 * Price lists by customer group (enterprise plan E3.4): e.g. "Wholesale" pays Rs 180/kg for Jeans A. The sale
 * screen suggests the customer's group price first, then the item's own price, then their last price, then anyone's.
 */
@Injectable()
export class PriceListsService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(tenantId: string) {
    const [entries, customers, categories, grades, people] = await Promise.all([
      this.prisma.priceListEntry.findMany({ where: { tenantId }, orderBy: [{ group: 'asc' }, { createdAt: 'asc' }] }),
      this.prisma.customer.groupBy({ by: ['priceGroup'], where: { tenantId, priceGroup: { not: null } }, _count: { _all: true } }),
      this.prisma.category.findMany({ where: { tenantId }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
      this.prisma.grade.findMany({ where: { tenantId, isActive: true }, select: { id: true, name: true }, orderBy: { rank: 'asc' } }),
      // Who is in which group, and who could be added (v2 review: the page only showed a count).
      this.prisma.customer.findMany({ where: { tenantId }, select: { id: true, name: true, city: true, priceGroup: true }, orderBy: { name: 'asc' } }),
    ]);
    const cat = new Map(categories.map((c) => [c.id, c.name]));
    const gr = new Map(grades.map((g) => [g.id, g.name]));
    const counts = new Map(customers.map((c) => [c.priceGroup!, c._count._all]));
    const groups = [...new Set([...entries.map((e) => e.group), ...counts.keys()])].sort();
    return {
      groups: groups.map((g) => ({ name: g, customers: counts.get(g) ?? 0, prices: entries.filter((e) => e.group === g).length })),
      entries: entries.map((e) => ({ id: e.id, group: e.group, categoryId: e.categoryId, category: cat.get(e.categoryId) ?? '', gradeId: e.gradeId, grade: e.gradeId ? gr.get(e.gradeId) ?? '' : null, unit: e.unit, price: e.price, updatedAt: e.updatedAt })),
      categories,
      grades,
      customers: people.map((c) => ({ id: c.id, name: c.name, city: c.city, group: c.priceGroup })),
    };
  }

  /** Sets a group's price for a category / grade / unit (one price per combination). */
  async setPrice(tenantId: string, dto: PriceEntryDto, userId: string) {
    const group = dto.group.trim();
    const gradeId = dto.gradeId || null;
    const [category, grade] = await Promise.all([
      this.prisma.category.findFirst({ where: { id: dto.categoryId, tenantId }, select: { id: true } }),
      gradeId ? this.prisma.grade.findFirst({ where: { id: gradeId, tenantId }, select: { id: true } }) : Promise.resolve({ id: null }),
    ]);
    if (!category) throw new NotFoundException('Category not found');
    if (!grade) throw new NotFoundException('Grade not found');
    if (!group) throw new BadRequestException('Name the group');
    const price = new Prisma.Decimal(dto.price);
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.priceListEntry.findFirst({ where: { tenantId, group, categoryId: dto.categoryId, gradeId, unit: dto.unit } });
      const e = existing
        ? await tx.priceListEntry.update({ where: { id: existing.id }, data: { price, updatedBy: userId } })
        : await tx.priceListEntry.create({ data: { tenantId, group, categoryId: dto.categoryId, gradeId, unit: dto.unit, price, updatedBy: userId } });
      await tx.auditLog.create({ data: { tenantId, userId, action: 'PRICE_LIST_SET', entityType: 'PriceListEntry', entityId: e.id, metadataJson: { group, categoryId: dto.categoryId, gradeId, unit: dto.unit, from: existing?.price.toString() ?? null, to: price.toString() } } });
      return e;
    });
  }

  async removePrice(tenantId: string, id: string, userId: string) {
    const e = await this.prisma.priceListEntry.findFirst({ where: { id, tenantId } });
    if (!e) throw new NotFoundException('Price not found');
    await this.prisma.$transaction([
      this.prisma.priceListEntry.delete({ where: { id } }),
      this.prisma.auditLog.create({ data: { tenantId, userId, action: 'PRICE_LIST_REMOVED', entityType: 'PriceListEntry', entityId: id, metadataJson: { group: e.group, price: e.price.toString() } } }),
    ]);
    return { id, removed: true };
  }

  async setCustomerGroup(tenantId: string, customerId: string, dto: PriceGroupDto, userId: string) {
    const c = await this.prisma.customer.findFirst({ where: { id: customerId, tenantId }, select: { id: true, priceGroup: true } });
    if (!c) throw new NotFoundException('Customer not found');
    const group = dto.group?.trim() || null;
    await this.prisma.$transaction([
      this.prisma.customer.update({ where: { id: c.id }, data: { priceGroup: group } }),
      this.prisma.auditLog.create({ data: { tenantId, userId, action: 'PRICE_GROUP_CHANGED', entityType: 'Customer', entityId: c.id, metadataJson: { from: c.priceGroup, to: group } } }),
    ]);
    return { id: c.id, priceGroup: group };
  }

  /** A group's new name: its prices and its customers move with it. The new name must not be another group's. */
  async renameGroup(tenantId: string, from: string, dto: PriceGroupRenameDto, userId: string) {
    const to = dto.name.trim();
    if (!to) throw new BadRequestException('Name the group');
    if (to === from) return { name: to };
    const [exists, taken] = await Promise.all([this.groupExists(tenantId, from), this.groupExists(tenantId, to)]);
    if (!exists) throw new NotFoundException('Group not found');
    if (taken) throw new ConflictException('There is already a group with that name');
    await this.prisma.$transaction([
      this.prisma.priceListEntry.updateMany({ where: { tenantId, group: from }, data: { group: to } }),
      this.prisma.customer.updateMany({ where: { tenantId, priceGroup: from }, data: { priceGroup: to } }),
      this.prisma.auditLog.create({ data: { tenantId, userId, action: 'PRICE_GROUP_RENAMED', entityType: 'PriceGroup', entityId: to, metadataJson: { from, to } } }),
    ]);
    return { name: to };
  }

  /** Removes a group: its prices go and its customers are in no group (their own prices and old sales stay). */
  async removeGroup(tenantId: string, name: string, userId: string) {
    if (!(await this.groupExists(tenantId, name))) throw new NotFoundException('Group not found');
    const [prices, customers] = await this.prisma.$transaction([
      this.prisma.priceListEntry.deleteMany({ where: { tenantId, group: name } }),
      this.prisma.customer.updateMany({ where: { tenantId, priceGroup: name }, data: { priceGroup: null } }),
      this.prisma.auditLog.create({ data: { tenantId, userId, action: 'PRICE_GROUP_REMOVED', entityType: 'PriceGroup', entityId: name, metadataJson: { name } } }),
    ]);
    return { name, removed: true, prices: prices.count, customers: customers.count };
  }

  private async groupExists(tenantId: string, name: string): Promise<boolean> {
    const [entry, customer] = await Promise.all([
      this.prisma.priceListEntry.findFirst({ where: { tenantId, group: name }, select: { id: true } }),
      this.prisma.customer.findFirst({ where: { tenantId, priceGroup: name }, select: { id: true } }),
    ]);
    return !!entry || !!customer;
  }
}
