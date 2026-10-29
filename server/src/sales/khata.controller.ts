import { Body, Controller, Get, Headers, Param, Post, StreamableFile, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser, CurrentUserData, TenantId } from '../common/decorators';
import { TenantGuard } from '../common/guards/tenant.guard';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { KhataService, UploadedPhoto } from './khata.service';

@Controller('khata')
@UseGuards(TenantGuard)
export class KhataController {
  constructor(private readonly khata: KhataService) {}

  /** Payment received. Send an Idempotency-Key so a repeat (offline sync, double tap) records it once. */
  @Post('payments')
  recordPayment(
    @TenantId() tenantId: string,
    @Body() dto: CreatePaymentDto,
    @CurrentUser() user: CurrentUserData,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.khata.recordPayment(tenantId, dto, user.userId, idempotencyKey);
  }

  @Post('payments/:id/photo')
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
