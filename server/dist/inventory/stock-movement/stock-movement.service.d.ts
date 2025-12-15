import { MovementType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
export declare class StockMovementService {
    private prisma;
    constructor(prisma: PrismaService);
    findAll(tenantId: string, options?: {
        inventoryItemId?: string;
        movementType?: MovementType;
        page?: number;
        limit?: number;
    }): Promise<{
        data: ({
            inventoryItem: {
                category: {
                    id: string;
                    name: string;
                };
                grade: {
                    id: string;
                    name: string;
                };
                warehouse: {
                    id: string;
                    name: string;
                    code: string;
                };
                repackUnit: {
                    id: string;
                    unitCode: string;
                };
                id: string;
                status: import("@prisma/client").$Enums.InventoryStatus;
            };
        } & {
            id: string;
            metadataJson: import("@prisma/client/runtime/library").JsonValue | null;
            createdAt: Date;
            updatedAt: Date;
            inventoryItemId: string;
            movementType: import("@prisma/client").$Enums.MovementType;
            quantityKg: import("@prisma/client/runtime/library").Decimal;
            quantityPcs: number;
            referenceId: string | null;
        })[];
        total: number;
        page: number;
        limit: number;
    }>;
    findOne(tenantId: string, id: string): Promise<{
        inventoryItem: {
            category: {
                id: string;
                name: string;
            };
            grade: {
                id: string;
                name: string;
            };
            warehouse: {
                id: string;
                name: string;
                code: string;
            };
            repackUnit: {
                id: string;
                unitCode: string;
            };
        } & {
            id: string;
            tenantId: string;
            createdAt: Date;
            updatedAt: Date;
            status: import("@prisma/client").$Enums.InventoryStatus;
            weightKg: import("@prisma/client/runtime/library").Decimal;
            categoryId: string;
            gradeId: string;
            pcsCount: number;
            repackUnitId: string;
            warehouseId: string;
            avgCost: import("@prisma/client/runtime/library").Decimal;
        };
    } & {
        id: string;
        metadataJson: import("@prisma/client/runtime/library").JsonValue | null;
        createdAt: Date;
        updatedAt: Date;
        inventoryItemId: string;
        movementType: import("@prisma/client").$Enums.MovementType;
        quantityKg: import("@prisma/client/runtime/library").Decimal;
        quantityPcs: number;
        referenceId: string | null;
    }>;
}
