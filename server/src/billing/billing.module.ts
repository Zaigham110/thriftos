import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditModule } from '../audit/audit.module';
import { FileStorageService } from '../common/storage/file-storage.service';
import { PrismaModule } from '../prisma/prisma.module';
import { BillingController, SuperAdminBillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { ReadOnlyInterceptor } from './read-only.interceptor';

/** Phase 7: plans, trial, manual payments, grace and read-only. Global so creating businesses and logins can use it. */
@Global()
@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [BillingController, SuperAdminBillingController],
  providers: [BillingService, FileStorageService, { provide: APP_INTERCEPTOR, useClass: ReadOnlyInterceptor }],
  exports: [BillingService],
})
export class BillingModule {}
