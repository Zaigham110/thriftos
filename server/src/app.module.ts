import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { SuperAdminModule } from './superadmin/superadmin.module';
import { RolesModule } from './roles/roles.module';
import { PermissionsModule } from './permissions/permissions.module';
import { UsersModule } from './users/users.module';
import { MeModule } from './me/me.module';
import { AuditModule } from './audit/audit.module';
import { TenantModule } from './tenant/tenant.module';
import { ProcurementModule } from './procurement/procurement.module';
import { SortingStage1Module } from './sorting-stage1/sorting-stage1.module';
import { SortingStage2Module } from './sorting-stage2/sorting-stage2.module';
import { RepackModule } from './repack/repack.module';
import { InventoryModule } from './inventory/inventory.module';
import { ReportsModule } from './reports/reports.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../.env',
    }),

    // Rate limiting
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,
        limit: 3,
      },
      {
        name: 'medium',
        ttl: 10000,
        limit: 20,
      },
      {
        name: 'long',
        ttl: 60000,
        limit: 100,
      },
    ]),

    // Core modules
    PrismaModule,
    AuditModule,
    HealthModule,

    // Auth & RBAC
    AuthModule,
    RolesModule,
    PermissionsModule,
    UsersModule,
    MeModule,

    // Admin modules
    SuperAdminModule,
    TenantModule,

    // Business modules
    ProcurementModule,
    SortingStage1Module,
    SortingStage2Module,
    RepackModule,
    InventoryModule,
    ReportsModule,
  ],
})
export class AppModule {}

