import { PrismaService } from '../../prisma/prisma.service';
export declare class WorkerReportsService {
    private prisma;
    constructor(prisma: PrismaService);
    productivity(tenantId: string, filters: {
        startDate?: string;
        endDate?: string;
        workerId?: string;
    }): Promise<{
        workerId: string;
        stage1: {
            sessionsCompleted: number;
            avgMinutesPerSession: number;
            yieldContributionPct: string;
            wastePct: string;
        };
        stage2: {
            sessionsCompleted: number;
            avgMinutesPerSession: number;
        };
    }[]>;
}
