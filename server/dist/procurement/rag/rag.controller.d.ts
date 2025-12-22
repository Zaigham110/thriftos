import { Request } from 'express';
import { RagService } from './rag.service';
import { CreateRagDto } from './dto/create-rag.dto';
import { CurrentUserData } from '../../common/decorators/current-user.decorator';
import { RagStatus } from '@prisma/client';
export declare class RagController {
    private readonly ragService;
    constructor(ragService: RagService);
    createForContainer(containerId: string, dto: Omit<CreateRagDto, 'containerId'>, user: CurrentUserData, req: Request): Promise<{
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
    findAll(containerId: string, status: RagStatus, sortableOnly: string, page: number, limit: number, user: CurrentUserData, req: Request): Promise<{
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
    findOne(id: string, user: CurrentUserData, req: Request): Promise<{
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
    delete(id: string, user: CurrentUserData, req: Request): Promise<{
        success: boolean;
    }>;
}
