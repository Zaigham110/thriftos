import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordService } from './password.service';
import { AuditService } from '../audit/audit.service';
import { LoginDto, LoginResponseDto } from './dto/login.dto';
import { RefreshResponseDto } from './dto/refresh.dto';
export declare class AuthService {
    private prisma;
    private jwtService;
    private passwordService;
    private configService;
    private auditService;
    private readonly accessTokenExpiresIn;
    private readonly refreshTokenExpiresIn;
    constructor(prisma: PrismaService, jwtService: JwtService, passwordService: PasswordService, configService: ConfigService, auditService: AuditService);
    login(dto: LoginDto, ipAddress?: string, userAgent?: string): Promise<LoginResponseDto>;
    logout(userId: string, refreshToken?: string, ipAddress?: string, userAgent?: string): Promise<void>;
    refreshTokens(refreshToken: string, ipAddress?: string, userAgent?: string): Promise<RefreshResponseDto>;
    createImpersonationToken(superAdminId: string, targetTenantId: string, ipAddress?: string, userAgent?: string): Promise<{
        accessToken: string;
        expiresIn: number;
    }>;
    private generateTokens;
}
