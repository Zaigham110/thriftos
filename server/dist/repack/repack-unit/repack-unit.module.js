"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RepackUnitModule = void 0;
const common_1 = require("@nestjs/common");
const repack_unit_controller_1 = require("./repack-unit.controller");
const repack_unit_service_1 = require("./repack-unit.service");
let RepackUnitModule = class RepackUnitModule {
};
exports.RepackUnitModule = RepackUnitModule;
exports.RepackUnitModule = RepackUnitModule = __decorate([
    (0, common_1.Module)({
        controllers: [repack_unit_controller_1.RepackUnitController],
        providers: [repack_unit_service_1.RepackUnitService],
        exports: [repack_unit_service_1.RepackUnitService],
    })
], RepackUnitModule);
//# sourceMappingURL=repack-unit.module.js.map