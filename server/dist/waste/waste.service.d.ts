import { PrismaService } from '../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';
import { WasteStage, WasteUnitType } from '@prisma/client';
export declare class WasteService {
    private prisma;
    constructor(prisma: PrismaService);
    listCategories(tenantId: string): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        name: string;
        isActive: boolean;
        updatedAt: Date;
        unitType: import("@prisma/client").$Enums.WasteUnitType;
        defaultResalePrice: Decimal;
        isSystemGenerated: boolean;
        linkedCategoryId: string | null;
    }[]>;
    listAllCategories(tenantId: string): Promise<({
        linkedCategory: {
            id: string;
            name: string;
        };
    } & {
        id: string;
        tenantId: string;
        createdAt: Date;
        name: string;
        isActive: boolean;
        updatedAt: Date;
        unitType: import("@prisma/client").$Enums.WasteUnitType;
        defaultResalePrice: Decimal;
        isSystemGenerated: boolean;
        linkedCategoryId: string | null;
    })[]>;
    createCategory(tenantId: string, dto: {
        name: string;
        unitType: WasteUnitType;
        defaultResalePrice: number;
    }): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        name: string;
        isActive: boolean;
        updatedAt: Date;
        unitType: import("@prisma/client").$Enums.WasteUnitType;
        defaultResalePrice: Decimal;
        isSystemGenerated: boolean;
        linkedCategoryId: string | null;
    }>;
    updateCategory(tenantId: string, id: string, dto: {
        name?: string;
        unitType?: WasteUnitType;
        defaultResalePrice?: number;
        isActive?: boolean;
    }): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        name: string;
        isActive: boolean;
        updatedAt: Date;
        unitType: import("@prisma/client").$Enums.WasteUnitType;
        defaultResalePrice: Decimal;
        isSystemGenerated: boolean;
        linkedCategoryId: string | null;
    }>;
    createLineItem(tenantId: string, dto: {
        stage: WasteStage;
        wasteCategoryId: string;
        amount: number;
        sortSessionId?: string;
        gradeSessionId?: string;
    }, traceability: {
        containerId?: string | null;
        ragId?: string | null;
        categoryOutputId?: string | null;
    }): Promise<{
        wasteCategory: {
            id: string;
            tenantId: string;
            createdAt: Date;
            name: string;
            isActive: boolean;
            updatedAt: Date;
            unitType: import("@prisma/client").$Enums.WasteUnitType;
            defaultResalePrice: Decimal;
            isSystemGenerated: boolean;
            linkedCategoryId: string | null;
        };
    } & {
        id: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        unitType: import("@prisma/client").$Enums.WasteUnitType;
        containerId: string | null;
        amount: Decimal;
        ragId: string | null;
        sortSessionId: string | null;
        estimatedValue: Decimal;
        stage: import("@prisma/client").$Enums.WasteStage;
        wasteCategoryId: string;
        gradeSessionId: string | null;
        categoryOutputId: string | null;
    }>;
    updateLineItem(tenantId: string, id: string, dto: {
        wasteCategoryId: string;
        amount: number;
    }): Promise<{
        wasteCategory: {
            id: string;
            tenantId: string;
            createdAt: Date;
            name: string;
            isActive: boolean;
            updatedAt: Date;
            unitType: import("@prisma/client").$Enums.WasteUnitType;
            defaultResalePrice: Decimal;
            isSystemGenerated: boolean;
            linkedCategoryId: string | null;
        };
    } & {
        id: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        unitType: import("@prisma/client").$Enums.WasteUnitType;
        containerId: string | null;
        amount: Decimal;
        ragId: string | null;
        sortSessionId: string | null;
        estimatedValue: Decimal;
        stage: import("@prisma/client").$Enums.WasteStage;
        wasteCategoryId: string;
        gradeSessionId: string | null;
        categoryOutputId: string | null;
    }>;
    deleteLineItem(tenantId: string, id: string): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        unitType: import("@prisma/client").$Enums.WasteUnitType;
        containerId: string | null;
        amount: Decimal;
        ragId: string | null;
        sortSessionId: string | null;
        estimatedValue: Decimal;
        stage: import("@prisma/client").$Enums.WasteStage;
        wasteCategoryId: string;
        gradeSessionId: string | null;
        categoryOutputId: string | null;
    }>;
}
