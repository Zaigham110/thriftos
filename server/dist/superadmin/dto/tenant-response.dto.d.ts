import { TenantStatus } from '@prisma/client';
export declare class TenantResponseDto {
    id: string;
    name: string;
    companyCode: string;
    currency: string;
    locale: string;
    status: TenantStatus;
    createdAt: Date;
    updatedAt: Date;
    _count?: {
        users: number;
        roles: number;
        categories: number;
        grades: number;
        warehouses: number;
    };
}
export declare class TenantListResponseDto {
    data: TenantResponseDto[];
    total: number;
    page: number;
    limit: number;
}
