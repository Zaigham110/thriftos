import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { CreateGradeDto, UpdateGradeDto } from './dto';
export declare class GradesService {
    private prisma;
    private auditService;
    constructor(prisma: PrismaService, auditService: AuditService);
    findAll(tenantId: string): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        name: string;
        isActive: boolean;
        updatedAt: Date;
        description: string | null;
        rank: number;
    }[]>;
    findAllAdmin(tenantId: string): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        name: string;
        isActive: boolean;
        updatedAt: Date;
        description: string | null;
        rank: number;
    }[]>;
    findOne(tenantId: string, id: string): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        name: string;
        isActive: boolean;
        updatedAt: Date;
        description: string | null;
        rank: number;
    }>;
    create(tenantId: string, dto: CreateGradeDto, userId: string): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        name: string;
        isActive: boolean;
        updatedAt: Date;
        description: string | null;
        rank: number;
    }>;
    update(tenantId: string, id: string, dto: UpdateGradeDto, userId: string): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        name: string;
        isActive: boolean;
        updatedAt: Date;
        description: string | null;
        rank: number;
    }>;
    remove(tenantId: string, id: string, userId: string): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        name: string;
        isActive: boolean;
        updatedAt: Date;
        description: string | null;
        rank: number;
    }>;
    private getNextRank;
}
