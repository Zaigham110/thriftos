import { Request, Response } from 'express';
import { CurrentUserData } from '../../common/decorators/current-user.decorator';
import { ReportFiltersDto } from '../common/dto/report-filters.dto';
import { ReportsAuditService } from '../common/reports-audit.service';
import { WasteReportsService } from './waste-reports.service';
export declare class WasteReportsController {
    private readonly service;
    private readonly audit;
    constructor(service: WasteReportsService, audit: ReportsAuditService);
    byStage(filters: ReportFiltersDto, user: CurrentUserData, req: Request): Promise<{
        data: {
            procurementWasteKg: string;
            sortingStage1WasteKg: string;
            gradingStage2WasteKg: string;
        };
    }>;
    byStageExport(filters: ReportFiltersDto, user: CurrentUserData, req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    costImpact(filters: ReportFiltersDto, user: CurrentUserData, req: Request): Promise<{
        data: {
            procurement: {
                wasteKg: string;
                wasteCost: string;
            };
            sortingStage1: {
                wasteKg: string;
                wasteCost: string;
            };
            gradingStage2: {
                wasteKg: string;
                wasteCost: string;
            };
        };
    }>;
    costImpactExport(filters: ReportFiltersDto, user: CurrentUserData, req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
}
