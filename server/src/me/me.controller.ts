import { Body, Controller, Get, Patch, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { OperationMode } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';
import { TenantGuard } from '../common/guards/tenant.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { SkipPermissionCheck } from '../common/decorators/permissions.decorator';

class UpdatePreferencesDto {
  @IsEnum(OperationMode)
  @IsOptional()
  preferredOperationMode?: OperationMode | null;
}

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
        preferredOperationMode: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    const effectiveTenantId = currentUser.impersonatedTenantId || user.tenantId;
    let tenantOperationMode: OperationMode = 'FULL_ERP';
    if (effectiveTenantId) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: effectiveTenantId },
        select: { operationMode: true },
      });
      if (tenant) {
        tenantOperationMode = tenant.operationMode;
      }
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
        preferredOperationMode: user.preferredOperationMode ?? null,
        tenantOperationMode,
      },
      permissions,
    };
  }

  @Patch('preferences')
  @SkipPermissionCheck()
  @ApiOperation({ summary: 'Update current user preferences', description: 'Updates preferred operation mode for current user' })
  async updatePreferences(
    @CurrentUser() currentUser: CurrentUserData,
    @Body() dto: UpdatePreferencesDto,
  ) {
    const updated = await this.prisma.user.update({
      where: { id: currentUser.userId },
      data: {
        preferredOperationMode: dto.preferredOperationMode ?? null,
      },
      select: {
        id: true,
        preferredOperationMode: true,
      },
    });

    return updated;
  }
}
