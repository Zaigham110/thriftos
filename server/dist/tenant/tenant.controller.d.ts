import { Request } from 'express';
import { TenantService } from './tenant.service';
import { CurrentUserData } from '../common/decorators/current-user.decorator';
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
