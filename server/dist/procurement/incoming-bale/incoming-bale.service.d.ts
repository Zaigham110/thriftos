import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { CostAllocationService } from '../cost-allocation/cost-allocation.service';
import { CreateIncomingBaleDto } from './dto/create-incoming-bale.dto';
export declare class IncomingBaleService {
    private prisma;
    private auditService;
    private costAllocationService;
    constructor(prisma: PrismaService, auditService: AuditService, costAllocationService: CostAllocationService);
    create(tenantId: string, dto: CreateIncomingBaleDto, userId: string): Promise<{
        vendor: {
            name: string;
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
        containerId: string | null;
        weightKg: import("@prisma/client/runtime/library").Decimal;
        baleCode: string;
        categoryGuess: string | null;
        cost: import("@prisma/client/runtime/library").Decimal;
    }>;
    findAll(tenantId: string, options?: {
        containerId?: string;
        vendorId?: string;
        standalone?: boolean;
        page?: number;
        limit?: number;
    }): Promise<{
        data: ({
            vendor: {
                id: string;
                name: string;
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
            containerId: string | null;
            weightKg: import("@prisma/client/runtime/library").Decimal;
            baleCode: string;
            categoryGuess: string | null;
            cost: import("@prisma/client/runtime/library").Decimal;
        })[];
        total: number;
        page: number;
        limit: number;
    }>;
    findOne(tenantId: string, id: string): Promise<{
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
        containerId: string | null;
        weightKg: import("@prisma/client/runtime/library").Decimal;
        baleCode: string;
        categoryGuess: string | null;
        cost: import("@prisma/client/runtime/library").Decimal;
    }>;
    update(tenantId: string, id: string, dto: Partial<CreateIncomingBaleDto>, userId: string): Promise<{
        vendor: {
            name: string;
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
        containerId: string | null;
        weightKg: import("@prisma/client/runtime/library").Decimal;
        baleCode: string;
        categoryGuess: string | null;
        cost: import("@prisma/client/runtime/library").Decimal;
    }>;
    delete(tenantId: string, id: string, userId: string): Promise<{
        success: boolean;
    }>;
}
