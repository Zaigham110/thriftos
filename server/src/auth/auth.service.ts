import { Injectable, UnauthorizedException, BadRequestException, HttpException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordService } from './password.service';
import { AuditService } from '../audit/audit.service';
import { LoginDto, LoginResponseDto, PinLoginDto } from './dto/login.dto';
import { toE164 } from '../common/phone/phone';
import { RefreshResponseDto } from './dto/refresh.dto';
import { JwtPayload } from './jwt.strategy';
import { randomBytes } from 'crypto';
import { CurrentUserData } from '../common/decorators/current-user.decorator';

/** Wrong PINs in a row before the PIN locks, and for how long. */
export const MAX_PIN_ATTEMPTS = 5;
export const PIN_LOCK_MINUTES = 15;

@Injectable()
export class AuthService {
  private readonly accessTokenExpiresIn: number;
  private readonly refreshTokenExpiresIn: number;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private passwordService: PasswordService,
    private configService: ConfigService,
    private auditService: AuditService,
  ) {
    this.accessTokenExpiresIn = parseInt(this.configService.get('JWT_ACCESS_EXPIRES_IN') || '900', 10); // 15 minutes
    this.refreshTokenExpiresIn = parseInt(this.configService.get('JWT_REFRESH_EXPIRES_IN') || '604800', 10); // 7 days
  }

  async login(dto: LoginDto, ipAddress?: string, userAgent?: string): Promise<LoginResponseDto> {
    // Find user by email (search across all tenants)
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email.toLowerCase() },
      include: {
        tenant: true,
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      await this.auditService.log({
        action: 'AUTH_LOGIN_FAILED',
        metadataJson: { email: dto.email, reason: 'User not found' },
        ipAddress,
        userAgent,
      });
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      await this.auditService.log({
        userId: user.id,
        tenantId: user.tenantId,
        action: 'AUTH_LOGIN_FAILED',
        metadataJson: { reason: 'Account inactive' },
        ipAddress,
        userAgent,
      });
      throw new UnauthorizedException('Account is inactive');
    }

    const isPasswordValid = !!user.passwordHash && (await this.passwordService.compare(dto.password, user.passwordHash));
    if (!isPasswordValid) {
      await this.auditService.log({
        userId: user.id,
        tenantId: user.tenantId,
        action: 'AUTH_LOGIN_FAILED',
        metadataJson: { reason: 'Invalid password' },
        ipAddress,
        userAgent,
      });
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.signIn(user, 'AUTH_LOGIN_SUCCESS', ipAddress, userAgent);
  }

  /**
   * Munshi sign-in with phone + PIN. Five wrong PINs in a row lock the PIN for 15 minutes (the owner can
   * unlock it sooner). The answer never says whether a phone is registered.
   */
  async loginWithPin(dto: PinLoginDto, ipAddress?: string, userAgent?: string): Promise<LoginResponseDto> {
    const phone = toE164(dto.phone);
    const user = phone
      ? await this.prisma.user.findUnique({ where: { phone }, include: { tenant: true, userRoles: { include: { role: true } } } })
      : null;
    const wrong = (triesLeft?: number) =>
      new UnauthorizedException({ message: 'Phone or PIN is wrong', code: 'PIN_WRONG', ...(triesLeft !== undefined && { triesLeft }) });

    if (!user || !user.pinHash || !user.isActive) {
      await this.auditService.log({ action: 'AUTH_PIN_FAILED', metadataJson: { phone: dto.phone, reason: 'Unknown phone or no PIN' }, ipAddress, userAgent });
      throw wrong();
    }
    const now = new Date();
    if (user.pinLockedUntil && user.pinLockedUntil > now) throw this.locked(user.pinLockedUntil, now);

    if (!(await this.passwordService.compare(dto.pin, user.pinHash))) {
      // Counted in the database, so attempts at the same moment are all counted.
      const counted = await this.prisma.user.update({ where: { id: user.id }, data: { failedPinAttempts: { increment: 1 } }, select: { failedPinAttempts: true } });
      await this.auditService.log({ userId: user.id, tenantId: user.tenantId, action: 'AUTH_PIN_FAILED', metadataJson: { attempts: counted.failedPinAttempts }, ipAddress, userAgent });
      if (counted.failedPinAttempts >= MAX_PIN_ATTEMPTS) {
        const until = new Date(now.getTime() + PIN_LOCK_MINUTES * 60_000);
        await this.prisma.user.update({ where: { id: user.id }, data: { pinLockedUntil: until, failedPinAttempts: 0 } });
        await this.auditService.log({ userId: user.id, tenantId: user.tenantId, action: 'AUTH_PIN_LOCKED', metadataJson: { until: until.toISOString() }, ipAddress, userAgent });
        throw this.locked(until, now);
      }
      throw wrong(MAX_PIN_ATTEMPTS - counted.failedPinAttempts);
    }

    if (user.failedPinAttempts || user.pinLockedUntil) {
      await this.prisma.user.update({ where: { id: user.id }, data: { failedPinAttempts: 0, pinLockedUntil: null } });
    }
    return this.signIn(user, 'AUTH_PIN_SUCCESS', ipAddress, userAgent);
  }

  private locked(until: Date, now: Date): HttpException {
    const minutes = Math.max(1, Math.ceil((until.getTime() - now.getTime()) / 60_000));
    return new HttpException({ message: `PIN locked. Try again in ${minutes} minutes or ask the owner.`, code: 'PIN_LOCKED', minutes, lockedUntil: until.toISOString() }, 423);
  }

  /** Tokens and the user view after a successful sign-in (password or PIN). */
  private async signIn(
    user: { id: string; email: string | null; name: string; phone?: string | null; tenantId: string; tenant: { id: string; name: string } | null },
    action: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<LoginResponseDto> {
    // Check if user is Super Admin (belongs to SYSTEM tenant)
    const superAdminConfig = await this.prisma.globalConfig.findUnique({
      where: { key: 'system.superAdminTenantId' },
    });
    const superAdminTenantId = (superAdminConfig?.valueJson as any)?.tenantId;
    const isSuperAdmin = user.tenantId === superAdminTenantId;

    // Generate tokens
    const tokens = await this.generateTokens(
      user.id,
      user.email,
      isSuperAdmin ? null : user.tenantId,
      isSuperAdmin,
    );

    // Log successful login
    await this.auditService.log({
      userId: user.id,
      tenantId: user.tenantId,
      action,
      ipAddress,
      userAgent,
    });

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone ?? null,
        name: user.name,
        tenantId: isSuperAdmin ? null : user.tenantId,
        isSuperAdmin,
        role: isSuperAdmin ? 'SUPERADMIN' : 'TENANT_USER',
        tenants: isSuperAdmin
          ? []
          : user.tenant
            ? [{ id: user.tenant.id, name: user.tenant.name }]
            : [],
      },
    };
  }

  async logout(userId: string, refreshToken?: string, ipAddress?: string, userAgent?: string): Promise<void> {
    // Revoke the refresh token if provided
    if (refreshToken) {
      await this.prisma.refreshToken.updateMany({
        where: {
          userId,
          token: refreshToken,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });
    } else {
      // Revoke all refresh tokens for the user
      await this.prisma.refreshToken.updateMany({
        where: {
          userId,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { tenantId: true },
    });

    await this.auditService.log({
      userId,
      tenantId: user?.tenantId,
      action: 'AUTH_LOGOUT',
      ipAddress,
      userAgent,
    });
  }

  async refreshTokens(refreshToken: string, ipAddress?: string, userAgent?: string): Promise<RefreshResponseDto> {
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
    });

    if (!storedToken || storedToken.revokedAt || storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: storedToken.userId },
      select: {
        id: true,
        email: true,
        tenantId: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    // Revoke old refresh token
    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });

    // Check if user is Super Admin
    const superAdminConfig = await this.prisma.globalConfig.findUnique({
      where: { key: 'system.superAdminTenantId' },
    });
    const superAdminTenantId = (superAdminConfig?.valueJson as any)?.tenantId;
    const isSuperAdmin = user.tenantId === superAdminTenantId;

    // Generate new tokens
    const tokens = await this.generateTokens(
      user.id,
      user.email,
      isSuperAdmin ? null : user.tenantId,
      isSuperAdmin,
    );

    await this.auditService.log({
      userId: user.id,
      tenantId: user.tenantId,
      action: 'AUTH_TOKEN_REFRESH',
      ipAddress,
      userAgent,
    });

    return tokens;
  }

  async createImpersonationToken(
    superAdminId: string,
    targetTenantId: string,
    ipAddress?: string,
    userAgent?: string,
    reason?: string,
  ): Promise<{ accessToken: string; expiresIn: number }> {
    const superAdmin = await this.prisma.user.findUnique({
      where: { id: superAdminId },
      select: { tenantId: true, email: true },
    });

    if (!superAdmin) {
      throw new BadRequestException('Only super admins can impersonate tenants');
    }

    const superAdminConfig = await this.prisma.globalConfig.findUnique({
      where: { key: 'system.superAdminTenantId' },
    });
    const superAdminTenantId = (superAdminConfig?.valueJson as any)?.tenantId;
    const isSuperAdmin = Boolean(superAdminTenantId) && superAdmin.tenantId === superAdminTenantId;
    if (!isSuperAdmin) {
      throw new BadRequestException('Only super admins can impersonate tenants');
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: targetTenantId },
    });

    if (!tenant) {
      throw new BadRequestException('Target tenant not found');
    }

    const payload: JwtPayload = {
      sub: superAdminId,
      email: superAdmin.email,
      tenantId: null,
      isSuperAdmin: true,
      impersonatedTenantId: targetTenantId,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.accessTokenExpiresIn,
    });

    await this.auditService.log({
      userId: superAdminId,
      tenantId: targetTenantId,
      action: 'SUPERADMIN_IMPERSONATE',
      entityType: 'Tenant',
      entityId: targetTenantId,
      metadataJson: { tenantName: tenant.name, readOnly: true, ...(reason ? { reason } : {}) },
      ipAddress,
      userAgent,
    });

    return {
      accessToken,
      expiresIn: this.accessTokenExpiresIn,
    };
  }

  async exitImpersonation(user: CurrentUserData, ipAddress?: string, userAgent?: string): Promise<void> {
    if (!user.isSuperAdmin) {
      throw new BadRequestException('Only super admins can exit impersonation');
    }

    if (!user.impersonatedTenantId) {
      // Idempotent: allow calling exit even if not impersonating.
      return;
    }

    await this.auditService.log({
      userId: user.userId,
      tenantId: user.impersonatedTenantId,
      action: 'SUPERADMIN_EXIT_IMPERSONATION',
      ipAddress,
      userAgent,
    });
  }

  private async generateTokens(
    userId: string,
    email: string | null,
    tenantId: string | null,
    isSuperAdmin: boolean,
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    const payload: JwtPayload = {
      sub: userId,
      email,
      tenantId,
      isSuperAdmin,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.accessTokenExpiresIn,
    });

    const refreshToken = randomBytes(64).toString('hex');

    // Store refresh token
    await this.prisma.refreshToken.create({
      data: {
        userId,
        token: refreshToken,
        expiresAt: new Date(Date.now() + this.refreshTokenExpiresIn * 1000),
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: this.accessTokenExpiresIn,
    };
  }
}

