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
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
const password_service_1 = require("../auth/password.service");
let UsersService = class UsersService {
    constructor(prisma, auditService, passwordService) {
        this.prisma = prisma;
        this.auditService = auditService;
        this.passwordService = passwordService;
        this.userSelect = {
            id: true,
            tenantId: true,
            name: true,
            email: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
            userRoles: {
                include: {
                    role: {
                        include: {
                            rolePermissions: {
                                include: {
                                    permission: true,
                                },
                            },
                        },
                    },
                },
            },
        };
    }
    async create(tenantId, dto, creatorUserId) {
        const existing = await this.prisma.user.findFirst({
            where: { tenantId, email: dto.email.toLowerCase() },
        });
        if (existing) {
            throw new common_1.BadRequestException(`User with email "${dto.email}" already exists`);
        }
        const password = dto.password || this.passwordService.generateTemporaryPassword();
        const passwordHash = await this.passwordService.hash(password);
        const user = await this.prisma.user.create({
            data: {
                tenantId,
                name: dto.name,
                email: dto.email.toLowerCase(),
                passwordHash,
                isActive: true,
            },
            select: this.userSelect,
        });
        if (dto.roleIds && dto.roleIds.length > 0) {
            await this.assignMultipleRoles(tenantId, user.id, dto.roleIds, creatorUserId);
        }
        await this.auditService.log({
            userId: creatorUserId,
            tenantId,
            action: 'USER_CREATED',
            entityType: 'User',
            entityId: user.id,
            metadataJson: { userName: user.name, email: user.email },
        });
        return {
            ...user,
            temporaryPassword: dto.password ? undefined : password,
        };
    }
    async findAll(tenantId, includeInactive = false) {
        return this.prisma.user.findMany({
            where: {
                tenantId,
                ...(includeInactive ? {} : { isActive: true }),
            },
            select: this.userSelect,
            orderBy: { name: 'asc' },
        });
    }
    async findOne(tenantId, id) {
        const user = await this.prisma.user.findFirst({
            where: { id, tenantId },
            select: this.userSelect,
        });
        if (!user) {
            throw new common_1.NotFoundException(`User not found`);
        }
        return user;
    }
    async update(tenantId, id, dto, updaterUserId) {
        const user = await this.prisma.user.findFirst({
            where: { id, tenantId },
        });
        if (!user) {
            throw new common_1.NotFoundException(`User not found`);
        }
        const updated = await this.prisma.user.update({
            where: { id },
            data: dto,
            select: this.userSelect,
        });
        await this.auditService.log({
            userId: updaterUserId,
            tenantId,
            action: 'USER_UPDATED',
            entityType: 'User',
            entityId: id,
            metadataJson: { changes: dto },
        });
        return updated;
    }
    async block(tenantId, id, blockerUserId) {
        const user = await this.prisma.user.findFirst({
            where: { id, tenantId },
        });
        if (!user) {
            throw new common_1.NotFoundException(`User not found`);
        }
        if (id === blockerUserId) {
            throw new common_1.BadRequestException(`Cannot block yourself`);
        }
        const updated = await this.prisma.user.update({
            where: { id },
            data: { isActive: false },
            select: this.userSelect,
        });
        await this.auditService.log({
            userId: blockerUserId,
            tenantId,
            action: 'USER_BLOCKED',
            entityType: 'User',
            entityId: id,
            metadataJson: { userName: user.name },
        });
        return updated;
    }
    async unblock(tenantId, id, unblockerUserId) {
        const user = await this.prisma.user.findFirst({
            where: { id, tenantId },
        });
        if (!user) {
            throw new common_1.NotFoundException(`User not found`);
        }
        const updated = await this.prisma.user.update({
            where: { id },
            data: { isActive: true },
            select: this.userSelect,
        });
        await this.auditService.log({
            userId: unblockerUserId,
            tenantId,
            action: 'USER_UNBLOCKED',
            entityType: 'User',
            entityId: id,
            metadataJson: { userName: user.name },
        });
        return updated;
    }
    async resetPassword(tenantId, id, resetterUserId) {
        const user = await this.prisma.user.findFirst({
            where: { id, tenantId },
        });
        if (!user) {
            throw new common_1.NotFoundException(`User not found`);
        }
        const temporaryPassword = this.passwordService.generateTemporaryPassword();
        const passwordHash = await this.passwordService.hash(temporaryPassword);
        await this.prisma.user.update({
            where: { id },
            data: { passwordHash },
        });
        await this.prisma.refreshToken.updateMany({
            where: { userId: id, revokedAt: null },
            data: { revokedAt: new Date() },
        });
        await this.auditService.log({
            userId: resetterUserId,
            tenantId,
            action: 'USER_PASSWORD_RESET',
            entityType: 'User',
            entityId: id,
            metadataJson: { userName: user.name },
        });
        return {
            success: true,
            temporaryPassword,
            message: 'Password has been reset. Please send this temporary password to the user.',
        };
    }
    async assignRole(tenantId, userId, roleId, assignerUserId) {
        const user = await this.prisma.user.findFirst({
            where: { id: userId, tenantId },
        });
        if (!user) {
            throw new common_1.NotFoundException(`User not found`);
        }
        const role = await this.prisma.role.findFirst({
            where: { id: roleId, tenantId },
        });
        if (!role) {
            throw new common_1.NotFoundException(`Role not found`);
        }
        const existing = await this.prisma.userRole.findFirst({
            where: { userId, roleId },
        });
        if (existing) {
            throw new common_1.BadRequestException(`Role already assigned to this user`);
        }
        const userRole = await this.prisma.userRole.create({
            data: { userId, roleId },
            include: {
                role: true,
            },
        });
        await this.auditService.log({
            userId: assignerUserId,
            tenantId,
            action: 'USER_ROLE_ASSIGNED',
            entityType: 'UserRole',
            entityId: userRole.id,
            metadataJson: {
                userName: user.name,
                roleName: role.name,
            },
        });
        return this.findOne(tenantId, userId);
    }
    async assignMultipleRoles(tenantId, userId, roleIds, assignerUserId) {
        const user = await this.prisma.user.findFirst({
            where: { id: userId, tenantId },
        });
        if (!user) {
            throw new common_1.NotFoundException(`User not found`);
        }
        const roles = await this.prisma.role.findMany({
            where: { id: { in: roleIds }, tenantId },
        });
        if (roles.length !== roleIds.length) {
            throw new common_1.BadRequestException(`Some roles not found`);
        }
        await this.prisma.$transaction([
            this.prisma.userRole.deleteMany({
                where: { userId },
            }),
            this.prisma.userRole.createMany({
                data: roleIds.map((roleId) => ({
                    userId,
                    roleId,
                })),
            }),
        ]);
        await this.auditService.log({
            userId: assignerUserId,
            tenantId,
            action: 'USER_ROLES_UPDATED',
            entityType: 'User',
            entityId: userId,
            metadataJson: {
                userName: user.name,
                roleCount: roleIds.length,
            },
        });
        return this.findOne(tenantId, userId);
    }
    async removeRole(tenantId, userId, roleId, removerUserId) {
        const user = await this.prisma.user.findFirst({
            where: { id: userId, tenantId },
        });
        if (!user) {
            throw new common_1.NotFoundException(`User not found`);
        }
        const userRole = await this.prisma.userRole.findFirst({
            where: { userId, roleId },
            include: {
                role: true,
            },
        });
        if (!userRole) {
            throw new common_1.NotFoundException(`Role not assigned to this user`);
        }
        await this.prisma.userRole.delete({
            where: { id: userRole.id },
        });
        await this.auditService.log({
            userId: removerUserId,
            tenantId,
            action: 'USER_ROLE_REMOVED',
            entityType: 'UserRole',
            entityId: userRole.id,
            metadataJson: {
                userName: user.name,
                roleName: userRole.role.name,
            },
        });
        return { success: true };
    }
    async getUserPermissions(userId) {
        const userRoles = await this.prisma.userRole.findMany({
            where: { userId },
            include: {
                role: {
                    include: {
                        rolePermissions: {
                            include: {
                                permission: true,
                            },
                        },
                    },
                },
            },
        });
        const permissions = new Set();
        for (const userRole of userRoles) {
            for (const rolePermission of userRole.role.rolePermissions) {
                permissions.add(rolePermission.permission.code);
            }
        }
        return Array.from(permissions);
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        password_service_1.PasswordService])
], UsersService);
//# sourceMappingURL=users.service.js.map