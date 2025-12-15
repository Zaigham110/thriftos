"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StockMovementModule = void 0;
const common_1 = require("@nestjs/common");
const stock_movement_controller_1 = require("./stock-movement.controller");
const stock_movement_service_1 = require("./stock-movement.service");
let StockMovementModule = class StockMovementModule {
};
exports.StockMovementModule = StockMovementModule;
exports.StockMovementModule = StockMovementModule = __decorate([
    (0, common_1.Module)({
        controllers: [stock_movement_controller_1.StockMovementController],
        providers: [stock_movement_service_1.StockMovementService],
        exports: [stock_movement_service_1.StockMovementService],
    })
], StockMovementModule);
//# sourceMappingURL=stock-movement.module.js.map