import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@Injectable()
export class RolesService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async create(tenantId: string, dto: CreateRoleDto, userId: string) {
    // Check for duplicate name within tenant
    const existing = await this.prisma.role.findFirst({
      where: { tenantId, name: dto.name },
    });

    if (existing) {
      throw new BadRequestException(`Role "${dto.name}" already exists`);
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

  async findAll(tenantId: string) {
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

  async findOne(tenantId: string, id: string) {
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
      throw new NotFoundException(`Role not found`);
    }

    return role;
  }

  async update(tenantId: string, id: string, dto: UpdateRoleDto, userId: string) {
    const role = await this.prisma.role.findFirst({
      where: { id, tenantId },
    });

    if (!role) {
      throw new NotFoundException(`Role not found`);
    }

    // Check for duplicate name if name is being changed
    if (dto.name && dto.name !== role.name) {
      const existing = await this.prisma.role.findFirst({
        where: { tenantId, name: dto.name, id: { not: id } },
      });

      if (existing) {
        throw new BadRequestException(`Role "${dto.name}" already exists`);
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

  async remove(tenantId: string, id: string, userId: string) {
    const role = await this.prisma.role.findFirst({
      where: { id, tenantId },
      include: {
        _count: {
          select: { userRoles: true },
        },
      },
    });

    if (!role) {
      throw new NotFoundException(`Role not found`);
    }

    if (role._count.userRoles > 0) {
      throw new BadRequestException(`Cannot delete role with assigned users`);
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

  async assignPermission(tenantId: string, roleId: string, permissionId: string, userId: string) {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, tenantId },
    });

    if (!role) {
      throw new NotFoundException(`Role not found`);
    }

    const permission = await this.prisma.permission.findUnique({
      where: { id: permissionId },
    });

    if (!permission) {
      throw new NotFoundException(`Permission not found`);
    }

    // Check if already assigned
    const existing = await this.prisma.rolePermission.findFirst({
      where: { roleId, permissionId },
    });

    if (existing) {
      throw new BadRequestException(`Permission already assigned to this role`);
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

  async assignMultiplePermissions(
    tenantId: string,
    roleId: string,
    permissionIds: string[],
    userId: string,
  ) {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, tenantId },
    });

    if (!role) {
      throw new NotFoundException(`Role not found`);
    }

    // Verify all permissions exist if array is not empty
    if (permissionIds.length > 0) {
      const permissions = await this.prisma.permission.findMany({
        where: { id: { in: permissionIds } },
      });

      if (permissions.length !== permissionIds.length) {
        throw new BadRequestException(`Some permissions not found`);
      }
    }

    // Remove existing assignments and create new ones
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

  async removePermission(tenantId: string, roleId: string, permissionId: string, userId: string) {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, tenantId },
    });

    if (!role) {
      throw new NotFoundException(`Role not found`);
    }

    const rolePermission = await this.prisma.rolePermission.findFirst({
      where: { roleId, permissionId },
      include: {
        permission: true,
      },
    });

    if (!rolePermission) {
      throw new NotFoundException(`Permission not assigned to this role`);
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
}

