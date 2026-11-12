import { RequireModule } from '../common/decorators/require-module.decorator';
import { Body, Controller, Get, Headers, Param, Post, Query, StreamableFile, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser, CurrentUserData, TenantId } from '../common/decorators';
import { TenantGuard } from '../common/guards/tenant.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { RequireAnyPermission, RequirePermissions } from '../common/decorators/permissions.decorator';
import { SEE_SALES } from './sales-access';
import { CreatePaymentDto, CustomersQueryDto, LanguageQueryDto } from './dto';
import { KhataService, UploadedPhoto } from './khata.service';

@RequireModule('KHATA')
@Controller('khata')
@UseGuards(TenantGuard, PermissionGuard)
@RequireAnyPermission(...SEE_SALES)
export class KhataController {
  constructor(private readonly khata: KhataService) {}

  /** Every customer with what they owe and days overdue, biggest balance first. */
  @Get()
  list(@TenantId() tenantId: string, @Query() query: CustomersQueryDto) {
    return this.khata.list(tenantId, query.search);
  }

  @Get('customers/:id')
  ledger(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.khata.ledger(tenantId, id);
  }

  @Get('customers/:id/reminder')
  reminder(@TenantId() tenantId: string, @Param('id') id: string, @Query() query: LanguageQueryDto) {
    return this.khata.reminder(tenantId, id, query.lang);
  }

  /** Payment received. Send an Idempotency-Key so a repeat (offline sync, double tap) records it once. */
  @Post('payments')
  @RequirePermissions('payment.create')
  recordPayment(
    @TenantId() tenantId: string,
    @Body() dto: CreatePaymentDto,
    @CurrentUser() user: CurrentUserData,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.khata.recordPayment(tenantId, dto, user.userId, idempotencyKey);
  }

  @Get('payments/:id/receipt')
  receipt(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.khata.printReceipt(tenantId, id);
  }

  @Post('payments/:id/photo')
  @RequirePermissions('payment.create')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 + 1 } }))
  attachPhoto(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @UploadedFile() file: UploadedPhoto | undefined,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.khata.attachPhoto(tenantId, id, file, user.userId);
  }

  @Get('payments/:id/photo')
  async photo(@TenantId() tenantId: string, @Param('id') id: string) {
    const photo = await this.khata.photo(tenantId, id);
    return new StreamableFile(photo.data, { type: photo.type });
  }
}
