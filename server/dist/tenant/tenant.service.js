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
exports.TenantService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let TenantService = class TenantService {
    constructor(prisma) {
        this.prisma = prisma;
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
            throw new common_1.NotFoundException(`Tenant not found`);
        }
        return tenant;
    }
    async getCategories(tenantId) {
        return this.prisma.category.findMany({
            where: { tenantId, isActive: true },
            orderBy: { sortOrder: 'asc' },
        });
    }
    async getAllCategories(tenantId) {
        return this.prisma.category.findMany({
            where: { tenantId },
            orderBy: { sortOrder: 'asc' },
        });
    }
    async createCategory(tenantId, dto) {
        return this.prisma.$transaction(async (tx) => {
            const category = await tx.category.create({
                data: {
                    tenantId,
                    name: dto.name,
                    sortOrder: dto.sortOrder ?? 0,
                },
            });
            await tx.wasteCategory.create({
                data: {
                    tenantId,
                    name: `${dto.name} Waste`,
                    linkedCategoryId: category.id,
                    unitType: 'KG',
                    defaultResalePrice: 0,
                    isSystemGenerated: true,
                    isActive: true,
                },
            });
            return category;
        });
    }
    async updateCategory(tenantId, id, dto) {
        return this.prisma.$transaction(async (tx) => {
            const category = await tx.category.findFirst({
                where: { id, tenantId },
                include: { linkedWasteCategory: true },
            });
            if (!category) {
                throw new common_1.NotFoundException('Category not found');
            }
            const updated = await tx.category.update({
                where: { id },
                data: {
                    ...(dto.name && { name: dto.name }),
                    ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
                    ...(dto.isActive !== undefined && { isActive: dto.isActive }),
                },
            });
            if (category.linkedWasteCategory) {
                await tx.wasteCategory.update({
                    where: { id: category.linkedWasteCategory.id },
                    data: {
                        ...(dto.name && { name: `${dto.name} Waste` }),
                        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
                    },
                });
            }
            return updated;
        });
    }
    async deleteCategory(tenantId, id) {
        return this.prisma.$transaction(async (tx) => {
            const category = await tx.category.findFirst({
                where: { id, tenantId },
                include: {
                    linkedWasteCategory: true,
                    _count: {
                        select: {
                            sortCategoryBuckets: true,
                            categoryOutputs: true,
                        },
                    },
                },
            });
            if (!category) {
                throw new common_1.NotFoundException('Category not found');
            }
            const hasHistory = category._count.sortCategoryBuckets > 0 ||
                category._count.categoryOutputs > 0;
            if (hasHistory) {
                throw new common_1.BadRequestException('Cannot delete category: already used in sorting history. Deactivate instead.');
            }
            if (category.linkedWasteCategory) {
                await tx.wasteCategory.delete({
                    where: { id: category.linkedWasteCategory.id },
                });
            }
            return tx.category.delete({ where: { id } });
        });
    }
    async getRawCategories(tenantId, type) {
        return this.prisma.rawCategory.findMany({
            where: {
                tenantId,
                isActive: true,
                ...(type && { rawType: type }),
            },
            orderBy: { sortOrder: 'asc' },
        });
    }
    async createRawCategory(tenantId, dto) {
        return this.prisma.rawCategory.create({
            data: {
                tenantId,
                name: dto.name,
                rawType: dto.rawType,
                sortOrder: dto.sortOrder ?? 0,
            },
        });
    }
    async updateRawCategory(tenantId, id, dto) {
        const category = await this.prisma.rawCategory.findFirst({
            where: { id, tenantId },
        });
        if (!category) {
            throw new common_1.NotFoundException('Raw category not found');
        }
        return this.prisma.rawCategory.update({
            where: { id },
            data: {
                ...(dto.name && { name: dto.name }),
                ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
            },
        });
    }
    async deleteRawCategory(tenantId, id) {
        const category = await this.prisma.rawCategory.findFirst({
            where: { id, tenantId },
        });
        if (!category) {
            throw new common_1.NotFoundException('Raw category not found');
        }
        return this.prisma.rawCategory.delete({
            where: { id },
        });
    }
    async getGrades(tenantId) {
        return this.prisma.grade.findMany({
            where: { tenantId, isActive: true },
            orderBy: { rank: 'asc' },
        });
    }
    async getWarehouses(tenantId) {
        return this.prisma.warehouse.findMany({
            where: { tenantId },
            orderBy: { name: 'asc' },
        });
    }
    async getStats(tenantId) {
        const [users, roles, categories, grades, warehouses] = await Promise.all([
            this.prisma.user.count({ where: { tenantId, isActive: true } }),
            this.prisma.role.count({ where: { tenantId } }),
            this.prisma.category.count({ where: { tenantId, isActive: true } }),
            this.prisma.grade.count({ where: { tenantId, isActive: true } }),
            this.prisma.warehouse.count({ where: { tenantId } }),
        ]);
        return {
            users,
            roles,
            categories,
            grades,
            warehouses,
        };
    }
};
exports.TenantService = TenantService;
exports.TenantService = TenantService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], TenantService);
//# sourceMappingURL=tenant.service.js.map