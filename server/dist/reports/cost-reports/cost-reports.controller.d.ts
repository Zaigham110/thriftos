import { Request, Response } from 'express';
import { CurrentUserData } from '../../common/decorators/current-user.decorator';
import { ReportFiltersDto } from '../common/dto/report-filters.dto';
import { ReportsAuditService } from '../common/reports-audit.service';
import { CostReportsService } from './cost-reports.service';
export declare class CostReportsController {
    private readonly service;
    private readonly audit;
    constructor(service: CostReportsService, audit: ReportsAuditService);
    cascade(filters: ReportFiltersDto, user: CurrentUserData, req: Request): Promise<{
        data: {
            procurement: {
                totalCost: number;
                weightKg: number;
                costPerKg: number;
            };
            sorting: {
                totalCost: number;
                weightKg: number;
                costPerKg: number;
            };
            grading: {
                totalCost: number;
                weightKg: number;
                costPerKg: number;
            };
            repack: {
                totalCost: number;
                weightKg: number;
                costPerKg: number;
            };
            final: {
                totalCost: number;
                weightKg: number;
                costPerKg: number;
            };
        };
    }>;
    cascadeExport(filters: ReportFiltersDto, user: CurrentUserData, req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    readiness(filters: ReportFiltersDto, user: CurrentUserData, req: Request): Promise<{
        data: {
            categoryId: string;
            categoryName: string;
            gradeId: string;
            gradeName: string;
            unitsReady: number;
            totalWeightKg: number;
            totalCost: number;
            avgCostPerKg: number;
        }[];
    }>;
    readinessExport(filters: ReportFiltersDto, user: CurrentUserData, req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    finalProducts(filters: ReportFiltersDto, user: CurrentUserData, req: Request): Promise<{
        data: {
            repackUnitId: string;
            productCode: string;
            unitType: string;
            categoryId: string;
            category: string;
            gradeId: string;
            grade: string;
            totalWeightKg: number;
            totalQty: number;
            totalCost: number;
            repackUnitTotalCost: number;
            costPerKg: number;
            costPerUnit: number;
            sourceContainers: number;
            sourceBales: number;
            allocationsCount: number;
            dateSealed: string;
        }[];
        summary: {
            totalUnits: number;
            totalWeightKg: number;
            totalCost: number;
        };
    }>;
    finalProductsExport(filters: ReportFiltersDto, user: CurrentUserData, req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
}
