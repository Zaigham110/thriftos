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
        containerNumber: string;
        purchaseOrderId: string;
        poNumber: string;
        netWeightKg: string;
        totalCost: string;
        costPerKg: string;
        charges: {
            id: string;
            type: import("@prisma/client").$Enums.ChargeType;
            description: string;
            amount: string;
        }[];
        ragAllocations: {
            ragId: string;
            ragCode: string;
            weightKg: string;
            allocatedCost: string;
            costPerKg: string;
        }[];
    }>;
    vendorSummaryJson(filters: ReportFiltersDto, user: CurrentUserData, req: Request): Promise<{
        data: {
            vendorId: string;
            vendorName: string;
            totalWeightKg: string;
            totalCost: string;
            avgCostPerKg: string;
        }[];
    }>;
    vendorSummaryExportCsv(filters: ReportFiltersDto, user: CurrentUserData, req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
}
