import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';
import { RequirePermissions, SkipPermissionCheck } from '../common/decorators/permissions.decorator';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { PermissionGuard } from '../common/guards/permission.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { ListsService } from '../lists/lists.service';
import { WorkspaceRecordsService } from './records.service';
import { CreditLimitDto, PromiseDto, ReceivablesService, ReminderDto, StatementQueryDto } from './receivables.service';
import { StockCountDto, StockDecisionDto, StockRecordsService, StockTransferDto } from './stock-records.service';

/** Workspace record pages (enterprise plan E3): one call per page; cost and profit need cost.view. */
@Controller('workspace')
@UseGuards(TenantGuard, PermissionGuard)
export class WorkspaceController {
  constructor(
    private readonly records: WorkspaceRecordsService,
    private readonly lists: ListsService,
    private readonly stock: StockRecordsService,
    private readonly receivables: ReceivablesService,
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

  // ---- Receivables (E3.5): open to everyone of the business, like the khata; profit needs cost.view ----
  /** Collections worklist and ageing: every customer who owes, biggest first. */
  @SkipPermissionCheck()
  @Get('receivables')
  worklist(@TenantId() tenantId: string) {
    return this.receivables.worklist(tenantId);
  }

  @SkipPermissionCheck()
  @Get('customers/:id')
  async customer(@TenantId() tenantId: string, @CurrentUser() user: CurrentUserData, @Param('id') id: string) {
    return this.receivables.customer(tenantId, id, await this.canSeeCost(user));
  }

  @SkipPermissionCheck()
  @Get('customers/:id/statement')
  statement(@TenantId() tenantId: string, @Param('id') id: string, @Query() q: StatementQueryDto) {
    return this.receivables.statement(tenantId, id, q);
  }

  @SkipPermissionCheck()
  @Post('customers/:id/promises')
  promise(@TenantId() tenantId: string, @CurrentUser() user: CurrentUserData, @Param('id') id: string, @Body() dto: PromiseDto) {
    return this.receivables.addPromise(tenantId, id, dto, user.userId);
  }

  @SkipPermissionCheck()
  @Post('promises/:id/cancel')
  @HttpCode(200)
  cancelPromise(@TenantId() tenantId: string, @CurrentUser() user: CurrentUserData, @Param('id') id: string) {
    return this.receivables.cancelPromise(tenantId, id, user.userId);
  }

  /** The WhatsApp reminder link; logged as a reminder sent. */
  @SkipPermissionCheck()
  @Post('customers/:id/remind')
  @HttpCode(200)
  remind(@TenantId() tenantId: string, @CurrentUser() user: CurrentUserData, @Param('id') id: string, @Body() dto: ReminderDto) {
    return this.receivables.remind(tenantId, id, dto, user.userId);
  }

  @SkipPermissionCheck()
  @Patch('customers/:id/credit-limit')
  creditLimit(@TenantId() tenantId: string, @CurrentUser() user: CurrentUserData, @Param('id') id: string, @Body() dto: CreditLimitDto) {
    return this.receivables.setCreditLimit(tenantId, id, dto, user.userId);
  }
}
