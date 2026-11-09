import { Controller, Get, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';
import { TenantGuard } from '../common/guards/tenant.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { SkipPermissionCheck } from '../common/decorators/permissions.decorator';

@ApiTags('Me')
@ApiBearerAuth('JWT-auth')
@Controller('me')
@UseGuards(TenantGuard, PermissionGuard)
export class MeController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  @Get()
  @SkipPermissionCheck()
  @ApiOperation({ summary: 'Get current user profile', description: 'Returns authenticated user data and permissions' })
  @ApiResponse({ status: 200, description: 'User profile retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMe(@CurrentUser() currentUser: CurrentUserData) {
    const user = await this.prisma.user.findUnique({
      where: { id: currentUser.userId },
      select: {
        id: true,
        email: true,
        phone: true,
        pinHash: true,
        name: true,
        tenantId: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    const permissions = currentUser.isSuperAdmin
      ? []
      : await this.usersService.getUserPermissions(currentUser.userId);

    return {
      user: {
        id: user.id,
        email: user.email,
        // Settings shows how this person signs in, and "Change my PIN" for those with a PIN (v2 review).
        phone: user.phone,
        hasPin: !!user.pinHash,
        name: user.name,
        tenantId: currentUser.isSuperAdmin ? null : user.tenantId,
        isSuperAdmin: currentUser.isSuperAdmin,
        impersonatedTenantId: currentUser.impersonatedTenantId ?? null,
      },
      permissions,
    };
  }
}
