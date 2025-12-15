import { Request, Response } from 'express';
import { CurrentUserData } from '../../common/decorators/current-user.decorator';
import { ReportFiltersDto } from '../common/dto/report-filters.dto';
import { ReportsAuditService } from '../common/reports-audit.service';
import { SortingReportsService } from './sorting-reports.service';
export declare class SortingReportsController {
    private readonly service;
    private readonly audit;
    constructor(service: SortingReportsService, audit: ReportsAuditService);
    categoryYield(filters: ReportFiltersDto, user: CurrentUserData, req: Request): Promise<{
        data: {
            categoryId: string;
            inputWeightKg: string;
            outputWeightKg: string;
            wasteWeightKg: string;
            yieldPct: string;
        }[];
    }>;
    categoryYieldExport(filters: ReportFiltersDto, user: CurrentUserData, req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    efficiency(filters: ReportFiltersDto, user: CurrentUserData, req: Request): Promise<{
        data: {
            workerId: string;
            sessionsHandled: number;
            inputWeightKg: string;
            outputWeightKg: string;
            wasteWeightKg: string;
            avgYieldPct: string;
            avgWastePct: string;
        }[];
    }>;
    efficiencyExport(filters: ReportFiltersDto, user: CurrentUserData, req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
}
