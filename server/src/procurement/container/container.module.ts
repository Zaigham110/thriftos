import { Module } from '@nestjs/common';
import { ContainerController } from './container.controller';
import { ContainerService } from './container.service';
import { TenantSequenceModule } from '../shared/tenant-sequence.module';

@Module({
  imports: [TenantSequenceModule],
  controllers: [ContainerController],
  providers: [ContainerService],
  exports: [ContainerService],
})
export class ContainerModule {}

