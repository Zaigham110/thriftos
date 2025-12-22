import { Request } from 'express';
import { RepackSessionStatus } from '@prisma/client';
import { CurrentUserData } from '../../common/decorators/current-user.decorator';
import { CreateRepackSessionDto, UpdateRepackSessionDto } from './dto';
import { RepackSessionService } from './repack-session.service';
export declare class RepackSessionController {
    private readonly service;
    constructor(service: RepackSessionService);
    create(dto: CreateRepackSessionDto, user: CurrentUserData, req: Request): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.RepackSessionStatus;
        workerId: string;
        supervisorId: string;
        startTime: Date;
        endTime: Date | null;
    }>;
    findAll(status: RepackSessionStatus, page: number, limit: number, user: CurrentUserData, req: Request): Promise<{
        data: ({
            _count: {
                repackUnits: number;
            };
            worker: {
                id: string;
                name: string;
                email: string;
            };
            supervisor: {
                id: string;
                name: string;
                email: string;
            };
        } & {
            id: string;
            tenantId: string;
            createdAt: Date;
            updatedAt: Date;
            status: import("@prisma/client").$Enums.RepackSessionStatus;
            workerId: string;
            supervisorId: string;
            startTime: Date;
            endTime: Date | null;
        })[];
        total: number;
        page: number;
        limit: number;
    }>;
    findOne(id: string, user: CurrentUserData, req: Request): Promise<{
        repackUnits: ({
            category: {
                id: string;
                name: string;
            };
            grade: {
                id: string;
                name: string;
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
            containerId: string | null;
            weightKg: import("@prisma/client/runtime/library").Decimal;
            ragId: string | null;
            sortSessionId: string | null;
            categoryId: string | null;
            gradeSessionId: string | null;
            gradeId: string | null;
            repackSessionId: string;
            unitCode: string;
            unitType: import("@prisma/client").$Enums.UnitType;
            pcsCount: number;
        })[];
        worker: {
            id: string;
            name: string;
            email: string;
        };
        supervisor: {
            id: string;
            name: string;
            email: string;
        };
    } & {
        id: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.RepackSessionStatus;
        workerId: string;
        supervisorId: string;
        startTime: Date;
        endTime: Date | null;
    }>;
    update(id: string, dto: UpdateRepackSessionDto, user: CurrentUserData, req: Request): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.RepackSessionStatus;
        workerId: string;
        supervisorId: string;
        startTime: Date;
        endTime: Date | null;
    }>;
    close(id: string, user: CurrentUserData, req: Request): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.RepackSessionStatus;
        workerId: string;
        supervisorId: string;
        startTime: Date;
        endTime: Date | null;
    }>;
}
