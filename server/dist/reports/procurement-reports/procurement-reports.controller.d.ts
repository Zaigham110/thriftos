import { Response, Request } from 'express';
import { CurrentUserData } from '../../common/decorators/current-user.decorator';
import { ReportFiltersDto } from '../common/dto/report-filters.dto';
import { ReportsAuditService } from '../common/reports-audit.service';
import { ProcurementReportsService } from './procurement-reports.service';
export declare class ProcurementReportsController {
    private readonly service;
    private readonly audit;
    constructor(service: ProcurementReportsService, audit: ReportsAuditService);
    containerCostBreakdown(containerId: string, user: CurrentUserData, req: Request): Promise<{
        containerId: string;
        containerCode: string;
        vendorName: string;
        landingDate: string;
        purchaseCost: number;
        shippingCost: number;
        dutiesCost: number;
        otherCosts: number;
        totalCost: number;
        totalWeightKg: number;
        costPerKg: number;
    }>;
    vendorSummaryJson(filters: ReportFiltersDto, user: CurrentUserData, req: Request): Promise<{
        data: {
            vendorId: string;
            vendorName: string;
            totalContainers: number;
            totalWeightKg: number;
            totalCost: number;
            avgCostPerKg: number;
        }[];
        total: number;
    }>;
    vendorSummaryExportCsv(filters: ReportFiltersDto, user: CurrentUserData, req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    procurementSummaryJson(filters: ReportFiltersDto, user: CurrentUserData, req: Request): Promise<{
        data: {
            purchaseOrderId: string;
            poNumber: string;
            poType: string;
            status: string;
            currency: string;
            vendorId: string;
            vendorName: string;
            createdAt: string;
            containers: {
                count: number;
                weightKg: number;
                cost: number;
            };
            looseBales: {
                count: number;
                weightKg: number;
                cost: number;
            };
            poTotalCost: number;
            computedProcurementCost: number;
            costDelta: number;
            matchesPoTotal: boolean;
        }[];
        summary: {
            avgCostPerKg: number;
            currency: string;
            totalPurchaseOrders: number;
            totalPoCost: number;
            totalContainers: number;
            totalContainerWeightKg: number;
            totalContainerCost: number;
            totalLooseBales: number;
            totalLooseBaleWeightKg: number;
            totalLooseBaleCost: number;
            totalComputedProcurementCost: number;
        };
    }>;
    procurementSummaryExportCsv(filters: ReportFiltersDto, user: CurrentUserData, req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
}
