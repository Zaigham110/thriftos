import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { CreateSortCategoryBucketDto, UpdateSortCategoryBucketDto } from './dto';
import { Decimal } from '@prisma/client/runtime/library';
export declare class SortCategoryBucketService {
    private prisma;
    private auditService;
    constructor(prisma: PrismaService, auditService: AuditService);
    createForSession(tenantId: string, sessionId: string, dto: CreateSortCategoryBucketDto, userId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        categoryId: string;
        sortSessionId: string;
        outputWeightKg: Decimal;
        outputCount: number;
    }>;
    update(tenantId: string, bucketId: string, dto: UpdateSortCategoryBucketDto, userId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        categoryId: string;
        sortSessionId: string;
        outputWeightKg: Decimal;
        outputCount: number;
    }>;
    delete(tenantId: string, bucketId: string, userId: string): Promise<{
        success: boolean;
    }>;
    private recomputeTotalsOrThrow;
}
