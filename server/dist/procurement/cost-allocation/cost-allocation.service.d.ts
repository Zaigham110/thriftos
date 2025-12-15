import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { Decimal } from '@prisma/client/runtime/library';
export declare class CostAllocationService {
    private prisma;
    private auditService;
    constructor(prisma: PrismaService, auditService: AuditService);
    allocateContainerCosts(containerId: string, userId?: string): Promise<void>;
    getContainerCostBreakdown(containerId: string): Promise<{
        containerId: string;
        containerNumber: string;
        grossWeight: Decimal;
        netWeight: Decimal;
        totalCharges: string;
        chargeBreakdown: {
            type: import("@prisma/client").$Enums.ChargeType;
            description: string;
            amount: string;
        }[];
        rags: {
            id: string;
            code: string;
            weightKg: string;
            allocatedCost: string;
        }[];
        incomingBales: {
            id: string;
            code: string;
            weightKg: string;
            allocatedCost: string;
        }[];
        totalAllocatedToRags: string;
        totalAllocatedToBales: string;
        totalAllocated: string;
    }>;
}
