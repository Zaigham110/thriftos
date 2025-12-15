import { TenantStatus } from '@prisma/client';
export declare class UpdateTenantDto {
    name?: string;
    currency?: string;
    locale?: string;
    status?: TenantStatus;
}
