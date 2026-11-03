import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { TenantModule } from '../tenant/tenant.module';
import { UsersModule } from '../users/users.module';
import { RolesModule } from '../roles/roles.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { SortingModule } from '../sorting/sorting.module';
import { VendorModule } from '../procurement/vendor/vendor.module';
import { WasteModule } from '../waste/waste.module';

import { AdminCategoriesController } from './categories/admin-categories.controller';
import { AdminWarehousesController } from './warehouses/admin-warehouses.controller';
import { AdminGradesController } from './grades/admin-grades.controller';
import { AdminVendorsController } from './vendors/admin-vendors.controller';
import { AdminUsersController } from './users/admin-users.controller';
import { AdminRolesController } from './roles/admin-roles.controller';
import { AdminPermissionsController } from './permissions/admin-permissions.controller';
import { AdminWasteCategoriesController } from './waste-categories/admin-waste-categories.controller';

@Module({
  imports: [
    CommonModule,
    TenantModule,
    UsersModule,
    RolesModule,
    PermissionsModule,
    SortingModule,
    VendorModule,
    WasteModule,
  ],
  controllers: [
    AdminCategoriesController,
    AdminWarehousesController,
    AdminGradesController,
    AdminVendorsController,
    AdminUsersController,
    AdminRolesController,
    AdminPermissionsController,
    AdminWasteCategoriesController,
  ],
})
export class AdminModule {}
