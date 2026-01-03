import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { GradingOutputStatus, MeasurementType } from '@prisma/client';
import { CreateRepackUnitV2Dto } from '../repack-unit/dto';
export type RepackSourceType = 'CONTAINER' | 'LOOSE_BALE';
export interface AvailableStockRow {
    id: string;
    tenantId: string;
    categoryId: string;
    categoryName: string;
    gradeId: string;
    gradeName: string;
    measurementType: MeasurementType;
    totalAmount: number;
    usedAmount: number;
    remainingAmount: number;
    status: GradingOutputStatus;
    sourceType: RepackSourceType;
    sourceId: string | null;
    containerId: string | null;
    containerNumber: string | null;
    ragId: string | null;
    ragCode: string | null;
    sortSessionId: string | null;
    gradeSessionId: string | null;
    fifoTimestamp: string | null;
    createdAt: string;
}
export interface RepackDraftAllocationRow {
    id: string;
    gradingOutputId: string;
    amountUsed: number;
    allocatedCost: number;
    containerId: string | null;
    ragBaleId: string | null;
}
export interface RepackDraftResult {
    repackUnit: any;
    allocations: RepackDraftAllocationRow[];
    totalAllocated: number;
    totalCost: number;
}
export interface SealRepackResult {
    repackUnit: any;
    inventoryItem: any;
    qrLabel: any;
}
export declare class RepackV3Service {
    private readonly prisma;
    private readonly audit;
    constructor(prisma: PrismaService, audit: AuditService);
    getAvailableStock(tenantId: string, categoryId: string, gradeId: string, measurementType: MeasurementType): Promise<AvailableStockRow[]>;
    createDraftManual(tenantId: string, dto: CreateRepackUnitV2Dto, userId: string): Promise<RepackDraftResult>;
    sealUnit(tenantId: string, unitId: string, warehouseId: string | null, userId: string): Promise<SealRepackResult>;
    private assertDraftInputs;
    private ensureOpenSessionAndUnitCode;
    private allocateManualTx;
}
