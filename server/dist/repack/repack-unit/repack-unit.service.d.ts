import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { CreateRepackUnitDto } from './dto';
import { Decimal } from '@prisma/client/runtime/library';
export declare class RepackUnitService {
    private prisma;
    private auditService;
    constructor(prisma: PrismaService, auditService: AuditService);
    createForSession(tenantId: string, sessionId: string, dto: CreateRepackUnitDto, userId: string): Promise<{
        category: {
            name: string;
        };
        grade: {
            name: string;
        };
    } & {
        id: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.RepackStatus;
        totalCost: Decimal;
        weightKg: Decimal;
        categoryId: string | null;
        gradeId: string | null;
        repackSessionId: string;
        unitCode: string;
        unitType: import("@prisma/client").$Enums.UnitType;
        pcsCount: number;
    }>;
    findAll(tenantId: string, options?: {
        page?: number;
        limit?: number;
        sessionId?: string;
    }): Promise<{
        data: ({
            category: {
                id: string;
                name: string;
            };
            grade: {
                id: string;
                name: string;
            };
            repackSession: {
                id: string;
                status: import("@prisma/client").$Enums.RepackSessionStatus;
            };
            _count: {
                repackItems: number;
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
            weightKg: Decimal;
            categoryId: string | null;
            gradeId: string | null;
            repackSessionId: string;
            unitCode: string;
            unitType: import("@prisma/client").$Enums.UnitType;
            pcsCount: number;
        })[];
        total: number;
        page: number;
        limit: number;
    }>;
    findOne(tenantId: string, id: string): Promise<{
        category: {
            id: string;
            name: string;
        };
        grade: {
            id: string;
            name: string;
        };
        repackSession: {
            id: string;
            status: import("@prisma/client").$Enums.RepackSessionStatus;
        };
        repackItems: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            weightKg: Decimal;
            pcsCount: number;
            repackUnitId: string;
            sourceType: import("@prisma/client").$Enums.SourceType;
            sourceId: string;
        }[];
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
        weightKg: Decimal;
        categoryId: string | null;
        gradeId: string | null;
        repackSessionId: string;
        unitCode: string;
        unitType: import("@prisma/client").$Enums.UnitType;
        pcsCount: number;
    }>;
    private generateUniqueUnitCode;
}
