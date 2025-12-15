import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TenantBootstrapService, BootstrapResult } from './tenant-bootstrap.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { TenantResponseDto, TenantListResponseDto } from './dto/tenant-response.dto';
import { TenantStatus } from '@prisma/client';

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
    adminEmail?: string,
    adminName?: string,
  ): Promise<TenantResponseDto & { bootstrap: BootstrapResult }> {
    // Check for duplicate company code
    const existing = await this.prisma.tenant.findUnique({
      where: { companyCode: dto.companyCode },
    });

    if (existing) {
      throw new BadRequestException(`Company code "${dto.companyCode}" already exists`);
    }

    // Create tenant
    const tenant = await this.prisma.tenant.create({
      data: {
        name: dto.name,
        companyCode: dto.companyCode,
        currency: dto.currency || 'USD',
        locale: dto.locale || 'en-US',
        status: dto.status || TenantStatus.ACTIVE,
      },
    });

    // Bootstrap the tenant
    const bootstrap = await this.bootstrapService.bootstrapTenant(tenant.id, adminEmail, adminName);

    // Log the action
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

    return {
      ...tenant,
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

    return {
      data,
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

    return tenant;
  }

  async update(id: string, dto: UpdateTenantDto, userId: string): Promise<TenantResponseDto> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant with ID "${id}" not found`);
    }

    const updated = await this.prisma.tenant.update({
      where: { id },
      data: dto,
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
        changes: dto,
        previousStatus: tenant.status,
        newStatus: updated.status,
      },
    });

    return updated;
  }

  async deactivate(id: string, userId: string): Promise<TenantResponseDto> {
    return this.update(id, { status: TenantStatus.INACTIVE }, userId);
  }

  async activate(id: string, userId: string): Promise<TenantResponseDto> {
    return this.update(id, { status: TenantStatus.ACTIVE }, userId);
  }
}

