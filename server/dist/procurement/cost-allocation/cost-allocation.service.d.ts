import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { Prisma } from '@prisma/client';
export declare class CostAllocationService {
    private prisma;
    private auditService;
    constructor(prisma: PrismaService, auditService: AuditService);
    allocateContainerCosts(containerId: string, userId?: string): Promise<void>;
    syncPurchaseOrderTotals(purchaseOrderId: string, prismaClient?: Prisma.TransactionClient): Promise<void>;
    getContainerCostBreakdown(containerId: string): Promise<{
        containerId: string;
        containerNumber: string;
        totalCost: number;
        costPerKg: number;
        totalWeight: number;
        currency: string;
        charges: {
            id: string;
            containerId: string;
            chargeType: import("@prisma/client").$Enums.ChargeType;
            description: string;
            amount: number;
            createdAt: string;
            updatedAt: string;
        }[];
        rags: {
            id: string;
            code: string;
            weightKg: number;
            allocatedCost: number;
        }[];
        incomingBales: {
            id: string;
            code: string;
            weightKg: number;
            allocatedCost: number;
        }[];
    }>;
}
