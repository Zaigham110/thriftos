import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TenantBootstrapService, BootstrapResult } from './tenant-bootstrap.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { TenantResponseDto, TenantListResponseDto } from './dto/tenant-response.dto';
import { TenantStatus } from '@prisma/client';
export declare class SuperAdminService {
    private prisma;
    private auditService;
    private bootstrapService;
    constructor(prisma: PrismaService, auditService: AuditService, bootstrapService: TenantBootstrapService);
    createTenant(dto: CreateTenantDto, userId: string): Promise<TenantResponseDto & {
        bootstrap: BootstrapResult;
    }>;
    findAll(page?: number, limit?: number, status?: TenantStatus): Promise<TenantListResponseDto>;
    findOne(id: string): Promise<TenantResponseDto>;
    update(id: string, dto: UpdateTenantDto, userId: string): Promise<TenantResponseDto>;
    deactivate(id: string, userId: string): Promise<TenantResponseDto>;
    activate(id: string, userId: string): Promise<TenantResponseDto>;
}
