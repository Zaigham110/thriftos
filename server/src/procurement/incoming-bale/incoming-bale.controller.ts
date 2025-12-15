import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { IncomingBaleService } from './incoming-bale.service';
import { CreateIncomingBaleDto } from './dto/create-incoming-bale.dto';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';

@Controller('procurement/incoming-bales')
@UseGuards(TenantGuard, PermissionGuard)
export class IncomingBaleController {
  constructor(private readonly incomingBaleService: IncomingBaleService) {}

  @Post()
  @RequirePermissions('po.create')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateIncomingBaleDto,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.incomingBaleService.create(tenantId, dto, user.userId);
  }

  @Get()
  @RequirePermissions('po.read')
  async findAll(
    @Query('containerId') containerId: string,
    @Query('vendorId') vendorId: string,
    @Query('standalone') standalone: boolean,
    @Query('page') page: number,
    @Query('limit') limit: number,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.incomingBaleService.findAll(tenantId, {
      containerId,
      vendorId,
      standalone,
      page,
      limit,
    });
  }

  @Get(':id')
  @RequirePermissions('po.read')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.incomingBaleService.findOne(tenantId, id);
  }

  @Patch(':id')
  @RequirePermissions('po.update')
  async update(
    @Param('id') id: string,
    @Body() dto: Partial<CreateIncomingBaleDto>,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.incomingBaleService.update(tenantId, id, dto, user.userId);
  }

  @Delete(':id')
  @RequirePermissions('po.delete')
  @HttpCode(HttpStatus.OK)
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.incomingBaleService.delete(tenantId, id, user.userId);
  }
}

