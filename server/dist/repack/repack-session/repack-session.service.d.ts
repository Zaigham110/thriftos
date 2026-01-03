import { RepackSessionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { CreateRepackSessionDto, UpdateRepackSessionDto } from './dto';
export declare class RepackSessionService {
    private prisma;
    private auditService;
    constructor(prisma: PrismaService, auditService: AuditService);
    create(tenantId: string, dto: CreateRepackSessionDto, currentUserId: string): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.RepackSessionStatus;
        workerId: string;
        supervisorId: string;
        startTime: Date;
        endTime: Date | null;
    }>;
    findAll(tenantId: string, options?: {
        status?: RepackSessionStatus;
        page?: number;
        limit?: number;
    }): Promise<{
        data: ({
            _count: {
                repackUnits: number;
            };
            worker: {
                id: string;
                name: string;
                email: string;
            };
            supervisor: {
                id: string;
                name: string;
                email: string;
            };
        } & {
            id: string;
            tenantId: string;
            createdAt: Date;
            updatedAt: Date;
            status: import("@prisma/client").$Enums.RepackSessionStatus;
            workerId: string;
            supervisorId: string;
            startTime: Date;
            endTime: Date | null;
        })[];
        total: number;
        page: number;
        limit: number;
    }>;
    findOne(tenantId: string, id: string): Promise<{
        repackUnits: ({
            category: {
                id: string;
                name: string;
            };
            grade: {
                id: string;
                name: string;
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
        worker: {
            id: string;
            name: string;
            email: string;
        };
        supervisor: {
            id: string;
            name: string;
            email: string;
        };
    } & {
        id: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.RepackSessionStatus;
        workerId: string;
        supervisorId: string;
        startTime: Date;
        endTime: Date | null;
    }>;
    update(tenantId: string, id: string, dto: UpdateRepackSessionDto, currentUserId: string): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.RepackSessionStatus;
        workerId: string;
        supervisorId: string;
        startTime: Date;
        endTime: Date | null;
    }>;
    close(tenantId: string, id: string, currentUserId: string): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.RepackSessionStatus;
        workerId: string;
        supervisorId: string;
        startTime: Date;
        endTime: Date | null;
    }>;
}
