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
exports.TenantBootstrapService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const password_service_1 = require("../auth/password.service");
let TenantBootstrapService = class TenantBootstrapService {
    constructor(prisma, passwordService) {
        this.prisma = prisma;
        this.passwordService = passwordService;
    }
    async bootstrapTenant(tenantId, adminEmail, adminName) {
        const result = {
            roles: 0,
            permissions: 0,
            categories: 0,
            grades: 0,
            warehouses: 0,
        };
        await this.prisma.$transaction(async (tx) => {
            const defaultRoles = [
                { name: 'Admin', description: 'Full access to all tenant features' },
                { name: 'Manager', description: 'Manage operations and view reports' },
                { name: 'Worker', description: 'Perform daily operations' },
                { name: 'ReadOnly', description: 'View-only access' },
            ];
            const createdRoles = await Promise.all(defaultRoles.map((role) => tx.role.create({
                data: {
                    tenantId,
                    name: role.name,
                    description: role.description,
                },
            })));
            result.roles = createdRoles.length;
            const allPermissions = await tx.permission.findMany();
            result.permissions = allPermissions.length;
            const adminRole = createdRoles.find((r) => r.name === 'Admin');
            if (adminRole) {
                await tx.rolePermission.createMany({
                    data: allPermissions.map((p) => ({
                        roleId: adminRole.id,
                        permissionId: p.id,
                    })),
                });
            }
            const managerRole = createdRoles.find((r) => r.name === 'Manager');
            if (managerRole) {
                const managerPermissions = allPermissions.filter((p) => p.code.endsWith('.read') ||
                    p.group === 'Reports' ||
                    [
                        'sort.session.create',
                        'SORTING_STAGE1_CREATE',
                        'grade.session.create',
                        'SORTING_STAGE2_CREATE',
                        'repack.session.create',
                        'REPACK_CREATE',
                        'INVENTORY_INTAKE',
                        'REPORTS_VIEW',
                        'REPORTS_EXPORT',
                    ].includes(p.code));
                await tx.rolePermission.createMany({
                    data: managerPermissions.map((p) => ({
                        roleId: managerRole.id,
                        permissionId: p.id,
                    })),
                });
            }
            const readPermissions = allPermissions.filter((p) => p.code.endsWith('.read'));
            const workerRole = createdRoles.find((r) => r.name === 'Worker');
            const readOnlyRole = createdRoles.find((r) => r.name === 'ReadOnly');
            if (workerRole) {
                const workerPermissions = allPermissions.filter((p) => p.code.endsWith('.read') ||
                    [
                        'sort.session.create',
                        'sort.session.update',
                        'SORTING_STAGE1_CREATE',
                        'SORTING_STAGE1_EDIT',
                        'grade.session.create',
                        'grade.session.update',
                        'SORTING_STAGE2_CREATE',
                        'SORTING_STAGE2_EDIT',
                        'REPACK_CREATE',
                        'REPACK_EDIT',
                        'INVENTORY_VIEW',
                        'INVENTORY_INTAKE',
                        'INVENTORY_ADJUST',
                        'INVENTORY_RESERVE',
                    ].includes(p.code));
                await tx.rolePermission.createMany({
                    data: workerPermissions.map((p) => ({
                        roleId: workerRole.id,
                        permissionId: p.id,
                    })),
                });
            }
            if (readOnlyRole) {
                await tx.rolePermission.createMany({
                    data: readPermissions.map((p) => ({
                        roleId: readOnlyRole.id,
                        permissionId: p.id,
                    })),
                });
            }
            const templates = await tx.globalCategoryTemplate.findMany();
            if (templates.length > 0) {
                await tx.category.createMany({
                    data: templates.map((t) => ({
                        tenantId,
                        name: t.categoryName,
                        sortOrder: t.defaultSortPriority,
                        isActive: true,
                    })),
                });
                result.categories = templates.length;
            }
            const defaultGrades = [
                { name: 'Grade A', description: 'Premium quality', rank: 1 },
                { name: 'Grade B', description: 'Good quality', rank: 2 },
                { name: 'Grade C', description: 'Fair quality', rank: 3 },
                { name: 'Waste', description: 'Unsuitable for resale', rank: 4 },
            ];
            await tx.grade.createMany({
                data: defaultGrades.map((g) => ({
                    tenantId,
                    name: g.name,
                    description: g.description,
                    rank: g.rank,
                    isActive: true,
                })),
            });
            result.grades = defaultGrades.length;
            await tx.warehouse.create({
                data: {
                    tenantId,
                    name: 'Main Warehouse',
                    code: 'WH-001',
                    location: 'Default Location',
                },
            });
            result.warehouses = 1;
            if (adminEmail && adminRole) {
                const temporaryPassword = this.passwordService.generateTemporaryPassword();
                const passwordHash = await this.passwordService.hash(temporaryPassword);
                const adminUser = await tx.user.create({
                    data: {
                        tenantId,
                        name: adminName || 'Tenant Admin',
                        email: adminEmail.toLowerCase(),
                        passwordHash,
                        isActive: true,
                    },
                });
                await tx.userRole.create({
                    data: {
                        userId: adminUser.id,
                        roleId: adminRole.id,
                    },
                });
                result.adminUser = {
                    id: adminUser.id,
                    email: adminUser.email,
                    temporaryPassword,
                };
            }
        });
        return result;
    }
};
exports.TenantBootstrapService = TenantBootstrapService;
exports.TenantBootstrapService = TenantBootstrapService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        password_service_1.PasswordService])
], TenantBootstrapService);
//# sourceMappingURL=tenant-bootstrap.service.js.map