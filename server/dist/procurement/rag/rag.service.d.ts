import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { CostAllocationService } from '../cost-allocation/cost-allocation.service';
import { CreateRagDto } from './dto/create-rag.dto';
export declare class RagService {
    private prisma;
    private auditService;
    private costAllocationService;
    constructor(prisma: PrismaService, auditService: AuditService, costAllocationService: CostAllocationService);
    create(tenantId: string, dto: CreateRagDto, userId: string): Promise<{
        container: {
            containerNumber: string;
        };
    } & {
        id: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        containerId: string;
        ragCode: string;
        weightKg: import("@prisma/client/runtime/library").Decimal;
        allocatedCost: import("@prisma/client/runtime/library").Decimal;
    }>;
    findAll(tenantId: string, options?: {
        containerId?: string;
        page?: number;
        limit?: number;
    }): Promise<{
        data: ({
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
            containerId: string;
            ragCode: string;
            weightKg: import("@prisma/client/runtime/library").Decimal;
            allocatedCost: import("@prisma/client/runtime/library").Decimal;
        })[];
        total: number;
        page: number;
        limit: number;
    }>;
    findOne(tenantId: string, id: string): Promise<{
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
        sortSessions: {
            id: string;
            status: import("@prisma/client").$Enums.SortStatus;
        }[];
    } & {
        id: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        containerId: string;
        ragCode: string;
        weightKg: import("@prisma/client/runtime/library").Decimal;
        allocatedCost: import("@prisma/client/runtime/library").Decimal;
    }>;
    delete(tenantId: string, id: string, userId: string): Promise<{
        success: boolean;
    }>;
}
