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
exports.StockMovementService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
let StockMovementService = class StockMovementService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAll(tenantId, options) {
        const page = options?.page || 1;
        const limit = options?.limit || 50;
        const skip = (page - 1) * limit;
        const where = {
            inventoryItem: { tenantId },
            ...(options?.inventoryItemId && { inventoryItemId: options.inventoryItemId }),
            ...(options?.movementType && { movementType: options.movementType }),
        };
        const [data, total] = await Promise.all([
            this.prisma.stockMovement.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    inventoryItem: {
                        select: {
                            id: true,
                            repackUnit: { select: { id: true, unitCode: true } },
                            category: { select: { id: true, name: true } },
                            grade: { select: { id: true, name: true } },
                            warehouse: { select: { id: true, name: true, code: true } },
                            status: true,
                        },
                    },
                },
            }),
            this.prisma.stockMovement.count({ where }),
        ]);
        return { data, total, page, limit };
    }
    async findOne(tenantId, id) {
        const movement = await this.prisma.stockMovement.findFirst({
            where: { id, inventoryItem: { tenantId } },
            include: {
                inventoryItem: {
                    include: {
                        repackUnit: { select: { id: true, unitCode: true } },
                        category: { select: { id: true, name: true } },
                        grade: { select: { id: true, name: true } },
                        warehouse: { select: { id: true, name: true, code: true } },
                    },
                },
            },
        });
        if (!movement)
            throw new common_1.NotFoundException('Stock movement not found');
        return movement;
    }
};
exports.StockMovementService = StockMovementService;
exports.StockMovementService = StockMovementService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], StockMovementService);
//# sourceMappingURL=stock-movement.service.js.map