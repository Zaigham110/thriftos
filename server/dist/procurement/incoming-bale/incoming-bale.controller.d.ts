import { Request } from 'express';
import { IncomingBaleService } from './incoming-bale.service';
import { CreateIncomingBaleDto } from './dto/create-incoming-bale.dto';
import { CurrentUserData } from '../../common/decorators/current-user.decorator';
export declare class IncomingBaleController {
    private readonly incomingBaleService;
    constructor(incomingBaleService: IncomingBaleService);
    create(dto: CreateIncomingBaleDto, user: CurrentUserData, req: Request): Promise<{
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
    findAll(containerId: string, vendorId: string, purchaseOrderId: string, standalone: boolean, page: number, limit: number, user: CurrentUserData, req: Request): Promise<{
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
    findOne(id: string, user: CurrentUserData, req: Request): Promise<{
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
    update(id: string, dto: Partial<CreateIncomingBaleDto>, user: CurrentUserData, req: Request): Promise<{
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
    delete(id: string, user: CurrentUserData, req: Request): Promise<{
        success: boolean;
    }>;
}
