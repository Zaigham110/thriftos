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
            steps: ({
                stage: string;
                totalCost: string;
                totalWeightKg: string;
                avgCostPerKg: string;
                totalPcs?: undefined;
                lockedCost?: undefined;
                totalKg?: undefined;
            } | {
                stage: string;
                totalCost: string;
                totalWeightKg: string;
                totalPcs: number;
                avgCostPerKg: string;
                lockedCost?: undefined;
                totalKg?: undefined;
            } | {
                stage: string;
                lockedCost: string;
                totalKg: string;
                totalPcs: number;
                totalCost?: undefined;
                totalWeightKg?: undefined;
                avgCostPerKg?: undefined;
            })[];
        };
    }>;
    cascadeExport(filters: ReportFiltersDto, user: CurrentUserData, req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    readiness(filters: ReportFiltersDto, user: CurrentUserData, req: Request): Promise<{
        data: {
            perKg: {
                categoryId: string;
                gradeId: string;
                totalKg: string;
                totalCost: string;
                avgCostPerKg: string;
            }[];
            perPcs: {
                categoryId: string;
                gradeId: string;
                totalPcs: number;
                totalCost: string;
                avgCostPerPcs: string;
            }[];
            perSku: {
                skuKey: string;
                unitType: string;
                categoryId: string;
                gradeId: string;
                units: number;
                totalCost: string;
                totalWeightKg: string;
                totalPcs: number;
            }[];
        };
    }>;
    readinessExport(filters: ReportFiltersDto, user: CurrentUserData, req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
}
