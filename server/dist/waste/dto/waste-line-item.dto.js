"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateWasteLineItemDto = exports.AddWasteLineItemDto = void 0;
const client_1 = require("@prisma/client");
const class_validator_1 = require("class-validator");
class AddWasteLineItemDto {
}
exports.AddWasteLineItemDto = AddWasteLineItemDto;
__decorate([
    (0, class_validator_1.IsEnum)(client_1.WasteStage),
    __metadata("design:type", String)
], AddWasteLineItemDto.prototype, "stage", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AddWasteLineItemDto.prototype, "wasteCategoryId", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0.01),
    __metadata("design:type", Number)
], AddWasteLineItemDto.prototype, "amount", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AddWasteLineItemDto.prototype, "sortSessionId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AddWasteLineItemDto.prototype, "gradeSessionId", void 0);
class UpdateWasteLineItemDto {
}
exports.UpdateWasteLineItemDto = UpdateWasteLineItemDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateWasteLineItemDto.prototype, "wasteCategoryId", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0.01),
    __metadata("design:type", Number)
], UpdateWasteLineItemDto.prototype, "amount", void 0);
//# sourceMappingURL=waste-line-item.dto.js.map