import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { MeasurementType } from '@prisma/client';
import { SalesService } from './sales.service';
import {
  AddSaleLineDto,
  CreatePaymentDto,
  CreateSaleDto,
  UpdateSaleDto,
} from './dto';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';

@Controller('sales')
export class SalesController {
  constructor(private readonly sales: SalesService) {}

  private requireTenant(user: CurrentUserData): string {
    const tenantId = user?.impersonatedTenantId ?? user?.tenantId;
    if (!tenantId) throw new ForbiddenException('Tenant context required');
    return tenantId;
  }

  // QR scan resolution: validate tenant + AVAILABLE only; do not auto-add to sale
  @Get('scan/qr/:code')
  async scanQr(@CurrentUser() user: CurrentUserData, @Param('code') code: string) {
    const tenantId = this.requireTenant(user);
    return this.sales.resolveQrToInventoryItem(tenantId, code);
  }

  @Post()
  async create(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: CreateSaleDto,
  ) {
    const tenantId = this.requireTenant(user);
    return this.sales.createSale(tenantId, { customerId: dto.customerId, type: dto.type }, user.userId);
  }

  @Get()
  async list(@CurrentUser() user: CurrentUserData) {
    const tenantId = this.requireTenant(user);
    return this.sales.listSales(tenantId);
  }

  @Get(':id')
  async get(@CurrentUser() user: CurrentUserData, @Param('id') id: string) {
    const tenantId = this.requireTenant(user);
    return this.sales.getSale(tenantId, id);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
    @Body() dto: UpdateSaleDto,
  ) {
    const tenantId = this.requireTenant(user);
    return this.sales.updateSale(tenantId, id, { customerId: dto.customerId, type: dto.type });
  }

  @Post(':id/lines')
  async addLine(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
    @Body() dto: AddSaleLineDto,
  ) {
    const tenantId = this.requireTenant(user);
    return this.sales.addLine(
      tenantId,
      id,
      {
        inventoryItemId: dto.inventoryItemId,
        measurementType: dto.measurementType as MeasurementType,
        quantity: dto.quantity,
        unitPrice: dto.unitPrice,
      },
      user.userId,
    );
  }

  @Delete(':saleId/lines/:lineId')
  async deleteLine(
    @CurrentUser() user: CurrentUserData,
    @Param('saleId') saleId: string,
    @Param('lineId') lineId: string,
  ) {
    const tenantId = this.requireTenant(user);
    return this.sales.deleteLine(tenantId, saleId, lineId, user.userId);
  }

  @Post(':id/issue')
  async issue(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
  ) {
    const tenantId = this.requireTenant(user);
    return this.sales.issue(tenantId, id, user.userId);
  }

  @Post(':id/cancel')
  async cancel(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
  ) {
    const tenantId = this.requireTenant(user);
    return this.sales.cancel(tenantId, id, user.userId);
  }

  @Post(':id/payments')
  async addPayment(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
    @Body() dto: CreatePaymentDto,
  ) {
    const tenantId = this.requireTenant(user);
    return this.sales.addPayment(tenantId, id, { amount: dto.amount, method: dto.method }, user.userId);
  }
}
