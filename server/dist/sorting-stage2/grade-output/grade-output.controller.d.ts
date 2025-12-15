import { Request } from 'express';
import { CurrentUserData } from '../../common/decorators/current-user.decorator';
import { GradeOutputService } from './grade-output.service';
export declare class GradeOutputController {
    private readonly service;
    constructor(service: GradeOutputService);
    findAll(gradeSessionId: string, gradeId: string, page: number, limit: number, user: CurrentUserData, req: Request): Promise<{
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
    findOne(id: string, user: CurrentUserData, req: Request): Promise<{
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
