import { GradeStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { AuditService } from '../../audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateGradeSessionDto, UpdateGradeSessionDto } from './dto';
export declare class GradeSessionService {
    private prisma;
    private auditService;
    constructor(prisma: PrismaService, auditService: AuditService);
    create(tenantId: string, dto: CreateGradeSessionDto, currentUserId: string): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.GradeStatus;
        workerId: string;
        supervisorId: string;
        startTime: Date;
        endTime: Date | null;
        categoryOutputId: string;
    }>;
    findAll(tenantId: string, options?: {
        status?: GradeStatus;
        page?: number;
        limit?: number;
    }): Promise<{
        data: ({
            categoryOutput: {
                id: string;
                weightKg: Decimal;
                allocatedCost: Decimal;
                categoryId: string;
                count: number;
            };
            _count: {
                gradeBuckets: number;
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
            status: import("@prisma/client").$Enums.GradeStatus;
            workerId: string;
            supervisorId: string;
            startTime: Date;
            endTime: Date | null;
            categoryOutputId: string;
        })[];
        total: number;
        page: number;
        limit: number;
    }>;
    findOne(tenantId: string, id: string): Promise<{
        totalGradeOutputWeight: string;
        wasteWeight: string;
        gradeYieldPercent: number;
        categoryOutput: {
            category: {
                id: string;
                name: string;
            };
        } & {
            id: string;
            tenantId: string;
            createdAt: Date;
            updatedAt: Date;
            weightKg: Decimal;
            allocatedCost: Decimal;
            categoryId: string;
            count: number;
            sortCategoryBucketId: string;
        };
        gradeBuckets: ({
            grade: {
                id: string;
                name: string;
            };
            gradeOutputs: {
                id: string;
                tenantId: string;
                createdAt: Date;
                updatedAt: Date;
                weightKg: Decimal;
                allocatedCost: Decimal;
                count: number;
                gradeId: string;
                gradeBucketId: string;
            }[];
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            outputWeightKg: Decimal;
            outputCount: number;
            gradeSessionId: string;
            gradeId: string;
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
        status: import("@prisma/client").$Enums.GradeStatus;
        workerId: string;
        supervisorId: string;
        startTime: Date;
        endTime: Date | null;
        categoryOutputId: string;
    }>;
    update(tenantId: string, id: string, dto: UpdateGradeSessionDto, currentUserId: string): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.GradeStatus;
        workerId: string;
        supervisorId: string;
        startTime: Date;
        endTime: Date | null;
        categoryOutputId: string;
    }>;
    close(tenantId: string, sessionId: string, currentUserId: string): Promise<{
        session: {
            id: string;
            tenantId: string;
            createdAt: Date;
            updatedAt: Date;
            status: import("@prisma/client").$Enums.GradeStatus;
            workerId: string;
            supervisorId: string;
            startTime: Date;
            endTime: Date | null;
            categoryOutputId: string;
        };
        outputs: any[];
        wasteWeight: string;
        gradeYieldPercent: number;
    }>;
}
