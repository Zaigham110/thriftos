import { Request } from 'express';
import { CurrentUserData } from '../../common/decorators/current-user.decorator';
import { ReportFiltersDto } from '../common/dto/report-filters.dto';
import { ReportsAuditService } from '../common/reports-audit.service';
import { DashboardReportsService } from './dashboard-reports.service';
export declare class DashboardReportsController {
    private readonly service;
    private readonly audit;
    constructor(service: DashboardReportsService, audit: ReportsAuditService);
    summary(filters: ReportFiltersDto, user: CurrentUserData, req: Request): Promise<{
        data: {
            range: {
                startDate: string;
                endDate: string;
            };
            previousRange: {
                startDate: string;
                endDate: string;
            };
            kpis: {
                procurementCost: {
                    value: string;
                    change: string;
                    sparkline: number[];
                };
                sortedWeightKg: {
                    value: string;
                    change: string;
                    sparkline: number[];
                };
                yieldPct: {
                    value: string;
                    change: string;
                    sparkline: number[];
                };
                wastePct: {
                    value: string;
                    change: string;
                    sparkline: number[];
                };
            };
            analytics: {
                sortedVolumeTrend: {
                    bucket: string;
                    value: string;
                }[];
                categoryYield: {
                    categoryId: string;
                    inputWeightKg: string;
                    outputWeightKg: string;
                    wasteWeightKg: string;
                    yieldPct: string;
                }[];
            };
            generatedAt: string;
        };
    }>;
}
