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
exports.Stage1SealDto = exports.Stage1UpdateWasteDto = exports.Stage1AddWasteDto = exports.Stage1AllocateDto = exports.Stage1StartDto = void 0;
const class_validator_1 = require("class-validator");
class Stage1StartDto {
}
exports.Stage1StartDto = Stage1StartDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], Stage1StartDto.prototype, "ragId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], Stage1StartDto.prototype, "incomingBaleId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], Stage1StartDto.prototype, "workerId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], Stage1StartDto.prototype, "supervisorId", void 0);
class Stage1AllocateDto {
}
exports.Stage1AllocateDto = Stage1AllocateDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], Stage1AllocateDto.prototype, "sessionId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], Stage1AllocateDto.prototype, "categoryId", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], Stage1AllocateDto.prototype, "amountKg", void 0);
class Stage1AddWasteDto {
}
exports.Stage1AddWasteDto = Stage1AddWasteDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], Stage1AddWasteDto.prototype, "sessionId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], Stage1AddWasteDto.prototype, "wasteCategoryId", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], Stage1AddWasteDto.prototype, "amount", void 0);
class Stage1UpdateWasteDto {
}
exports.Stage1UpdateWasteDto = Stage1UpdateWasteDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], Stage1UpdateWasteDto.prototype, "wasteCategoryId", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], Stage1UpdateWasteDto.prototype, "amount", void 0);
class Stage1SealDto {
}
exports.Stage1SealDto = Stage1SealDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], Stage1SealDto.prototype, "wasteCategoryId", void 0);
//# sourceMappingURL=dto.js.map