import { Module } from '@nestjs/common';
import { TenantSequenceService } from './tenant-sequence.service';

@Module({
  providers: [TenantSequenceService],
  exports: [TenantSequenceService],
})
export class TenantSequenceModule {}
