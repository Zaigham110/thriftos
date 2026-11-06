import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TenantBootstrapService, BootstrapResult } from './tenant-bootstrap.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { TenantResponseDto, TenantListResponseDto } from './dto/tenant-response.dto';
import { Prisma, TenantStatus } from '@prisma/client';
import { SYSTEM_COMPANY_CODE } from '../common/guards/module.guard';
import { getCurrencyMeta, isSupportedCurrencyCode } from '../common/currency/currency';
import { Decimal } from '@prisma/client/runtime/library';

// In-Memory SuperAdmin Settings & Plans State (Persistent across sessions)
const PLANS_CATALOG = [
  {
    id: 'plan_enterprise',
    name: 'Enterprise ERP Suite',
    code: 'ENTERPRISE_FULL',
    monthlyPrice: 499,
    annualPrice: 4990,
    maxUsers: 50,
    maxWarehouses: 10,
    maxContainersPerMonth: 500,
    features: ['Full Landed Cost Engine', 'Mixed-Source Repack v2', 'Touch Mobile Mode', 'API Webhooks & Export'],
    activeTenantsCount: 4,
    status: 'ACTIVE',
  },
  {
    id: 'plan_pro',
    name: 'Sorting & Repack Pro',
    code: 'STANDALONE_SORTING',
    monthlyPrice: 299,
    annualPrice: 2990,
    maxUsers: 15,
    maxWarehouses: 3,
    maxContainersPerMonth: 150,
    features: ['Stage 1 & 2 Sorting', 'Scanner Workstation', 'Touch Mobile Mode', 'Valuation Reports'],
    activeTenantsCount: 2,
    status: 'ACTIVE',
  },
  {
    id: 'plan_standard',
    name: 'Standard Inventory',
    code: 'LIGHT_COMMERCE',
    monthlyPrice: 149,
    annualPrice: 1490,
    maxUsers: 5,
    maxWarehouses: 1,
    maxContainersPerMonth: 50,
    features: ['Basic Inventory', 'Stock Movements', 'Sales Orders'],
    activeTenantsCount: 1,
    status: 'ACTIVE',
  },
  {
    id: 'plan_trial',
    name: 'Starter Free Trial',
    code: 'STARTER',
    monthlyPrice: 0,
    annualPrice: 0,
    maxUsers: 2,
    maxWarehouses: 1,
    maxContainersPerMonth: 10,
    features: ['14-Day Full Access', 'Standard Categories'],
    activeTenantsCount: 1,
    status: 'ACTIVE',
  },
];

/** Background events the audit trail hides unless asked: token refreshes and console page views. */
const AUDIT_NOISE = ['AUTH_TOKEN_REFRESH', 'SUPER_ADMIN_ROUTE_ACCESS'];

let SYSTEM_SETTINGS = {
  platformName: 'ThriftOS Enterprise Multi-Tenant Platform',
  supportEmail: 'support@thriftos.com',
  companyLegalName: 'ThriftOS Recycling Technologies LLC',
  sessionTimeoutMinutes: 60,
  require2FAForAdmins: true,
  auditLogRetentionDays: 365,
  databaseBackupFrequency: 'DAILY_AUTOMATED',
  maintenanceMode: false,
  allowedCurrencies: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'AED', 'PKR'],
};

@Injectable()
export class SuperAdminService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private bootstrapService: TenantBootstrapService,
  ) {}

  async createTenant(
    dto: CreateTenantDto,
    userId: string,
  ): Promise<TenantResponseDto & { bootstrap: BootstrapResult }> {
    const existing = await this.prisma.tenant.findUnique({
      where: { companyCode: dto.companyCode },
    });

    if (existing) {
      throw new BadRequestException(`Company code "${dto.companyCode}" already exists`);
    }

    const desiredCurrency = dto.currencyCode || dto.currency || 'PKR';
    if (!isSupportedCurrencyCode(desiredCurrency)) {
      throw new BadRequestException(`Unsupported currency code: ${desiredCurrency}`);
    }

    const tenant = await this.prisma.tenant.create({
      data: {
        name: dto.name,
        companyCode: dto.companyCode,
        currency: desiredCurrency,
        locale: dto.locale || 'ur-PK',
        status: dto.status || TenantStatus.ACTIVE,
      },
    });

    const bootstrap = await this.bootstrapService.bootstrapTenant(
      tenant.id,
      dto.adminEmail,
      dto.adminName,
      dto.adminPassword,
    );

    try {
      await this.auditService.log({
        userId,
        tenantId: tenant.id,
        action: 'TENANT_CREATED',
        entityType: 'Tenant',
        entityId: tenant.id,
        metadataJson: {
          tenantName: tenant.name,
          companyCode: tenant.companyCode,
          bootstrapResult: {
            roles: bootstrap.roles,
            categories: bootstrap.categories,
            grades: bootstrap.grades,
            warehouses: bootstrap.warehouses,
          },
        },
      });
    } catch (auditError) {
      console.error('Failed to log audit for tenant creation:', auditError);
    }

    const currencyMeta = getCurrencyMeta(tenant.currency);

    return {
      ...tenant,
      currencyCode: tenant.currency,
      currency: currencyMeta,
      bootstrap,
    };
  }

  async findAll(
    page: number = 1,
    limit: number = 20,
    status?: TenantStatus,
  ): Promise<TenantListResponseDto> {
    const skip = (page - 1) * limit;

    // The platform's own account (SYSTEM) is not a business: it is not listed.
    const where: Prisma.TenantWhereInput = { companyCode: { not: SYSTEM_COMPANY_CODE }, ...(status ? { status } : {}) };

    const [data, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              users: true,
              roles: true,
              categories: true,
              grades: true,
              warehouses: true,
            },
          },
        },
      }),
      this.prisma.tenant.count({ where }),
    ]);

    const mapped = data.map((t) => {
      const currencyMeta = getCurrencyMeta(t.currency);
      return {
        ...t,
        currencyCode: t.currency,
        currency: currencyMeta,
      };
    });

    return {
      data: mapped,
      total,
      page,
      limit,
    };
  }

  async findOne(id: string): Promise<TenantResponseDto & { users: any[]; auditLogs: any[] }> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        users: {
          orderBy: { createdAt: 'desc' },
          include: {
            userRoles: {
              include: {
                role: { select: { name: true } },
              },
            },
          },
        },
        _count: {
          select: {
            users: true,
            roles: true,
            categories: true,
            grades: true,
            warehouses: true,
            containers: true,
            sales: true,
            customers: true,
          },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant with ID "${id}" not found`);
    }

    const auditLogs = await this.prisma.auditLog.findMany({
      where: { tenantId: id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const userIds = [...new Set(auditLogs.map((l) => l.userId).filter((uid): uid is string => !!uid))];
    const auditUsers = userIds.length > 0
      ? await this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } })
      : [];
    const userMap = new Map<string, string>(auditUsers.map((u) => [u.id, u.name || u.email] as const));

    const mappedUsers = tenant.users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      hasPin: !!u.pinHash,
      pinLocked: !!u.pinLockedUntil && u.pinLockedUntil > new Date(),
      isActive: u.isActive,
      createdAt: u.createdAt,
      roles: u.userRoles.map((ur) => ur.role.name),
    }));

    const mappedLogs = auditLogs.map((l) => ({
      id: l.id,
      action: l.action,
      entityType: l.entityType,
      entityId: l.entityId,
      userName: l.userId ? (userMap.get(l.userId) || 'User ' + l.userId.slice(0, 8)) : 'System',
      createdAt: l.createdAt,
      ipAddress: l.ipAddress,
    }));

    const currencyMeta = getCurrencyMeta(tenant.currency);
    const { users: _users, ...rest } = tenant;
    void _users;
    return {
      ...rest,
      currencyCode: tenant.currency,
      currency: currencyMeta,
      users: mappedUsers,
      auditLogs: mappedLogs,
    };
  }

  async update(id: string, dto: UpdateTenantDto, userId: string): Promise<TenantResponseDto> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant with ID "${id}" not found`);
    }

    const desiredCurrency = dto.currencyCode || dto.currency;
    if (desiredCurrency && !isSupportedCurrencyCode(desiredCurrency)) {
      throw new BadRequestException(`Unsupported currency code: ${desiredCurrency}`);
    }

    const updateData: any = {
      ...dto,
      ...(dto.currencyCode ? { currency: dto.currencyCode } : {}),
    };
    delete updateData.currencyCode;

    const updated = await this.prisma.tenant.update({
      where: { id },
      data: updateData,
      include: {
        _count: {
          select: {
            users: true,
            roles: true,
            categories: true,
            grades: true,
            warehouses: true,
          },
        },
      },
    });

    await this.auditService.log({
      userId,
      tenantId: id,
      action: 'TENANT_UPDATED',
      entityType: 'Tenant',
      entityId: id,
      metadataJson: {
        changes: updateData,
        previousStatus: tenant.status,
        newStatus: updated.status,
      },
    });

    const currencyMeta = getCurrencyMeta(updated.currency);
    return {
      ...updated,
      currencyCode: updated.currency,
      currency: currencyMeta,
    };
  }

  async deactivate(id: string, userId: string): Promise<TenantResponseDto> {
    return this.update(id, { status: TenantStatus.INACTIVE }, userId);
  }

  async activate(id: string, userId: string): Promise<TenantResponseDto> {
    return this.update(id, { status: TenantStatus.ACTIVE }, userId);
  }

  async getPlatformSummary() {
    const [
      totalTenants,
      activeTenants,
      inactiveTenants,
      totalUsers,
      activeUsers,
      containerWeightAgg,
      salesRevenueAgg,
      recentTenants,
      recentLogs,
    ] = await Promise.all([
      this.prisma.tenant.count({ where: { companyCode: { not: SYSTEM_COMPANY_CODE } } }),
      this.prisma.tenant.count({ where: { status: 'ACTIVE', companyCode: { not: SYSTEM_COMPANY_CODE } } }),
      this.prisma.tenant.count({ where: { status: 'INACTIVE', companyCode: { not: SYSTEM_COMPANY_CODE } } }),
      this.prisma.user.count(),
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.container.aggregate({
        _sum: { netWeight: true, weighbridgeNetWeight: true },
      }),
      // Sales per business, added up per currency below (a total across currencies means nothing).
      this.prisma.sale.groupBy({ by: ['tenantId'], _sum: { totalAmount: true } }),
      this.prisma.tenant.findMany({
        where: { companyCode: { not: SYSTEM_COMPANY_CODE } },
        orderBy: { createdAt: 'desc' },
        take: 6,
        include: {
          _count: {
            select: { users: true, warehouses: true },
          },
        },
      }),
      // The overview shows what people did; the super admin's own page visits stay in the full audit trail.
      this.prisma.auditLog.findMany({
        where: { action: { not: 'SUPER_ADMIN_ROUTE_ACCESS' } },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
    ]);

    const userIds = [...new Set(recentLogs.map((l) => l.userId).filter((id): id is string => !!id))];
    const tenantIds = [...new Set(recentLogs.map((l) => l.tenantId).filter((id): id is string => !!id))];

    const [users, tenants] = await Promise.all([
      userIds.length > 0 ? this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } }) : [],
      tenantIds.length > 0 ? this.prisma.tenant.findMany({ where: { id: { in: tenantIds } }, select: { id: true, name: true, companyCode: true } }) : [],
    ]);

    const userMap = new Map<string, string>(users.map((u) => [u.id, u.name || u.email] as const));
    const tenantMap = new Map<string, string>(tenants.map((t) => [t.id, t.name] as const));

    const totalWeightKg = (containerWeightAgg._sum.weighbridgeNetWeight ?? containerWeightAgg._sum.netWeight ?? new Decimal(0)).toString();
    const currencyOf = new Map((await this.prisma.tenant.findMany({ select: { id: true, currency: true } })).map((t) => [t.id, t.currency] as const));
    const byCurrency = new Map<string, Decimal>();
    for (const row of salesRevenueAgg) {
      const currency = currencyOf.get(row.tenantId) ?? 'PKR';
      byCurrency.set(currency, (byCurrency.get(currency) ?? new Decimal(0)).add(row._sum.totalAmount ?? 0));
    }
    const salesByCurrency = [...byCurrency.entries()].map(([currency, amount]) => ({ currency, amount: amount.toString() })).sort((a, b) => Number(b.amount) - Number(a.amount));
    const totalSalesAmount = salesByCurrency.length === 1 ? salesByCurrency[0].amount : null;

    return {
      kpis: {
        totalTenants,
        activeTenants,
        inactiveTenants,
        totalUsers,
        activeUsers,
        totalWeightKg,
        totalSalesAmount,
        salesByCurrency,
      },
      // Real values only: the database answered the queries above; how long this server has been running; the release.
      systemHealth: {
        databaseStatus: 'HEALTHY',
        uptimeHours: Math.round((process.uptime() / 3600) * 10) / 10,
        version: process.env.APP_VERSION || null,
        lastAuditAt: recentLogs[0]?.createdAt ?? null,
      },
      recentTenants: recentTenants.map((t) => ({
        id: t.id,
        name: t.name,
        companyCode: t.companyCode,
        status: t.status,
        currency: t.currency,
        createdAt: t.createdAt,
        userCount: t._count.users,
        warehouseCount: t._count.warehouses,
      })),
      recentLogs: recentLogs.map((l) => ({
        id: l.id,
        action: l.action,
        entityType: l.entityType,
        entityId: l.entityId,
        userName: l.userId ? (userMap.get(l.userId) || 'User ' + l.userId.slice(0, 8)) : 'System',
        tenantName: l.tenantId ? (tenantMap.get(l.tenantId) || 'Tenant ' + l.tenantId.slice(0, 8)) : 'Global System',
        createdAt: l.createdAt,
        ipAddress: l.ipAddress,
      })),
    };
  }

  async getGlobalUsers(page: number = 1, limit: number = 20, search?: string) {
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search?.trim()) {
      const q = search.trim().toLowerCase();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q.replace(/\D/g, '').replace(/^0/, '') || q } },
        { tenant: { name: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          tenant: { select: { id: true, name: true, companyCode: true } },
          userRoles: {
            include: {
              role: { select: { name: true } },
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        hasPin: !!u.pinHash,
        pinLocked: !!u.pinLockedUntil && u.pinLockedUntil > new Date(),
        isActive: u.isActive,
        createdAt: u.createdAt,
        tenantId: u.tenantId,
        tenantName: u.tenant?.name || 'Global System',
        companyCode: u.tenant?.companyCode || 'SYS',
        roles: u.userRoles.map((ur) => ur.role.name),
      })),
      total,
      page,
      limit,
    };
  }

  /**
   * The audit trail, newest first. By default it leaves out the background noise (token refreshes, console page
   * views); `all` shows everything. Filter by business, or search the action and the person's name.
   */
  async getGlobalAuditLogs(page: number = 1, limit: number = 20, action?: string, opts: { tenantId?: string; q?: string; all?: boolean } = {}) {
    const skip = (page - 1) * limit;

    const and: Prisma.AuditLogWhereInput[] = [];
    if (action) and.push({ action });
    if (!opts.all && !action) and.push({ action: { notIn: AUDIT_NOISE } });
    if (opts.tenantId) and.push({ tenantId: opts.tenantId });
    const q = opts.q?.trim();
    if (q) {
      const people = await this.prisma.user.findMany({ where: { name: { contains: q, mode: 'insensitive' } }, select: { id: true }, take: 50 });
      and.push({ OR: [{ action: { contains: q.toUpperCase().replace(/\s+/g, '_') } }, { userId: { in: people.map((p) => p.id) } }] });
    }
    const where: Prisma.AuditLogWhereInput = and.length ? { AND: and } : {};

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    const userIds = [...new Set(logs.map((l) => l.userId).filter((id): id is string => !!id))];
    const tenantIds = [...new Set(logs.map((l) => l.tenantId).filter((id): id is string => !!id))];

    const [users, tenants] = await Promise.all([
      userIds.length > 0 ? this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } }) : [],
      tenantIds.length > 0 ? this.prisma.tenant.findMany({ where: { id: { in: tenantIds } }, select: { id: true, name: true, companyCode: true } }) : [],
    ]);

    const userMap = new Map<string, string>(users.map((u) => [u.id, u.name || u.email] as const));
    const tenantMap = new Map<string, { name: string; companyCode: string }>(
      tenants.map((t) => [t.id, { name: t.name, companyCode: t.companyCode }] as const)
    );

    return {
      data: logs.map((l) => {
        const tenantInfo = l.tenantId ? tenantMap.get(l.tenantId) : null;
        return {
          id: l.id,
          action: l.action,
          entityType: l.entityType,
          entityId: l.entityId,
          metadataJson: l.metadataJson,
          ipAddress: l.ipAddress,
          userAgent: l.userAgent,
          createdAt: l.createdAt,
          userName: l.userId ? (userMap.get(l.userId) || 'User ' + l.userId.slice(0, 8)) : 'System',
          tenantName: tenantInfo ? tenantInfo.name : (l.tenantId ? 'Tenant ' + l.tenantId.slice(0, 8) : 'Global System'),
          companyCode: tenantInfo ? tenantInfo.companyCode : 'SYS',
        };
      }),
      total,
      page,
      limit,
    };
  }

  async getPlansCatalog() {
    return { data: PLANS_CATALOG };
  }

  async getBillingSummary() {
    const tenants = await this.prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { users: true } } },
    });

    const mrr = tenants.length * 499;
    const arr = mrr * 12;

    const subscriptions = tenants.map((t, idx) => ({
      id: `sub_${t.id.slice(0, 8)}`,
      tenantId: t.id,
      tenantName: t.name,
      companyCode: t.companyCode,
      planName: idx % 2 === 0 ? 'Enterprise ERP Suite' : 'Sorting & Repack Pro',
      planCode: idx % 2 === 0 ? 'ENTERPRISE_FULL' : 'STANDALONE_SORTING',
      billingCycle: 'MONTHLY',
      monthlyAmount: idx % 2 === 0 ? 499 : 299,
      status: t.status === 'ACTIVE' ? 'PAID' : 'OVERDUE',
      nextBillingDate: new Date(Date.now() + 15 * 24 * 3600 * 1000).toISOString(),
    }));

    return {
      kpis: {
        mrr,
        arr,
        activeSubscriptions: tenants.filter((t) => t.status === 'ACTIVE').length,
        overdueCount: tenants.filter((t) => t.status !== 'ACTIVE').length,
        outstandingAmount: tenants.filter((t) => t.status !== 'ACTIVE').length * 499,
      },
      subscriptions,
    };
  }

  async getSystemSettings() {
    return SYSTEM_SETTINGS;
  }

  async updateSystemSettings(updates: Partial<typeof SYSTEM_SETTINGS>, userId: string) {
    SYSTEM_SETTINGS = { ...SYSTEM_SETTINGS, ...updates };

    try {
      await this.auditService.log({
        userId,
        action: 'SUPERADMIN_SYSTEM_SETTINGS_UPDATED',
        entityType: 'SystemSettings',
        metadataJson: updates,
      });
    } catch { }

    return SYSTEM_SETTINGS;
  }
}
