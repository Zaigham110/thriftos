import { TenantStatus } from '@prisma/client';
export declare class CreateTenantDto {
    name: string;
    companyCode: string;
    currency?: string;
    locale?: string;
    status?: TenantStatus;
    adminEmail?: string;
    adminName?: string;
}
