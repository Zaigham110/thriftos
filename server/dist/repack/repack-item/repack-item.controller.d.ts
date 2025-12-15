import { Request } from 'express';
import { CurrentUserData } from '../../common/decorators/current-user.decorator';
import { CreateRepackItemDto } from './dto';
import { RepackItemService } from './repack-item.service';
export declare class RepackItemController {
    private readonly service;
    constructor(service: RepackItemService);
    addItem(unitId: string, dto: CreateRepackItemDto, user: CurrentUserData, req: Request): Promise<{
        item: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            weightKg: import("@prisma/client/runtime/library").Decimal;
            pcsCount: number;
            repackUnitId: string;
            sourceType: import("@prisma/client").$Enums.SourceType;
            sourceId: string;
        };
        unit: {
            category: {
                name: string;
            };
            grade: {
                name: string;
            };
            qrLabel: {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                repackUnitId: string;
                qrCode: string;
                generatedAt: Date;
            };
        } & {
            id: string;
            tenantId: string;
            createdAt: Date;
            updatedAt: Date;
            status: import("@prisma/client").$Enums.RepackStatus;
            totalCost: import("@prisma/client/runtime/library").Decimal;
            weightKg: import("@prisma/client/runtime/library").Decimal;
            categoryId: string | null;
            gradeId: string | null;
            repackSessionId: string;
            unitCode: string;
            unitType: import("@prisma/client").$Enums.UnitType;
            pcsCount: number;
        };
        itemCost: string;
    }>;
}
