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
            gradeInputWeightKg: number;
            repackOutputWeightKg: number;
            unitsProduced: number;
            avgUnitWeightKg: number;
        }[];
    }>;
    summary(filters: ReportFiltersDto, user: CurrentUserData, req: Request): Promise<{
        data: {
            status: string;
            units: number;
            totalWeightKg: number;
            totalPcs: number;
            totalCost: number;
        }[];
        summary: {
            totalUnits: number;
            totalWeightKg: number;
            totalPcs: number;
            totalCost: number;
        };
    }>;
    summaryExport(filters: ReportFiltersDto, user: CurrentUserData, req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
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
            weightKg: number;
            pcsCount: number;
            totalCost: number;
            createdAt: Date;
        }[];
    }>;
    skuSummaryExport(query: any, user: CurrentUserData, req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
}
