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
exports.SortingStage2FacadeController = void 0;
const common_1 = require("@nestjs/common");
const tenant_guard_1 = require("../../common/guards/tenant.guard");
const permission_guard_1 = require("../../common/guards/permission.guard");
const permissions_decorator_1 = require("../../common/decorators/permissions.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const prisma_service_1 = require("../../prisma/prisma.service");
const library_1 = require("@prisma/client/runtime/library");
const category_output_service_1 = require("../../sorting-stage1/category-output/category-output.service");
const grade_session_service_1 = require("../../sorting-stage2/grade-session/grade-session.service");
const grade_bucket_service_1 = require("../../sorting-stage2/grade-bucket/grade-bucket.service");
const client_1 = require("@prisma/client");
const waste_service_1 = require("../../waste/waste.service");
const dto_1 = require("./dto");
let SortingStage2FacadeController = class SortingStage2FacadeController {
    constructor(categoryOutputService, gradeSessionService, gradeBucketService, wasteService, prisma) {
        this.categoryOutputService = categoryOutputService;
        this.gradeSessionService = gradeSessionService;
        this.gradeBucketService = gradeBucketService;
        this.wasteService = wasteService;
        this.prisma = prisma;
    }
    async queue(page, limit, user, req) {
        const tenantId = req.tenantId || user.tenantId;
        return this.categoryOutputService.findAvailableForGrading(tenantId, { page, limit });
    }
    async start(dto, user, req) {
        const tenantId = req.tenantId || user.tenantId;
        const session = await this.gradeSessionService.create(tenantId, { categoryOutputId: dto.categoryOutputId, workerId: dto.workerId, supervisorId: dto.supervisorId }, user.userId);
        return this.getSessionSummary(tenantId, session.id);
    }
    async allocate(dto, user, req) {
        const tenantId = req.tenantId || user.tenantId;
        const amount = Number(dto.amountKg || 0);
        if (!(amount > 0)) {
            return this.getSessionSummary(tenantId, dto.sessionId);
        }
        const existing = await this.prisma.gradeBucket.findUnique({
            where: { gradeSessionId_gradeId: { gradeSessionId: dto.sessionId, gradeId: dto.gradeId } },
            select: { id: true, outputWeightKg: true, outputCount: true },
        });
        if (!existing) {
            await this.gradeBucketService.createForSession(tenantId, dto.sessionId, { gradeId: dto.gradeId, outputWeightKg: amount, outputCount: 0 }, user.userId);
            return this.getSessionSummary(tenantId, dto.sessionId);
        }
        const newWeight = Number(existing.outputWeightKg || 0) + amount;
        await this.gradeBucketService.update(tenantId, existing.id, { outputWeightKg: newWeight, outputCount: existing.outputCount ?? 0 }, user.userId);
        return this.getSessionSummary(tenantId, dto.sessionId);
    }
    async seal(sessionId, dto, user, req) {
        const tenantId = req.tenantId || user.tenantId;
        await this.gradeSessionService.close(tenantId, sessionId, user.userId, { wasteCategoryId: dto?.wasteCategoryId });
        return this.getSessionSummary(tenantId, sessionId);
    }
    async addWaste(dto, user, req) {
        const tenantId = req.tenantId || user.tenantId;
        const prismaAny = this.prisma;
        const session = await this.prisma.gradeSession.findFirst({
            where: { id: dto.sessionId, tenantId },
            include: { categoryOutput: { select: { id: true, weightKg: true, ragId: true, containerId: true } } },
        });
        if (!session)
            throw new common_1.BadRequestException('Grade session not found');
        if (session.status !== client_1.GradeStatus.OPEN)
            throw new common_1.BadRequestException('Cannot add waste after sealing');
        const totals = await this.prisma.gradeBucket.aggregate({
            where: { gradeSessionId: session.id },
            _sum: { outputWeightKg: true },
        });
        const totalGradeOutputWeight = totals._sum.outputWeightKg ?? new library_1.Decimal(0);
        const computedWasteWeight = session.categoryOutput.weightKg.sub(totalGradeOutputWeight);
        if (computedWasteWeight.lessThan(new library_1.Decimal(0))) {
            throw new common_1.BadRequestException('wasteWeight cannot be negative (output exceeds input)');
        }
        const existingWasteAgg = await prismaAny.wasteLineItem.aggregate({
            where: { tenantId, stage: 'STAGE_2', gradeSessionId: session.id },
            _sum: { amount: true },
        });
        const existingWasteAmount = existingWasteAgg._sum.amount ?? new library_1.Decimal(0);
        const nextWasteAmount = existingWasteAmount.add(new library_1.Decimal(dto.amount ?? 0));
        if (nextWasteAmount.greaterThan(computedWasteWeight)) {
            throw new common_1.BadRequestException('Waste amount exceeds available remaining amount');
        }
        await this.wasteService.createLineItem(tenantId, {
            stage: 'STAGE_2',
            wasteCategoryId: dto.wasteCategoryId,
            amount: dto.amount,
            gradeSessionId: session.id,
        }, {
            containerId: session.categoryOutput.containerId,
            ragId: session.categoryOutput.ragId,
            categoryOutputId: session.categoryOutput.id,
        });
        return this.getSessionSummary(tenantId, session.id);
    }
    async updateWaste(wasteLineItemId, dto, user, req) {
        const tenantId = req.tenantId || user.tenantId;
        const prismaAny = this.prisma;
        const existing = await prismaAny.wasteLineItem.findFirst({
            where: { id: wasteLineItemId, tenantId, stage: 'STAGE_2' },
            include: { gradeSession: { include: { categoryOutput: { select: { id: true, weightKg: true } } } } },
        });
        if (!existing || !existing.gradeSession)
            throw new common_1.BadRequestException('Waste line item not found');
        if (existing.gradeSession.status !== client_1.GradeStatus.OPEN)
            throw new common_1.BadRequestException('Cannot edit waste after sealing');
        const totals = await this.prisma.gradeBucket.aggregate({
            where: { gradeSessionId: existing.gradeSession.id },
            _sum: { outputWeightKg: true },
        });
        const totalGradeOutputWeight = totals._sum.outputWeightKg ?? new library_1.Decimal(0);
        const computedWasteWeight = existing.gradeSession.categoryOutput.weightKg.sub(totalGradeOutputWeight);
        if (computedWasteWeight.lessThan(new library_1.Decimal(0))) {
            throw new common_1.BadRequestException('wasteWeight cannot be negative (output exceeds input)');
        }
        const otherWasteAgg = await prismaAny.wasteLineItem.aggregate({
            where: {
                tenantId,
                stage: 'STAGE_2',
                gradeSessionId: existing.gradeSession.id,
                NOT: { id: existing.id },
            },
            _sum: { amount: true },
        });
        const otherWasteAmount = otherWasteAgg._sum.amount ?? new library_1.Decimal(0);
        const nextWasteAmount = otherWasteAmount.add(new library_1.Decimal(dto.amount ?? 0));
        if (nextWasteAmount.greaterThan(computedWasteWeight)) {
            throw new common_1.BadRequestException('Waste amount exceeds available remaining amount');
        }
        await this.wasteService.updateLineItem(tenantId, existing.id, { wasteCategoryId: dto.wasteCategoryId, amount: dto.amount });
        return this.getSessionSummary(tenantId, existing.gradeSession.id);
    }
    async removeWaste(wasteLineItemId, user, req) {
        const tenantId = req.tenantId || user.tenantId;
        const prismaAny = this.prisma;
        const existing = await prismaAny.wasteLineItem.findFirst({
            where: { id: wasteLineItemId, tenantId, stage: 'STAGE_2' },
            select: { id: true, gradeSessionId: true },
        });
        if (!existing || !existing.gradeSessionId)
            throw new common_1.BadRequestException('Waste line item not found');
        const session = await this.prisma.gradeSession.findFirst({
            where: { id: existing.gradeSessionId, tenantId },
            select: { id: true, status: true },
        });
        if (!session)
            throw new common_1.BadRequestException('Grade session not found');
        if (session.status !== client_1.GradeStatus.OPEN)
            throw new common_1.BadRequestException('Cannot remove waste after sealing');
        await this.wasteService.deleteLineItem(tenantId, existing.id);
        return this.getSessionSummary(tenantId, session.id);
    }
    async getSessionSummary(tenantId, sessionId) {
        const session = await this.prisma.gradeSession.findFirst({
            where: { id: sessionId, tenantId },
            include: {
                categoryOutput: {
                    select: {
                        id: true,
                        weightKg: true,
                        allocatedCost: true,
                        categoryId: true,
                        containerId: true,
                        ragId: true,
                        sortSessionId: true,
                        category: { select: { id: true, name: true } },
                        container: { select: { id: true, containerNumber: true } },
                        rag: { select: { id: true, ragCode: true } },
                    },
                },
            },
        });
        const buckets = await this.prisma.gradeBucket.findMany({
            where: { gradeSessionId: sessionId },
            orderBy: { updatedAt: 'desc' },
            include: { grade: { select: { id: true, name: true } } },
        });
        const prismaAny = this.prisma;
        const wasteLineItems = await prismaAny.wasteLineItem.findMany({
            where: { tenantId, stage: 'STAGE_2', gradeSessionId: sessionId },
            orderBy: { updatedAt: 'desc' },
            include: { wasteCategory: true },
        });
        if (!session)
            return { session: null, buckets, wasteLineItems: [] };
        const inputWeight = session.categoryOutput.weightKg;
        const totalGradeOutputWeight = buckets.reduce((sum, b) => sum.add(b.outputWeightKg), new library_1.Decimal(0));
        const wasteWeight = inputWeight.sub(totalGradeOutputWeight);
        const gradeYieldPercent = inputWeight.equals(new library_1.Decimal(0))
            ? new library_1.Decimal(0)
            : totalGradeOutputWeight.div(inputWeight).mul(new library_1.Decimal(100));
        const declaredWasteAmount = wasteLineItems.reduce((sum, li) => sum.add(li.amount), new library_1.Decimal(0));
        const remainingWasteAmount = wasteWeight.sub(declaredWasteAmount);
        return {
            session: {
                id: session.id,
                status: session.status,
                categoryOutputId: session.categoryOutputId,
                categoryOutput: session.categoryOutput,
                totalGradeOutputWeight: totalGradeOutputWeight.toString(),
                wasteWeight: wasteWeight.toString(),
                declaredWasteAmount: declaredWasteAmount.toString(),
                remainingWasteAmount: remainingWasteAmount.toString(),
                gradeYieldPercent: gradeYieldPercent.toNumber(),
            },
            buckets,
            wasteLineItems,
        };
    }
};
exports.SortingStage2FacadeController = SortingStage2FacadeController;
__decorate([
    (0, common_1.Get)('queue'),
    (0, permissions_decorator_1.RequirePermissions)('SORTING_STAGE2_VIEW'),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number, Object, Object]),
    __metadata("design:returntype", Promise)
], SortingStage2FacadeController.prototype, "queue", null);
__decorate([
    (0, common_1.Post)('start'),
    (0, permissions_decorator_1.RequirePermissions)('SORTING_STAGE2_CREATE'),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.Stage2StartDto, Object, Object]),
    __metadata("design:returntype", Promise)
], SortingStage2FacadeController.prototype, "start", null);
__decorate([
    (0, common_1.Post)('allocate'),
    (0, permissions_decorator_1.RequirePermissions)('SORTING_STAGE2_EDIT'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.Stage2AllocateDto, Object, Object]),
    __metadata("design:returntype", Promise)
], SortingStage2FacadeController.prototype, "allocate", null);
__decorate([
    (0, common_1.Patch)(':id/seal'),
    (0, permissions_decorator_1.RequirePermissions)('SORTING_STAGE2_CLOSE'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.Stage2SealDto, Object, Object]),
    __metadata("design:returntype", Promise)
], SortingStage2FacadeController.prototype, "seal", null);
__decorate([
    (0, common_1.Post)('waste'),
    (0, permissions_decorator_1.RequirePermissions)('SORTING_STAGE2_EDIT'),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.Stage2AddWasteDto, Object, Object]),
    __metadata("design:returntype", Promise)
], SortingStage2FacadeController.prototype, "addWaste", null);
__decorate([
    (0, common_1.Patch)('waste/:id'),
    (0, permissions_decorator_1.RequirePermissions)('SORTING_STAGE2_EDIT'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.Stage2UpdateWasteDto, Object, Object]),
    __metadata("design:returntype", Promise)
], SortingStage2FacadeController.prototype, "updateWaste", null);
__decorate([
    (0, common_1.Delete)('waste/:id'),
    (0, permissions_decorator_1.RequirePermissions)('SORTING_STAGE2_EDIT'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], SortingStage2FacadeController.prototype, "removeWaste", null);
exports.SortingStage2FacadeController = SortingStage2FacadeController = __decorate([
    (0, common_1.Controller)('sorting/stage-2'),
    (0, common_1.UseGuards)(tenant_guard_1.TenantGuard, permission_guard_1.PermissionGuard),
    __metadata("design:paramtypes", [category_output_service_1.CategoryOutputService,
        grade_session_service_1.GradeSessionService,
        grade_bucket_service_1.GradeBucketService,
        waste_service_1.WasteService,
        prisma_service_1.PrismaService])
], SortingStage2FacadeController);
//# sourceMappingURL=sorting-stage2-facade.controller.js.map