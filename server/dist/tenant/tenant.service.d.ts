import { PrismaService } from '../prisma/prisma.service';
export declare class TenantService {
    private prisma;
    constructor(prisma: PrismaService);
    findOne(id: string): Promise<{
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
    getCategories(tenantId: string): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        name: string;
        isActive: boolean;
        updatedAt: Date;
        sortOrder: number;
    }[]>;
    getGrades(tenantId: string): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        name: string;
        isActive: boolean;
        updatedAt: Date;
        description: string | null;
        rank: number;
    }[]>;
    getWarehouses(tenantId: string): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        name: string;
        updatedAt: Date;
        code: string;
        location: string | null;
    }[]>;
    getStats(tenantId: string): Promise<{
        users: number;
        roles: number;
        categories: number;
        grades: number;
        warehouses: number;
    }>;
}
