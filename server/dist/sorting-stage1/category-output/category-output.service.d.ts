import { PrismaService } from '../../prisma/prisma.service';
export declare class CategoryOutputService {
    private prisma;
    constructor(prisma: PrismaService);
    findAll(tenantId: string, options?: {
        sortSessionId?: string;
        categoryId?: string;
        page?: number;
        limit?: number;
    }): Promise<{
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
    findAvailableForGrading(tenantId: string, options?: {
        page?: number;
        limit?: number;
    }): Promise<{
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
    findOne(tenantId: string, id: string): Promise<{
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
