import { Body, Controller, Get, Headers, Param, Patch, Post, Query, SetMetadata, UseGuards } from '@nestjs/common';
import { ModuleGuard, REQUIRED_MODULE_KEY } from '../common/guards/module.guard';
import { CurrentUser, CurrentUserData, Public, TenantId } from '../common/decorators';
import { TenantGuard } from '../common/guards/tenant.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CreateSaleDto, FulfillSaleDto, LanguageQueryDto, LastPriceQueryDto, SetShipmentDto } from './dto';
import { SalesService } from './sales.service';

@Controller('sales')
@UseGuards(TenantGuard)
export class SalesController {
  constructor(private readonly sales: SalesService) {}

  /** QR scan: the bale behind a code, if it can still be sold (does not add it to a sale). */
  @Get('scan/qr/:code')
  scan(@TenantId() tenantId: string, @Param('code') code: string) {
    return this.sales.scan(tenantId, code);
  }

  @Get('last-price')
  lastPrice(@TenantId() tenantId: string, @Query() query: LastPriceQueryDto) {
    return this.sales.lastPrice(tenantId, query);
  }

  /** Saves a whole sale. Send an Idempotency-Key so a repeat (offline sync, double tap) creates one sale. */
  @Post()
  @UseGuards(PermissionGuard)
  @RequirePermissions('sale.create')
  create(
    @TenantId() tenantId: string,
    @Body() dto: CreateSaleDto,
    @CurrentUser() user: CurrentUserData,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.sales.create(tenantId, dto, user.userId, idempotencyKey);
  }

  @Get()
  list(@TenantId() tenantId: string) {
    return this.sales.list(tenantId);
  }

  @Get(':id')
  get(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.sales.get(tenantId, id);
  }

  @Get(':id/whatsapp')
  whatsapp(@TenantId() tenantId: string, @Param('id') id: string, @Query() query: LanguageQueryDto) {
    return this.sales.whatsapp(tenantId, id, query.lang);
  }

  /** A printable bill: the customer's bill plus their balance now and the bill link (v2 6.3). */
  @Get(':id/print')
  print(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.sales.printBill(tenantId, id);
  }

  /** Phase 9.2: an export sale's shipment details, changed later; a local sale can be made an export sale here. */
  @Patch(':id/shipment')
  @UseGuards(PermissionGuard)
  @RequirePermissions('sale.create')
  shipment(@TenantId() tenantId: string, @Param('id') id: string, @Body() dto: SetShipmentDto, @CurrentUser() user: CurrentUserData) {
    return this.sales.setShipment(tenantId, id, dto, user.userId);
  }

  /** Phase 9.2: the export pack (packing list, commercial invoice, each bale's sorting record). */
  @Get(':id/export-pack')
  @UseGuards(ModuleGuard)
  @SetMetadata(REQUIRED_MODULE_KEY, 'EXPORT')
  exportPack(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.sales.exportPack(tenantId, id);
  }

  @Post(':id/fulfill')
  fulfill(@TenantId() tenantId: string, @Param('id') id: string, @Body() dto: FulfillSaleDto, @CurrentUser() user: CurrentUserData) {
    return this.sales.fulfill(tenantId, id, dto.fulfillmentReference, user.userId);
  }
}

/** The bill link shared on WhatsApp: no login, found only by its unguessable token. */
@Controller('public/bills')
@Public()
export class PublicBillController {
  constructor(private readonly sales: SalesService) {}

  @Get(':token')
  bill(@Param('token') token: string) {
    return this.sales.publicBill(token);
  }
}
