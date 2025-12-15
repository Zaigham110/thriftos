import { Body, Controller, Delete, HttpCode, HttpStatus, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import { CreateGradeBucketDto, UpdateGradeBucketDto } from './dto';
import { GradeBucketService } from './grade-bucket.service';

@Controller('sorting/stage2')
@UseGuards(TenantGuard, PermissionGuard)
export class GradeBucketController {
  constructor(private readonly service: GradeBucketService) {}

  @Post('sessions/:id/buckets')
  @RequirePermissions('SORTING_STAGE2_EDIT')
  @HttpCode(HttpStatus.CREATED)
  async createForSession(
    @Param('id') sessionId: string,
    @Body() dto: CreateGradeBucketDto,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.service.createForSession(tenantId, sessionId, dto, user.userId);
  }

  @Patch('buckets/:id')
  @RequirePermissions('SORTING_STAGE2_EDIT')
  async update(
    @Param('id') bucketId: string,
    @Body() dto: UpdateGradeBucketDto,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.service.update(tenantId, bucketId, dto, user.userId);
  }

  @Delete('buckets/:id')
  @RequirePermissions('SORTING_STAGE2_EDIT')
  @HttpCode(HttpStatus.OK)
  async delete(@Param('id') bucketId: string, @CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.service.delete(tenantId, bucketId, user.userId);
  }
}


