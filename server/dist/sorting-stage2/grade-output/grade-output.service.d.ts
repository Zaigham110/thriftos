import { PrismaService } from '../../prisma/prisma.service';
export declare class GradeOutputService {
    private prisma;
    constructor(prisma: PrismaService);
    findAll(tenantId: string, options?: {
        gradeSessionId?: string;
        gradeId?: string;
        page?: number;
        limit?: number;
    }): Promise<{
        data: ({
            grade: {
                id: string;
                name: string;
            };
            gradeBucket: {
                gradeSession: {
                    categoryOutput: {
                        id: string;
                        weightKg: import("@prisma/client/runtime/library").Decimal;
                        allocatedCost: import("@prisma/client/runtime/library").Decimal;
                        categoryId: string;
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
                };
            } & {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                outputWeightKg: import("@prisma/client/runtime/library").Decimal;
                outputCount: number;
                gradeSessionId: string;
                gradeId: string;
            };
        } & {
            id: string;
            tenantId: string;
            createdAt: Date;
            updatedAt: Date;
            weightKg: import("@prisma/client/runtime/library").Decimal;
            allocatedCost: import("@prisma/client/runtime/library").Decimal;
            count: number;
            gradeId: string;
            gradeBucketId: string;
        })[];
        total: number;
        page: number;
        limit: number;
    }>;
    findOne(tenantId: string, id: string): Promise<{
        grade: {
            id: string;
            name: string;
        };
        gradeBucket: {
            grade: {
                id: string;
                name: string;
            };
            gradeSession: {
                categoryOutput: {
                    id: string;
                    weightKg: import("@prisma/client/runtime/library").Decimal;
                    allocatedCost: import("@prisma/client/runtime/library").Decimal;
                    categoryId: string;
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
            };
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            outputWeightKg: import("@prisma/client/runtime/library").Decimal;
            outputCount: number;
            gradeSessionId: string;
            gradeId: string;
        };
    } & {
        id: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        weightKg: import("@prisma/client/runtime/library").Decimal;
        allocatedCost: import("@prisma/client/runtime/library").Decimal;
        count: number;
        gradeId: string;
        gradeBucketId: string;
    }>;
}
