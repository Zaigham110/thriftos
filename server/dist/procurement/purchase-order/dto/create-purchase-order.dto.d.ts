import { PurchaseOrderType } from '@prisma/client';
export declare class CreatePurchaseOrderDto {
    poType: PurchaseOrderType;
    vendorId?: string;
}
