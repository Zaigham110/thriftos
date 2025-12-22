import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { CreateRepackItemDto } from './dto';
import { Decimal } from '@prisma/client/runtime/library';
export declare class RepackItemService {
    private prisma;
    private auditService;
    constructor(prisma: PrismaService, auditService: AuditService);
    addItem(tenantId: string, unitId: string, dto: CreateRepackItemDto, userId: string): Promise<{
        item: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            weightKg: Decimal;
            sourceType: import("@prisma/client").$Enums.SourceType;
            pcsCount: number;
            repackUnitId: string;
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
            totalCost: Decimal;
            containerId: string | null;
            weightKg: Decimal;
            ragId: string | null;
            sortSessionId: string | null;
            categoryId: string | null;
            gradeSessionId: string | null;
            gradeId: string | null;
            repackSessionId: string;
            unitCode: string;
            unitType: import("@prisma/client").$Enums.UnitType;
            pcsCount: number;
        };
        itemCost: string;
    }>;
}
