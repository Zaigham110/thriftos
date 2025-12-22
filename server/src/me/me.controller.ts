import { Controller, Get, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';
import { TenantGuard } from '../common/guards/tenant.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { SkipPermissionCheck } from '../common/decorators/permissions.decorator';

/**
 * MeController - Returns the currently authenticated user's data.
 * 
 * Security: TenantGuard + PermissionGuard applied for guard consistency.
 * Uses SkipPermissionCheck since any authenticated user should be able 
 * to retrieve their own profile - this is not a privileged operation.
 */
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
        name: user.name,
        tenantId: currentUser.isSuperAdmin ? null : user.tenantId,
        isSuperAdmin: currentUser.isSuperAdmin,
        impersonatedTenantId: currentUser.impersonatedTenantId ?? null,
      },
      permissions,
    };
  }
}
