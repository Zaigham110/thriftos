"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SortCategoryBucketModule = void 0;
const common_1 = require("@nestjs/common");
const sort_category_bucket_controller_1 = require("./sort-category-bucket.controller");
const sort_category_bucket_service_1 = require("./sort-category-bucket.service");
let SortCategoryBucketModule = class SortCategoryBucketModule {
};
exports.SortCategoryBucketModule = SortCategoryBucketModule;
exports.SortCategoryBucketModule = SortCategoryBucketModule = __decorate([
    (0, common_1.Module)({
        controllers: [sort_category_bucket_controller_1.SortCategoryBucketController],
        providers: [sort_category_bucket_service_1.SortCategoryBucketService],
        exports: [sort_category_bucket_service_1.SortCategoryBucketService],
    })
], SortCategoryBucketModule);
//# sourceMappingURL=sort-category-bucket.module.js.map