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
exports.GradeOutputService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
let GradeOutputService = class GradeOutputService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAll(tenantId, options) {
        const page = options?.page || 1;
        const limit = options?.limit || 20;
        const skip = (page - 1) * limit;
        const where = {
            tenantId,
            ...(options?.gradeId && { gradeId: options.gradeId }),
            ...(options?.gradeSessionId && { gradeBucket: { gradeSessionId: options.gradeSessionId } }),
        };
        const [data, total] = await Promise.all([
            this.prisma.gradeOutput.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    grade: { select: { id: true, name: true } },
                    gradeBucket: {
                        include: {
                            gradeSession: {
                                include: {
                                    categoryOutput: { select: { id: true, categoryId: true, weightKg: true, allocatedCost: true } },
                                },
                            },
                        },
                    },
                },
            }),
            this.prisma.gradeOutput.count({ where }),
        ]);
        return { data, total, page, limit };
    }
    async findOne(tenantId, id) {
        const output = await this.prisma.gradeOutput.findFirst({
            where: { id, tenantId },
            include: {
                grade: { select: { id: true, name: true } },
                gradeBucket: {
                    include: {
                        grade: { select: { id: true, name: true } },
                        gradeSession: {
                            include: {
                                categoryOutput: { select: { id: true, categoryId: true, weightKg: true, allocatedCost: true } },
                            },
                        },
                    },
                },
            },
        });
        if (!output)
            throw new common_1.NotFoundException('Grade output not found');
        return output;
    }
};
exports.GradeOutputService = GradeOutputService;
exports.GradeOutputService = GradeOutputService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], GradeOutputService);
//# sourceMappingURL=grade-output.service.js.map