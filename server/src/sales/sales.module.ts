import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { SalesController } from './sales.controller';
import { CustomersController } from './customers.controller';
import { SalesService } from './sales.service';
import { TenantSequenceModule } from '../procurement/shared/tenant-sequence.module';

@Module({
  imports: [PrismaModule, AuditModule, TenantSequenceModule],
  controllers: [SalesController, CustomersController],
  providers: [SalesService],
  exports: [SalesService],
})
export class SalesModule {}
