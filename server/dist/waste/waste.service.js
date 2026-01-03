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
exports.WasteService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const library_1 = require("@prisma/client/runtime/library");
const client_1 = require("@prisma/client");
let WasteService = class WasteService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async listCategories(tenantId) {
        return this.prisma.wasteCategory.findMany({
            where: { tenantId, isActive: true },
            orderBy: { name: 'asc' },
        });
    }
    async listAllCategories(tenantId) {
        return this.prisma.wasteCategory.findMany({
            where: { tenantId },
            include: { linkedCategory: { select: { id: true, name: true } } },
            orderBy: { name: 'asc' },
        });
    }
    async createCategory(tenantId, dto) {
        const existing = await this.prisma.wasteCategory.findFirst({
            where: { tenantId, name: dto.name },
        });
        if (existing) {
            throw new common_1.BadRequestException('Waste category with this name already exists');
        }
        return this.prisma.wasteCategory.create({
            data: {
                tenantId,
                name: dto.name,
                unitType: dto.unitType,
                defaultResalePrice: new library_1.Decimal(dto.defaultResalePrice),
                isSystemGenerated: false,
            },
        });
    }
    async updateCategory(tenantId, id, dto) {
        const existing = await this.prisma.wasteCategory.findFirst({ where: { id, tenantId } });
        if (!existing)
            throw new common_1.NotFoundException('Waste category not found');
        if (existing.isSystemGenerated && dto.unitType && dto.unitType !== existing.unitType) {
            throw new common_1.BadRequestException('Cannot change unit type on system-generated waste categories');
        }
        if (existing.isSystemGenerated && dto.name) {
            throw new common_1.BadRequestException('Cannot rename system-generated waste categories. Edit the linked category instead.');
        }
        return this.prisma.wasteCategory.update({
            where: { id },
            data: {
                ...(dto.name !== undefined && !existing.isSystemGenerated ? { name: dto.name } : {}),
                ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
                ...(dto.defaultResalePrice !== undefined ? { defaultResalePrice: new library_1.Decimal(dto.defaultResalePrice) } : {}),
            },
        });
    }
    async createLineItem(tenantId, dto, traceability) {
        const category = await this.prisma.wasteCategory.findFirst({
            where: { id: dto.wasteCategoryId, tenantId, isActive: true },
        });
        if (!category)
            throw new common_1.BadRequestException('Invalid waste category');
        if (!(dto.amount > 0))
            throw new common_1.BadRequestException('Waste amount must be > 0');
        if (dto.stage === client_1.WasteStage.STAGE_1) {
            if (!dto.sortSessionId || dto.gradeSessionId) {
                throw new common_1.BadRequestException('Stage-1 waste requires sortSessionId only');
            }
        }
        if (dto.stage === client_1.WasteStage.STAGE_2) {
            if (!dto.gradeSessionId || dto.sortSessionId) {
                throw new common_1.BadRequestException('Stage-2 waste requires gradeSessionId only');
            }
        }
        const estimatedValue = new library_1.Decimal(dto.amount).mul(category.defaultResalePrice);
        return this.prisma.wasteLineItem.create({
            data: {
                tenantId,
                stage: dto.stage,
                wasteCategoryId: category.id,
                amount: new library_1.Decimal(dto.amount),
                unitType: category.unitType,
                estimatedValue,
                sortSessionId: dto.sortSessionId,
                gradeSessionId: dto.gradeSessionId,
                containerId: traceability.containerId ?? null,
                ragId: traceability.ragId ?? null,
                categoryOutputId: traceability.categoryOutputId ?? null,
            },
            include: {
                wasteCategory: true,
            },
        });
    }
    async updateLineItem(tenantId, id, dto) {
        const existing = await this.prisma.wasteLineItem.findFirst({
            where: { id, tenantId },
            include: { wasteCategory: true },
        });
        if (!existing)
            throw new common_1.NotFoundException('Waste line item not found');
        const category = await this.prisma.wasteCategory.findFirst({
            where: { id: dto.wasteCategoryId, tenantId, isActive: true },
        });
        if (!category)
            throw new common_1.BadRequestException('Invalid waste category');
        if (!(dto.amount > 0))
            throw new common_1.BadRequestException('Waste amount must be > 0');
        const estimatedValue = new library_1.Decimal(dto.amount).mul(category.defaultResalePrice);
        return this.prisma.wasteLineItem.update({
            where: { id },
            data: {
                wasteCategoryId: category.id,
                amount: new library_1.Decimal(dto.amount),
                unitType: category.unitType,
                estimatedValue,
            },
            include: {
                wasteCategory: true,
            },
        });
    }
    async deleteLineItem(tenantId, id) {
        const existing = await this.prisma.wasteLineItem.findFirst({ where: { id, tenantId } });
        if (!existing)
            throw new common_1.NotFoundException('Waste line item not found');
        return this.prisma.wasteLineItem.delete({ where: { id } });
    }
};
exports.WasteService = WasteService;
exports.WasteService = WasteService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], WasteService);
//# sourceMappingURL=waste.service.js.map