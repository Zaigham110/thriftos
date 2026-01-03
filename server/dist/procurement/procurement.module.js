"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcurementModule = void 0;
const common_1 = require("@nestjs/common");
const purchase_order_module_1 = require("./purchase-order/purchase-order.module");
const vendor_module_1 = require("./vendor/vendor.module");
const container_module_1 = require("./container/container.module");
const rag_module_1 = require("./rag/rag.module");
const incoming_bale_module_1 = require("./incoming-bale/incoming-bale.module");
const cost_allocation_service_1 = require("./cost-allocation/cost-allocation.service");
const procurement_dashboard_module_1 = require("./dashboard/procurement-dashboard.module");
let ProcurementModule = class ProcurementModule {
};
exports.ProcurementModule = ProcurementModule;
exports.ProcurementModule = ProcurementModule = __decorate([
    (0, common_1.Module)({
        imports: [
            purchase_order_module_1.PurchaseOrderModule,
            vendor_module_1.VendorModule,
            container_module_1.ContainerModule,
            rag_module_1.RagModule,
            incoming_bale_module_1.IncomingBaleModule,
            procurement_dashboard_module_1.ProcurementDashboardModule,
        ],
        providers: [cost_allocation_service_1.CostAllocationService],
        exports: [cost_allocation_service_1.CostAllocationService],
    })
], ProcurementModule);
//# sourceMappingURL=procurement.module.js.map