import { Request } from 'express';
import { InventoryStatus } from '@prisma/client';
import { CurrentUserData } from '../../common/decorators/current-user.decorator';
import { InventoryItemService } from './inventory-item.service';
import { AdjustInventoryDto, IntakeDto } from './dto';
export declare class InventoryItemController {
    private readonly service;
    constructor(service: InventoryItemService);
    intake(dto: IntakeDto, user: CurrentUserData, req: Request): Promise<{
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
    }>;
    findAll(categoryId: string, gradeId: string, warehouseId: string, status: InventoryStatus, page: number, limit: number, user: CurrentUserData, req: Request): Promise<{
        data: ({
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
                unitType: import("@prisma/client").$Enums.UnitType;
            };
            _count: {
                stockMovements: number;
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
        })[];
        total: number;
        page: number;
        limit: number;
    }>;
    findOne(id: string, user: CurrentUserData, req: Request): Promise<{
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
            totalCost: import("@prisma/client/runtime/library").Decimal;
            weightKg: import("@prisma/client/runtime/library").Decimal;
            unitCode: string;
            unitType: import("@prisma/client").$Enums.UnitType;
            pcsCount: number;
        };
        stockMovements: {
            id: string;
            metadataJson: import("@prisma/client/runtime/library").JsonValue | null;
            createdAt: Date;
            updatedAt: Date;
            inventoryItemId: string;
            movementType: import("@prisma/client").$Enums.MovementType;
            quantityKg: import("@prisma/client/runtime/library").Decimal;
            quantityPcs: number;
            referenceId: string | null;
        }[];
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
    }>;
    adjust(id: string, dto: AdjustInventoryDto, user: CurrentUserData, req: Request): Promise<{
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
    }>;
    reserve(id: string, user: CurrentUserData, req: Request): Promise<{
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
    }>;
    release(id: string, user: CurrentUserData, req: Request): Promise<{
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
    }>;
}
