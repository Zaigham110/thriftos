import { PrismaService } from '../../prisma/prisma.service';
export declare class InventoryWarehouseService {
    private prisma;
    constructor(prisma: PrismaService);
    list(tenantId: string): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        name: string;
        updatedAt: Date;
        code: string;
        location: string | null;
    }[]>;
}
