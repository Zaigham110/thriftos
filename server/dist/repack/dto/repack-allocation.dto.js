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
exports.GetAvailableStockQueryDto = exports.SealRepackUnitDto = exports.UpdateRepackUnitDto = exports.CreateRepackUnitDto = exports.ManualAllocationInputDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const client_1 = require("@prisma/client");
class ManualAllocationInputDto {
}
exports.ManualAllocationInputDto = ManualAllocationInputDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], ManualAllocationInputDto.prototype, "gradingOutputId", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0.01),
    __metadata("design:type", Number)
], ManualAllocationInputDto.prototype, "amountUsed", void 0);
class CreateRepackUnitDto {
}
exports.CreateRepackUnitDto = CreateRepackUnitDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateRepackUnitDto.prototype, "repackSessionId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateRepackUnitDto.prototype, "categoryId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateRepackUnitDto.prototype, "gradeId", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.MeasurementType),
    __metadata("design:type", String)
], CreateRepackUnitDto.prototype, "measurementType", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0.01),
    __metadata("design:type", Number)
], CreateRepackUnitDto.prototype, "targetAmount", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.AllocationMode),
    __metadata("design:type", String)
], CreateRepackUnitDto.prototype, "allocationMode", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => ManualAllocationInputDto),
    __metadata("design:type", Array)
], CreateRepackUnitDto.prototype, "manualAllocations", void 0);
class UpdateRepackUnitDto {
}
exports.UpdateRepackUnitDto = UpdateRepackUnitDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.MeasurementType),
    __metadata("design:type", String)
], UpdateRepackUnitDto.prototype, "measurementType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0.01),
    __metadata("design:type", Number)
], UpdateRepackUnitDto.prototype, "targetAmount", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.AllocationMode),
    __metadata("design:type", String)
], UpdateRepackUnitDto.prototype, "allocationMode", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => ManualAllocationInputDto),
    __metadata("design:type", Array)
], UpdateRepackUnitDto.prototype, "manualAllocations", void 0);
class SealRepackUnitDto {
}
exports.SealRepackUnitDto = SealRepackUnitDto;
class GetAvailableStockQueryDto {
}
exports.GetAvailableStockQueryDto = GetAvailableStockQueryDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], GetAvailableStockQueryDto.prototype, "categoryId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], GetAvailableStockQueryDto.prototype, "gradeId", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.MeasurementType),
    __metadata("design:type", String)
], GetAvailableStockQueryDto.prototype, "measurementType", void 0);
//# sourceMappingURL=repack-allocation.dto.js.map