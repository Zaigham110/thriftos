import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { CostAllocationService } from '../cost-allocation/cost-allocation.service';
import { CreateRagDto } from './dto/create-rag.dto';
import { RagStatus } from '@prisma/client';
import { TenantSequenceService } from '../shared/tenant-sequence.service';
export declare class RagService {
    private prisma;
    private auditService;
    private costAllocationService;
    private tenantSequenceService;
    constructor(prisma: PrismaService, auditService: AuditService, costAllocationService: CostAllocationService, tenantSequenceService: TenantSequenceService);
    create(tenantId: string, dto: CreateRagDto, userId: string): Promise<{
        container: {
            containerNumber: string;
        };
    } & {
        id: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.RagStatus;
        notes: string | null;
        containerId: string | null;
        rawCategoryId: string | null;
        weightKg: import("@prisma/client/runtime/library").Decimal;
        ragCode: string;
        ragBaleType: import("@prisma/client").$Enums.RagBaleType;
        allocatedCost: import("@prisma/client/runtime/library").Decimal;
        sourceType: import("@prisma/client").$Enums.RagSourceType;
    }>;
    findAll(tenantId: string, options?: {
        containerId?: string;
        status?: RagStatus;
        sortableOnly?: boolean;
        page?: number;
        limit?: number;
    }): Promise<{
        data: ({
            rawCategory: {
                id: string;
                name: string;
                rawType: import("@prisma/client").$Enums.RagBaleType;
            };
            container: {
                purchaseOrder: {
                    id: string;
                    poNumber: string;
                };
                id: string;
                containerNumber: string;
            };
        } & {
            id: string;
            tenantId: string;
            createdAt: Date;
            updatedAt: Date;
            status: import("@prisma/client").$Enums.RagStatus;
            notes: string | null;
            containerId: string | null;
            rawCategoryId: string | null;
            weightKg: import("@prisma/client/runtime/library").Decimal;
            ragCode: string;
            ragBaleType: import("@prisma/client").$Enums.RagBaleType;
            allocatedCost: import("@prisma/client/runtime/library").Decimal;
            sourceType: import("@prisma/client").$Enums.RagSourceType;
        })[];
        total: number;
        page: number;
        limit: number;
    }>;
    findOne(tenantId: string, id: string): Promise<{
        rawCategory: {
            id: string;
            name: string;
            rawType: import("@prisma/client").$Enums.RagBaleType;
        };
        container: {
            purchaseOrder: {
                vendor: {
                    id: string;
                    tenantId: string;
                    createdAt: Date;
                    name: string;
                    isActive: boolean;
                    updatedAt: Date;
                    country: string | null;
                    contactInfo: string | null;
                };
                id: string;
                poNumber: string;
            };
            id: string;
            containerNumber: string;
        };
        sortSession: {
            id: string;
            status: import("@prisma/client").$Enums.SortStatus;
        };
    } & {
        id: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.RagStatus;
        notes: string | null;
        containerId: string | null;
        rawCategoryId: string | null;
        weightKg: import("@prisma/client/runtime/library").Decimal;
        ragCode: string;
        ragBaleType: import("@prisma/client").$Enums.RagBaleType;
        allocatedCost: import("@prisma/client/runtime/library").Decimal;
        sourceType: import("@prisma/client").$Enums.RagSourceType;
    }>;
    delete(tenantId: string, id: string, userId: string): Promise<{
        success: boolean;
    }>;
}
