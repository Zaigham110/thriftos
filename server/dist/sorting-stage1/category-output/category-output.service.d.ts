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
                sortSessionId: string;
                categoryId: string;
                outputWeightKg: import("@prisma/client/runtime/library").Decimal;
                outputCount: number;
            };
        } & {
            id: string;
            tenantId: string;
            createdAt: Date;
            updatedAt: Date;
            weightKg: import("@prisma/client/runtime/library").Decimal;
            allocatedCost: import("@prisma/client/runtime/library").Decimal;
            categoryId: string;
            count: number;
            sortCategoryBucketId: string;
        })[];
        total: number;
        page: number;
        limit: number;
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
            sortSessionId: string;
            categoryId: string;
            outputWeightKg: import("@prisma/client/runtime/library").Decimal;
            outputCount: number;
        };
    } & {
        id: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        weightKg: import("@prisma/client/runtime/library").Decimal;
        allocatedCost: import("@prisma/client/runtime/library").Decimal;
        categoryId: string;
        count: number;
        sortCategoryBucketId: string;
    }>;
}
