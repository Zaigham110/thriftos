import { Request } from 'express';
import { CurrentUserData } from '../../common/decorators/current-user.decorator';
import { CreateGradeBucketDto, UpdateGradeBucketDto } from './dto';
import { GradeBucketService } from './grade-bucket.service';
export declare class GradeBucketController {
    private readonly service;
    constructor(service: GradeBucketService);
    createForSession(sessionId: string, dto: CreateGradeBucketDto, user: CurrentUserData, req: Request): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        outputWeightKg: import("@prisma/client/runtime/library").Decimal;
        outputCount: number;
        gradeSessionId: string;
        gradeId: string;
    }>;
    update(bucketId: string, dto: UpdateGradeBucketDto, user: CurrentUserData, req: Request): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        outputWeightKg: import("@prisma/client/runtime/library").Decimal;
        outputCount: number;
        gradeSessionId: string;
        gradeId: string;
    }>;
    delete(bucketId: string, user: CurrentUserData, req: Request): Promise<{
        success: boolean;
    }>;
}
