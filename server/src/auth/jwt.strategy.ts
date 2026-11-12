import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUserData } from '../common/decorators/current-user.decorator';
import { jwtSecret } from './jwt-secret';

export interface JwtPayload {
  sub: string;
  email: string;
  tenantId: string | null;
  isSuperAdmin: boolean;
  impersonatedTenantId?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private prisma: PrismaService,
    configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret(configService),
    });
  }

  async validate(payload: JwtPayload): Promise<CurrentUserData> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
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

    // For super admin, return null as tenantId (they're global)
    const effectiveTenantId = payload.isSuperAdmin ? null : payload.tenantId;

    return {
      userId: payload.sub,
      email: payload.email,
      tenantId: effectiveTenantId,
      isSuperAdmin: payload.isSuperAdmin,
      impersonatedTenantId: payload.impersonatedTenantId,
    };
  }
}
