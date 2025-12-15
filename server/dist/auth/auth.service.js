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
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const config_1 = require("@nestjs/config");
const prisma_service_1 = require("../prisma/prisma.service");
const password_service_1 = require("./password.service");
const audit_service_1 = require("../audit/audit.service");
const crypto_1 = require("crypto");
let AuthService = class AuthService {
    constructor(prisma, jwtService, passwordService, configService, auditService) {
        this.prisma = prisma;
        this.jwtService = jwtService;
        this.passwordService = passwordService;
        this.configService = configService;
        this.auditService = auditService;
        this.accessTokenExpiresIn = parseInt(this.configService.get('JWT_ACCESS_EXPIRES_IN') || '900', 10);
        this.refreshTokenExpiresIn = parseInt(this.configService.get('JWT_REFRESH_EXPIRES_IN') || '604800', 10);
    }
    async login(dto, ipAddress, userAgent) {
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
            throw new common_1.UnauthorizedException('Invalid email or password');
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
            throw new common_1.UnauthorizedException('Account is inactive');
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
            throw new common_1.UnauthorizedException('Invalid email or password');
        }
        const superAdminConfig = await this.prisma.globalConfig.findUnique({
            where: { key: 'system.superAdminTenantId' },
        });
        const superAdminTenantId = superAdminConfig?.valueJson?.tenantId;
        const isSuperAdmin = user.tenantId === superAdminTenantId;
        const tokens = await this.generateTokens(user.id, user.email, user.tenantId, isSuperAdmin);
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
                tenantId: user.tenantId,
                isSuperAdmin,
            },
        };
    }
    async logout(userId, refreshToken, ipAddress, userAgent) {
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
        }
        else {
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
    async refreshTokens(refreshToken, ipAddress, userAgent) {
        const storedToken = await this.prisma.refreshToken.findUnique({
            where: { token: refreshToken },
        });
        if (!storedToken || storedToken.revokedAt || storedToken.expiresAt < new Date()) {
            throw new common_1.UnauthorizedException('Invalid or expired refresh token');
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
            throw new common_1.UnauthorizedException('User not found or inactive');
        }
        await this.prisma.refreshToken.update({
            where: { id: storedToken.id },
            data: { revokedAt: new Date() },
        });
        const superAdminConfig = await this.prisma.globalConfig.findUnique({
            where: { key: 'system.superAdminTenantId' },
        });
        const superAdminTenantId = superAdminConfig?.valueJson?.tenantId;
        const isSuperAdmin = user.tenantId === superAdminTenantId;
        const tokens = await this.generateTokens(user.id, user.email, user.tenantId, isSuperAdmin);
        await this.auditService.log({
            userId: user.id,
            tenantId: user.tenantId,
            action: 'AUTH_TOKEN_REFRESH',
            ipAddress,
            userAgent,
        });
        return tokens;
    }
    async createImpersonationToken(superAdminId, targetTenantId, ipAddress, userAgent) {
        const superAdmin = await this.prisma.user.findUnique({
            where: { id: superAdminId },
            select: { tenantId: true, email: true },
        });
        if (!superAdmin || superAdmin.tenantId !== null) {
            throw new common_1.BadRequestException('Only super admins can impersonate tenants');
        }
        const tenant = await this.prisma.tenant.findUnique({
            where: { id: targetTenantId },
        });
        if (!tenant) {
            throw new common_1.BadRequestException('Target tenant not found');
        }
        const payload = {
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
    async generateTokens(userId, email, tenantId, isSuperAdmin) {
        const payload = {
            sub: userId,
            email,
            tenantId,
            isSuperAdmin,
        };
        const accessToken = this.jwtService.sign(payload, {
            expiresIn: this.accessTokenExpiresIn,
        });
        const refreshToken = (0, crypto_1.randomBytes)(64).toString('hex');
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
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService,
        password_service_1.PasswordService,
        config_1.ConfigService,
        audit_service_1.AuditService])
], AuthService);
//# sourceMappingURL=auth.service.js.map