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
            categoryId: string;
            categoryName: string;
            gradeId: string;
            gradeName: string;
            warehouseId: string;
            warehouseName: string;
            status: string;
            totalUnits: number;
            totalWeightKg: number;
            totalPcs: number;
            avgCost: number;
        }[];
        summary: {
            totalUnits: number;
            totalWeightKg: number;
            totalPcs: number;
        };
    }>;
    stock(filters: ReportFiltersDto, user: CurrentUserData, req: Request): Promise<{
        data: {
            categoryId: string;
            categoryName: string;
            gradeId: string;
            gradeName: string;
            warehouseId: string;
            warehouseName: string;
            status: string;
            totalUnits: number;
            totalWeightKg: number;
            totalPcs: number;
            avgCost: number;
        }[];
        summary: {
            totalUnits: number;
            totalWeightKg: number;
            totalPcs: number;
        };
    }>;
    snapshotExport(filters: ReportFiltersDto, user: CurrentUserData, req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    aging(query: any, user: CurrentUserData, req: Request): Promise<{
        data: {
            ageRangeDays: string;
            unitsCount: number;
            totalWeightKg: number;
            totalValue: number;
        }[];
    }>;
    agingExport(query: any, user: CurrentUserData, req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    movements(query: any, user: CurrentUserData, req: Request): Promise<{
        data: {
            movementId: string;
            createdAt: Date;
            movementType: string;
            quantityKg: number;
            quantityPcs: number;
            referenceId: string;
            inventoryItemId: string;
            inventoryStatus: string;
            avgCost: number;
            warehouseId: string;
            warehouseName: string;
            categoryId: string;
            categoryName: string;
            gradeId: string;
            gradeName: string;
            repackUnitId: string;
            unitCode: string;
            unitType: string;
        }[];
        summary: {
            totalMovements: number;
            totalKg: number;
            totalPcs: number;
        };
    }>;
    movementsExport(query: any, user: CurrentUserData, req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
}
