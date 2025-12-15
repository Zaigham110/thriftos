import { Request } from 'express';
import { CurrentUserData } from '../../common/decorators/current-user.decorator';
import { QrLabelService } from './qr-label.service';
export declare class QrLabelController {
    private readonly service;
    constructor(service: QrLabelService);
    getUnitQr(unitId: string, user: CurrentUserData, req: Request): Promise<{
        qr: {
            encoded: string;
            pngDataUrl: string;
            generatedAt: Date;
        };
        unit: {
            id: string;
            unitCode: string;
            unitType: import("@prisma/client").$Enums.UnitType;
            category: string;
            grade: string;
            weightKg: string;
            pcsCount: number;
            totalCost: string;
            createdAt: Date;
        };
    }>;
}
