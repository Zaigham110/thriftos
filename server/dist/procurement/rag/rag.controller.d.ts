import { Request } from 'express';
import { RagService } from './rag.service';
import { CreateRagDto } from './dto/create-rag.dto';
import { CurrentUserData } from '../../common/decorators/current-user.decorator';
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
        containerId: string;
        ragCode: string;
        weightKg: import("@prisma/client/runtime/library").Decimal;
        allocatedCost: import("@prisma/client/runtime/library").Decimal;
    }>;
    findAll(containerId: string, page: number, limit: number, user: CurrentUserData, req: Request): Promise<{
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
    findOne(id: string, user: CurrentUserData, req: Request): Promise<{
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
    delete(id: string, user: CurrentUserData, req: Request): Promise<{
        success: boolean;
    }>;
}
