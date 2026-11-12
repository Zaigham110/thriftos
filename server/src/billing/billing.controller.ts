import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Put, Query, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { SuperAdminOnly } from '../common/decorators/super-admin.decorator';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { PermissionGuard } from '../common/guards/permission.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { BillingService, UploadedShot } from './billing.service';
import { PayToDto, PaymentsQueryDto, RejectPaymentDto, SetTenantPlanDto, SubmitPaymentDto, UpdatePlanDto } from './billing.dto';

/** The owner's Plan and billing page (Phase 7): where the business stands, the plans, paying, invoices. */
@Controller('billing')
@UseGuards(TenantGuard, PermissionGuard)
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get()
  @RequirePermissions('tenant.update')
  status(@TenantId() tenantId: string) {
    return this.billing.status(tenantId);
  }

  @Post('payments')
  @RequirePermissions('tenant.update')
  @UseInterceptors(FileInterceptor('screenshot', { limits: { fileSize: 5 * 1024 * 1024 + 1 } }))
  pay(@TenantId() tenantId: string, @CurrentUser() user: CurrentUserData, @Body() dto: SubmitPaymentDto, @UploadedFile() shot?: UploadedShot) {
    return this.billing.submitPayment(tenantId, user.userId, dto, shot);
  }

  @Get('payments/:id/invoice')
  @RequirePermissions('tenant.update')
  invoice(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.billing.invoice(id, tenantId);
  }

  @Get('payments/:id/screenshot')
  @RequirePermissions('tenant.update')
  async screenshot(@TenantId() tenantId: string, @Param('id') id: string, @Res() res: Response) {
    const f = await this.billing.screenshot(id, tenantId);
    res.setHeader('Content-Type', f.type);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(f.data);
  }
}

/** The super admin's billing console (Phase 7): plans, payments to confirm, a business's plan, revenue, pay-to details. */
@Controller('superadmin/billing')
@UseGuards(TenantGuard)
@SuperAdminOnly()
export class SuperAdminBillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('plans')
  plans() {
    return this.billing.plans();
  }

  @Patch('plans/:id')
  updatePlan(@Param('id') id: string, @Body() dto: UpdatePlanDto, @CurrentUser() user: CurrentUserData) {
    return this.billing.updatePlan(id, dto, user.userId);
  }

  @Get('payments')
  payments(@Query() q: PaymentsQueryDto) {
    return this.billing.payments(q.status);
  }

  @Post('payments/:id/confirm')
  @HttpCode(HttpStatus.OK)
  confirm(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.billing.confirm(id, user.userId);
  }

  @Post('payments/:id/reject')
  @HttpCode(HttpStatus.OK)
  reject(@Param('id') id: string, @Body() dto: RejectPaymentDto, @CurrentUser() user: CurrentUserData) {
    return this.billing.reject(id, dto.reason, user.userId);
  }

  @Get('payments/:id/screenshot')
  async screenshot(@Param('id') id: string, @Res() res: Response) {
    const f = await this.billing.screenshot(id, null);
    res.setHeader('Content-Type', f.type);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(f.data);
  }

  @Get('payments/:id/invoice')
  invoice(@Param('id') id: string) {
    return this.billing.invoice(id, null);
  }

  @Get('tenants/:id')
  tenant(@Param('id') id: string) {
    return this.billing.tenantBilling(id);
  }

  @Patch('tenants/:id')
  setTenantPlan(@Param('id') id: string, @Body() dto: SetTenantPlanDto, @CurrentUser() user: CurrentUserData) {
    return this.billing.setTenantPlan(id, dto, user.userId);
  }

  @Get('revenue')
  revenue() {
    return this.billing.revenue();
  }

  @Get('pay-to')
  payTo() {
    return this.billing.payTo();
  }

  @Put('pay-to')
  setPayTo(@Body() dto: PayToDto, @CurrentUser() user: CurrentUserData) {
    return this.billing.setPayTo(dto, user.userId);
  }
}
