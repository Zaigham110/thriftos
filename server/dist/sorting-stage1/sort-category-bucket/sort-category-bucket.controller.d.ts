import { Request } from 'express';
import { CurrentUserData } from '../../common/decorators/current-user.decorator';
import { CreateSortCategoryBucketDto, UpdateSortCategoryBucketDto } from './dto';
import { SortCategoryBucketService } from './sort-category-bucket.service';
export declare class SortCategoryBucketController {
    private readonly service;
    constructor(service: SortCategoryBucketService);
    createForSession(sessionId: string, dto: CreateSortCategoryBucketDto, user: CurrentUserData, req: Request): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        categoryId: string;
        sortSessionId: string;
        outputWeightKg: import("@prisma/client/runtime/library").Decimal;
        outputCount: number;
    }>;
    update(bucketId: string, dto: UpdateSortCategoryBucketDto, user: CurrentUserData, req: Request): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        categoryId: string;
        sortSessionId: string;
        outputWeightKg: import("@prisma/client/runtime/library").Decimal;
        outputCount: number;
    }>;
    delete(bucketId: string, user: CurrentUserData, req: Request): Promise<{
        success: boolean;
    }>;
}
