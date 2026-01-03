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
const client_1 = require("@prisma/client");
let GradeOutputService = class GradeOutputService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAll(tenantId, options) {
        const page = options?.page || 1;
        const limit = options?.limit || 20;
        const skip = (page - 1) * limit;
        const search = (options?.search ?? '').trim();
        const ragCode = (options?.ragCode ?? '').trim();
        const containerNumber = (options?.containerNumber ?? '').trim();
        const where = {
            tenantId,
            ...(options?.gradeId && { gradeId: options.gradeId }),
            ...(options?.gradeSessionId && { gradeBucket: { gradeSessionId: options.gradeSessionId } }),
            ...(options?.status && { status: options.status }),
            ...(options?.categoryId && {
                gradeBucket: {
                    ...(options?.gradeSessionId ? { gradeSessionId: options.gradeSessionId } : {}),
                    gradeSession: { categoryOutput: { categoryId: options.categoryId } },
                },
            }),
        };
        const or = [];
        if (search) {
            or.push({ id: { contains: search, mode: 'insensitive' } }, { grade: { name: { contains: search, mode: 'insensitive' } } }, {
                gradeBucket: {
                    gradeSession: {
                        categoryOutput: {
                            rag: { ragCode: { contains: search, mode: 'insensitive' } },
                        },
                    },
                },
            }, {
                gradeBucket: {
                    gradeSession: {
                        categoryOutput: {
                            container: { containerNumber: { contains: search, mode: 'insensitive' } },
                        },
                    },
                },
            }, {
                gradeBucket: {
                    gradeSession: {
                        categoryOutput: {
                            category: { name: { contains: search, mode: 'insensitive' } },
                        },
                    },
                },
            });
        }
        if (ragCode) {
            or.push({
                gradeBucket: {
                    gradeSession: {
                        categoryOutput: {
                            rag: { ragCode: { contains: ragCode, mode: 'insensitive' } },
                        },
                    },
                },
            });
        }
        if (containerNumber) {
            or.push({
                gradeBucket: {
                    gradeSession: {
                        categoryOutput: {
                            container: { containerNumber: { contains: containerNumber, mode: 'insensitive' } },
                        },
                    },
                },
            });
        }
        if (or.length) {
            where.AND = [...(where.AND ?? []), { OR: or }];
        }
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
                                    categoryOutput: {
                                        select: {
                                            id: true,
                                            categoryId: true,
                                            ragId: true,
                                            containerId: true,
                                            sortSessionId: true,
                                            weightKg: true,
                                            allocatedCost: true,
                                            category: { select: { id: true, name: true } },
                                            rag: { select: { id: true, ragCode: true } },
                                            container: { select: { id: true, containerNumber: true } },
                                        },
                                    },
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
                                categoryOutput: {
                                    select: {
                                        id: true,
                                        categoryId: true,
                                        ragId: true,
                                        containerId: true,
                                        sortSessionId: true,
                                        weightKg: true,
                                        allocatedCost: true,
                                        category: { select: { id: true, name: true } },
                                        rag: { select: { id: true, ragCode: true } },
                                        container: { select: { id: true, containerNumber: true } },
                                    },
                                },
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
    async markReadyForRepack(tenantId, id) {
        const output = await this.prisma.gradeOutput.findFirst({
            where: { id, tenantId },
            include: {
                gradeBucket: {
                    include: {
                        gradeSession: {
                            select: { id: true, status: true },
                        },
                    },
                },
                grade: { select: { id: true, name: true } },
            },
        });
        if (!output) {
            throw new common_1.NotFoundException('Grade output not found');
        }
        if (output.status === client_1.GradingOutputStatus.DEPLETED) {
            throw new common_1.ConflictException('Cannot mark DEPLETED output as ready for repack');
        }
        if (output.status === client_1.GradingOutputStatus.READY_FOR_REPACK) {
            return output;
        }
        if (output.gradeBucket.gradeSession.status !== 'CLOSED') {
            throw new common_1.ConflictException('Cannot mark output as ready: grading session is still OPEN');
        }
        const updated = await this.prisma.gradeOutput.update({
            where: { id },
            data: { status: client_1.GradingOutputStatus.READY_FOR_REPACK },
            include: {
                grade: { select: { id: true, name: true } },
                gradeBucket: {
                    include: {
                        gradeSession: {
                            include: {
                                categoryOutput: {
                                    select: {
                                        id: true,
                                        categoryId: true,
                                        ragId: true,
                                        containerId: true,
                                        category: { select: { id: true, name: true } },
                                        rag: { select: { id: true, ragCode: true } },
                                        container: { select: { id: true, containerNumber: true } },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });
        return updated;
    }
};
exports.GradeOutputService = GradeOutputService;
exports.GradeOutputService = GradeOutputService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], GradeOutputService);
//# sourceMappingURL=grade-output.service.js.map