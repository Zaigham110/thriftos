import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { CreateVendorDto } from './dto/create-vendor.dto';
export declare class VendorService {
    private prisma;
    private auditService;
    constructor(prisma: PrismaService, auditService: AuditService);
    create(tenantId: string, dto: CreateVendorDto, userId: string): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        name: string;
        isActive: boolean;
        updatedAt: Date;
        country: string | null;
        contactInfo: string | null;
    }>;
    findAll(tenantId: string, includeInactive?: boolean): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        name: string;
        isActive: boolean;
        updatedAt: Date;
        country: string | null;
        contactInfo: string | null;
    }[]>;
    findOne(tenantId: string, id: string): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        name: string;
        isActive: boolean;
        updatedAt: Date;
        country: string | null;
        contactInfo: string | null;
    }>;
    update(tenantId: string, id: string, dto: Partial<CreateVendorDto>, userId: string): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        name: string;
        isActive: boolean;
        updatedAt: Date;
        country: string | null;
        contactInfo: string | null;
    }>;
}
