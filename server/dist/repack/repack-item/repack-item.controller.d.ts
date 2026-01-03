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
            sourceType: import("@prisma/client").$Enums.SourceType;
            sourceId: string;
            pcsCount: number;
            repackUnitId: string;
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
            unitType: import("@prisma/client").$Enums.UnitType;
            totalCost: import("@prisma/client/runtime/library").Decimal;
            containerId: string | null;
            weightKg: import("@prisma/client/runtime/library").Decimal;
            ragId: string | null;
            categoryId: string | null;
            gradeId: string | null;
            sortSessionId: string | null;
            gradeSessionId: string | null;
            measurementType: import("@prisma/client").$Enums.MeasurementType;
            repackSessionId: string;
            unitCode: string;
            pcsCount: number;
            targetAmount: import("@prisma/client/runtime/library").Decimal;
            allocationMode: import("@prisma/client").$Enums.AllocationMode;
            createdBy: string | null;
        };
        itemCost: string;
    }>;
}
