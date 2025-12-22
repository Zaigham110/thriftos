import { RagBaleType } from '@prisma/client';
export declare class CreateRawCategoryDto {
    name: string;
    rawType: RagBaleType;
    sortOrder?: number;
}
export declare class UpdateRawCategoryDto {
    name?: string;
    sortOrder?: number;
}
