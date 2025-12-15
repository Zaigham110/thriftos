import { PrismaService } from '../../prisma/prisma.service';
export declare class ProcurementReportsService {
    private prisma;
    constructor(prisma: PrismaService);
    containerCostBreakdown(tenantId: string, containerId: string): Promise<{
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
    vendorProcurementSummary(tenantId: string, filters: {
        startDate?: string;
        endDate?: string;
    }): Promise<{
        vendorId: string;
        vendorName: string;
        totalWeightKg: string;
        totalCost: string;
        avgCostPerKg: string;
    }[]>;
}
