"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SortingStage2Module = void 0;
const common_1 = require("@nestjs/common");
const grade_session_module_1 = require("./grade-session/grade-session.module");
const grade_bucket_module_1 = require("./grade-bucket/grade-bucket.module");
const grade_output_module_1 = require("./grade-output/grade-output.module");
let SortingStage2Module = class SortingStage2Module {
};
exports.SortingStage2Module = SortingStage2Module;
exports.SortingStage2Module = SortingStage2Module = __decorate([
    (0, common_1.Module)({
        imports: [grade_session_module_1.GradeSessionModule, grade_bucket_module_1.GradeBucketModule, grade_output_module_1.GradeOutputModule],
    })
], SortingStage2Module);
//# sourceMappingURL=sorting-stage2.module.js.map