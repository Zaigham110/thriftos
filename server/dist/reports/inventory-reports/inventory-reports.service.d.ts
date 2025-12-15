import { PrismaService } from '../../prisma/prisma.service';
export declare class InventoryReportsService {
    private prisma;
    constructor(prisma: PrismaService);
    inventorySnapshot(tenantId: string, filters: {
        warehouseId?: string;
        categoryId?: string;
        gradeId?: string;
        startDate?: string;
        endDate?: string;
    }): Promise<{
        warehouseId: string;
        categoryId: string;
        gradeId: string;
        status: string;
        items: number;
        weightKg: string;
        pcsCount: number;
        costLocked: string;
    }[]>;
    inventoryAging(tenantId: string, filters: {
        warehouseId?: string;
        categoryId?: string;
        gradeId?: string;
        asOfDate?: string;
    }): Promise<{
        bucket: string;
        items: number;
        weightKg: string;
        pcsCount: number;
        costLocked: string;
    }[]>;
}
