import { Request } from 'express';
import { TenantService } from './tenant.service';
import { CurrentUserData } from '../common/decorators/current-user.decorator';
import { RagBaleType } from '@prisma/client';
import { CreateRawCategoryDto, UpdateRawCategoryDto } from './dto/raw-category.dto';
export declare class TenantController {
    private readonly tenantService;
    constructor(tenantService: TenantService);
    getCurrentTenant(user: CurrentUserData, req: Request): Promise<{
        _count: {
            users: number;
            roles: number;
            categories: number;
            grades: number;
            warehouses: number;
        };
    } & {
        id: string;
        createdAt: Date;
        name: string;
        updatedAt: Date;
        companyCode: string;
        currency: string;
        locale: string;
        status: import("@prisma/client").$Enums.TenantStatus;
    }>;
    getCategories(user: CurrentUserData, req: Request): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        name: string;
        isActive: boolean;
        updatedAt: Date;
        sortOrder: number;
    }[]>;
    getRawCategories(user: CurrentUserData, req: Request, type?: RagBaleType): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        name: string;
        isActive: boolean;
        updatedAt: Date;
        rawType: import("@prisma/client").$Enums.RagBaleType;
        sortOrder: number;
    }[]>;
    createRawCategory(user: CurrentUserData, req: Request, dto: CreateRawCategoryDto): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        name: string;
        isActive: boolean;
        updatedAt: Date;
        rawType: import("@prisma/client").$Enums.RagBaleType;
        sortOrder: number;
    }>;
    updateRawCategory(user: CurrentUserData, req: Request, id: string, dto: UpdateRawCategoryDto): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        name: string;
        isActive: boolean;
        updatedAt: Date;
        rawType: import("@prisma/client").$Enums.RagBaleType;
        sortOrder: number;
    }>;
    deleteRawCategory(user: CurrentUserData, req: Request, id: string): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        name: string;
        isActive: boolean;
        updatedAt: Date;
        rawType: import("@prisma/client").$Enums.RagBaleType;
        sortOrder: number;
    }>;
    getGrades(user: CurrentUserData, req: Request): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        name: string;
        isActive: boolean;
        updatedAt: Date;
        description: string | null;
        rank: number;
    }[]>;
    getWarehouses(user: CurrentUserData, req: Request): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        name: string;
        updatedAt: Date;
        code: string;
        location: string | null;
    }[]>;
    getStats(user: CurrentUserData, req: Request): Promise<{
        users: number;
        roles: number;
        categories: number;
        grades: number;
        warehouses: number;
    }>;
}
