"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SortingReportsModule = void 0;
const common_1 = require("@nestjs/common");
const prisma_module_1 = require("../../prisma/prisma.module");
const audit_module_1 = require("../../audit/audit.module");
const reports_audit_service_1 = require("../common/reports-audit.service");
const reports_consistency_service_1 = require("../common/reports-consistency.service");
const sorting_reports_controller_1 = require("./sorting-reports.controller");
const sorting_reports_service_1 = require("./sorting-reports.service");
let SortingReportsModule = class SortingReportsModule {
};
exports.SortingReportsModule = SortingReportsModule;
exports.SortingReportsModule = SortingReportsModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule, audit_module_1.AuditModule],
        controllers: [sorting_reports_controller_1.SortingReportsController],
        providers: [sorting_reports_service_1.SortingReportsService, reports_audit_service_1.ReportsAuditService, reports_consistency_service_1.ReportsConsistencyService],
    })
], SortingReportsModule);
//# sourceMappingURL=sorting-reports.module.js.map