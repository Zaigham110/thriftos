import { ChargeType } from '@prisma/client';
export declare class CreateContainerChargeDto {
    chargeType: ChargeType;
    description: string;
    amount: number;
}
