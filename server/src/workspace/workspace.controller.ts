import { RequireModule } from '../common/decorators/require-module.decorator';
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';
import { RequireAnyPermission, RequirePermissions } from '../common/decorators/permissions.decorator';
import { SEE_SALES, SET_CREDIT_LIMIT, WORK_CUSTOMERS } from '../sales/sales-access';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { PermissionGuard } from '../common/guards/permission.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { ListsService } from '../lists/lists.service';
import { WorkspaceRecordsService } from './records.service';
import { CreditLimitDto, PromiseDto, ReceivablesService, ReminderDto, StatementQueryDto } from './receivables.service';
import { SortingRecordsService, YieldQueryDto } from './sorting-records.service';
import { AnalyticsService, PeriodDto, SalesAnalyticsQueryDto, ScorecardQueryDto } from './analytics.service';
import { PriceEntryDto, PriceGroupDto, PriceListsService } from './price-lists.service';
import { BookQueryDto, CancelExpenseDto, CashMoveDto, CloseDto, CloseQueryDto, ExpenseDto, ExpenseUpdateDto, FinanceService, PnlQueryDto, ReopenDto } from './finance.service';
import { StockCountDto, StockDecisionDto, StockRecordsService, StockTransferDto, StockTransferManyDto, StockPriceDto, StockKindPriceDto } from './stock-records.service';

/** Workspace record pages (enterprise plan E3): one call per page; cost and profit need cost.view. */
@Controller('workspace')
@UseGuards(TenantGuard, PermissionGuard)
export class WorkspaceController {
  constructor(
    private readonly records: WorkspaceRecordsService,
    private readonly lists: ListsService,
    private readonly stock: StockRecordsService,
    private readonly receivables: ReceivablesService,
    private readonly sorting: SortingRecordsService,
    private readonly finance: FinanceService,
    private readonly prices: PriceListsService,
    private readonly analytics: AnalyticsService,
  ) {}

  private async canSeeCost(user: CurrentUserData): Promise<boolean> {
    return (await this.lists.permissionsOf(user)).has('cost.view');
  }

  @RequireModule('CONTAINERS')
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

  /** One price for every item of a kind in stock. */
  @Patch('stock/price')
  @RequirePermissions('price.manage')
  async stockKindPrice(@TenantId() tenantId: string, @Body() dto: StockKindPriceDto, @CurrentUser() user: CurrentUserData) {
    return this.stock.setKindPrice(tenantId, dto, user.userId);
  }

  /** The sale price of one stock item. */
  @Patch('stock/items/:id/price')
  @RequirePermissions('price.manage')
  async stockItemPrice(@TenantId() tenantId: string, @Param('id') id: string, @Body() dto: StockPriceDto, @CurrentUser() user: CurrentUserData) {
    return this.stock.setPrice(tenantId, id, dto, user.userId);
  }

  /** Inventory by what it is: bales or items in stock and sorted kg not baled, per category and grade. */
  @Get('stock/by-item')
  @RequirePermissions('INVENTORY_VIEW')
  async stockByItem(@TenantId() tenantId: string, @CurrentUser() user: CurrentUserData) {
    return this.stock.byItem(tenantId, await this.canSeeCost(user));
  }

  @Get('stock/:id')
  @RequirePermissions('INVENTORY_VIEW')
  async stockItem(@TenantId() tenantId: string, @CurrentUser() user: CurrentUserData, @Param('id') id: string) {
    return this.stock.item(tenantId, id, await this.canSeeCost(user));
  }

  /** A stock count; the books change only when someone with INVENTORY_APPROVE approves it. */
  @RequireModule('STOCK_COUNTS')
  @Post('stock/:id/counts')
  @RequirePermissions('INVENTORY_ADJUST')
  count(@TenantId() tenantId: string, @CurrentUser() user: CurrentUserData, @Param('id') id: string, @Body() dto: StockCountDto) {
    return this.stock.requestCount(tenantId, id, dto, user.userId);
  }

  @RequireModule('STOCK_COUNTS')
  @Post('stock-counts/:id/approve')
  @HttpCode(200)
  @RequirePermissions('INVENTORY_APPROVE')
  approve(@TenantId() tenantId: string, @CurrentUser() user: CurrentUserData, @Param('id') id: string, @Body() dto: StockDecisionDto) {
    return this.stock.decide(tenantId, id, true, dto, user.userId);
  }

  @RequireModule('STOCK_COUNTS')
  @Post('stock-counts/:id/reject')
  @HttpCode(200)
  @RequirePermissions('INVENTORY_APPROVE')
  reject(@TenantId() tenantId: string, @CurrentUser() user: CurrentUserData, @Param('id') id: string, @Body() dto: StockDecisionDto) {
    return this.stock.decide(tenantId, id, false, dto, user.userId);
  }

  /** Phase 9.3: a scanned bale for the move screen (what it is, what is left, where it is). */
  @RequireModule('WAREHOUSES')
  @Get('stock/scan/:code')
  @RequirePermissions('INVENTORY_ADJUST')
  scanForMove(@TenantId() tenantId: string, @Param('code') code: string) {
    return this.stock.scanForMove(tenantId, code);
  }

  /** Phase 9.3: several bales to one godown in one go. */
  @RequireModule('WAREHOUSES')
  @Post('stock/transfer')
  @HttpCode(200)
  @RequirePermissions('INVENTORY_ADJUST')
  transferMany(@TenantId() tenantId: string, @CurrentUser() user: CurrentUserData, @Body() dto: StockTransferManyDto) {
    return this.stock.transferMany(tenantId, dto, user.userId);
  }

  /** Move what is left of a stock item to another godown. */
  @RequireModule('WAREHOUSES')
  @Post('stock/:id/transfer')
  @HttpCode(200)
  @RequirePermissions('INVENTORY_ADJUST')
  transfer(@TenantId() tenantId: string, @CurrentUser() user: CurrentUserData, @Param('id') id: string, @Body() dto: StockTransferDto) {
    return this.stock.transfer(tenantId, id, dto, user.userId);
  }

  // ---- Sorting (E3.2) ----
  /** Yield analysis over finished sorting: by supplier, origin, raw type, container or month. */
  @RequireModule('SORT')
  @Get('sorting/yield')
  @RequirePermissions('SORTING_STAGE1_VIEW')
  sortingYield(@TenantId() tenantId: string, @Query() q: YieldQueryDto) {
    return this.sorting.yieldAnalysis(tenantId, q);
  }

  /** A lot's sorting record: stage 1 categories, stage 2 grades, waste, cost. */
  @RequireModule('SORT')
  @Get('sorting/:lotId')
  @RequirePermissions('SORTING_STAGE1_VIEW')
  async sortingLot(@TenantId() tenantId: string, @CurrentUser() user: CurrentUserData, @Param('lotId') id: string) {
    return this.sorting.lot(tenantId, id, await this.canSeeCost(user));
  }

  // ---- Dashboards and analytics (E4) ----
  @Get('dashboard')
  @RequirePermissions('REPORTS_VIEW')
  async dashboard(@TenantId() tenantId: string, @CurrentUser() user: CurrentUserData, @Query() q: PeriodDto) {
    const perms = await this.lists.permissionsOf(user);
    return this.analytics.dashboard(tenantId, q, { cost: perms.has('cost.view'), finance: perms.has('finance.view') });
  }

  @Get('analytics/suppliers')
  @RequirePermissions('REPORTS_VIEW')
  async scorecard(@TenantId() tenantId: string, @CurrentUser() user: CurrentUserData, @Query() q: ScorecardQueryDto) {
    return this.analytics.scorecard(tenantId, q, await this.canSeeCost(user));
  }

  @Get('analytics/sales')
  @RequirePermissions('REPORTS_VIEW')
  async salesAnalytics(@TenantId() tenantId: string, @CurrentUser() user: CurrentUserData, @Query() q: SalesAnalyticsQueryDto) {
    return this.analytics.sales(tenantId, q, await this.canSeeCost(user));
  }

  // ---- Price lists (E3.4) ----
  @RequireModule('PRICE_LISTS')
  @Get('price-lists')
  @RequirePermissions('price.manage')
  priceLists(@TenantId() tenantId: string) {
    return this.prices.overview(tenantId);
  }

  @RequireModule('PRICE_LISTS')
  @Put('price-lists/entries')
  @RequirePermissions('price.manage')
  setPrice(@TenantId() tenantId: string, @CurrentUser() user: CurrentUserData, @Body() dto: PriceEntryDto) {
    return this.prices.setPrice(tenantId, dto, user.userId);
  }

  @RequireModule('PRICE_LISTS')
  @Delete('price-lists/entries/:id')
  @RequirePermissions('price.manage')
  removePrice(@TenantId() tenantId: string, @CurrentUser() user: CurrentUserData, @Param('id') id: string) {
    return this.prices.removePrice(tenantId, id, user.userId);
  }

  @RequireModule('PRICE_LISTS')
  @Patch('customers/:id/price-group')
  @RequirePermissions('price.manage')
  priceGroup(@TenantId() tenantId: string, @CurrentUser() user: CurrentUserData, @Param('id') id: string, @Body() dto: PriceGroupDto) {
    return this.prices.setCustomerGroup(tenantId, id, dto, user.userId);
  }

  // ---- Finance (E3.6) ----
  @RequireModule('EXPENSES')
  @Post('expenses')
  @RequirePermissions('expense.create')
  addExpense(@TenantId() tenantId: string, @CurrentUser() user: CurrentUserData, @Body() dto: ExpenseDto) {
    return this.finance.addExpense(tenantId, dto, user.userId);
  }

  @RequireModule('EXPENSES')
  @Get('expenses/:id')
  @RequirePermissions('finance.view')
  expense(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.finance.expense(tenantId, id);
  }

  /** Fix a mistake (v2 review). Changing or cancelling needs Finance as well: a munshi only records. */
  @RequireModule('EXPENSES')
  @Patch('expenses/:id')
  @RequirePermissions('expense.create', 'finance.view')
  updateExpense(@TenantId() tenantId: string, @CurrentUser() user: CurrentUserData, @Param('id') id: string, @Body() dto: ExpenseUpdateDto) {
    return this.finance.updateExpense(tenantId, id, dto, user.userId);
  }

  @RequireModule('EXPENSES')
  @Post('expenses/:id/cancel')
  @HttpCode(200)
  @RequirePermissions('expense.create', 'finance.view')
  cancelExpense(@TenantId() tenantId: string, @CurrentUser() user: CurrentUserData, @Param('id') id: string, @Body() dto: CancelExpenseDto) {
    return this.finance.cancelExpense(tenantId, id, user.userId, dto.reason);
  }

  /** Cash or bank book by payment method. */
  @RequireModule('CASH_CLOSE', 'EXPENSES')
  @Get('finance/book')
  @RequirePermissions('finance.view')
  book(@TenantId() tenantId: string, @Query() q: BookQueryDto) {
    return this.finance.book(tenantId, q);
  }

  @RequireModule('CASH_CLOSE')
  @Get('finance/close')
  @RequirePermissions('finance.view')
  closeView(@TenantId() tenantId: string, @Query() q: CloseQueryDto) {
    return this.finance.closeView(tenantId, q);
  }

  @RequireModule('CASH_CLOSE')
  @Post('finance/close')
  @RequirePermissions('cash.close')
  closeDay(@TenantId() tenantId: string, @CurrentUser() user: CurrentUserData, @Body() dto: CloseDto) {
    return this.finance.closeDay(tenantId, dto, user.userId);
  }

  /** Undo a wrong count: the latest closed day only, with a reason (v2 review). */
  @RequireModule('CASH_CLOSE')
  @Post('finance/close/:day/reopen')
  @HttpCode(200)
  @RequirePermissions('cash.close')
  reopenDay(@TenantId() tenantId: string, @CurrentUser() user: CurrentUserData, @Param('day') day: string, @Body() dto: ReopenDto) {
    return this.finance.reopenDay(tenantId, day, dto.reason, user.userId);
  }

  /** Cash out of the drawer or into it: bank, owner or other (v2 review). */
  @RequireModule('CASH_CLOSE')
  @Post('finance/cash-moves')
  @RequirePermissions('cash.close')
  addCashMove(@TenantId() tenantId: string, @CurrentUser() user: CurrentUserData, @Body() dto: CashMoveDto) {
    return this.finance.addCashMove(tenantId, dto, user.userId);
  }

  @RequireModule('CASH_CLOSE')
  @Post('finance/cash-moves/:id/cancel')
  @HttpCode(200)
  @RequirePermissions('cash.close')
  cancelCashMove(@TenantId() tenantId: string, @CurrentUser() user: CurrentUserData, @Param('id') id: string) {
    return this.finance.cancelCashMove(tenantId, id, user.userId);
  }

  /** Profit and loss by month; cost of goods needs cost.view too. */
  @RequireModule('PNL')
  @Get('finance/pnl')
  @RequirePermissions('finance.view', 'cost.view')
  pnl(@TenantId() tenantId: string, @Query() q: PnlQueryDto) {
    return this.finance.pnl(tenantId, q);
  }

  // ---- Receivables (E3.5): for people who sell, take payments or keep the books, like the khata (audit H1/H2); profit needs cost.view ----
  /** Collections worklist and ageing: every customer who owes, biggest first. */
  @RequireAnyPermission(...SEE_SALES)
  @RequireModule('KHATA')
  @Get('receivables')
  worklist(@TenantId() tenantId: string) {
    return this.receivables.worklist(tenantId);
  }

  @RequireAnyPermission(...SEE_SALES)
  @Get('customers/:id')
  async customer(@TenantId() tenantId: string, @CurrentUser() user: CurrentUserData, @Param('id') id: string) {
    return this.receivables.customer(tenantId, id, await this.canSeeCost(user));
  }

  @RequireAnyPermission(...SEE_SALES)
  @RequireModule('KHATA')
  @Get('customers/:id/statement')
  statement(@TenantId() tenantId: string, @Param('id') id: string, @Query() q: StatementQueryDto) {
    return this.receivables.statement(tenantId, id, q);
  }

  @RequireAnyPermission(...WORK_CUSTOMERS)
  @RequireModule('KHATA')
  @Post('customers/:id/promises')
  promise(@TenantId() tenantId: string, @CurrentUser() user: CurrentUserData, @Param('id') id: string, @Body() dto: PromiseDto) {
    return this.receivables.addPromise(tenantId, id, dto, user.userId);
  }

  @RequireAnyPermission(...WORK_CUSTOMERS)
  @RequireModule('KHATA')
  @Post('promises/:id/cancel')
  @HttpCode(200)
  cancelPromise(@TenantId() tenantId: string, @CurrentUser() user: CurrentUserData, @Param('id') id: string) {
    return this.receivables.cancelPromise(tenantId, id, user.userId);
  }

  /** The WhatsApp reminder link; logged as a reminder sent. */
  @RequireAnyPermission(...WORK_CUSTOMERS)
  @RequireModule('KHATA')
  @Post('customers/:id/remind')
  @HttpCode(200)
  remind(@TenantId() tenantId: string, @CurrentUser() user: CurrentUserData, @Param('id') id: string, @Body() dto: ReminderDto) {
    return this.receivables.remind(tenantId, id, dto, user.userId);
  }

  @RequirePermissions(SET_CREDIT_LIMIT)
  @RequireModule('KHATA')
  @Patch('customers/:id/credit-limit')
  creditLimit(@TenantId() tenantId: string, @CurrentUser() user: CurrentUserData, @Param('id') id: string, @Body() dto: CreditLimitDto) {
    return this.receivables.setCreditLimit(tenantId, id, dto, user.userId);
  }
}
