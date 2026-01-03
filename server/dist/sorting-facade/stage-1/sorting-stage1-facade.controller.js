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
exports.SortingStage1FacadeController = void 0;
const common_1 = require("@nestjs/common");
const tenant_guard_1 = require("../../common/guards/tenant.guard");
const permission_guard_1 = require("../../common/guards/permission.guard");
const permissions_decorator_1 = require("../../common/decorators/permissions.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const rag_service_1 = require("../../procurement/rag/rag.service");
const incoming_bale_service_1 = require("../../procurement/incoming-bale/incoming-bale.service");
const sort_session_service_1 = require("../../sorting-stage1/sort-session/sort-session.service");
const sort_category_bucket_service_1 = require("../../sorting-stage1/sort-category-bucket/sort-category-bucket.service");
const prisma_service_1 = require("../../prisma/prisma.service");
const client_1 = require("@prisma/client");
const library_1 = require("@prisma/client/runtime/library");
const waste_service_1 = require("../../waste/waste.service");
const dto_1 = require("./dto");
let SortingStage1FacadeController = class SortingStage1FacadeController {
    constructor(ragService, incomingBaleService, sortSessionService, bucketService, wasteService, prisma) {
        this.ragService = ragService;
        this.incomingBaleService = incomingBaleService;
        this.sortSessionService = sortSessionService;
        this.bucketService = bucketService;
        this.wasteService = wasteService;
        this.prisma = prisma;
    }
    async queue(page, limit, status, user, req) {
        const tenantId = req.tenantId || user.tenantId;
        const pageNum = page || 1;
        const limitNum = limit || 20;
        const ragStatusFilter = status ? status : undefined;
        const ragsResult = await this.ragService.findAll(tenantId, {
            status: ragStatusFilter,
            page: pageNum,
            limit: limitNum
        });
        const filteredRags = ragStatusFilter
            ? ragsResult.data
            : ragsResult.data.filter(r => r.status === 'NOT_STARTED' || r.status === 'IN_SORTING');
        const balesWhere = {
            tenantId,
            purchaseOrderId: { not: null },
            purchaseOrder: {
                is: {
                    status: { not: 'CLOSED' },
                },
            },
            OR: [
                { sortSessions: { none: {} } },
                { sortSessions: { some: { status: client_1.SortStatus.OPEN } } },
            ],
        };
        const [balesData, balesTotal] = await Promise.all([
            this.prisma.incomingBale.findMany({
                where: balesWhere,
                skip: (pageNum - 1) * limitNum,
                take: limitNum,
                orderBy: { createdAt: 'desc' },
                include: {
                    purchaseOrder: {
                        select: { id: true, poNumber: true },
                    },
                    vendor: {
                        select: { id: true, name: true },
                    },
                    rawCategory: {
                        select: { id: true, name: true, rawType: true },
                    },
                    sortSessions: {
                        select: { id: true, status: true },
                    },
                },
            }),
            this.prisma.incomingBale.count({ where: balesWhere }),
        ]);
        const combinedData = [
            ...filteredRags.map((rag) => ({
                ...rag,
                sourceType: 'RAG',
                sourceId: rag.id,
            })),
            ...balesData.map((bale) => {
                let status = 'NOT_STARTED';
                if (bale.sortSessions && bale.sortSessions.length > 0) {
                    const latestSession = bale.sortSessions[0];
                    status = latestSession.status === 'CLOSED' ? 'SORTED' : 'IN_SORTING';
                }
                return {
                    ...bale,
                    sourceType: 'LOOSE_BALE',
                    sourceId: bale.id,
                    status,
                };
            }),
        ];
        combinedData.sort((a, b) => {
            if (a.status === 'IN_SORTING' && b.status !== 'IN_SORTING')
                return -1;
            if (a.status !== 'IN_SORTING' && b.status === 'IN_SORTING')
                return 1;
            return 0;
        });
        const totalCount = filteredRags.length + balesTotal;
        return {
            data: combinedData,
            total: totalCount,
            page: pageNum,
            limit: limitNum,
        };
    }
    async summary(ragId, user, req) {
        const tenantId = req.tenantId || user.tenantId;
        if (!ragId)
            return { session: null, buckets: [] };
        const session = await this.prisma.sortSession.findFirst({
            where: { tenantId, ragId, status: client_1.SortStatus.OPEN },
            orderBy: { createdAt: 'desc' },
            select: { id: true },
        });
        if (!session)
            return { session: null, buckets: [] };
        return this.getSessionSummary(tenantId, session.id);
    }
    async start(dto, user, req) {
        const tenantId = req.tenantId || user.tenantId;
        const session = await this.sortSessionService.create(tenantId, {
            ragId: dto.ragId,
            incomingBaleId: dto.incomingBaleId,
            workerId: dto.workerId,
            supervisorId: dto.supervisorId
        }, user.userId);
        return this.getSessionSummary(tenantId, session.id);
    }
    async allocate(dto, user, req) {
        const tenantId = req.tenantId || user.tenantId;
        const amount = Number(dto.amountKg || 0);
        if (!(amount > 0)) {
            return this.getSessionSummary(tenantId, dto.sessionId);
        }
        const existing = await this.prisma.sortCategoryBucket.findUnique({
            where: { sortSessionId_categoryId: { sortSessionId: dto.sessionId, categoryId: dto.categoryId } },
            select: { id: true, outputWeightKg: true, outputCount: true },
        });
        if (!existing) {
            await this.bucketService.createForSession(tenantId, dto.sessionId, { categoryId: dto.categoryId, outputWeightKg: amount, outputCount: 0 }, user.userId);
            return this.getSessionSummary(tenantId, dto.sessionId);
        }
        const newWeight = Number(existing.outputWeightKg || 0) + amount;
        await this.bucketService.update(tenantId, existing.id, { outputWeightKg: newWeight, outputCount: existing.outputCount ?? 0 }, user.userId);
        return this.getSessionSummary(tenantId, dto.sessionId);
    }
    async seal(sessionId, dto, user, req) {
        const tenantId = req.tenantId || user.tenantId;
        await this.sortSessionService.close(tenantId, sessionId, user.userId, { wasteCategoryId: dto?.wasteCategoryId });
        return this.getSessionSummary(tenantId, sessionId);
    }
    async addWaste(dto, user, req) {
        const tenantId = req.tenantId || user.tenantId;
        const prismaAny = this.prisma;
        const session = await this.prisma.sortSession.findFirst({
            where: { id: dto.sessionId, tenantId },
            include: {
                rag: { select: { id: true, containerId: true } },
                incomingBale: { select: { containerId: true } },
            },
        });
        if (!session)
            throw new common_1.BadRequestException('Sort session not found');
        if (session.status !== client_1.SortStatus.OPEN)
            throw new common_1.BadRequestException('Cannot add waste after sealing');
        const totalOutputWeight = session.totalOutputWeight ?? new library_1.Decimal(0);
        const computedWasteWeight = session.totalInputWeight.sub(totalOutputWeight);
        if (computedWasteWeight.lessThan(new library_1.Decimal(0))) {
            throw new common_1.BadRequestException('Invalid session totals (output exceeds input)');
        }
        const existingWasteAgg = await prismaAny.wasteLineItem.aggregate({
            where: { tenantId, stage: 'STAGE_1', sortSessionId: session.id },
            _sum: { amount: true },
        });
        const existingWasteAmount = existingWasteAgg._sum.amount ?? new library_1.Decimal(0);
        const nextWasteAmount = existingWasteAmount.add(new library_1.Decimal(dto.amount ?? 0));
        if (nextWasteAmount.greaterThan(computedWasteWeight)) {
            throw new common_1.BadRequestException('Waste amount exceeds available remaining amount');
        }
        const containerId = session.rag?.containerId ?? session.incomingBale?.containerId ?? null;
        const ragId = session.ragId ?? session.rag?.id ?? null;
        await this.wasteService.createLineItem(tenantId, {
            stage: 'STAGE_1',
            wasteCategoryId: dto.wasteCategoryId,
            amount: dto.amount,
            sortSessionId: session.id,
        }, {
            containerId,
            ragId,
            categoryOutputId: null,
        });
        return this.getSessionSummary(tenantId, session.id);
    }
    async updateWaste(wasteLineItemId, dto, user, req) {
        const tenantId = req.tenantId || user.tenantId;
        const prismaAny = this.prisma;
        const existing = await prismaAny.wasteLineItem.findFirst({
            where: { id: wasteLineItemId, tenantId, stage: 'STAGE_1' },
            include: { sortSession: { select: { id: true, status: true, totalInputWeight: true, totalOutputWeight: true } } },
        });
        if (!existing || !existing.sortSession)
            throw new common_1.BadRequestException('Waste line item not found');
        if (existing.sortSession.status !== client_1.SortStatus.OPEN)
            throw new common_1.BadRequestException('Cannot edit waste after sealing');
        const totalOutputWeight = existing.sortSession.totalOutputWeight ?? new library_1.Decimal(0);
        const computedWasteWeight = existing.sortSession.totalInputWeight.sub(totalOutputWeight);
        if (computedWasteWeight.lessThan(new library_1.Decimal(0))) {
            throw new common_1.BadRequestException('Invalid session totals (output exceeds input)');
        }
        const otherWasteAgg = await prismaAny.wasteLineItem.aggregate({
            where: {
                tenantId,
                stage: 'STAGE_1',
                sortSessionId: existing.sortSession.id,
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
        return this.getSessionSummary(tenantId, existing.sortSession.id);
    }
    async removeWaste(wasteLineItemId, user, req) {
        const tenantId = req.tenantId || user.tenantId;
        const prismaAny = this.prisma;
        const existing = await prismaAny.wasteLineItem.findFirst({
            where: { id: wasteLineItemId, tenantId, stage: 'STAGE_1' },
            select: { id: true, sortSessionId: true },
        });
        if (!existing || !existing.sortSessionId)
            throw new common_1.BadRequestException('Waste line item not found');
        const session = await this.prisma.sortSession.findFirst({
            where: { id: existing.sortSessionId, tenantId },
            select: { id: true, status: true },
        });
        if (!session)
            throw new common_1.BadRequestException('Sort session not found');
        if (session.status !== client_1.SortStatus.OPEN)
            throw new common_1.BadRequestException('Cannot remove waste after sealing');
        await this.wasteService.deleteLineItem(tenantId, existing.id);
        return this.getSessionSummary(tenantId, session.id);
    }
    async getSessionSummary(tenantId, sessionId) {
        const session = await this.prisma.sortSession.findFirst({
            where: { id: sessionId, tenantId },
            select: { id: true, status: true, totalInputWeight: true, totalOutputWeight: true, wasteWeight: true },
        });
        const buckets = await this.prisma.sortCategoryBucket.findMany({
            where: { sortSessionId: sessionId },
            orderBy: { updatedAt: 'desc' },
            include: { category: { select: { id: true, name: true } } },
        });
        const prismaAny = this.prisma;
        const wasteLineItems = await prismaAny.wasteLineItem.findMany({
            where: { tenantId, stage: 'STAGE_1', sortSessionId: sessionId },
            orderBy: { updatedAt: 'desc' },
            include: { wasteCategory: true },
        });
        if (!session)
            return { session: null, buckets, wasteLineItems: [] };
        const totalOutputWeight = session.totalOutputWeight ?? new library_1.Decimal(0);
        const computedWasteWeight = session.totalInputWeight.sub(totalOutputWeight);
        const declaredWasteAmount = wasteLineItems.reduce((sum, li) => sum.add(li.amount), new library_1.Decimal(0));
        const remainingWasteAmount = computedWasteWeight.sub(declaredWasteAmount);
        return {
            session: {
                ...session,
                computedWasteWeight: computedWasteWeight.toString(),
                declaredWasteAmount: declaredWasteAmount.toString(),
                remainingWasteAmount: remainingWasteAmount.toString(),
            },
            buckets,
            wasteLineItems,
        };
    }
};
exports.SortingStage1FacadeController = SortingStage1FacadeController;
__decorate([
    (0, common_1.Get)('queue'),
    (0, permissions_decorator_1.RequirePermissions)('SORTING_STAGE1_VIEW'),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('status')),
    __param(3, (0, current_user_decorator_1.CurrentUser)()),
    __param(4, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number, String, Object, Object]),
    __metadata("design:returntype", Promise)
], SortingStage1FacadeController.prototype, "queue", null);
__decorate([
    (0, common_1.Get)('summary'),
    (0, permissions_decorator_1.RequirePermissions)('SORTING_STAGE1_VIEW'),
    __param(0, (0, common_1.Query)('ragId')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], SortingStage1FacadeController.prototype, "summary", null);
__decorate([
    (0, common_1.Post)('start'),
    (0, permissions_decorator_1.RequirePermissions)('SORTING_STAGE1_CREATE'),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.Stage1StartDto, Object, Object]),
    __metadata("design:returntype", Promise)
], SortingStage1FacadeController.prototype, "start", null);
__decorate([
    (0, common_1.Post)('allocate'),
    (0, permissions_decorator_1.RequirePermissions)('SORTING_STAGE1_EDIT'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.Stage1AllocateDto, Object, Object]),
    __metadata("design:returntype", Promise)
], SortingStage1FacadeController.prototype, "allocate", null);
__decorate([
    (0, common_1.Patch)(':id/seal'),
    (0, permissions_decorator_1.RequirePermissions)('SORTING_STAGE1_CLOSE'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.Stage1SealDto, Object, Object]),
    __metadata("design:returntype", Promise)
], SortingStage1FacadeController.prototype, "seal", null);
__decorate([
    (0, common_1.Post)('waste'),
    (0, permissions_decorator_1.RequirePermissions)('SORTING_STAGE1_EDIT'),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.Stage1AddWasteDto, Object, Object]),
    __metadata("design:returntype", Promise)
], SortingStage1FacadeController.prototype, "addWaste", null);
__decorate([
    (0, common_1.Patch)('waste/:id'),
    (0, permissions_decorator_1.RequirePermissions)('SORTING_STAGE1_EDIT'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.Stage1UpdateWasteDto, Object, Object]),
    __metadata("design:returntype", Promise)
], SortingStage1FacadeController.prototype, "updateWaste", null);
__decorate([
    (0, common_1.Delete)('waste/:id'),
    (0, permissions_decorator_1.RequirePermissions)('SORTING_STAGE1_EDIT'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], SortingStage1FacadeController.prototype, "removeWaste", null);
exports.SortingStage1FacadeController = SortingStage1FacadeController = __decorate([
    (0, common_1.Controller)('sorting/stage-1'),
    (0, common_1.UseGuards)(tenant_guard_1.TenantGuard, permission_guard_1.PermissionGuard),
    __metadata("design:paramtypes", [rag_service_1.RagService,
        incoming_bale_service_1.IncomingBaleService,
        sort_session_service_1.SortSessionService,
        sort_category_bucket_service_1.SortCategoryBucketService,
        waste_service_1.WasteService,
        prisma_service_1.PrismaService])
], SortingStage1FacadeController);
//# sourceMappingURL=sorting-stage1-facade.controller.js.map