import { PrismaService } from '../../prisma/prisma.service';
import { ReportsConsistencyService } from '../common/reports-consistency.service';
export declare class InventoryReportsService {
    private readonly prisma;
    private readonly consistency;
    constructor(prisma: PrismaService, consistency: ReportsConsistencyService);
    inventorySnapshot(tenantId: string, filters: {
        warehouseId?: string;
        categoryId?: string;
        gradeId?: string;
        startDate?: string;
        endDate?: string;
    }): Promise<{
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
    inventoryAging(tenantId: string, filters: {
        warehouseId?: string;
        categoryId?: string;
        gradeId?: string;
        asOfDate?: string;
    }): Promise<{
        data: {
            ageRangeDays: string;
            unitsCount: number;
            totalWeightKg: number;
            totalValue: number;
        }[];
    }>;
    inventoryMovements(tenantId: string, filters: {
        startDate?: string;
        endDate?: string;
        warehouseId?: string;
        categoryId?: string;
        gradeId?: string;
        movementType?: string;
    }): Promise<{
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
}
