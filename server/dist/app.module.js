"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const throttler_1 = require("@nestjs/throttler");
const prisma_module_1 = require("./prisma/prisma.module");
const auth_module_1 = require("./auth/auth.module");
const superadmin_module_1 = require("./superadmin/superadmin.module");
const roles_module_1 = require("./roles/roles.module");
const permissions_module_1 = require("./permissions/permissions.module");
const users_module_1 = require("./users/users.module");
const audit_module_1 = require("./audit/audit.module");
const tenant_module_1 = require("./tenant/tenant.module");
const procurement_module_1 = require("./procurement/procurement.module");
const sorting_stage1_module_1 = require("./sorting-stage1/sorting-stage1.module");
const sorting_stage2_module_1 = require("./sorting-stage2/sorting-stage2.module");
const repack_module_1 = require("./repack/repack.module");
const inventory_module_1 = require("./inventory/inventory.module");
const reports_module_1 = require("./reports/reports.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                envFilePath: '../.env',
            }),
            throttler_1.ThrottlerModule.forRoot([
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
            prisma_module_1.PrismaModule,
            audit_module_1.AuditModule,
            auth_module_1.AuthModule,
            roles_module_1.RolesModule,
            permissions_module_1.PermissionsModule,
            users_module_1.UsersModule,
            superadmin_module_1.SuperAdminModule,
            tenant_module_1.TenantModule,
            procurement_module_1.ProcurementModule,
            sorting_stage1_module_1.SortingStage1Module,
            sorting_stage2_module_1.SortingStage2Module,
            repack_module_1.RepackModule,
            inventory_module_1.InventoryModule,
            reports_module_1.ReportsModule,
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map