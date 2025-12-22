import { RagBaleType } from '@prisma/client';
export declare class CreateRagDto {
    containerId: string;
    ragBaleType: RagBaleType;
    rawCategoryId: string;
    weightKg: number;
    notes?: string;
}
