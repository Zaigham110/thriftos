"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SuperAdminService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
const tenant_bootstrap_service_1 = require("./tenant-bootstrap.service");
const client_1 = require("@prisma/client");
let SuperAdminService = class SuperAdminService {
    constructor(prisma, auditService, bootstrapService) {
        this.prisma = prisma;
        this.auditService = auditService;
        this.bootstrapService = bootstrapService;
    }
    async createTenant(dto, userId) {
        const existing = await this.prisma.tenant.findUnique({
            where: { companyCode: dto.companyCode },
        });
        if (existing) {
            throw new common_1.BadRequestException(`Company code "${dto.companyCode}" already exists`);
        }
        const tenant = await this.prisma.tenant.create({
            data: {
                name: dto.name,
                companyCode: dto.companyCode,
                currency: dto.currency || 'USD',
                locale: dto.locale || 'en-US',
                status: dto.status || client_1.TenantStatus.ACTIVE,
            },
        });
        const bootstrap = await this.bootstrapService.bootstrapTenant(tenant.id, dto.adminEmail, dto.adminName, dto.adminPassword);
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
        }
        catch (auditError) {
            console.error('Failed to log audit for tenant creation:', auditError);
        }
        return {
            ...tenant,
            bootstrap,
        };
    }
    async findAll(page = 1, limit = 20, status) {
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
    async findOne(id) {
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
            throw new common_1.NotFoundException(`Tenant with ID "${id}" not found`);
        }
        return tenant;
    }
    async update(id, dto, userId) {
        const tenant = await this.prisma.tenant.findUnique({
            where: { id },
        });
        if (!tenant) {
            throw new common_1.NotFoundException(`Tenant with ID "${id}" not found`);
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
    async deactivate(id, userId) {
        return this.update(id, { status: client_1.TenantStatus.INACTIVE }, userId);
    }
    async activate(id, userId) {
        return this.update(id, { status: client_1.TenantStatus.ACTIVE }, userId);
    }
};
exports.SuperAdminService = SuperAdminService;
exports.SuperAdminService = SuperAdminService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        tenant_bootstrap_service_1.TenantBootstrapService])
], SuperAdminService);
//# sourceMappingURL=superadmin.service.js.map