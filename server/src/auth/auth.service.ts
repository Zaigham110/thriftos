import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordService } from './password.service';
import { AuditService } from '../audit/audit.service';
import { LoginDto, LoginResponseDto } from './dto/login.dto';
import { RefreshResponseDto } from './dto/refresh.dto';
import { JwtPayload } from './jwt.strategy';
import { randomBytes } from 'crypto';
import { CurrentUserData } from '../common/decorators/current-user.decorator';

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

    const isPasswordValid = await this.passwordService.compare(dto.password, user.passwordHash);
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
      action: 'AUTH_LOGIN_SUCCESS',
      ipAddress,
      userAgent,
    });

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        tenantId: isSuperAdmin ? null : user.tenantId,
        isSuperAdmin,
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
      metadataJson: { tenantName: tenant.name },
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
    email: string,
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

