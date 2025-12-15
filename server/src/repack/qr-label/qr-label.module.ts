import { Module } from '@nestjs/common';
import { QrLabelController } from './qr-label.controller';
import { QrLabelService } from './qr-label.service';

@Module({
  controllers: [QrLabelController],
  providers: [QrLabelService],
  exports: [QrLabelService],
})
export class QrLabelModule {}


