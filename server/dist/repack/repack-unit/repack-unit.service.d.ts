import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { CreateRepackUnitDto, CreateRepackUnitV2Dto } from './dto';
import { MeasurementType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { RepackAllocationService } from '../shared/repack-allocation.service';
export declare class RepackUnitService {
    private prisma;
    private auditService;
    private allocationService;
    constructor(prisma: PrismaService, auditService: AuditService, allocationService: RepackAllocationService);
    createForSession(tenantId: string, sessionId: string, dto: CreateRepackUnitDto, userId: string): Promise<{
        category: {
            name: string;
        };
        grade: {
            name: string;
        };
    } & {
        id: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.RepackStatus;
        unitType: import("@prisma/client").$Enums.UnitType;
        totalCost: Decimal;
        containerId: string | null;
        weightKg: Decimal;
        ragId: string | null;
        categoryId: string | null;
        gradeId: string | null;
        sortSessionId: string | null;
        gradeSessionId: string | null;
        measurementType: import("@prisma/client").$Enums.MeasurementType;
        repackSessionId: string;
        unitCode: string;
        pcsCount: number;
        targetAmount: Decimal;
        allocationMode: import("@prisma/client").$Enums.AllocationMode;
        createdBy: string | null;
    }>;
    findAll(tenantId: string, options?: {
        page?: number;
        limit?: number;
        sessionId?: string;
    }): Promise<{
        data: ({
            category: {
                id: string;
                name: string;
            };
            grade: {
                id: string;
                name: string;
            };
            repackSession: {
                id: string;
                status: import("@prisma/client").$Enums.RepackSessionStatus;
            };
            _count: {
                repackItems: number;
            };
            qrLabel: {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                repackUnitId: string;
                qrCode: string;
                generatedAt: Date;
            };
        } & {
            id: string;
            tenantId: string;
            createdAt: Date;
            updatedAt: Date;
            status: import("@prisma/client").$Enums.RepackStatus;
            unitType: import("@prisma/client").$Enums.UnitType;
            totalCost: Decimal;
            containerId: string | null;
            weightKg: Decimal;
            ragId: string | null;
            categoryId: string | null;
            gradeId: string | null;
            sortSessionId: string | null;
            gradeSessionId: string | null;
            measurementType: import("@prisma/client").$Enums.MeasurementType;
            repackSessionId: string;
            unitCode: string;
            pcsCount: number;
            targetAmount: Decimal;
            allocationMode: import("@prisma/client").$Enums.AllocationMode;
            createdBy: string | null;
        })[];
        total: number;
        page: number;
        limit: number;
    }>;
    findOne(tenantId: string, id: string): Promise<{
        inputAllocations: any[];
        category: {
            id: string;
            name: string;
        };
        grade: {
            id: string;
            name: string;
        };
        repackSession: {
            id: string;
            status: import("@prisma/client").$Enums.RepackSessionStatus;
        };
        repackItems: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            weightKg: Decimal;
            sourceType: import("@prisma/client").$Enums.SourceType;
            sourceId: string;
            pcsCount: number;
            repackUnitId: string;
        }[];
        qrLabel: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            repackUnitId: string;
            qrCode: string;
            generatedAt: Date;
        };
        id: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.RepackStatus;
        unitType: import("@prisma/client").$Enums.UnitType;
        totalCost: Decimal;
        containerId: string | null;
        weightKg: Decimal;
        ragId: string | null;
        categoryId: string | null;
        gradeId: string | null;
        sortSessionId: string | null;
        gradeSessionId: string | null;
        measurementType: import("@prisma/client").$Enums.MeasurementType;
        repackSessionId: string;
        unitCode: string;
        pcsCount: number;
        targetAmount: Decimal;
        allocationMode: import("@prisma/client").$Enums.AllocationMode;
        createdBy: string | null;
    } | {
        inputAllocations: any[];
        allocatedAmount: number;
        remainingTargetAmount: number;
        eligibleStock: {
            id: string;
            gradeId: string;
            gradeName: string;
            categoryId: string;
            categoryName: string;
            totalAmount: number;
            usedAmount: number;
            remainingAmount: number;
            measurementType: import("@prisma/client").$Enums.MeasurementType;
            status: import("@prisma/client").$Enums.GradingOutputStatus;
            allocatedCost: number;
            containerId: string;
            containerNumber: string;
            ragBaleCode: string;
            sortSessionId: string;
            gradeSessionId: string;
        }[];
        category: {
            id: string;
            name: string;
        };
        grade: {
            id: string;
            name: string;
        };
        repackSession: {
            id: string;
            status: import("@prisma/client").$Enums.RepackSessionStatus;
        };
        repackItems: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            weightKg: Decimal;
            sourceType: import("@prisma/client").$Enums.SourceType;
            sourceId: string;
            pcsCount: number;
            repackUnitId: string;
        }[];
        qrLabel: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            repackUnitId: string;
            qrCode: string;
            generatedAt: Date;
        };
        id: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.RepackStatus;
        unitType: import("@prisma/client").$Enums.UnitType;
        totalCost: Decimal;
        containerId: string | null;
        weightKg: Decimal;
        ragId: string | null;
        categoryId: string | null;
        gradeId: string | null;
        sortSessionId: string | null;
        gradeSessionId: string | null;
        measurementType: import("@prisma/client").$Enums.MeasurementType;
        repackSessionId: string;
        unitCode: string;
        pcsCount: number;
        targetAmount: Decimal;
        allocationMode: import("@prisma/client").$Enums.AllocationMode;
        createdBy: string | null;
    }>;
    private generateUniqueUnitCode;
    createV2Manual(tenantId: string, dto: CreateRepackUnitV2Dto, userId: string): Promise<{
        allocations: {
            id: string;
            gradingOutputId: string;
            amountUsed: number;
            containerId: string | null;
            ragBaleId: string | null;
        }[];
        totalAllocated: number;
        totalCost: number;
        repackUnit: {
            category: {
                id: string;
                name: string;
            };
            grade: {
                id: string;
                name: string;
            };
            inputAllocations: {
                id: string;
                tenantId: string;
                createdAt: Date;
                updatedAt: Date;
                containerId: string | null;
                allocatedCost: Decimal;
                measurementType: import("@prisma/client").$Enums.MeasurementType;
                gradingOutputId: string;
                amountUsed: Decimal;
                repackUnitId: string;
                ragBaleId: string | null;
            }[];
        } & {
            id: string;
            tenantId: string;
            createdAt: Date;
            updatedAt: Date;
            status: import("@prisma/client").$Enums.RepackStatus;
            unitType: import("@prisma/client").$Enums.UnitType;
            totalCost: Decimal;
            containerId: string | null;
            weightKg: Decimal;
            ragId: string | null;
            categoryId: string | null;
            gradeId: string | null;
            sortSessionId: string | null;
            gradeSessionId: string | null;
            measurementType: import("@prisma/client").$Enums.MeasurementType;
            repackSessionId: string;
            unitCode: string;
            pcsCount: number;
            targetAmount: Decimal;
            allocationMode: import("@prisma/client").$Enums.AllocationMode;
            createdBy: string | null;
        };
    }>;
    sealUnit(tenantId: string, unitId: string, userId: string): Promise<{
        category: {
            id: string;
            name: string;
        };
        grade: {
            id: string;
            name: string;
        };
        inputAllocations: {
            id: string;
            tenantId: string;
            createdAt: Date;
            updatedAt: Date;
            containerId: string | null;
            allocatedCost: Decimal;
            measurementType: import("@prisma/client").$Enums.MeasurementType;
            gradingOutputId: string;
            amountUsed: Decimal;
            repackUnitId: string;
            ragBaleId: string | null;
        }[];
    } & {
        id: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.RepackStatus;
        unitType: import("@prisma/client").$Enums.UnitType;
        totalCost: Decimal;
        containerId: string | null;
        weightKg: Decimal;
        ragId: string | null;
        categoryId: string | null;
        gradeId: string | null;
        sortSessionId: string | null;
        gradeSessionId: string | null;
        measurementType: import("@prisma/client").$Enums.MeasurementType;
        repackSessionId: string;
        unitCode: string;
        pcsCount: number;
        targetAmount: Decimal;
        allocationMode: import("@prisma/client").$Enums.AllocationMode;
        createdBy: string | null;
    }>;
    getAvailableStock(tenantId: string, categoryId?: string, gradeId?: string, measurementType?: MeasurementType): Promise<{
        id: string;
        gradeId: string;
        gradeName: string;
        categoryId: string;
        categoryName: string;
        totalAmount: number;
        usedAmount: number;
        remainingAmount: number;
        measurementType: import("@prisma/client").$Enums.MeasurementType;
        status: import("@prisma/client").$Enums.GradingOutputStatus;
        allocatedCost: number;
        containerId: string;
        containerNumber: string;
        ragBaleCode: string;
        sortSessionId: string;
        gradeSessionId: string;
    }[]>;
    getDraftUnits(tenantId: string): Promise<{
        id: any;
        code: any;
        category: any;
        grade: any;
        targetAmount: any;
        allocatedAmount: any;
        createdAt: any;
    }[]>;
    getSealedUnits(tenantId: string): Promise<{
        id: any;
        unitCode: any;
        status: any;
        category: any;
        grade: any;
        weightKg: number;
        pcsCount: any;
        totalCost: number;
        measurementType: any;
        createdAt: any;
        sealedAt: any;
    }[]>;
    allocateToDraft(tenantId: string, unitId: string, allocations: {
        gradingOutputId: string;
        amountUsed: number;
    }[], userId: string): Promise<{
        repackUnit: {
            category: {
                id: string;
                name: string;
            };
            grade: {
                id: string;
                name: string;
            };
            inputAllocations: {
                id: string;
                tenantId: string;
                createdAt: Date;
                updatedAt: Date;
                containerId: string | null;
                allocatedCost: Decimal;
                measurementType: import("@prisma/client").$Enums.MeasurementType;
                gradingOutputId: string;
                amountUsed: Decimal;
                repackUnitId: string;
                ragBaleId: string | null;
            }[];
        } & {
            id: string;
            tenantId: string;
            createdAt: Date;
            updatedAt: Date;
            status: import("@prisma/client").$Enums.RepackStatus;
            unitType: import("@prisma/client").$Enums.UnitType;
            totalCost: Decimal;
            containerId: string | null;
            weightKg: Decimal;
            ragId: string | null;
            categoryId: string | null;
            gradeId: string | null;
            sortSessionId: string | null;
            gradeSessionId: string | null;
            measurementType: import("@prisma/client").$Enums.MeasurementType;
            repackSessionId: string;
            unitCode: string;
            pcsCount: number;
            targetAmount: Decimal;
            allocationMode: import("@prisma/client").$Enums.AllocationMode;
            createdBy: string | null;
        };
        appended: import("../shared/repack-allocation.service").AllocationResult;
    }>;
    deallocateFromDraft(tenantId: string, unitId: string, allocationId: string, userId: string): Promise<{
        success: boolean;
    }>;
    deleteDraft(tenantId: string, unitId: string, userId: string): Promise<{
        success: boolean;
    }>;
}
