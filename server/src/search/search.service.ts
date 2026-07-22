import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface GlobalSearchResultItem {
  id: string;
  title: string;
  subtitle: string;
  route: string;
  group: string;
  type: string;
  icon: string;
}

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async searchGlobal(tenantId: string, query: string): Promise<GlobalSearchResultItem[]> {
    const q = query?.trim();
    if (!q || q.length < 2) return [];

    const results: GlobalSearchResultItem[] = [];

    // Parallel queries across Prisma entities
    const [pos, containers, sortSessions, gradeSessions, sales, customers, repackUnits] = await Promise.all([
      // 1. Purchase Orders
      this.prisma.purchaseOrder
        .findMany({
          where: {
            tenantId,
            OR: [
              { poNumber: { contains: q, mode: 'insensitive' } },
              { vendor: { name: { contains: q, mode: 'insensitive' } } },
            ],
          },
          take: 5,
          include: { vendor: true },
        })
        .catch(() => []),

      // 2. Containers
      this.prisma.container
        .findMany({
          where: {
            tenantId,
            OR: [
              { containerNumber: { contains: q, mode: 'insensitive' } },
              { shippingLine: { contains: q, mode: 'insensitive' } },
            ],
          },
          take: 5,
        })
        .catch(() => []),

      // 3. Stage 1 Sort Sessions
      this.prisma.sortSession
        .findMany({
          where: {
            tenantId,
            OR: [
              { id: { contains: q, mode: 'insensitive' } },
            ],
          },
          take: 5,
        })
        .catch(() => []),

      // 4. Stage 2 Grade Sessions
      this.prisma.gradeSession
        .findMany({
          where: {
            tenantId,
            OR: [
              { id: { contains: q, mode: 'insensitive' } },
            ],
          },
          take: 5,
        })
        .catch(() => []),

      // 5. Sales Orders
      this.prisma.sale
        .findMany({
          where: {
            tenantId,
            OR: [
              { saleNumber: { contains: q, mode: 'insensitive' } },
              { customer: { name: { contains: q, mode: 'insensitive' } } },
            ],
          },
          take: 5,
          include: { customer: true },
        })
        .catch(() => []),

      // 6. Customers
      this.prisma.customer
        .findMany({
          where: {
            tenantId,
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { companyName: { contains: q, mode: 'insensitive' } },
              { contactEmail: { contains: q, mode: 'insensitive' } },
            ],
          },
          take: 5,
        })
        .catch(() => []),

      // 7. Repack Units
      this.prisma.repackUnit
        .findMany({
          where: {
            tenantId,
            OR: [
              { unitCode: { contains: q, mode: 'insensitive' } },
              { category: { name: { contains: q, mode: 'insensitive' } } },
            ],
          },
          take: 5,
          include: { category: true },
        })
        .catch(() => []),
    ]);

    // Map Purchase Orders
    for (const po of pos) {
      results.push({
        id: `po-${po.id}`,
        title: `Purchase Order #${po.poNumber}`,
        subtitle: `Vendor: ${po.vendor?.name || 'Standard Vendor'} | Type: ${po.poType} | Status: ${po.status}`,
        route: '/app/procurement/pos',
        group: 'Purchase Orders',
        type: 'Procurement',
        icon: 'Truck',
      });
    }

    // Map Containers
    for (const c of containers) {
      results.push({
        id: `cont-${c.id}`,
        title: `Container #${c.containerNumber}`,
        subtitle: `Shipping Line: ${c.shippingLine || 'Direct Fleet'} | Net Weight: ${c.netWeight || 0} KG | Status: ${c.status}`,
        route: '/app/procurement/containers',
        group: 'Containers',
        type: 'Procurement',
        icon: 'Package',
      });
    }

    // Map Sort Sessions
    for (const s of sortSessions) {
      results.push({
        id: `sort-${s.id}`,
        title: `Stage 1 Sorting Session #${s.id.substring(0, 8).toUpperCase()}`,
        subtitle: `Status: ${s.sortStatus} | Created: ${new Date(s.createdAt).toISOString().slice(0, 10)}`,
        route: '/app/sorting/stage-1',
        group: 'Sorting Sessions',
        type: 'Operations',
        icon: 'Layers',
      });
    }

    // Map Grade Sessions
    for (const g of gradeSessions) {
      results.push({
        id: `grade-${g.id}`,
        title: `Stage 2 Grading Session #${g.id.substring(0, 8).toUpperCase()}`,
        subtitle: `Status: ${g.gradeStatus} | Created: ${new Date(g.createdAt).toISOString().slice(0, 10)}`,
        route: '/app/sorting/stage-2',
        group: 'Grading Sessions',
        type: 'Operations',
        icon: 'Tag',
      });
    }

    // Map Sales Orders
    for (const s of sales) {
      results.push({
        id: `sale-${s.id}`,
        title: `Sales Order #${s.saleNumber}`,
        subtitle: `Customer: ${s.customer?.name || 'Walk-in Buyer'} | Revenue: $${Number(s.totalAmount || 0).toLocaleString()} | Status: ${s.status}`,
        route: '/app/sales',
        group: 'Sales Orders',
        type: 'Sales',
        icon: 'ShoppingBag',
      });
    }

    // Map Customers
    for (const cust of customers) {
      results.push({
        id: `cust-${cust.id}`,
        title: `Customer: ${cust.name}`,
        subtitle: `Company: ${cust.companyName || cust.name} | Phone: ${cust.contactPhone || 'N/A'}`,
        route: '/app/sales/customers',
        group: 'Sales',
        type: 'Sales',
        icon: 'Users',
      });
    }

    // Map Repack Units
    for (const unit of repackUnits) {
      results.push({
        id: `repack-${unit.id}`,
        title: `Repack Unit SKU: ${unit.unitCode || unit.id.substring(0, 8).toUpperCase()}`,
        subtitle: `Category: ${unit.category?.name || 'General'} | Weight: ${unit.weightKg || 0} KG | Status: ${unit.status}`,
        route: '/app/packaging/repack',
        group: 'Repack Units',
        type: 'Inventory',
        icon: 'Package',
      });
    }

    return results;
  }
}
