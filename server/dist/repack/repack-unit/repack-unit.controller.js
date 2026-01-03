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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RepackUnitController = void 0;
const common_1 = require("@nestjs/common");
const tenant_guard_1 = require("../../common/guards/tenant.guard");
const permission_guard_1 = require("../../common/guards/permission.guard");
const permissions_decorator_1 = require("../../common/decorators/permissions.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const dto_1 = require("./dto");
const repack_unit_service_1 = require("./repack-unit.service");
const allocate_repack_unit_dto_1 = require("./dto/allocate-repack-unit.dto");
const deallocate_repack_unit_dto_1 = require("./dto/deallocate-repack-unit.dto");
const client_1 = require("@prisma/client");
const repack_v3_service_1 = require("../v3/repack-v3.service");
const prisma_service_1 = require("../../prisma/prisma.service");
let RepackUnitController = class RepackUnitController {
    constructor(service, repackV3, prisma) {
        this.service = service;
        this.repackV3 = repackV3;
        this.prisma = prisma;
    }
    async getContextFromGradingOutput(gradingOutputId, user, req) {
        const tenantId = req.tenantId || user.tenantId;
        const gradingOutput = await this.prisma.gradeOutput.findFirst({
            where: { id: gradingOutputId, tenantId },
            include: {
                gradeBucket: {
                    include: {
                        gradeSession: {
                            include: {
                                categoryOutput: true,
                            },
                        },
                    },
                },
            },
        });
        if (!gradingOutput) {
            return {
                gradingOutputId,
                found: false,
            };
        }
        return {
            found: true,
            gradingOutputId: gradingOutput.id,
            categoryId: gradingOutput.gradeBucket.gradeSession.categoryOutput.categoryId,
            gradeId: gradingOutput.gradeId,
            measurementType: gradingOutput.measurementType,
            remainingAmount: gradingOutput.remainingAmount,
            totalAmount: gradingOutput.totalAmount,
            status: gradingOutput.status,
        };
    }
    async validateGradingOutputForRepack(gradingOutputId, user, req) {
        const tenantId = req.tenantId || user.tenantId;
        const output = await this.prisma.gradeOutput.findFirst({
            where: { id: gradingOutputId, tenantId },
            include: {
                gradeBucket: {
                    include: {
                        gradeSession: {
                            include: {
                                categoryOutput: {
                                    include: {
                                        sortCategoryBucket: {
                                            include: {
                                                sortSession: true,
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });
        if (!output) {
            return {
                valid: false,
                errors: ['Grade output not found'],
            };
        }
        const errors = [];
        const sortSession = output.gradeBucket.gradeSession.categoryOutput.sortCategoryBucket?.sortSession;
        if (sortSession && sortSession.status !== 'CLOSED') {
            errors.push('Sort session must be CLOSED before repack');
        }
        const gradeSession = output.gradeBucket.gradeSession;
        if (gradeSession.status !== 'CLOSED') {
            errors.push('Grade session must be CLOSED before repack');
        }
        const openBucketsCount = await this.prisma.gradeBucket.count({
            where: {
                gradeSessionId: gradeSession.id,
            },
        });
        return {
            valid: errors.length === 0,
            errors,
            output: errors.length === 0
                ? {
                    id: output.id,
                    categoryId: gradeSession.categoryOutput.categoryId,
                    gradeId: output.gradeId,
                    remainingAmount: Number(output.remainingAmount),
                }
                : undefined,
        };
    }
    async createForSession(sessionId, dto, user, req) {
        const tenantId = req.tenantId || user.tenantId;
        return this.service.createForSession(tenantId, sessionId, dto, user.userId);
    }
    async findAll(sessionId, page, limit, user, req) {
        const tenantId = req.tenantId || user.tenantId;
        return this.service.findAll(tenantId, { sessionId, page, limit });
    }
    async getDrafts(user, req) {
        const tenantId = req.tenantId || user.tenantId;
        return this.service.getDraftUnits(tenantId);
    }
    async getSealedUnits(user, req) {
        const tenantId = req.tenantId || user.tenantId;
        return this.service.getSealedUnits(tenantId);
    }
    async findOne(id, user, req) {
        const tenantId = req.tenantId || user.tenantId;
        return this.service.findOne(tenantId, id);
    }
    async getAvailableStock(categoryId, gradeId, measurementType, user, req) {
        const tenantId = req.tenantId || user.tenantId;
        return this.repackV3.getAvailableStock(tenantId, categoryId, gradeId, measurementType);
    }
    async createManual(dto, user, req) {
        const tenantId = req.tenantId || user.tenantId;
        return this.repackV3.createDraftManual(tenantId, dto, user.userId);
    }
    async sealUnit(id, dto, user, req) {
        const tenantId = req.tenantId || user.tenantId;
        return this.repackV3.sealUnit(tenantId, id, dto.warehouseId ?? null, user.userId);
    }
    async allocateToDraft(id, dto, user, req) {
        const tenantId = req.tenantId || user.tenantId;
        return this.service.allocateToDraft(tenantId, id, dto.allocations, user.userId);
    }
    async deallocateFromDraft(id, dto, user, req) {
        const tenantId = req.tenantId || user.tenantId;
        return this.service.deallocateFromDraft(tenantId, id, dto.allocationId, user.userId);
    }
    async deleteDraft(id, user, req) {
        const tenantId = req.tenantId || user.tenantId;
        return this.service.deleteDraft(tenantId, id, user.userId);
    }
};
exports.RepackUnitController = RepackUnitController;
__decorate([
    (0, common_1.Get)('context/grading-output/:id'),
    (0, permissions_decorator_1.RequirePermissions)('REPACK_VIEW'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], RepackUnitController.prototype, "getContextFromGradingOutput", null);
__decorate([
    (0, common_1.Get)('validate/grading-output/:id'),
    (0, permissions_decorator_1.RequirePermissions)('REPACK_VIEW'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], RepackUnitController.prototype, "validateGradingOutputForRepack", null);
__decorate([
    (0, common_1.Post)('sessions/:id/units'),
    (0, permissions_decorator_1.RequirePermissions)('REPACK_EDIT'),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.CreateRepackUnitDto, Object, Object]),
    __metadata("design:returntype", Promise)
], RepackUnitController.prototype, "createForSession", null);
__decorate([
    (0, common_1.Get)('units'),
    (0, permissions_decorator_1.RequirePermissions)('REPACK_VIEW'),
    __param(0, (0, common_1.Query)('sessionId')),
    __param(1, (0, common_1.Query)('page')),
    __param(2, (0, common_1.Query)('limit')),
    __param(3, (0, current_user_decorator_1.CurrentUser)()),
    __param(4, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number, Number, Object, Object]),
    __metadata("design:returntype", Promise)
], RepackUnitController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('units/drafts'),
    (0, permissions_decorator_1.RequirePermissions)('REPACK_VIEW'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], RepackUnitController.prototype, "getDrafts", null);
__decorate([
    (0, common_1.Get)('units/sealed'),
    (0, permissions_decorator_1.RequirePermissions)('REPACK_VIEW'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], RepackUnitController.prototype, "getSealedUnits", null);
__decorate([
    (0, common_1.Get)('units/:id'),
    (0, permissions_decorator_1.RequirePermissions)('REPACK_VIEW'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], RepackUnitController.prototype, "findOne", null);
__decorate([
    (0, common_1.Get)('available-stock'),
    (0, permissions_decorator_1.RequirePermissions)('REPACK_VIEW'),
    __param(0, (0, common_1.Query)('categoryId')),
    __param(1, (0, common_1.Query)('gradeId')),
    __param(2, (0, common_1.Query)('measurementType')),
    __param(3, (0, current_user_decorator_1.CurrentUser)()),
    __param(4, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, Object, Object]),
    __metadata("design:returntype", Promise)
], RepackUnitController.prototype, "getAvailableStock", null);
__decorate([
    (0, common_1.Post)('units/manual'),
    (0, permissions_decorator_1.RequirePermissions)('REPACK_ALLOCATE'),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.CreateRepackUnitV2Dto, Object, Object]),
    __metadata("design:returntype", Promise)
], RepackUnitController.prototype, "createManual", null);
__decorate([
    (0, common_1.Patch)('units/:id/seal'),
    (0, permissions_decorator_1.RequirePermissions)('REPACK_ALLOCATE'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.SealRepackUnitV3Dto, Object, Object]),
    __metadata("design:returntype", Promise)
], RepackUnitController.prototype, "sealUnit", null);
__decorate([
    (0, common_1.Patch)('units/:id/allocate'),
    (0, permissions_decorator_1.RequirePermissions)('REPACK_ALLOCATE'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, allocate_repack_unit_dto_1.AllocateRepackUnitDto, Object, Object]),
    __metadata("design:returntype", Promise)
], RepackUnitController.prototype, "allocateToDraft", null);
__decorate([
    (0, common_1.Patch)('units/:id/deallocate'),
    (0, permissions_decorator_1.RequirePermissions)('REPACK_ALLOCATE'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, deallocate_repack_unit_dto_1.DeallocateRepackUnitDto, Object, Object]),
    __metadata("design:returntype", Promise)
], RepackUnitController.prototype, "deallocateFromDraft", null);
__decorate([
    (0, common_1.Delete)('units/:id'),
    (0, permissions_decorator_1.RequirePermissions)('REPACK_ALLOCATE'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], RepackUnitController.prototype, "deleteDraft", null);
exports.RepackUnitController = RepackUnitController = __decorate([
    (0, common_1.Controller)('repack'),
    (0, common_1.UseGuards)(tenant_guard_1.TenantGuard, permission_guard_1.PermissionGuard),
    __metadata("design:paramtypes", [repack_unit_service_1.RepackUnitService,
        repack_v3_service_1.RepackV3Service,
        prisma_service_1.PrismaService])
], RepackUnitController);
//# sourceMappingURL=repack-unit.controller.js.map