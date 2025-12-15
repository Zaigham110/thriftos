import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PasswordService } from '../auth/password.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private passwordService: PasswordService,
  ) {}

  private userSelect = {
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

  async create(tenantId: string, dto: CreateUserDto, creatorUserId: string) {
    // Check for duplicate email within tenant
    const existing = await this.prisma.user.findFirst({
      where: { tenantId, email: dto.email.toLowerCase() },
    });

    if (existing) {
      throw new BadRequestException(`User with email "${dto.email}" already exists`);
    }

    // Generate temporary password if not provided
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

    // Assign roles if provided
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

    // Return user with temporary password (for email sending)
    return {
      ...user,
      temporaryPassword: dto.password ? undefined : password,
    };
  }

  async findAll(tenantId: string, includeInactive: boolean = false) {
    return this.prisma.user.findMany({
      where: {
        tenantId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      select: this.userSelect,
      orderBy: { name: 'asc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId },
      select: this.userSelect,
    });

    if (!user) {
      throw new NotFoundException(`User not found`);
    }

    return user;
  }

  async update(tenantId: string, id: string, dto: UpdateUserDto, updaterUserId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId },
    });

    if (!user) {
      throw new NotFoundException(`User not found`);
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

  async block(tenantId: string, id: string, blockerUserId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId },
    });

    if (!user) {
      throw new NotFoundException(`User not found`);
    }

    if (id === blockerUserId) {
      throw new BadRequestException(`Cannot block yourself`);
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

  async unblock(tenantId: string, id: string, unblockerUserId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId },
    });

    if (!user) {
      throw new NotFoundException(`User not found`);
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

  async resetPassword(tenantId: string, id: string, resetterUserId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId },
    });

    if (!user) {
      throw new NotFoundException(`User not found`);
    }

    const temporaryPassword = this.passwordService.generateTemporaryPassword();
    const passwordHash = await this.passwordService.hash(temporaryPassword);

    await this.prisma.user.update({
      where: { id },
      data: { passwordHash },
    });

    // Invalidate all refresh tokens for this user
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

  async assignRole(tenantId: string, userId: string, roleId: string, assignerUserId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
    });

    if (!user) {
      throw new NotFoundException(`User not found`);
    }

    const role = await this.prisma.role.findFirst({
      where: { id: roleId, tenantId },
    });

    if (!role) {
      throw new NotFoundException(`Role not found`);
    }

    // Check if already assigned
    const existing = await this.prisma.userRole.findFirst({
      where: { userId, roleId },
    });

    if (existing) {
      throw new BadRequestException(`Role already assigned to this user`);
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

  async assignMultipleRoles(
    tenantId: string,
    userId: string,
    roleIds: string[],
    assignerUserId: string,
  ) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
    });

    if (!user) {
      throw new NotFoundException(`User not found`);
    }

    // Verify all roles exist and belong to the tenant
    const roles = await this.prisma.role.findMany({
      where: { id: { in: roleIds }, tenantId },
    });

    if (roles.length !== roleIds.length) {
      throw new BadRequestException(`Some roles not found`);
    }

    // Remove existing assignments and create new ones
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

  async removeRole(tenantId: string, userId: string, roleId: string, removerUserId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
    });

    if (!user) {
      throw new NotFoundException(`User not found`);
    }

    const userRole = await this.prisma.userRole.findFirst({
      where: { userId, roleId },
      include: {
        role: true,
      },
    });

    if (!userRole) {
      throw new NotFoundException(`Role not assigned to this user`);
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

  async getUserPermissions(userId: string): Promise<string[]> {
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

    const permissions = new Set<string>();
    for (const userRole of userRoles) {
      for (const rolePermission of userRole.role.rolePermissions) {
        permissions.add(rolePermission.permission.code);
      }
    }

    return Array.from(permissions);
  }
}

