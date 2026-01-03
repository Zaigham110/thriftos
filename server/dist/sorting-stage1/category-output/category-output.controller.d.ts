import { Request } from 'express';
import { CurrentUserData } from '../../common/decorators/current-user.decorator';
import { CategoryOutputService } from './category-output.service';
export declare class CategoryOutputController {
    private readonly service;
    constructor(service: CategoryOutputService);
    findAll(sortSessionId: string, categoryId: string, page: number, limit: number, user: CurrentUserData, req: Request): Promise<{
        data: ({
            category: {
                id: string;
                name: string;
            };
            sortCategoryBucket: {
                sortSession: {
                    id: string;
                    status: import("@prisma/client").$Enums.SortStatus;
                    startTime: Date;
                    endTime: Date;
                };
            } & {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                categoryId: string;
                sortSessionId: string;
                outputWeightKg: import("@prisma/client/runtime/library").Decimal;
                outputCount: number;
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
            categoryId: string;
            sortSessionId: string;
            count: number;
            sortCategoryBucketId: string;
        })[];
        total: number;
        page: number;
        limit: number;
    }>;
    findAvailableForGrading(page: number, limit: number, user: CurrentUserData, req: Request): Promise<{
        data: {
            gradeStatus: string;
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
            sortCategoryBucket: {
                sortSession: {
                    id: string;
                    status: import("@prisma/client").$Enums.SortStatus;
                    startTime: Date;
                    endTime: Date;
                    worker: {
                        id: string;
                        name: string;
                    };
                };
            } & {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                categoryId: string;
                sortSessionId: string;
                outputWeightKg: import("@prisma/client/runtime/library").Decimal;
                outputCount: number;
            };
            gradeSessions: {
                id: string;
                status: import("@prisma/client").$Enums.GradeStatus;
            }[];
            id: string;
            tenantId: string;
            createdAt: Date;
            updatedAt: Date;
            containerId: string | null;
            weightKg: import("@prisma/client/runtime/library").Decimal;
            allocatedCost: import("@prisma/client/runtime/library").Decimal;
            ragId: string;
            categoryId: string;
            sortSessionId: string;
            count: number;
            sortCategoryBucketId: string;
        }[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }>;
    findOne(id: string, user: CurrentUserData, req: Request): Promise<{
        category: {
            id: string;
            name: string;
        };
        sortCategoryBucket: {
            category: {
                id: string;
                name: string;
            };
            sortSession: {
                id: string;
                status: import("@prisma/client").$Enums.SortStatus;
                startTime: Date;
                endTime: Date;
            };
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            categoryId: string;
            sortSessionId: string;
            outputWeightKg: import("@prisma/client/runtime/library").Decimal;
            outputCount: number;
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
        categoryId: string;
        sortSessionId: string;
        count: number;
        sortCategoryBucketId: string;
    }>;
}
