import { Request } from 'express';
import { GradeStatus } from '@prisma/client';
import { CurrentUserData } from '../../common/decorators/current-user.decorator';
import { CreateGradeSessionDto, UpdateGradeSessionDto } from './dto';
import { GradeSessionService } from './grade-session.service';
export declare class GradeSessionController {
    private readonly service;
    constructor(service: GradeSessionService);
    create(dto: CreateGradeSessionDto, user: CurrentUserData, req: Request): Promise<{
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
    findAll(status: GradeStatus, page: number, limit: number, user: CurrentUserData, req: Request): Promise<{
        data: ({
            categoryOutput: {
                category: {
                    id: string;
                    name: string;
                };
                container: {
                    id: string;
                    containerNumber: string;
                };
                rag: {
                    id: string;
                    ragCode: string;
                };
                id: string;
                containerId: string;
                weightKg: import("@prisma/client/runtime/library").Decimal;
                allocatedCost: import("@prisma/client/runtime/library").Decimal;
                ragId: string;
                sortSessionId: string;
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
    findOne(id: string, user: CurrentUserData, req: Request): Promise<{
        totalGradeOutputWeight: string;
        wasteWeight: string;
        gradeYieldPercent: number;
        categoryOutput: {
            category: {
                id: string;
                name: string;
            };
            container: {
                id: string;
                containerNumber: string;
            };
            rag: {
                id: string;
                ragCode: string;
            };
        } & {
            id: string;
            tenantId: string;
            createdAt: Date;
            updatedAt: Date;
            containerId: string | null;
            weightKg: import("@prisma/client/runtime/library").Decimal;
            allocatedCost: import("@prisma/client/runtime/library").Decimal;
            ragId: string;
            sortSessionId: string;
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
                weightKg: import("@prisma/client/runtime/library").Decimal;
                allocatedCost: import("@prisma/client/runtime/library").Decimal;
                count: number;
                gradeId: string;
                gradeBucketId: string;
            }[];
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            outputWeightKg: import("@prisma/client/runtime/library").Decimal;
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
    update(id: string, dto: UpdateGradeSessionDto, user: CurrentUserData, req: Request): Promise<{
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
    close(id: string, user: CurrentUserData, req: Request): Promise<{
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
