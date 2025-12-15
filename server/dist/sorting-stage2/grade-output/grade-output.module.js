"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GradeOutputModule = void 0;
const common_1 = require("@nestjs/common");
const grade_output_controller_1 = require("./grade-output.controller");
const grade_output_service_1 = require("./grade-output.service");
let GradeOutputModule = class GradeOutputModule {
};
exports.GradeOutputModule = GradeOutputModule;
exports.GradeOutputModule = GradeOutputModule = __decorate([
    (0, common_1.Module)({
        controllers: [grade_output_controller_1.GradeOutputController],
        providers: [grade_output_service_1.GradeOutputService],
        exports: [grade_output_service_1.GradeOutputService],
    })
], GradeOutputModule);
//# sourceMappingURL=grade-output.module.js.map