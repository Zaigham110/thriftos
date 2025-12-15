import { Decimal } from '@prisma/client/runtime/library';
import { AuditService } from '../../audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateGradeBucketDto, UpdateGradeBucketDto } from './dto';
export declare class GradeBucketService {
    private prisma;
    private auditService;
    constructor(prisma: PrismaService, auditService: AuditService);
    createForSession(tenantId: string, sessionId: string, dto: CreateGradeBucketDto, userId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        outputWeightKg: Decimal;
        outputCount: number;
        gradeSessionId: string;
        gradeId: string;
    }>;
    update(tenantId: string, bucketId: string, dto: UpdateGradeBucketDto, userId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        outputWeightKg: Decimal;
        outputCount: number;
        gradeSessionId: string;
        gradeId: string;
    }>;
    delete(tenantId: string, bucketId: string, userId: string): Promise<{
        success: boolean;
    }>;
    private validateNonNegativeWaste;
}
