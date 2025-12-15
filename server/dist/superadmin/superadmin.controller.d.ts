import { Request } from 'express';
import { TenantStatus } from '@prisma/client';
import { SuperAdminService } from './superadmin.service';
import { AuthService } from '../auth/auth.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { TenantResponseDto, TenantListResponseDto } from './dto/tenant-response.dto';
import { CurrentUserData } from '../common/decorators/current-user.decorator';
import { BootstrapResult } from './tenant-bootstrap.service';
export declare class SuperAdminController {
    private readonly superAdminService;
    private readonly authService;
    constructor(superAdminService: SuperAdminService, authService: AuthService);
    create(dto: CreateTenantDto, user: CurrentUserData): Promise<TenantResponseDto & {
        bootstrap: BootstrapResult;
    }>;
    findAll(page?: number, limit?: number, status?: TenantStatus): Promise<TenantListResponseDto>;
    findOne(id: string): Promise<TenantResponseDto>;
    update(id: string, dto: UpdateTenantDto, user: CurrentUserData): Promise<TenantResponseDto>;
    deactivate(id: string, user: CurrentUserData): Promise<TenantResponseDto>;
    activate(id: string, user: CurrentUserData): Promise<TenantResponseDto>;
    impersonate(id: string, user: CurrentUserData, req: Request): Promise<{
        accessToken: string;
        expiresIn: number;
    }>;
}
