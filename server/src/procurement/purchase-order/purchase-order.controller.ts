import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { PurchaseOrderStatus } from '@prisma/client';
import { PurchaseOrderService } from './purchase-order.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';

import { RequireModule } from '../../common/decorators/require-module.decorator';

@RequireModule('PURCHASE_ORDERS')
@Controller('procurement/purchase-orders')
@UseGuards(TenantGuard, PermissionGuard)
export class PurchaseOrderController {
  constructor(private readonly purchaseOrderService: PurchaseOrderService) {}

  @Post()
  @RequirePermissions('po.create')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreatePurchaseOrderDto,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.purchaseOrderService.create(tenantId, dto, user.userId);
  }

  @Get()
  @RequirePermissions('po.read')
  async findAll(
    @Query('status') status: PurchaseOrderStatus,
    @Query('page') page: number,
    @Query('limit') limit: number,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.purchaseOrderService.findAll(tenantId, { status, page, limit });
  }

  @Get(':id')
  @RequirePermissions('po.read')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.purchaseOrderService.findOne(tenantId, id);
  }

  @Patch(':id')
  @RequirePermissions('po.update')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePurchaseOrderDto,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.purchaseOrderService.update(tenantId, id, dto, user.userId);
  }

  @Patch(':id/receive')
  @RequirePermissions('po.update')
  @HttpCode(HttpStatus.OK)
  async receive(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.purchaseOrderService.receive(tenantId, id, user.userId);
  }

  @Patch(':id/close')
  @RequirePermissions('po.update')
  @HttpCode(HttpStatus.OK)
  async close(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.purchaseOrderService.close(tenantId, id, user.userId);
  }
}

