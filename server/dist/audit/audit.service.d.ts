import { PrismaService } from '../prisma/prisma.service';
export interface AuditLogInput {
    tenantId?: string | null;
    userId?: string | null;
    action: string;
    entityType?: string;
    entityId?: string;
    metadataJson?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
}
export declare class AuditService {
    private prisma;
    constructor(prisma: PrismaService);
    log(input: AuditLogInput): Promise<void>;
    findByTenant(tenantId: string, options?: {
        limit?: number;
        offset?: number;
    }): Promise<{
        id: string;
        tenantId: string | null;
        userId: string | null;
        action: string;
        entityType: string | null;
        entityId: string | null;
        metadataJson: import("@prisma/client/runtime/library").JsonValue | null;
        ipAddress: string | null;
        userAgent: string | null;
        createdAt: Date;
    }[]>;
    findByUser(userId: string, options?: {
        limit?: number;
        offset?: number;
    }): Promise<{
        id: string;
        tenantId: string | null;
        userId: string | null;
        action: string;
        entityType: string | null;
        entityId: string | null;
        metadataJson: import("@prisma/client/runtime/library").JsonValue | null;
        ipAddress: string | null;
        userAgent: string | null;
        createdAt: Date;
    }[]>;
    findByAction(action: string, options?: {
        tenantId?: string;
        limit?: number;
        offset?: number;
    }): Promise<{
        id: string;
        tenantId: string | null;
        userId: string | null;
        action: string;
        entityType: string | null;
        entityId: string | null;
        metadataJson: import("@prisma/client/runtime/library").JsonValue | null;
        ipAddress: string | null;
        userAgent: string | null;
        createdAt: Date;
    }[]>;
    findAll(options?: {
        limit?: number;
        offset?: number;
    }): Promise<{
        id: string;
        tenantId: string | null;
        userId: string | null;
        action: string;
        entityType: string | null;
        entityId: string | null;
        metadataJson: import("@prisma/client/runtime/library").JsonValue | null;
        ipAddress: string | null;
        userAgent: string | null;
        createdAt: Date;
    }[]>;
}
