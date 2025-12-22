import { PrismaService } from '../prisma/prisma.service';
import { PasswordService } from '../auth/password.service';
export interface BootstrapResult {
    roles: number;
    permissions: number;
    categories: number;
    grades: number;
    warehouses: number;
    adminUser?: {
        id: string;
        email: string;
    };
}
export declare class TenantBootstrapService {
    private prisma;
    private passwordService;
    constructor(prisma: PrismaService, passwordService: PasswordService);
    bootstrapTenant(tenantId: string, adminEmail?: string, adminName?: string, adminPassword?: string): Promise<BootstrapResult>;
}
