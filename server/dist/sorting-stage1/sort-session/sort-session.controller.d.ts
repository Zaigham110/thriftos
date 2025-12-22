import { Request } from 'express';
import { SortStatus } from '@prisma/client';
import { CurrentUserData } from '../../common/decorators/current-user.decorator';
import { CreateSortSessionDto, UpdateSortSessionDto } from './dto';
import { SortSessionService } from './sort-session.service';
export declare class SortSessionController {
    private readonly sortSessionService;
    constructor(sortSessionService: SortSessionService);
    create(dto: CreateSortSessionDto, user: CurrentUserData, req: Request): Promise<{
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
        totalInputWeight: import("@prisma/client/runtime/library").Decimal;
        totalOutputWeight: import("@prisma/client/runtime/library").Decimal;
        wasteWeight: import("@prisma/client/runtime/library").Decimal;
    }>;
    findAll(status: SortStatus, page: number, limit: number, user: CurrentUserData, req: Request): Promise<{
        data: ({
            rag: {
                id: string;
                weightKg: import("@prisma/client/runtime/library").Decimal;
                ragCode: string;
                allocatedCost: import("@prisma/client/runtime/library").Decimal;
            };
            incomingBale: {
                id: string;
                baleCode: string;
                weightKg: import("@prisma/client/runtime/library").Decimal;
                cost: import("@prisma/client/runtime/library").Decimal;
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
            totalInputWeight: import("@prisma/client/runtime/library").Decimal;
            totalOutputWeight: import("@prisma/client/runtime/library").Decimal;
            wasteWeight: import("@prisma/client/runtime/library").Decimal;
        })[];
        total: number;
        page: number;
        limit: number;
    }>;
    findOne(id: string, user: CurrentUserData, req: Request): Promise<{
        yieldPercent: number;
        rag: {
            id: string;
            weightKg: import("@prisma/client/runtime/library").Decimal;
            ragCode: string;
            allocatedCost: import("@prisma/client/runtime/library").Decimal;
        };
        incomingBale: {
            id: string;
            baleCode: string;
            weightKg: import("@prisma/client/runtime/library").Decimal;
            cost: import("@prisma/client/runtime/library").Decimal;
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
                weightKg: import("@prisma/client/runtime/library").Decimal;
                allocatedCost: import("@prisma/client/runtime/library").Decimal;
                ragId: string;
                sortSessionId: string;
                categoryId: string;
                count: number;
                sortCategoryBucketId: string;
            }[];
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            sortSessionId: string;
            categoryId: string;
            outputWeightKg: import("@prisma/client/runtime/library").Decimal;
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
        totalInputWeight: import("@prisma/client/runtime/library").Decimal;
        totalOutputWeight: import("@prisma/client/runtime/library").Decimal;
        wasteWeight: import("@prisma/client/runtime/library").Decimal;
    }>;
    update(id: string, dto: UpdateSortSessionDto, user: CurrentUserData, req: Request): Promise<{
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
        totalInputWeight: import("@prisma/client/runtime/library").Decimal;
        totalOutputWeight: import("@prisma/client/runtime/library").Decimal;
        wasteWeight: import("@prisma/client/runtime/library").Decimal;
    }>;
    close(id: string, user: CurrentUserData, req: Request): Promise<{
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
            totalInputWeight: import("@prisma/client/runtime/library").Decimal;
            totalOutputWeight: import("@prisma/client/runtime/library").Decimal;
            wasteWeight: import("@prisma/client/runtime/library").Decimal;
        };
        outputs: any[];
        yieldPercent: number;
        wasteWeight: import("@prisma/client/runtime/library").Decimal;
    }>;
}
