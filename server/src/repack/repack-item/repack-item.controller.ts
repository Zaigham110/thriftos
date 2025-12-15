import { Body, Controller, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import { CreateRepackItemDto } from './dto';
import { RepackItemService } from './repack-item.service';

@Controller('repack')
@UseGuards(TenantGuard, PermissionGuard)
export class RepackItemController {
  constructor(private readonly service: RepackItemService) {}

  @Post('units/:id/items')
  @RequirePermissions('REPACK_EDIT')
  @HttpCode(HttpStatus.CREATED)
  async addItem(
    @Param('id') unitId: string,
    @Body() dto: CreateRepackItemDto,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.service.addItem(tenantId, unitId, dto, user.userId);
  }
}


