import { Injectable, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { toE164 } from '../common/phone/phone';
import { CreateMunshiDto } from './dto/munshi.dto';
import { ensureStaffRoles } from './staff';
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

    if (dto.isActive === false && id === updaterUserId) {
      throw new BadRequestException(`Cannot deactivate yourself`);
    }

    if (dto.email && dto.email.toLowerCase() !== user.email) {
      const existing = await this.prisma.user.findFirst({
        where: { tenantId, email: dto.email.toLowerCase(), id: { not: id } },
      });
      if (existing) {
        throw new BadRequestException(`User with email "${dto.email}" already exists`);
      }
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.email !== undefined && { email: dto.email.toLowerCase() }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
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

  /** The team for Settings: who can sign in, how, and whether a PIN is locked. */
  async team(tenantId: string, meId?: string) {
    const users = await this.prisma.user.findMany({
      where: { tenantId },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      select: { id: true, name: true, email: true, phone: true, isActive: true, pinHash: true, pinLockedUntil: true, userRoles: { select: { role: { select: { id: true, name: true } } } } },
    });
    const now = new Date();
    return users.map(({ pinHash, userRoles, ...u }) => ({
      ...u,
      hasPin: !!pinHash,
      locked: !!u.pinLockedUntil && u.pinLockedUntil > now,
      roles: userRoles.map((r) => r.role.name),
      roleIds: userRoles.map((r) => r.role.id),
      you: u.id === meId,
    }));
  }

  /** The business's roles for Team (v2 review: Settings): id, name and how many people have it. */
  async teamRoles(tenantId: string) {
    await this.prisma.$transaction((tx) => ensureStaffRoles(tx, tenantId));
    const roles = await this.prisma.role.findMany({ where: { tenantId }, orderBy: { name: 'asc' }, select: { id: true, name: true, _count: { select: { userRoles: true } } } });
    return roles.map((r) => ({ id: r.id, name: r.name, people: r._count.userRoles }));
  }

  /**
   * Stop someone's access (a munshi who left): they cannot sign in and every session ends now. Not yourself.
   * Give it back with startAccess. History stays (v2 review: Settings).
   */
  async stopAccess(tenantId: string, id: string, actorId: string) {
    if (id === actorId) throw new BadRequestException({ code: 'SELF', message: 'You cannot stop your own access' });
    const user = await this.ownUser(tenantId, id);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id }, data: { isActive: false } }),
      this.prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    await this.auditService.log({ tenantId, userId: actorId, action: 'USER_BLOCKED', entityType: 'User', entityId: id, metadataJson: { userName: user.name } });
    return { ok: true };
  }

  async startAccess(tenantId: string, id: string, actorId: string) {
    const user = await this.ownUser(tenantId, id);
    await this.prisma.user.update({ where: { id }, data: { isActive: true, failedPinAttempts: 0, pinLockedUntil: null } });
    await this.auditService.log({ tenantId, userId: actorId, action: 'USER_UNBLOCKED', entityType: 'User', entityId: id, metadataJson: { userName: user.name } });
    return { ok: true };
  }

  /** Fix a name or phone. Someone who signs in with phone + PIN keeps a phone. */
  async updateDetails(tenantId: string, id: string, dto: { name?: string; phone?: string }, actorId: string) {
    const user = await this.prisma.user.findFirst({ where: { id, tenantId }, select: { id: true, name: true, phone: true, pinHash: true } });
    if (!user) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Person not found' });
    const data: { name?: string; phone?: string | null } = {};
    if (dto.name !== undefined && dto.name.trim() !== user.name) data.name = dto.name.trim();
    if (dto.phone !== undefined) {
      const raw = dto.phone.trim();
      const phone = raw ? toE164(raw) : null;
      if (raw && !phone) throw new BadRequestException({ code: 'PHONE_INVALID', message: 'Enter a valid phone number, e.g. 0300 1234567' });
      if (!phone && user.pinHash) throw new BadRequestException({ code: 'PHONE_NEEDED', message: 'They sign in with this phone; it cannot be empty' });
      if (phone !== user.phone) data.phone = phone;
    }
    if (!Object.keys(data).length) return { ok: true };
    try {
      await this.prisma.user.update({ where: { id }, data });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException({ code: 'PHONE_TAKEN', message: 'This phone already has a login' });
      throw e;
    }
    await this.auditService.log({ tenantId, userId: actorId, action: 'USER_UPDATED', entityType: 'User', entityId: id, metadataJson: { before: { name: user.name, phone: user.phone }, after: data } });
    return { ok: true };
  }

  /** One role per person on Team: the new one replaces the old. Not your own (you could lock yourself out). */
  async setRole(tenantId: string, id: string, roleId: string, actorId: string) {
    if (id === actorId) throw new BadRequestException({ code: 'SELF', message: 'You cannot change your own role' });
    await this.ownUser(tenantId, id);
    const role = await this.prisma.role.findFirst({ where: { id: roleId, tenantId }, select: { id: true, name: true } });
    if (!role) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Role not found' });
    await this.prisma.$transaction([
      this.prisma.userRole.deleteMany({ where: { userId: id } }),
      this.prisma.userRole.create({ data: { userId: id, roleId } }),
    ]);
    await this.auditService.log({ tenantId, userId: actorId, action: 'USER_ROLE_CHANGED', entityType: 'User', entityId: id, metadataJson: { role: role.name } });
    return { ok: true };
  }

  /** Someone who signs in with email: a first password is made for the owner to pass on (they change it later). */
  async addPerson(tenantId: string, dto: { name: string; email: string; roleId: string }, actorId: string) {
    const role = await this.prisma.role.findFirst({ where: { id: dto.roleId, tenantId }, select: { id: true } });
    if (!role) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Role not found' });
    const email = dto.email.trim().toLowerCase();
    if (await this.prisma.user.findFirst({ where: { email } })) throw new ConflictException({ code: 'EMAIL_TAKEN', message: 'This email already has a login' });
    const created = await this.create(tenantId, { name: dto.name.trim(), email, roleIds: [role.id] }, actorId);
    // A password made by ThriftOS: they set their own at the first sign-in.
    await this.prisma.user.update({ where: { id: created.id }, data: { mustChangePassword: true } });
    return { id: created.id, temporaryPassword: (created as { temporaryPassword?: string }).temporaryPassword };
  }

  /**
   * Adds staff who sign in with phone + PIN (no email or password) in a role: a staff role (Manager, Buyer, Sorter,
   * Salesman, Cashier) or one the owner made; never the owner's own role. Sorter when no role is given.
   */
  async createMunshi(tenantId: string, dto: CreateMunshiDto, actorId: string) {
    const phone = toE164(dto.phone);
    if (!phone) throw new BadRequestException({ code: 'PHONE_INVALID', message: 'Enter a valid phone number, e.g. 0300 1234567' });
    const pinHash = await this.passwordService.hash(dto.pin);
    try {
      const user = await this.prisma.$transaction(async (tx) => {
        await ensureStaffRoles(tx, tenantId);
        const role = dto.roleId
          ? await tx.role.findFirst({ where: { id: dto.roleId, tenantId }, select: { id: true, name: true } })
          : await tx.role.findFirst({ where: { tenantId, name: dto.roleName ?? 'Sorter' }, select: { id: true, name: true } });
        if (!role) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Role not found' });
        // The owner's role (or any role that may manage the team) is not for staff.
        const ownerLevel = role.name === 'Admin' || (await tx.rolePermission.count({ where: { roleId: role.id, permission: { code: 'user.create' } } })) > 0;
        if (ownerLevel) throw new BadRequestException({ code: 'OWNER_ROLE', message: 'Staff cannot have the owner role' });
        const roleId = role.id;
        return tx.user.create({
          data: { tenantId, name: dto.name.trim(), phone, pinHash, userRoles: { create: { roleId } } },
          select: { id: true, name: true, phone: true, isActive: true },
        });
      });
      await this.auditService.log({ tenantId, userId: actorId, action: 'STAFF_ADDED', entityType: 'User', entityId: user.id, metadataJson: { name: user.name, phone } });
      return user;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException({ code: 'PHONE_TAKEN', message: 'This phone already has a login' });
      throw e;
    }
  }

  /** New PIN (also unlocks it). */
  async setPin(tenantId: string, id: string, pin: string, actorId: string) {
    await this.ownUser(tenantId, id);
    await this.prisma.user.update({ where: { id }, data: { pinHash: await this.passwordService.hash(pin), failedPinAttempts: 0, pinLockedUntil: null } });
    await this.auditService.log({ tenantId, userId: actorId, action: 'PIN_RESET', entityType: 'User', entityId: id });
    return { ok: true };
  }

  /** Unlock a PIN locked after wrong tries (the PIN stays the same). */
  async unlockPin(tenantId: string, id: string, actorId: string) {
    await this.ownUser(tenantId, id);
    await this.prisma.user.update({ where: { id }, data: { failedPinAttempts: 0, pinLockedUntil: null } });
    await this.auditService.log({ tenantId, userId: actorId, action: 'PIN_UNLOCKED', entityType: 'User', entityId: id });
    return { ok: true };
  }

  private async ownUser(tenantId: string, id: string) {
    const user = await this.prisma.user.findFirst({ where: { id, tenantId }, select: { id: true, name: true } });
    if (!user) throw new NotFoundException({ code: 'NOT_FOUND', message: 'User not found' });
    return user;
  }
}
