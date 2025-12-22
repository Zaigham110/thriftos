import { PrismaService } from '../prisma/prisma.service';
import { RagBaleType } from '@prisma/client';
import { CreateRawCategoryDto, UpdateRawCategoryDto } from './dto/raw-category.dto';
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
    getRawCategories(tenantId: string, type?: RagBaleType): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        name: string;
        isActive: boolean;
        updatedAt: Date;
        rawType: import("@prisma/client").$Enums.RagBaleType;
        sortOrder: number;
    }[]>;
    createRawCategory(tenantId: string, dto: CreateRawCategoryDto): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        name: string;
        isActive: boolean;
        updatedAt: Date;
        rawType: import("@prisma/client").$Enums.RagBaleType;
        sortOrder: number;
    }>;
    updateRawCategory(tenantId: string, id: string, dto: UpdateRawCategoryDto): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        name: string;
        isActive: boolean;
        updatedAt: Date;
        rawType: import("@prisma/client").$Enums.RagBaleType;
        sortOrder: number;
    }>;
    deleteRawCategory(tenantId: string, id: string): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        name: string;
        isActive: boolean;
        updatedAt: Date;
        rawType: import("@prisma/client").$Enums.RagBaleType;
        sortOrder: number;
    }>;
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
