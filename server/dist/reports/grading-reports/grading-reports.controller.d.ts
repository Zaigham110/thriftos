import { Request, Response } from 'express';
import { CurrentUserData } from '../../common/decorators/current-user.decorator';
import { ReportFiltersDto } from '../common/dto/report-filters.dto';
import { ReportsAuditService } from '../common/reports-audit.service';
import { GradingReportsService } from './grading-reports.service';
export declare class GradingReportsController {
    private readonly service;
    private readonly audit;
    constructor(service: GradingReportsService, audit: ReportsAuditService);
    distribution(filters: ReportFiltersDto, user: CurrentUserData, req: Request): Promise<{
        data: {
            categoryId: string;
            gradeId: string;
            gradeWeightKg: string;
            gradePct: string;
            gradeCost: string;
            costPerKg: string;
        }[];
    }>;
    distributionExport(filters: ReportFiltersDto, user: CurrentUserData, req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    loss(filters: ReportFiltersDto, user: CurrentUserData, req: Request): Promise<{
        data: {
            categoryId: string;
            inputWeightKg: string;
            wasteWeightKg: string;
            wastePct: string;
            wasteCost: string;
        }[];
    }>;
    lossExport(filters: ReportFiltersDto, user: CurrentUserData, req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
}
