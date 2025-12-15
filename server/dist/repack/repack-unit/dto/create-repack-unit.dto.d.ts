import { UnitType } from '@prisma/client';
export declare class CreateRepackUnitDto {
    unitType: UnitType;
    categoryId?: string;
    gradeId?: string;
    weightKg: number;
    pcsCount?: number;
}
