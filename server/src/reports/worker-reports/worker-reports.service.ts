import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';
import { parseDateRange } from '../common/report-utils';

@Injectable()
export class WorkerReportsService {
  constructor(private prisma: PrismaService) {}

  async productivity(tenantId: string, filters: { startDate?: string; endDate?: string; workerId?: string }) {
    const { start, end } = parseDateRange(filters);

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

      const input = s1?._sum.totalInputWeight ?? new Decimal(0);
      const output = s1?._sum.totalOutputWeight ?? new Decimal(0);
      const waste = s1?._sum.wasteWeight ?? new Decimal(0);
      const yieldPct = input.equals(new Decimal(0)) ? new Decimal(0) : output.div(input).mul(100);
      const wastePct = input.equals(new Decimal(0)) ? new Decimal(0) : waste.div(input).mul(100);

      const stage1AvgMinutes =
        s1?._min.startTime && s1?._max.endTime && s1._count._all > 0
          ? (new Date(s1._max.endTime).getTime() - new Date(s1._min.startTime).getTime()) / 60000 / s1._count._all
          : null;

      const stage2AvgMinutes =
        s2?._min.startTime && s2?._max.endTime && s2._count._all > 0
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
}


