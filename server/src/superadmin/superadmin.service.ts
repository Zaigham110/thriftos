import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TenantBootstrapService, BootstrapResult } from './tenant-bootstrap.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { TenantResponseDto, TenantListResponseDto } from './dto/tenant-response.dto';
import { TenantStatus } from '@prisma/client';
import { getCurrencyMeta, isSupportedCurrencyCode } from '../common/currency/currency';

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
    // Check for duplicate company code
    const existing = await this.prisma.tenant.findUnique({
      where: { companyCode: dto.companyCode },
    });

    if (existing) {
      throw new BadRequestException(`Company code "${dto.companyCode}" already exists`);
    }

    const desiredCurrency = dto.currencyCode || dto.currency || 'USD';
    if (!isSupportedCurrencyCode(desiredCurrency)) {
      throw new BadRequestException(`Unsupported currency code: ${desiredCurrency}`);
    }

    // Create tenant
    const tenant = await this.prisma.tenant.create({
      data: {
        name: dto.name,
        companyCode: dto.companyCode,
        currency: desiredCurrency,
        locale: dto.locale || 'en-US',
        status: dto.status || TenantStatus.ACTIVE,
      },
    });

    // Bootstrap the tenant
    const bootstrap = await this.bootstrapService.bootstrapTenant(
      tenant.id,
      dto.adminEmail,
      dto.adminName,
      dto.adminPassword,
    );

    // Log the action (non-blocking - don't fail tenant creation if audit fails)
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

    const where = status ? { status } : {};

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

  async findOne(id: string): Promise<TenantResponseDto> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
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

    if (!tenant) {
      throw new NotFoundException(`Tenant with ID "${id}" not found`);
    }

    const currencyMeta = getCurrencyMeta(tenant.currency);
    return {
      ...tenant,
      currencyCode: tenant.currency,
      currency: currencyMeta,
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
}

