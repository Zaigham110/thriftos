import { PrismaService } from '../../prisma/prisma.service';
export declare class GradeOutputService {
    private prisma;
    constructor(prisma: PrismaService);
    findAll(tenantId: string, options?: {
        gradeSessionId?: string;
        gradeId?: string;
        status?: string;
        search?: string;
        ragCode?: string;
        containerNumber?: string;
        categoryId?: string;
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
                        categoryId: string;
                        sortSessionId: string;
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
                gradeId: string;
                outputWeightKg: import("@prisma/client/runtime/library").Decimal;
                outputCount: number;
                gradeSessionId: string;
            };
        } & {
            id: string;
            tenantId: string;
            createdAt: Date;
            updatedAt: Date;
            status: import("@prisma/client").$Enums.GradingOutputStatus;
            weightKg: import("@prisma/client/runtime/library").Decimal;
            allocatedCost: import("@prisma/client/runtime/library").Decimal;
            gradeId: string;
            count: number;
            gradeBucketId: string;
            totalAmount: import("@prisma/client/runtime/library").Decimal;
            usedAmount: import("@prisma/client/runtime/library").Decimal;
            remainingAmount: import("@prisma/client/runtime/library").Decimal;
            measurementType: import("@prisma/client").$Enums.MeasurementType;
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
                    categoryId: string;
                    sortSessionId: string;
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
            gradeId: string;
            outputWeightKg: import("@prisma/client/runtime/library").Decimal;
            outputCount: number;
            gradeSessionId: string;
        };
    } & {
        id: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.GradingOutputStatus;
        weightKg: import("@prisma/client/runtime/library").Decimal;
        allocatedCost: import("@prisma/client/runtime/library").Decimal;
        gradeId: string;
        count: number;
        gradeBucketId: string;
        totalAmount: import("@prisma/client/runtime/library").Decimal;
        usedAmount: import("@prisma/client/runtime/library").Decimal;
        remainingAmount: import("@prisma/client/runtime/library").Decimal;
        measurementType: import("@prisma/client").$Enums.MeasurementType;
    }>;
    markReadyForRepack(tenantId: string, id: string): Promise<{
        grade: {
            id: string;
            name: string;
        };
        gradeBucket: {
            gradeSession: {
                id: string;
                status: import("@prisma/client").$Enums.GradeStatus;
            };
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            gradeId: string;
            outputWeightKg: import("@prisma/client/runtime/library").Decimal;
            outputCount: number;
            gradeSessionId: string;
        };
    } & {
        id: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.GradingOutputStatus;
        weightKg: import("@prisma/client/runtime/library").Decimal;
        allocatedCost: import("@prisma/client/runtime/library").Decimal;
        gradeId: string;
        count: number;
        gradeBucketId: string;
        totalAmount: import("@prisma/client/runtime/library").Decimal;
        usedAmount: import("@prisma/client/runtime/library").Decimal;
        remainingAmount: import("@prisma/client/runtime/library").Decimal;
        measurementType: import("@prisma/client").$Enums.MeasurementType;
    }>;
}
