import { PurchaseOrderType } from '@prisma/client';
export declare class CreatePurchaseOrderDto {
    poType: PurchaseOrderType;
    budgetCap?: number;
    vendorId?: string;
}
