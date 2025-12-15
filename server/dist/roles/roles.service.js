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
exports.RolesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
let RolesService = class RolesService {
    constructor(prisma, auditService) {
        this.prisma = prisma;
        this.auditService = auditService;
    }
    async create(tenantId, dto, userId) {
        const existing = await this.prisma.role.findFirst({
            where: { tenantId, name: dto.name },
        });
        if (existing) {
            throw new common_1.BadRequestException(`Role "${dto.name}" already exists`);
        }
        const role = await this.prisma.role.create({
            data: {
                tenantId,
                name: dto.name,
                description: dto.description,
            },
            include: {
                rolePermissions: {
                    include: {
                        permission: true,
                    },
                },
                _count: {
                    select: { userRoles: true },
                },
            },
        });
        await this.auditService.log({
            userId,
            tenantId,
            action: 'ROLE_CREATED',
            entityType: 'Role',
            entityId: role.id,
            metadataJson: { roleName: role.name },
        });
        return role;
    }
    async findAll(tenantId) {
        return this.prisma.role.findMany({
            where: { tenantId },
            include: {
                rolePermissions: {
                    include: {
                        permission: true,
                    },
                },
                _count: {
                    select: { userRoles: true },
                },
            },
            orderBy: { name: 'asc' },
        });
    }
    async findOne(tenantId, id) {
        const role = await this.prisma.role.findFirst({
            where: { id, tenantId },
            include: {
                rolePermissions: {
                    include: {
                        permission: true,
                    },
                },
                _count: {
                    select: { userRoles: true },
                },
            },
        });
        if (!role) {
            throw new common_1.NotFoundException(`Role not found`);
        }
        return role;
    }
    async update(tenantId, id, dto, userId) {
        const role = await this.prisma.role.findFirst({
            where: { id, tenantId },
        });
        if (!role) {
            throw new common_1.NotFoundException(`Role not found`);
        }
        if (dto.name && dto.name !== role.name) {
            const existing = await this.prisma.role.findFirst({
                where: { tenantId, name: dto.name, id: { not: id } },
            });
            if (existing) {
                throw new common_1.BadRequestException(`Role "${dto.name}" already exists`);
            }
        }
        const updated = await this.prisma.role.update({
            where: { id },
            data: dto,
            include: {
                rolePermissions: {
                    include: {
                        permission: true,
                    },
                },
                _count: {
                    select: { userRoles: true },
                },
            },
        });
        await this.auditService.log({
            userId,
            tenantId,
            action: 'ROLE_UPDATED',
            entityType: 'Role',
            entityId: id,
            metadataJson: { changes: dto },
        });
        return updated;
    }
    async remove(tenantId, id, userId) {
        const role = await this.prisma.role.findFirst({
            where: { id, tenantId },
            include: {
                _count: {
                    select: { userRoles: true },
                },
            },
        });
        if (!role) {
            throw new common_1.NotFoundException(`Role not found`);
        }
        if (role._count.userRoles > 0) {
            throw new common_1.BadRequestException(`Cannot delete role with assigned users`);
        }
        await this.prisma.role.delete({
            where: { id },
        });
        await this.auditService.log({
            userId,
            tenantId,
            action: 'ROLE_DELETED',
            entityType: 'Role',
            entityId: id,
            metadataJson: { roleName: role.name },
        });
        return { success: true };
    }
    async assignPermission(tenantId, roleId, permissionId, userId) {
        const role = await this.prisma.role.findFirst({
            where: { id: roleId, tenantId },
        });
        if (!role) {
            throw new common_1.NotFoundException(`Role not found`);
        }
        const permission = await this.prisma.permission.findUnique({
            where: { id: permissionId },
        });
        if (!permission) {
            throw new common_1.NotFoundException(`Permission not found`);
        }
        const existing = await this.prisma.rolePermission.findFirst({
            where: { roleId, permissionId },
        });
        if (existing) {
            throw new common_1.BadRequestException(`Permission already assigned to this role`);
        }
        const rolePermission = await this.prisma.rolePermission.create({
            data: { roleId, permissionId },
            include: {
                permission: true,
            },
        });
        await this.auditService.log({
            userId,
            tenantId,
            action: 'ROLE_PERMISSION_ASSIGNED',
            entityType: 'RolePermission',
            entityId: rolePermission.id,
            metadataJson: {
                roleName: role.name,
                permissionCode: permission.code,
            },
        });
        return rolePermission;
    }
    async assignMultiplePermissions(tenantId, roleId, permissionIds, userId) {
        const role = await this.prisma.role.findFirst({
            where: { id: roleId, tenantId },
        });
        if (!role) {
            throw new common_1.NotFoundException(`Role not found`);
        }
        const permissions = await this.prisma.permission.findMany({
            where: { id: { in: permissionIds } },
        });
        if (permissions.length !== permissionIds.length) {
            throw new common_1.BadRequestException(`Some permissions not found`);
        }
        await this.prisma.$transaction([
            this.prisma.rolePermission.deleteMany({
                where: { roleId },
            }),
            this.prisma.rolePermission.createMany({
                data: permissionIds.map((permissionId) => ({
                    roleId,
                    permissionId,
                })),
            }),
        ]);
        await this.auditService.log({
            userId,
            tenantId,
            action: 'ROLE_PERMISSIONS_UPDATED',
            entityType: 'Role',
            entityId: roleId,
            metadataJson: {
                roleName: role.name,
                permissionCount: permissionIds.length,
            },
        });
        return this.findOne(tenantId, roleId);
    }
    async removePermission(tenantId, roleId, permissionId, userId) {
        const role = await this.prisma.role.findFirst({
            where: { id: roleId, tenantId },
        });
        if (!role) {
            throw new common_1.NotFoundException(`Role not found`);
        }
        const rolePermission = await this.prisma.rolePermission.findFirst({
            where: { roleId, permissionId },
            include: {
                permission: true,
            },
        });
        if (!rolePermission) {
            throw new common_1.NotFoundException(`Permission not assigned to this role`);
        }
        await this.prisma.rolePermission.delete({
            where: { id: rolePermission.id },
        });
        await this.auditService.log({
            userId,
            tenantId,
            action: 'ROLE_PERMISSION_REMOVED',
            entityType: 'RolePermission',
            entityId: rolePermission.id,
            metadataJson: {
                roleName: role.name,
                permissionCode: rolePermission.permission.code,
            },
        });
        return { success: true };
    }
};
exports.RolesService = RolesService;
exports.RolesService = RolesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], RolesService);
//# sourceMappingURL=roles.service.js.map