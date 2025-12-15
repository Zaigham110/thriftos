import { Request, Response } from 'express';
import { CurrentUserData } from '../../common/decorators/current-user.decorator';
import { ReportFiltersDto } from '../common/dto/report-filters.dto';
import { ReportsAuditService } from '../common/reports-audit.service';
import { RepackReportsService } from './repack-reports.service';
export declare class RepackReportsController {
    private readonly service;
    private readonly audit;
    constructor(service: RepackReportsService, audit: ReportsAuditService);
    efficiency(filters: ReportFiltersDto, user: CurrentUserData, req: Request): Promise<{
        data: {
            day: string;
            gradeInputWeightKg: string;
            repackOutputWeightKg: string;
            unitsProduced: number;
            avgUnitWeightKg: string;
        }[];
    }>;
    efficiencyExport(filters: ReportFiltersDto, user: CurrentUserData, req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    skuSummary(query: any, user: CurrentUserData, req: Request): Promise<{
        page: number;
        limit: number;
        total: number;
        data: {
            unitId: string;
            unitCode: string;
            unitType: import("@prisma/client").$Enums.UnitType;
            categoryId: string;
            categoryName: string;
            gradeId: string;
            gradeName: string;
            weightKg: string;
            pcsCount: number;
            totalCost: string;
            createdAt: Date;
        }[];
    }>;
    skuSummaryExport(query: any, user: CurrentUserData, req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
}
