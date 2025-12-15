import { PurchaseOrderType } from '@prisma/client';
export declare class CreatePurchaseOrderDto {
    poNumber: string;
    poType: PurchaseOrderType;
    vendorId?: string;
    currency?: string;
    totalCost?: number;
}
