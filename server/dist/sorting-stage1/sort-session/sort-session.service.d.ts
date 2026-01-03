import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { CreateSortSessionDto, UpdateSortSessionDto } from './dto';
import { Decimal } from '@prisma/client/runtime/library';
import { SortStatus } from '@prisma/client';
export declare class SortSessionService {
    private prisma;
    private auditService;
    constructor(prisma: PrismaService, auditService: AuditService);
    create(tenantId: string, dto: CreateSortSessionDto, currentUserId: string): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.SortStatus;
        ragId: string;
        incomingBaleId: string | null;
        workerId: string;
        supervisorId: string;
        startTime: Date;
        endTime: Date | null;
        totalInputWeight: Decimal;
        totalOutputWeight: Decimal;
        wasteWeight: Decimal;
    }>;
    findAll(tenantId: string, options?: {
        status?: SortStatus;
        page?: number;
        limit?: number;
    }): Promise<{
        data: ({
            rag: {
                id: string;
                weightKg: Decimal;
                ragCode: string;
                allocatedCost: Decimal;
            };
            incomingBale: {
                id: string;
                baleCode: string;
                weightKg: Decimal;
                cost: Decimal;
            };
            _count: {
                sortCategoryBuckets: number;
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
            status: import("@prisma/client").$Enums.SortStatus;
            ragId: string;
            incomingBaleId: string | null;
            workerId: string;
            supervisorId: string;
            startTime: Date;
            endTime: Date | null;
            totalInputWeight: Decimal;
            totalOutputWeight: Decimal;
            wasteWeight: Decimal;
        })[];
        total: number;
        page: number;
        limit: number;
    }>;
    findOne(tenantId: string, id: string): Promise<{
        yieldPercent: number;
        rag: {
            id: string;
            weightKg: Decimal;
            ragCode: string;
            allocatedCost: Decimal;
        };
        incomingBale: {
            id: string;
            baleCode: string;
            weightKg: Decimal;
            cost: Decimal;
        };
        sortCategoryBuckets: ({
            category: {
                id: string;
                name: string;
            };
            categoryOutputs: {
                id: string;
                tenantId: string;
                createdAt: Date;
                updatedAt: Date;
                containerId: string | null;
                weightKg: Decimal;
                allocatedCost: Decimal;
                ragId: string;
                categoryId: string;
                sortSessionId: string;
                count: number;
                sortCategoryBucketId: string;
            }[];
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            categoryId: string;
            sortSessionId: string;
            outputWeightKg: Decimal;
            outputCount: number;
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
        id: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.SortStatus;
        ragId: string;
        incomingBaleId: string | null;
        workerId: string;
        supervisorId: string;
        startTime: Date;
        endTime: Date | null;
        totalInputWeight: Decimal;
        totalOutputWeight: Decimal;
        wasteWeight: Decimal;
    }>;
    update(tenantId: string, id: string, dto: UpdateSortSessionDto, currentUserId: string): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.SortStatus;
        ragId: string;
        incomingBaleId: string | null;
        workerId: string;
        supervisorId: string;
        startTime: Date;
        endTime: Date | null;
        totalInputWeight: Decimal;
        totalOutputWeight: Decimal;
        wasteWeight: Decimal;
    }>;
    close(tenantId: string, sessionId: string, currentUserId: string, options?: {
        wasteCategoryId?: string;
    }): Promise<{
        session: {
            id: string;
            tenantId: string;
            createdAt: Date;
            updatedAt: Date;
            status: import("@prisma/client").$Enums.SortStatus;
            ragId: string;
            incomingBaleId: string | null;
            workerId: string;
            supervisorId: string;
            startTime: Date;
            endTime: Date | null;
            totalInputWeight: Decimal;
            totalOutputWeight: Decimal;
            wasteWeight: Decimal;
        };
        outputs: any[];
        yieldPercent: number;
        wasteWeight: Decimal;
    }>;
}
