import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SEE_SALES } from '../sales/sales-access';

export interface GlobalSearchResultItem {
  id: string;
  title: string;
  subtitle: string;
  route: string;
  /** containers | lots | stock | customers | suppliers | sales | payments */
  group: string;
  type: string;
  icon: string;
}

const PER_GROUP = 5;

/** Search finds only what the person may open: each group needs one of the permissions its list needs (audit H1). */
export const SEARCH_GROUP_PERMISSIONS: Record<string, readonly string[]> = {
  containers: ['container.read'],
  lots: ['rag.read', 'SORTING_STAGE1_VIEW'],
  stock: ['INVENTORY_VIEW'],
  customers: SEE_SALES,
  suppliers: ['vendor.read'],
  sales: SEE_SALES,
  payments: SEE_SALES,
};

/**
 * Search across a business's records (enterprise plan E2.5) for Ctrl/⌘ K: containers, lots, bales and stock,
 * customers (name, WhatsApp number, city), suppliers, sales and payments. Routes are the v1 screens.
 */
@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async searchGlobal(tenantId: string, query: string, user: { userId: string; isSuperAdmin: boolean }): Promise<GlobalSearchResultItem[]> {
    const q = query?.trim();
    if (!q || q.length < 2 || q.length > 100) return [];
    const held = user.isSuperAdmin
      ? null
      : new Set((await this.prisma.rolePermission.findMany({ where: { role: { userRoles: { some: { userId: user.userId } } } }, select: { permission: { select: { code: true } } } })).map((r) => r.permission.code));
    /** Runs a group's query only for someone who may open that group. */
    const may = <T>(group: string, find: () => Promise<T[]>): Promise<T[]> =>
      !held || SEARCH_GROUP_PERMISSIONS[group].some((p) => held.has(p)) ? find() : Promise.resolve([]);
    const has = { contains: q, mode: 'insensitive' as const };
    const digits = q.replace(/\D/g, '');

    const [containers, lots, stock, customers, suppliers, sales, payments] = await Promise.all([
      may('containers', () => this.prisma.container.findMany({
        where: { tenantId, OR: [{ containerNumber: has }, { vendor: { name: has } }] },
        select: { id: true, containerNumber: true, createdAt: true, vendor: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: PER_GROUP,
      })),
      may('lots', () => this.prisma.rag.findMany({
        where: { tenantId, ragCode: has },
        select: { id: true, ragCode: true, container: { select: { containerNumber: true } } },
        orderBy: { createdAt: 'desc' },
        take: PER_GROUP,
      })),
      may('stock', () => this.prisma.inventoryItem.findMany({
        where: { tenantId, OR: [{ repackUnit: { unitCode: has } }, { name: has }] },
        select: { id: true, name: true, status: true, repackUnit: { select: { unitCode: true } }, category: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: PER_GROUP,
      })),
      may('customers', () => this.prisma.customer.findMany({
        where: { tenantId, OR: [{ name: has }, { city: has }, ...(digits.length >= 4 ? [{ phone: { contains: digits } }] : [])] },
        select: { id: true, name: true, city: true, phone: true },
        orderBy: { name: 'asc' },
        take: PER_GROUP,
      })),
      may('suppliers', () => this.prisma.vendor.findMany({
        where: { tenantId, name: has },
        select: { id: true, name: true, originCountry: true },
        orderBy: { name: 'asc' },
        take: PER_GROUP,
      })),
      may('sales', () => this.prisma.sale.findMany({
        where: { tenantId, status: { not: 'DRAFT' }, OR: [{ saleNumber: has }, { customer: { name: has } }] },
        select: { id: true, saleNumber: true, totalAmount: true, status: true, customer: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: PER_GROUP,
      })),
      may('payments', () => this.prisma.payment.findMany({
        where: { tenantId, reference: has },
        select: { id: true, reference: true, amount: true, customerId: true, customer: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: PER_GROUP,
      })),
    ]);

    return [
      ...containers.map((c) => ({ id: c.id, title: c.containerNumber, subtitle: c.vendor?.name ?? '', route: `/receive/records/containers/${c.id}`, group: 'containers', type: 'container', icon: 'truck' })),
      ...lots.map((l) => ({ id: l.id, title: l.ragCode, subtitle: l.container?.containerNumber ?? '', route: `/sort/records/${l.id}`, group: 'lots', type: 'lot', icon: 'boxes' })),
      ...stock.map((s) => ({ id: s.id, title: s.repackUnit?.unitCode ?? s.name ?? '', subtitle: [s.category?.name, s.status].filter(Boolean).join(' · '), route: `/stock/items/${s.id}`, group: 'stock', type: 'stockItem', icon: 'package' })),
      ...customers.map((c) => ({ id: c.id, title: c.name, subtitle: [c.city, c.phone].filter(Boolean).join(' · '), route: `/khata/records/${c.id}`, group: 'customers', type: 'customer', icon: 'book' })),
      ...suppliers.map((v) => ({ id: v.id, title: v.name, subtitle: v.originCountry ?? '', route: '/settings/admin/vendors', group: 'suppliers', type: 'supplier', icon: 'truck' })),
      ...sales.map((s) => ({ id: s.id, title: s.saleNumber, subtitle: `${s.customer.name} · Rs ${s.totalAmount.toString()}`, route: `/sell/records/${s.id}`, group: 'sales', type: 'sale', icon: 'cart' })),
      ...payments.map((p) => ({ id: p.id, title: p.reference ?? '', subtitle: `${p.customer?.name ?? ''} · Rs ${p.amount.toString()}`, route: p.customerId ? `/khata/records/${p.customerId}` : '/khata/records', group: 'payments', type: 'payment', icon: 'coins' })),
    ];
  }
}
