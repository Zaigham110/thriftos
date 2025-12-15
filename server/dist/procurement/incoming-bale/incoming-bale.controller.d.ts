import { Request } from 'express';
import { IncomingBaleService } from './incoming-bale.service';
import { CreateIncomingBaleDto } from './dto/create-incoming-bale.dto';
import { CurrentUserData } from '../../common/decorators/current-user.decorator';
export declare class IncomingBaleController {
    private readonly incomingBaleService;
    constructor(incomingBaleService: IncomingBaleService);
    create(dto: CreateIncomingBaleDto, user: CurrentUserData, req: Request): Promise<{
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
    findAll(containerId: string, vendorId: string, standalone: boolean, page: number, limit: number, user: CurrentUserData, req: Request): Promise<{
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
    findOne(id: string, user: CurrentUserData, req: Request): Promise<{
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
    update(id: string, dto: Partial<CreateIncomingBaleDto>, user: CurrentUserData, req: Request): Promise<{
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
    delete(id: string, user: CurrentUserData, req: Request): Promise<{
        success: boolean;
    }>;
}
