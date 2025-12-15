"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SortingStage1Module = void 0;
const common_1 = require("@nestjs/common");
const sort_session_module_1 = require("./sort-session/sort-session.module");
const sort_category_bucket_module_1 = require("./sort-category-bucket/sort-category-bucket.module");
const category_output_module_1 = require("./category-output/category-output.module");
let SortingStage1Module = class SortingStage1Module {
};
exports.SortingStage1Module = SortingStage1Module;
exports.SortingStage1Module = SortingStage1Module = __decorate([
    (0, common_1.Module)({
        imports: [sort_session_module_1.SortSessionModule, sort_category_bucket_module_1.SortCategoryBucketModule, category_output_module_1.CategoryOutputModule],
    })
], SortingStage1Module);
//# sourceMappingURL=sorting-stage1.module.js.map