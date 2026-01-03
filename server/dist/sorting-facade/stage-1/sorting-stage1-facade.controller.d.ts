import { Request } from 'express';
import { CurrentUserData } from '../../common/decorators/current-user.decorator';
import { RagService } from '../../procurement/rag/rag.service';
import { IncomingBaleService } from '../../procurement/incoming-bale/incoming-bale.service';
import { SortSessionService } from '../../sorting-stage1/sort-session/sort-session.service';
import { SortCategoryBucketService } from '../../sorting-stage1/sort-category-bucket/sort-category-bucket.service';
import { PrismaService } from '../../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';
import { WasteService } from '../../waste/waste.service';
import { Stage1AddWasteDto, Stage1AllocateDto, Stage1SealDto, Stage1StartDto, Stage1UpdateWasteDto } from './dto';
export declare class SortingStage1FacadeController {
    private readonly ragService;
    private readonly incomingBaleService;
    private readonly sortSessionService;
    private readonly bucketService;
    private readonly wasteService;
    private readonly prisma;
    constructor(ragService: RagService, incomingBaleService: IncomingBaleService, sortSessionService: SortSessionService, bucketService: SortCategoryBucketService, wasteService: WasteService, prisma: PrismaService);
    queue(page: number, limit: number, status: string, user: CurrentUserData, req: Request): Promise<{
        data: ({
            sourceType: string;
            sourceId: string;
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
            id: string;
            tenantId: string;
            createdAt: Date;
            updatedAt: Date;
            status: import("@prisma/client").$Enums.RagStatus;
            notes: string | null;
            containerId: string | null;
            rawCategoryId: string | null;
            weightKg: Decimal;
            ragCode: string;
            ragBaleType: import("@prisma/client").$Enums.RagBaleType;
            allocatedCost: Decimal;
        } | {
            sourceType: string;
            sourceId: string;
            status: string;
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
            sortSessions: {
                id: string;
                status: import("@prisma/client").$Enums.SortStatus;
            }[];
            id: string;
            tenantId: string;
            createdAt: Date;
            updatedAt: Date;
            vendorId: string | null;
            purchaseOrderId: string | null;
            containerId: string | null;
            rawCategoryId: string | null;
            baleCode: string;
            weightKg: Decimal;
            cost: Decimal;
        })[];
        total: number;
        page: number;
        limit: number;
    }>;
    summary(ragId: string, user: CurrentUserData, req: Request): Promise<{
        session: {
            computedWasteWeight: string;
            declaredWasteAmount: any;
            remainingWasteAmount: string;
            id: string;
            status: import("@prisma/client").$Enums.SortStatus;
            totalInputWeight: Decimal;
            totalOutputWeight: Decimal;
            wasteWeight: Decimal;
        };
        buckets: ({
            category: {
                id: string;
                name: string;
            };
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            categoryId: string;
            sortSessionId: string;
            outputWeightKg: Decimal;
            outputCount: number;
        })[];
        wasteLineItems: any;
    } | {
        session: any;
        buckets: any[];
    }>;
    start(dto: Stage1StartDto, user: CurrentUserData, req: Request): Promise<{
        session: {
            computedWasteWeight: string;
            declaredWasteAmount: any;
            remainingWasteAmount: string;
            id: string;
            status: import("@prisma/client").$Enums.SortStatus;
            totalInputWeight: Decimal;
            totalOutputWeight: Decimal;
            wasteWeight: Decimal;
        };
        buckets: ({
            category: {
                id: string;
                name: string;
            };
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            categoryId: string;
            sortSessionId: string;
            outputWeightKg: Decimal;
            outputCount: number;
        })[];
        wasteLineItems: any;
    }>;
    allocate(dto: Stage1AllocateDto, user: CurrentUserData, req: Request): Promise<{
        session: {
            computedWasteWeight: string;
            declaredWasteAmount: any;
            remainingWasteAmount: string;
            id: string;
            status: import("@prisma/client").$Enums.SortStatus;
            totalInputWeight: Decimal;
            totalOutputWeight: Decimal;
            wasteWeight: Decimal;
        };
        buckets: ({
            category: {
                id: string;
                name: string;
            };
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            categoryId: string;
            sortSessionId: string;
            outputWeightKg: Decimal;
            outputCount: number;
        })[];
        wasteLineItems: any;
    }>;
    seal(sessionId: string, dto: Stage1SealDto, user: CurrentUserData, req: Request): Promise<{
        session: {
            computedWasteWeight: string;
            declaredWasteAmount: any;
            remainingWasteAmount: string;
            id: string;
            status: import("@prisma/client").$Enums.SortStatus;
            totalInputWeight: Decimal;
            totalOutputWeight: Decimal;
            wasteWeight: Decimal;
        };
        buckets: ({
            category: {
                id: string;
                name: string;
            };
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            categoryId: string;
            sortSessionId: string;
            outputWeightKg: Decimal;
            outputCount: number;
        })[];
        wasteLineItems: any;
    }>;
    addWaste(dto: Stage1AddWasteDto, user: CurrentUserData, req: Request): Promise<{
        session: {
            computedWasteWeight: string;
            declaredWasteAmount: any;
            remainingWasteAmount: string;
            id: string;
            status: import("@prisma/client").$Enums.SortStatus;
            totalInputWeight: Decimal;
            totalOutputWeight: Decimal;
            wasteWeight: Decimal;
        };
        buckets: ({
            category: {
                id: string;
                name: string;
            };
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            categoryId: string;
            sortSessionId: string;
            outputWeightKg: Decimal;
            outputCount: number;
        })[];
        wasteLineItems: any;
    }>;
    updateWaste(wasteLineItemId: string, dto: Stage1UpdateWasteDto, user: CurrentUserData, req: Request): Promise<{
        session: {
            computedWasteWeight: string;
            declaredWasteAmount: any;
            remainingWasteAmount: string;
            id: string;
            status: import("@prisma/client").$Enums.SortStatus;
            totalInputWeight: Decimal;
            totalOutputWeight: Decimal;
            wasteWeight: Decimal;
        };
        buckets: ({
            category: {
                id: string;
                name: string;
            };
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            categoryId: string;
            sortSessionId: string;
            outputWeightKg: Decimal;
            outputCount: number;
        })[];
        wasteLineItems: any;
    }>;
    removeWaste(wasteLineItemId: string, user: CurrentUserData, req: Request): Promise<{
        session: {
            computedWasteWeight: string;
            declaredWasteAmount: any;
            remainingWasteAmount: string;
            id: string;
            status: import("@prisma/client").$Enums.SortStatus;
            totalInputWeight: Decimal;
            totalOutputWeight: Decimal;
            wasteWeight: Decimal;
        };
        buckets: ({
            category: {
                id: string;
                name: string;
            };
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            categoryId: string;
            sortSessionId: string;
            outputWeightKg: Decimal;
            outputCount: number;
        })[];
        wasteLineItems: any;
    }>;
    private getSessionSummary;
}
