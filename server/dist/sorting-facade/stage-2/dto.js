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
exports.Stage2SealDto = exports.Stage2UpdateWasteDto = exports.Stage2AddWasteDto = exports.Stage2AllocateDto = exports.Stage2StartDto = void 0;
const class_validator_1 = require("class-validator");
class Stage2StartDto {
}
exports.Stage2StartDto = Stage2StartDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], Stage2StartDto.prototype, "categoryOutputId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], Stage2StartDto.prototype, "workerId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], Stage2StartDto.prototype, "supervisorId", void 0);
class Stage2AllocateDto {
}
exports.Stage2AllocateDto = Stage2AllocateDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], Stage2AllocateDto.prototype, "sessionId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], Stage2AllocateDto.prototype, "gradeId", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], Stage2AllocateDto.prototype, "amountKg", void 0);
class Stage2AddWasteDto {
}
exports.Stage2AddWasteDto = Stage2AddWasteDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], Stage2AddWasteDto.prototype, "sessionId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], Stage2AddWasteDto.prototype, "wasteCategoryId", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], Stage2AddWasteDto.prototype, "amount", void 0);
class Stage2UpdateWasteDto {
}
exports.Stage2UpdateWasteDto = Stage2UpdateWasteDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], Stage2UpdateWasteDto.prototype, "wasteCategoryId", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], Stage2UpdateWasteDto.prototype, "amount", void 0);
class Stage2SealDto {
}
exports.Stage2SealDto = Stage2SealDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], Stage2SealDto.prototype, "wasteCategoryId", void 0);
//# sourceMappingURL=dto.js.map