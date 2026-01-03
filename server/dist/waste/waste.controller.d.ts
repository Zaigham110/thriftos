import { Request } from 'express';
import { CurrentUserData } from '../common/decorators/current-user.decorator';
import { WasteService } from './waste.service';
import { CreateWasteCategoryDto, UpdateWasteCategoryDto } from './dto/waste-category.dto';
export declare class WasteController {
    private readonly waste;
    constructor(waste: WasteService);
    listActive(user: CurrentUserData, req: Request): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        name: string;
        isActive: boolean;
        updatedAt: Date;
        unitType: import("@prisma/client").$Enums.WasteUnitType;
        defaultResalePrice: import("@prisma/client/runtime/library").Decimal;
        isSystemGenerated: boolean;
        linkedCategoryId: string | null;
    }[]>;
    listAll(user: CurrentUserData, req: Request): Promise<({
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
        defaultResalePrice: import("@prisma/client/runtime/library").Decimal;
        isSystemGenerated: boolean;
        linkedCategoryId: string | null;
    })[]>;
    create(dto: CreateWasteCategoryDto, user: CurrentUserData, req: Request): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        name: string;
        isActive: boolean;
        updatedAt: Date;
        unitType: import("@prisma/client").$Enums.WasteUnitType;
        defaultResalePrice: import("@prisma/client/runtime/library").Decimal;
        isSystemGenerated: boolean;
        linkedCategoryId: string | null;
    }>;
    update(id: string, dto: UpdateWasteCategoryDto, user: CurrentUserData, req: Request): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        name: string;
        isActive: boolean;
        updatedAt: Date;
        unitType: import("@prisma/client").$Enums.WasteUnitType;
        defaultResalePrice: import("@prisma/client/runtime/library").Decimal;
        isSystemGenerated: boolean;
        linkedCategoryId: string | null;
    }>;
    remove(id: string, user: CurrentUserData, req: Request): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        name: string;
        isActive: boolean;
        updatedAt: Date;
        unitType: import("@prisma/client").$Enums.WasteUnitType;
        defaultResalePrice: import("@prisma/client/runtime/library").Decimal;
        isSystemGenerated: boolean;
        linkedCategoryId: string | null;
    }>;
}
