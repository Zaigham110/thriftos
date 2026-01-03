import { Request } from 'express';
import { CurrentUserData } from '../../common/decorators/current-user.decorator';
import { CreateRepackUnitDto, CreateRepackUnitV2Dto, SealRepackUnitV3Dto } from './dto';
import { RepackUnitService } from './repack-unit.service';
import { AllocateRepackUnitDto } from './dto/allocate-repack-unit.dto';
import { DeallocateRepackUnitDto } from './dto/deallocate-repack-unit.dto';
import { MeasurementType } from '@prisma/client';
import { RepackV3Service } from '../v3/repack-v3.service';
import { PrismaService } from '../../prisma/prisma.service';
export declare class RepackUnitController {
    private readonly service;
    private readonly repackV3;
    private readonly prisma;
    constructor(service: RepackUnitService, repackV3: RepackV3Service, prisma: PrismaService);
    getContextFromGradingOutput(gradingOutputId: string, user: CurrentUserData, req: Request): Promise<{
        gradingOutputId: string;
        found: boolean;
        categoryId?: undefined;
        gradeId?: undefined;
        measurementType?: undefined;
        remainingAmount?: undefined;
        totalAmount?: undefined;
        status?: undefined;
    } | {
        found: boolean;
        gradingOutputId: string;
        categoryId: string;
        gradeId: string;
        measurementType: MeasurementType;
        remainingAmount: import("@prisma/client/runtime/library").Decimal;
        totalAmount: import("@prisma/client/runtime/library").Decimal;
        status: import("@prisma/client").$Enums.GradingOutputStatus;
    }>;
    validateGradingOutputForRepack(gradingOutputId: string, user: CurrentUserData, req: Request): Promise<{
        valid: boolean;
        errors: string[];
        output?: undefined;
    } | {
        valid: boolean;
        errors: string[];
        output: {
            id: string;
            categoryId: string;
            gradeId: string;
            remainingAmount: number;
        };
    }>;
    createForSession(sessionId: string, dto: CreateRepackUnitDto, user: CurrentUserData, req: Request): Promise<{
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
        totalCost: import("@prisma/client/runtime/library").Decimal;
        containerId: string | null;
        weightKg: import("@prisma/client/runtime/library").Decimal;
        ragId: string | null;
        categoryId: string | null;
        gradeId: string | null;
        sortSessionId: string | null;
        gradeSessionId: string | null;
        measurementType: import("@prisma/client").$Enums.MeasurementType;
        repackSessionId: string;
        unitCode: string;
        pcsCount: number;
        targetAmount: import("@prisma/client/runtime/library").Decimal;
        allocationMode: import("@prisma/client").$Enums.AllocationMode;
        createdBy: string | null;
    }>;
    findAll(sessionId: string, page: number, limit: number, user: CurrentUserData, req: Request): Promise<{
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
            totalCost: import("@prisma/client/runtime/library").Decimal;
            containerId: string | null;
            weightKg: import("@prisma/client/runtime/library").Decimal;
            ragId: string | null;
            categoryId: string | null;
            gradeId: string | null;
            sortSessionId: string | null;
            gradeSessionId: string | null;
            measurementType: import("@prisma/client").$Enums.MeasurementType;
            repackSessionId: string;
            unitCode: string;
            pcsCount: number;
            targetAmount: import("@prisma/client/runtime/library").Decimal;
            allocationMode: import("@prisma/client").$Enums.AllocationMode;
            createdBy: string | null;
        })[];
        total: number;
        page: number;
        limit: number;
    }>;
    getDrafts(user: CurrentUserData, req: Request): Promise<{
        id: any;
        code: any;
        category: any;
        grade: any;
        targetAmount: any;
        allocatedAmount: any;
        createdAt: any;
    }[]>;
    getSealedUnits(user: CurrentUserData, req: Request): Promise<{
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
    findOne(id: string, user: CurrentUserData, req: Request): Promise<{
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
            weightKg: import("@prisma/client/runtime/library").Decimal;
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
        totalCost: import("@prisma/client/runtime/library").Decimal;
        containerId: string | null;
        weightKg: import("@prisma/client/runtime/library").Decimal;
        ragId: string | null;
        categoryId: string | null;
        gradeId: string | null;
        sortSessionId: string | null;
        gradeSessionId: string | null;
        measurementType: import("@prisma/client").$Enums.MeasurementType;
        repackSessionId: string;
        unitCode: string;
        pcsCount: number;
        targetAmount: import("@prisma/client/runtime/library").Decimal;
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
            weightKg: import("@prisma/client/runtime/library").Decimal;
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
        totalCost: import("@prisma/client/runtime/library").Decimal;
        containerId: string | null;
        weightKg: import("@prisma/client/runtime/library").Decimal;
        ragId: string | null;
        categoryId: string | null;
        gradeId: string | null;
        sortSessionId: string | null;
        gradeSessionId: string | null;
        measurementType: import("@prisma/client").$Enums.MeasurementType;
        repackSessionId: string;
        unitCode: string;
        pcsCount: number;
        targetAmount: import("@prisma/client/runtime/library").Decimal;
        allocationMode: import("@prisma/client").$Enums.AllocationMode;
        createdBy: string | null;
    }>;
    getAvailableStock(categoryId: string, gradeId: string, measurementType: MeasurementType, user: CurrentUserData, req: Request): Promise<import("../v3/repack-v3.service").AvailableStockRow[]>;
    createManual(dto: CreateRepackUnitV2Dto, user: CurrentUserData, req: Request): Promise<import("../v3/repack-v3.service").RepackDraftResult>;
    sealUnit(id: string, dto: SealRepackUnitV3Dto, user: CurrentUserData, req: Request): Promise<import("../v3/repack-v3.service").SealRepackResult>;
    allocateToDraft(id: string, dto: AllocateRepackUnitDto, user: CurrentUserData, req: Request): Promise<{
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
                allocatedCost: import("@prisma/client/runtime/library").Decimal;
                measurementType: import("@prisma/client").$Enums.MeasurementType;
                gradingOutputId: string;
                amountUsed: import("@prisma/client/runtime/library").Decimal;
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
            totalCost: import("@prisma/client/runtime/library").Decimal;
            containerId: string | null;
            weightKg: import("@prisma/client/runtime/library").Decimal;
            ragId: string | null;
            categoryId: string | null;
            gradeId: string | null;
            sortSessionId: string | null;
            gradeSessionId: string | null;
            measurementType: import("@prisma/client").$Enums.MeasurementType;
            repackSessionId: string;
            unitCode: string;
            pcsCount: number;
            targetAmount: import("@prisma/client/runtime/library").Decimal;
            allocationMode: import("@prisma/client").$Enums.AllocationMode;
            createdBy: string | null;
        };
        appended: import("../shared/repack-allocation.service").AllocationResult;
    }>;
    deallocateFromDraft(id: string, dto: DeallocateRepackUnitDto, user: CurrentUserData, req: Request): Promise<{
        success: boolean;
    }>;
    deleteDraft(id: string, user: CurrentUserData, req: Request): Promise<{
        success: boolean;
    }>;
}
