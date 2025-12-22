import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { CostAllocationService } from '../cost-allocation/cost-allocation.service';
import { CreateIncomingBaleDto } from './dto/create-incoming-bale.dto';
import { TenantSequenceService } from '../shared/tenant-sequence.service';
export declare class IncomingBaleService {
    private prisma;
    private auditService;
    private costAllocationService;
    private tenantSequenceService;
    constructor(prisma: PrismaService, auditService: AuditService, costAllocationService: CostAllocationService, tenantSequenceService: TenantSequenceService);
    create(tenantId: string, dto: CreateIncomingBaleDto, userId: string): Promise<{
        rawCategory: {
            id: string;
            name: string;
            rawType: import("@prisma/client").$Enums.RagBaleType;
        };
        vendor: {
            name: string;
        };
        purchaseOrder: {
            id: string;
            poNumber: string;
        };
        container: {
            containerNumber: string;
        };
    } & {
        id: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        vendorId: string | null;
        purchaseOrderId: string | null;
        containerId: string | null;
        rawCategoryId: string | null;
        baleCode: string;
        weightKg: import("@prisma/client/runtime/library").Decimal;
        cost: import("@prisma/client/runtime/library").Decimal;
    }>;
    findAll(tenantId: string, options?: {
        containerId?: string;
        vendorId?: string;
        purchaseOrderId?: string;
        standalone?: boolean;
        page?: number;
        limit?: number;
    }): Promise<{
        data: ({
            rawCategory: {
                id: string;
                name: string;
                rawType: import("@prisma/client").$Enums.RagBaleType;
            };
            vendor: {
                id: string;
                name: string;
            };
            purchaseOrder: {
                id: string;
                poNumber: string;
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
            vendorId: string | null;
            purchaseOrderId: string | null;
            containerId: string | null;
            rawCategoryId: string | null;
            baleCode: string;
            weightKg: import("@prisma/client/runtime/library").Decimal;
            cost: import("@prisma/client/runtime/library").Decimal;
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
        vendorId: string | null;
        purchaseOrderId: string | null;
        containerId: string | null;
        rawCategoryId: string | null;
        baleCode: string;
        weightKg: import("@prisma/client/runtime/library").Decimal;
        cost: import("@prisma/client/runtime/library").Decimal;
    }>;
    update(tenantId: string, id: string, dto: Partial<CreateIncomingBaleDto>, userId: string): Promise<{
        rawCategory: {
            id: string;
            name: string;
            rawType: import("@prisma/client").$Enums.RagBaleType;
        };
        vendor: {
            name: string;
        };
        purchaseOrder: {
            id: string;
            poNumber: string;
        };
        container: {
            containerNumber: string;
        };
    } & {
        id: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        vendorId: string | null;
        purchaseOrderId: string | null;
        containerId: string | null;
        rawCategoryId: string | null;
        baleCode: string;
        weightKg: import("@prisma/client/runtime/library").Decimal;
        cost: import("@prisma/client/runtime/library").Decimal;
    }>;
    delete(tenantId: string, id: string, userId: string): Promise<{
        success: boolean;
    }>;
}
