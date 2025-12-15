"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContainerModule = void 0;
const common_1 = require("@nestjs/common");
const container_controller_1 = require("./container.controller");
const container_service_1 = require("./container.service");
const cost_allocation_service_1 = require("../cost-allocation/cost-allocation.service");
let ContainerModule = class ContainerModule {
};
exports.ContainerModule = ContainerModule;
exports.ContainerModule = ContainerModule = __decorate([
    (0, common_1.Module)({
        controllers: [container_controller_1.ContainerController],
        providers: [container_service_1.ContainerService, cost_allocation_service_1.CostAllocationService],
        exports: [container_service_1.ContainerService],
    })
], ContainerModule);
//# sourceMappingURL=container.module.js.map