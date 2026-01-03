"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportsModule = void 0;
const common_1 = require("@nestjs/common");
const procurement_reports_module_1 = require("./procurement-reports/procurement-reports.module");
const sorting_reports_module_1 = require("./sorting-reports/sorting-reports.module");
const grading_reports_module_1 = require("./grading-reports/grading-reports.module");
const repack_reports_module_1 = require("./repack-reports/repack-reports.module");
const inventory_reports_module_1 = require("./inventory-reports/inventory-reports.module");
const waste_reports_module_1 = require("./waste-reports/waste-reports.module");
const worker_reports_module_1 = require("./worker-reports/worker-reports.module");
const cost_reports_module_1 = require("./cost-reports/cost-reports.module");
const dashboard_reports_module_1 = require("./dashboard-reports/dashboard-reports.module");
let ReportsModule = class ReportsModule {
};
exports.ReportsModule = ReportsModule;
exports.ReportsModule = ReportsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            dashboard_reports_module_1.DashboardReportsModule,
            procurement_reports_module_1.ProcurementReportsModule,
            sorting_reports_module_1.SortingReportsModule,
            grading_reports_module_1.GradingReportsModule,
            repack_reports_module_1.RepackReportsModule,
            inventory_reports_module_1.InventoryReportsModule,
            waste_reports_module_1.WasteReportsModule,
            worker_reports_module_1.WorkerReportsModule,
            cost_reports_module_1.CostReportsModule,
        ],
    })
], ReportsModule);
//# sourceMappingURL=reports.module.js.map