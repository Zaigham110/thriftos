import { Request, Response } from 'express';
import { CurrentUserData } from '../../common/decorators/current-user.decorator';
import { ReportFiltersDto } from '../common/dto/report-filters.dto';
import { ReportsAuditService } from '../common/reports-audit.service';
import { InventoryReportsService } from './inventory-reports.service';
export declare class InventoryReportsController {
    private readonly service;
    private readonly audit;
    constructor(service: InventoryReportsService, audit: ReportsAuditService);
    snapshot(filters: ReportFiltersDto, user: CurrentUserData, req: Request): Promise<{
        data: {
            warehouseId: string;
            categoryId: string;
            gradeId: string;
            status: string;
            items: number;
            weightKg: string;
            pcsCount: number;
            costLocked: string;
        }[];
    }>;
    snapshotExport(filters: ReportFiltersDto, user: CurrentUserData, req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    aging(query: any, user: CurrentUserData, req: Request): Promise<{
        data: {
            bucket: string;
            items: number;
            weightKg: string;
            pcsCount: number;
            costLocked: string;
        }[];
    }>;
    agingExport(query: any, user: CurrentUserData, req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
}
