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
exports.WorkerReportsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const library_1 = require("@prisma/client/runtime/library");
const report_utils_1 = require("../common/report-utils");
let WorkerReportsService = class WorkerReportsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async productivity(tenantId, filters) {
        const { start, end } = (0, report_utils_1.parseDateRange)(filters);
        const stage1 = await this.prisma.sortSession.groupBy({
            by: ['workerId'],
            where: {
                tenantId,
                status: 'CLOSED',
                ...(filters.workerId ? { workerId: filters.workerId } : {}),
                ...(start || end
                    ? {
                        startTime: {
                            ...(start ? { gte: start } : {}),
                            ...(end ? { lte: end } : {}),
                        },
                    }
                    : {}),
            },
            _count: { _all: true },
            _sum: { totalInputWeight: true, totalOutputWeight: true, wasteWeight: true },
            _min: { startTime: true },
            _max: { endTime: true },
        });
        const stage2 = await this.prisma.gradeSession.groupBy({
            by: ['workerId'],
            where: {
                tenantId,
                status: 'CLOSED',
                ...(filters.workerId ? { workerId: filters.workerId } : {}),
                ...(start || end
                    ? {
                        startTime: {
                            ...(start ? { gte: start } : {}),
                            ...(end ? { lte: end } : {}),
                        },
                    }
                    : {}),
            },
            _count: { _all: true },
            _min: { startTime: true },
            _max: { endTime: true },
        });
        const map1 = new Map(stage1.map((r) => [r.workerId, r]));
        const map2 = new Map(stage2.map((r) => [r.workerId, r]));
        const workerIds = Array.from(new Set([...map1.keys(), ...map2.keys()]));
        return workerIds.map((workerId) => {
            const s1 = map1.get(workerId);
            const s2 = map2.get(workerId);
            const input = s1?._sum.totalInputWeight ?? new library_1.Decimal(0);
            const output = s1?._sum.totalOutputWeight ?? new library_1.Decimal(0);
            const waste = s1?._sum.wasteWeight ?? new library_1.Decimal(0);
            const yieldPct = input.equals(new library_1.Decimal(0)) ? new library_1.Decimal(0) : output.div(input).mul(100);
            const wastePct = input.equals(new library_1.Decimal(0)) ? new library_1.Decimal(0) : waste.div(input).mul(100);
            const stage1AvgMinutes = s1?._min.startTime && s1?._max.endTime && s1._count._all > 0
                ? (new Date(s1._max.endTime).getTime() - new Date(s1._min.startTime).getTime()) / 60000 / s1._count._all
                : null;
            const stage2AvgMinutes = s2?._min.startTime && s2?._max.endTime && s2._count._all > 0
                ? (new Date(s2._max.endTime).getTime() - new Date(s2._min.startTime).getTime()) / 60000 / s2._count._all
                : null;
            return {
                workerId,
                stage1: {
                    sessionsCompleted: s1?._count._all ?? 0,
                    avgMinutesPerSession: stage1AvgMinutes,
                    yieldContributionPct: yieldPct.toFixed(2),
                    wastePct: wastePct.toFixed(2),
                },
                stage2: {
                    sessionsCompleted: s2?._count._all ?? 0,
                    avgMinutesPerSession: stage2AvgMinutes,
                },
            };
        });
    }
};
exports.WorkerReportsService = WorkerReportsService;
exports.WorkerReportsService = WorkerReportsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], WorkerReportsService);
//# sourceMappingURL=worker-reports.service.js.map