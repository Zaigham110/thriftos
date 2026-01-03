"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SortingFacadeModule = void 0;
const common_1 = require("@nestjs/common");
const rag_module_1 = require("../procurement/rag/rag.module");
const incoming_bale_module_1 = require("../procurement/incoming-bale/incoming-bale.module");
const sort_session_module_1 = require("../sorting-stage1/sort-session/sort-session.module");
const sort_category_bucket_module_1 = require("../sorting-stage1/sort-category-bucket/sort-category-bucket.module");
const category_output_module_1 = require("../sorting-stage1/category-output/category-output.module");
const grade_session_module_1 = require("../sorting-stage2/grade-session/grade-session.module");
const grade_bucket_module_1 = require("../sorting-stage2/grade-bucket/grade-bucket.module");
const grade_output_module_1 = require("../sorting-stage2/grade-output/grade-output.module");
const waste_module_1 = require("../waste/waste.module");
const sorting_stage1_facade_controller_1 = require("./stage-1/sorting-stage1-facade.controller");
const sorting_stage2_facade_controller_1 = require("./stage-2/sorting-stage2-facade.controller");
const sorting_outputs_facade_controller_1 = require("./outputs/sorting-outputs-facade.controller");
let SortingFacadeModule = class SortingFacadeModule {
};
exports.SortingFacadeModule = SortingFacadeModule;
exports.SortingFacadeModule = SortingFacadeModule = __decorate([
    (0, common_1.Module)({
        imports: [
            rag_module_1.RagModule,
            incoming_bale_module_1.IncomingBaleModule,
            sort_session_module_1.SortSessionModule,
            sort_category_bucket_module_1.SortCategoryBucketModule,
            category_output_module_1.CategoryOutputModule,
            grade_session_module_1.GradeSessionModule,
            grade_bucket_module_1.GradeBucketModule,
            grade_output_module_1.GradeOutputModule,
            waste_module_1.WasteModule,
        ],
        controllers: [sorting_stage1_facade_controller_1.SortingStage1FacadeController, sorting_stage2_facade_controller_1.SortingStage2FacadeController, sorting_outputs_facade_controller_1.SortingOutputsFacadeController],
    })
], SortingFacadeModule);
//# sourceMappingURL=sorting-facade.module.js.map