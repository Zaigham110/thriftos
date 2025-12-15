import { Request, Response } from 'express';
import { CurrentUserData } from '../../common/decorators/current-user.decorator';
import { ReportFiltersDto } from '../common/dto/report-filters.dto';
import { ReportsAuditService } from '../common/reports-audit.service';
import { WorkerReportsService } from './worker-reports.service';
export declare class WorkerReportsController {
    private readonly service;
    private readonly audit;
    constructor(service: WorkerReportsService, audit: ReportsAuditService);
    productivity(filters: ReportFiltersDto, user: CurrentUserData, req: Request): Promise<{
        data: {
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
        }[];
    }>;
    productivityExport(filters: ReportFiltersDto, user: CurrentUserData, req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
}
