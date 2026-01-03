import { Request } from 'express';
import { CurrentUserData } from '../../common/decorators/current-user.decorator';
import { ReportFiltersDto } from '../../reports/common/dto/report-filters.dto';
import { ProcurementDashboardService } from './procurement-dashboard.service';
export declare class ProcurementDashboardController {
    private readonly service;
    constructor(service: ProcurementDashboardService);
    summary(filters: ReportFiltersDto, user: CurrentUserData, req: Request): Promise<{
        data: {
            range: {
                startDate: string;
                endDate: string;
            };
            currency: string;
            kpis: {
                activePos: number;
                remainingBudget: string;
                containersInTransit: number;
                looseBalesReceived: number;
            };
            charts: {
                poSpendVsAllocated: {
                    label: string;
                    value: number;
                }[];
                vendorDistribution: {
                    vendorId: string;
                    vendorName: string;
                    totalCost: string;
                    sharePct: number;
                }[];
            };
            generatedAt: string;
        };
    }>;
}
