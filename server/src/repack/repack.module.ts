import { Module } from '@nestjs/common';
import { RepackSessionModule } from './repack-session/repack-session.module';
import { RepackUnitModule } from './repack-unit/repack-unit.module';
import { RepackItemModule } from './repack-item/repack-item.module';
import { QrLabelModule } from './qr-label/qr-label.module';

@Module({
  imports: [RepackSessionModule, RepackUnitModule, RepackItemModule, QrLabelModule],
})
export class RepackModule {}


