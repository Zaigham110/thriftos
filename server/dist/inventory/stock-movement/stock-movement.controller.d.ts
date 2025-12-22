import { Request } from 'express';
import { MovementType } from '@prisma/client';
import { CurrentUserData } from '../../common/decorators/current-user.decorator';
import { StockMovementService } from './stock-movement.service';
export declare class StockMovementController {
    private readonly service;
    constructor(service: StockMovementService);
    findAll(inventoryItemId: string, movementType: MovementType, page: number, limit: number, user: CurrentUserData, req: Request): Promise<{
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
    findOne(id: string, user: CurrentUserData, req: Request): Promise<{
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
            containerId: string | null;
            weightKg: import("@prisma/client/runtime/library").Decimal;
            ragId: string | null;
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
