import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
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
import { SortingFacadeModule } from './sorting-facade/sorting-facade.module';
import { WasteModule } from './waste/waste.module';
import { RepackModule } from './repack/repack.module';
import { InventoryModule } from './inventory/inventory.module';
import { ReportsModule } from './reports/reports.module';
import { HealthModule } from './health/health.module';
import { AdminModule } from './admin/admin.module';
import { SalesModule } from './sales/sales.module';
import { SearchModule } from './search/search.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../.env', 'server/.env'],
    }),

    // Rate limiting
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => [
        {
          name: 'short',
          ttl: parseInt(configService.get<string>('THROTTLE_TTL_SHORT') || '1000', 10),
          limit: parseInt(configService.get<string>('THROTTLE_LIMIT_SHORT') || '30', 10),
        },
        {
          name: 'medium',
          ttl: parseInt(configService.get<string>('THROTTLE_TTL_MEDIUM') || '10000', 10),
          limit: parseInt(configService.get<string>('THROTTLE_LIMIT_MEDIUM') || '150', 10),
        },
        {
          name: 'long',
          ttl: parseInt(configService.get<string>('THROTTLE_TTL_LONG') || '60000', 10),
          limit: parseInt(configService.get<string>('THROTTLE_LIMIT_LONG') || '500', 10),
        },
      ],
    }),

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
    AdminModule,
    TenantModule,

    // Business modules
    ProcurementModule,
    SortingStage1Module,
    SortingStage2Module,
    SortingFacadeModule,
    WasteModule,
    RepackModule,
    InventoryModule,
    SalesModule,
    ReportsModule,
    SearchModule,
  ],
})
export class AppModule {}

