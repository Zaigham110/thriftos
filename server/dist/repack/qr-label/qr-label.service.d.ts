import { PrismaService } from '../../prisma/prisma.service';
export declare class QrLabelService {
    private prisma;
    constructor(prisma: PrismaService);
    getUnitQr(tenantId: string, unitId: string): Promise<{
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
