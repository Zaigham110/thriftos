import { PrismaService } from '../prisma/prisma.service';
export declare class PermissionsService {
    private prisma;
    constructor(prisma: PrismaService);
    findAll(): Promise<{
        id: string;
        createdAt: Date;
        name: string;
        updatedAt: Date;
        code: string;
        group: string;
    }[]>;
    findByGroup(): Promise<Record<string, {
        id: string;
        createdAt: Date;
        name: string;
        updatedAt: Date;
        code: string;
        group: string;
    }[]>>;
    findOne(id: string): Promise<{
        id: string;
        createdAt: Date;
        name: string;
        updatedAt: Date;
        code: string;
        group: string;
    }>;
    findByCode(code: string): Promise<{
        id: string;
        createdAt: Date;
        name: string;
        updatedAt: Date;
        code: string;
        group: string;
    }>;
}
