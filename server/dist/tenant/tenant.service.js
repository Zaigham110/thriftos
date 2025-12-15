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