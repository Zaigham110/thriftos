import { Request } from 'express';
import { CurrentUserData } from '../../common/decorators/current-user.decorator';
import { CreateRepackUnitDto } from './dto';
import { RepackUnitService } from './repack-unit.service';
export declare class RepackUnitController {
    private readonly service;
    constructor(service: RepackUnitService);
    createForSession(sessionId: string, dto: CreateRepackUnitDto, user: CurrentUserData, req: Request): Promise<{
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
        totalCost: import("@prisma/client/runtime/library").Decimal;
        weightKg: import("@prisma/client/runtime/library").Decimal;
        categoryId: string | null;
        gradeId: string | null;
        repackSessionId: string;
        unitCode: string;
        unitType: import("@prisma/client").$Enums.UnitType;
        pcsCount: number;
    }>;
    findAll(sessionId: string, page: number, limit: number, user: CurrentUserData, req: Request): Promise<{
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
            totalCost: import("@prisma/client/runtime/library").Decimal;
            weightKg: import("@prisma/client/runtime/library").Decimal;
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
    findOne(id: string, user: CurrentUserData, req: Request): Promise<{
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
            weightKg: import("@prisma/client/runtime/library").Decimal;
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
        totalCost: import("@prisma/client/runtime/library").Decimal;
        weightKg: import("@prisma/client/runtime/library").Decimal;
        categoryId: string | null;
        gradeId: string | null;
        repackSessionId: string;
        unitCode: string;
        unitType: import("@prisma/client").$Enums.UnitType;
        pcsCount: number;
    }>;
}
