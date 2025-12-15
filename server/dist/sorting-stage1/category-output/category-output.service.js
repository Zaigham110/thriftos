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
exports.CategoryOutputService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
let CategoryOutputService = class CategoryOutputService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAll(tenantId, options) {
        const page = options?.page || 1;
        const limit = options?.limit || 20;
        const skip = (page - 1) * limit;
        const where = {
            tenantId,
            ...(options?.categoryId && { categoryId: options.categoryId }),
            ...(options?.sortSessionId && { sortCategoryBucket: { sortSessionId: options.sortSessionId } }),
        };
        const [data, total] = await Promise.all([
            this.prisma.categoryOutput.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    category: { select: { id: true, name: true } },
                    sortCategoryBucket: {
                        include: {
                            sortSession: { select: { id: true, status: true, startTime: true, endTime: true } },
                        },
                    },
                },
            }),
            this.prisma.categoryOutput.count({ where }),
        ]);
        return { data, total, page, limit };
    }
    async findOne(tenantId, id) {
        const output = await this.prisma.categoryOutput.findFirst({
            where: { id, tenantId },
            include: {
                category: { select: { id: true, name: true } },
                sortCategoryBucket: {
                    include: {
                        sortSession: { select: { id: true, status: true, startTime: true, endTime: true } },
                        category: { select: { id: true, name: true } },
                    },
                },
            },
        });
        if (!output)
            throw new common_1.NotFoundException('Category output not found');
        return output;
    }
};
exports.CategoryOutputService = CategoryOutputService;
exports.CategoryOutputService = CategoryOutputService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], CategoryOutputService);
//# sourceMappingURL=category-output.service.js.map