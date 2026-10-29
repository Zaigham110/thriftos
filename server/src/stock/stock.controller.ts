import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser, CurrentUserData, RequirePermissions, TenantId } from '../common/decorators';
import { PermissionGuard } from '../common/guards/permission.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { BaleService } from './bale.service';
import { DirectStockService } from './direct-stock.service';
import { InventoryService } from './inventory.service';
import { AvailableStockQueryDto, MakeBaleDto, OpenBaleDto, ReceiveReadyStockDto, StockItemsQueryDto } from './stock.dto';

@Controller('stock/bales')
@UseGuards(TenantGuard, PermissionGuard)
export class BalesController {
  constructor(private readonly bales: BaleService) {}

  @Get()
  @RequirePermissions('REPACK_VIEW')
  list(@TenantId() tenantId: string) {
    return this.bales.list(tenantId);
  }

  @Get('available-stock')
  @RequirePermissions('REPACK_VIEW')
  availableStock(@TenantId() tenantId: string, @Query() query: AvailableStockQueryDto) {
    return this.bales.availableStock(tenantId, query);
  }

  @Post()
  @RequirePermissions('REPACK_ALLOCATE')
  make(@TenantId() tenantId: string, @Body() dto: MakeBaleDto, @CurrentUser() user: CurrentUserData) {
    return this.bales.makeBale(tenantId, dto, user.userId);
  }

  @Get(':id')
  @RequirePermissions('REPACK_VIEW')
  findOne(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.bales.findOne(tenantId, id);
  }

  @Get(':id/qr')
  @RequirePermissions('REPACK_VIEW')
  qr(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.bales.qr(tenantId, id);
  }
}

@Controller('stock/items')
@UseGuards(TenantGuard, PermissionGuard)
export class StockItemsController {
  constructor(
    private readonly inventory: InventoryService,
    private readonly directStock: DirectStockService,
  ) {}

  /** Receive stock bought ready to sell. */
  @Post()
  @RequirePermissions('INVENTORY_INTAKE')
  receive(@TenantId() tenantId: string, @Body() dto: ReceiveReadyStockDto, @CurrentUser() user: CurrentUserData) {
    return this.directStock.receive(tenantId, dto, user.userId);
  }

  @Post(':id/open')
  @RequirePermissions('INVENTORY_ADJUST')
  open(@TenantId() tenantId: string, @Param('id') id: string, @Body() dto: OpenBaleDto, @CurrentUser() user: CurrentUserData) {
    return this.directStock.open(tenantId, id, dto, user.userId);
  }

  @Get('summary')
  @RequirePermissions('INVENTORY_VIEW')
  summary(@TenantId() tenantId: string) {
    return this.inventory.getSummary(tenantId);
  }

  @Get('filter-options')
  @RequirePermissions('INVENTORY_VIEW')
  filterOptions(@TenantId() tenantId: string) {
    return this.inventory.getFilterOptions(tenantId);
  }

  @Get()
  @RequirePermissions('INVENTORY_VIEW')
  list(@TenantId() tenantId: string, @Query() query: StockItemsQueryDto) {
    return this.inventory.findAll(tenantId, query);
  }

  @Get(':id/traceability')
  @RequirePermissions('INVENTORY_VIEW')
  traceability(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.inventory.getTraceability(tenantId, id);
  }

  @Get(':id')
  @RequirePermissions('INVENTORY_VIEW')
  findOne(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.inventory.findOne(tenantId, id);
  }
}
