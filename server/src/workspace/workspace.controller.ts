import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { PermissionGuard } from '../common/guards/permission.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { ListsService } from '../lists/lists.service';
import { WorkspaceRecordsService } from './records.service';
import { StockCountDto, StockDecisionDto, StockRecordsService, StockTransferDto } from './stock-records.service';

/** Workspace record pages (enterprise plan E3): one call per page; cost and profit need cost.view. */
@Controller('workspace')
@UseGuards(TenantGuard, PermissionGuard)
export class WorkspaceController {
  constructor(
    private readonly records: WorkspaceRecordsService,
    private readonly lists: ListsService,
    private readonly stock: StockRecordsService,
  ) {}

  private async canSeeCost(user: CurrentUserData): Promise<boolean> {
    return (await this.lists.permissionsOf(user)).has('cost.view');
  }

  @Get('containers/:id')
  @RequirePermissions('container.read')
  async container(@TenantId() tenantId: string, @CurrentUser() user: CurrentUserData, @Param('id') id: string) {
    return this.records.container(tenantId, id, await this.canSeeCost(user));
  }

  @Get('suppliers/:id')
  @RequirePermissions('vendor.read')
  async supplier(@TenantId() tenantId: string, @CurrentUser() user: CurrentUserData, @Param('id') id: string) {
    return this.records.supplier(tenantId, id, await this.canSeeCost(user));
  }

  // ---- Inventory (E3.3) ----
  @Get('stock/summary')
  @RequirePermissions('INVENTORY_VIEW')
  async stockSummary(@TenantId() tenantId: string, @CurrentUser() user: CurrentUserData) {
    return this.stock.summary(tenantId, await this.canSeeCost(user));
  }

  @Get('stock/:id')
  @RequirePermissions('INVENTORY_VIEW')
  async stockItem(@TenantId() tenantId: string, @CurrentUser() user: CurrentUserData, @Param('id') id: string) {
    return this.stock.item(tenantId, id, await this.canSeeCost(user));
  }

  /** A stock count; the books change only when someone with INVENTORY_APPROVE approves it. */
  @Post('stock/:id/counts')
  @RequirePermissions('INVENTORY_ADJUST')
  count(@TenantId() tenantId: string, @CurrentUser() user: CurrentUserData, @Param('id') id: string, @Body() dto: StockCountDto) {
    return this.stock.requestCount(tenantId, id, dto, user.userId);
  }

  @Post('stock-counts/:id/approve')
  @HttpCode(200)
  @RequirePermissions('INVENTORY_APPROVE')
  approve(@TenantId() tenantId: string, @CurrentUser() user: CurrentUserData, @Param('id') id: string, @Body() dto: StockDecisionDto) {
    return this.stock.decide(tenantId, id, true, dto, user.userId);
  }

  @Post('stock-counts/:id/reject')
  @HttpCode(200)
  @RequirePermissions('INVENTORY_APPROVE')
  reject(@TenantId() tenantId: string, @CurrentUser() user: CurrentUserData, @Param('id') id: string, @Body() dto: StockDecisionDto) {
    return this.stock.decide(tenantId, id, false, dto, user.userId);
  }

  /** Move what is left of a stock item to another godown. */
  @Post('stock/:id/transfer')
  @HttpCode(200)
  @RequirePermissions('INVENTORY_ADJUST')
  transfer(@TenantId() tenantId: string, @CurrentUser() user: CurrentUserData, @Param('id') id: string, @Body() dto: StockTransferDto) {
    return this.stock.transfer(tenantId, id, dto, user.userId);
  }
}
