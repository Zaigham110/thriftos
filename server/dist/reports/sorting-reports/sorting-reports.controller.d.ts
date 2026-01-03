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
            categoryName: string;
            inputWeightKg: number;
            outputWeightKg: number;
            wasteWeightKg: number;
            yieldPct: number;
        }[];
    }>;
    categoryYieldExport(filters: ReportFiltersDto, user: CurrentUserData, req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    outputs(filters: ReportFiltersDto, user: CurrentUserData, req: Request): Promise<{
        stage1: {
            data: {
                categoryOutputId: string;
                createdAt: Date;
                categoryId: string;
                categoryName: string;
                weightKg: number;
                allocatedCost: number;
                sortSessionId: string;
                sortStatus: string;
                workerId: string;
                ragId: string;
                ragCode: string;
                containerId: string;
                containerNumber: string;
                purchaseOrderId: string;
                poNumber: string;
            }[];
            summary: {
                totalOutputs: number;
                totalWeightKg: number;
                totalAllocatedCost: number;
            };
        };
        stage2: {
            data: {
                gradingOutputId: string;
                createdAt: Date;
                gradeId: string;
                gradeName: string;
                categoryId: string;
                categoryName: string;
                weightKg: number;
                allocatedCost: number;
                totalAmount: number;
                usedAmount: number;
                remainingAmount: number;
                measurementType: string;
                status: string;
                gradeSessionId: string;
                gradeStatus: string;
                workerId: string;
                categoryOutputId: string;
                sortSessionId: string;
                ragId: string;
                ragCode: string;
                containerId: string;
                containerNumber: string;
                purchaseOrderId: string;
                poNumber: string;
            }[];
            summary: {
                totalOutputs: number;
                totalWeightKg: number;
                totalAllocatedCost: number;
            };
        };
    }>;
    outputsExport(filters: ReportFiltersDto, user: CurrentUserData, req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    waste(filters: ReportFiltersDto, user: CurrentUserData, req: Request): Promise<{
        data: {
            sortingWasteId: string;
            createdAt: Date;
            sortSessionId: string;
            workerId: string;
            ragId: string;
            ragCode: string;
            containerId: string;
            containerNumber: string;
            purchaseOrderId: string;
            poNumber: string;
            wasteWeightKg: number;
        }[];
        summary: {
            totalWasteKg: number;
            totalRecords: number;
        };
        categorized: {
            data: {
                wasteLineItemId: string;
                createdAt: Date;
                stage: "STAGE_1" | "STAGE_2";
                amount: number;
                unitType: "KG" | "PCS";
                estimatedValue: number;
                wasteCategoryId: string;
                wasteCategoryName: string;
                sortSessionId: string;
                gradeSessionId: string;
                workerId: string;
                ragId: string;
                ragCode: string;
                containerId: string;
                containerNumber: string;
                purchaseOrderId: string;
                poNumber: string;
            }[];
            byCategory: {
                stage: "STAGE_1" | "STAGE_2";
                wasteCategoryId: string;
                wasteCategoryName: string;
                unitType: "KG" | "PCS";
                totalAmount: number;
                totalEstimatedValue: number;
                totalRecords: number;
            }[];
            summary: {
                totalKg: number;
                totalPcs: number;
                totalEstimatedValue: number;
                totalRecords: number;
            };
        };
        combinedSummary: {
            totalWasteKg: number;
            totalWastePcs: number;
            totalEstimatedValue: number;
            legacyRecords: number;
            categorizedRecords: number;
        };
    }>;
    wasteExport(filters: ReportFiltersDto, user: CurrentUserData, req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
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
    volumeTrend(filters: ReportFiltersDto, user: CurrentUserData, req: Request): Promise<{
        data: {
            bucket: string;
            value: string;
        }[];
    }>;
    yieldWasteTrend(filters: ReportFiltersDto, user: CurrentUserData, req: Request): Promise<{
        data: {
            bucket: string;
            yieldPct: string;
            wastePct: string;
        }[];
    }>;
    efficiencyExport(filters: ReportFiltersDto, user: CurrentUserData, req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
}
