import { InventoryStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { AuditService } from '../../audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AdjustInventoryDto, IntakeDto } from './dto';
export declare class InventoryItemService {
    private prisma;
    private auditService;
    constructor(prisma: PrismaService, auditService: AuditService);
    intake(tenantId: string, dto: IntakeDto, userId: string): Promise<{
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
        weightKg: Decimal;
        categoryId: string;
        gradeId: string;
        pcsCount: number;
        repackUnitId: string;
        warehouseId: string;
        avgCost: Decimal;
    }>;
    findAll(tenantId: string, options?: {
        categoryId?: string;
        gradeId?: string;
        warehouseId?: string;
        status?: InventoryStatus;
        page?: number;
        limit?: number;
    }): Promise<{
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
            weightKg: Decimal;
            categoryId: string;
            gradeId: string;
            pcsCount: number;
            repackUnitId: string;
            warehouseId: string;
            avgCost: Decimal;
        })[];
        total: number;
        page: number;
        limit: number;
    }>;
    findOne(tenantId: string, id: string): Promise<{
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
            totalCost: Decimal;
            weightKg: Decimal;
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
            quantityKg: Decimal;
            quantityPcs: number;
            referenceId: string | null;
        }[];
    } & {
        id: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.InventoryStatus;
        weightKg: Decimal;
        categoryId: string;
        gradeId: string;
        pcsCount: number;
        repackUnitId: string;
        warehouseId: string;
        avgCost: Decimal;
    }>;
    adjust(tenantId: string, id: string, dto: AdjustInventoryDto, userId: string): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.InventoryStatus;
        weightKg: Decimal;
        categoryId: string;
        gradeId: string;
        pcsCount: number;
        repackUnitId: string;
        warehouseId: string;
        avgCost: Decimal;
    }>;
    reserve(tenantId: string, id: string, userId: string): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.InventoryStatus;
        weightKg: Decimal;
        categoryId: string;
        gradeId: string;
        pcsCount: number;
        repackUnitId: string;
        warehouseId: string;
        avgCost: Decimal;
    }>;
    release(tenantId: string, id: string, userId: string): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.InventoryStatus;
        weightKg: Decimal;
        categoryId: string;
        gradeId: string;
        pcsCount: number;
        repackUnitId: string;
        warehouseId: string;
        avgCost: Decimal;
    }>;
}
