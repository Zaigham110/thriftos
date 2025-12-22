import { Request } from 'express';
import { CurrentUserData } from '../../common/decorators/current-user.decorator';
import { GradesService } from './grades.service';
import { CreateGradeDto, UpdateGradeDto } from './dto';
export declare class GradesController {
    private readonly service;
    constructor(service: GradesService);
    findAll(user: CurrentUserData, req: Request): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        name: string;
        isActive: boolean;
        updatedAt: Date;
        description: string | null;
        rank: number;
    }[]>;
    findAllAdmin(user: CurrentUserData, req: Request): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        name: string;
        isActive: boolean;
        updatedAt: Date;
        description: string | null;
        rank: number;
    }[]>;
    findOne(id: string, user: CurrentUserData, req: Request): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        name: string;
        isActive: boolean;
        updatedAt: Date;
        description: string | null;
        rank: number;
    }>;
    create(dto: CreateGradeDto, user: CurrentUserData, req: Request): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        name: string;
        isActive: boolean;
        updatedAt: Date;
        description: string | null;
        rank: number;
    }>;
    update(id: string, dto: UpdateGradeDto, user: CurrentUserData, req: Request): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        name: string;
        isActive: boolean;
        updatedAt: Date;
        description: string | null;
        rank: number;
    }>;
    remove(id: string, user: CurrentUserData, req: Request): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        name: string;
        isActive: boolean;
        updatedAt: Date;
        description: string | null;
        rank: number;
    }>;
}
