import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { StockModule } from '../stock/stock.module';
import { PublicBillController, SalesController } from './sales.controller';
import { CustomersController } from './customers.controller';
import { SalesService } from './sales.service';
import { CustomersService } from './customers.service';
import { KhataController } from './khata.controller';
import { KhataService } from './khata.service';
import { FileStorageService } from '../common/storage/file-storage.service';
import { TenantSequenceModule } from '../procurement/shared/tenant-sequence.module';

@Module({
  imports: [PrismaModule, AuditModule, TenantSequenceModule, StockModule],
  controllers: [SalesController, PublicBillController, CustomersController, KhataController],
  providers: [SalesService, CustomersService, KhataService, FileStorageService],
  exports: [SalesService],
})
export class SalesModule {}
