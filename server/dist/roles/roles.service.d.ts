import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
export declare class RolesService {
    private prisma;
    private auditService;
    constructor(prisma: PrismaService, auditService: AuditService);
    create(tenantId: string, dto: CreateRoleDto, userId: string): Promise<{
        _count: {
            userRoles: number;
        };
        rolePermissions: ({
            permission: {
                id: string;
                createdAt: Date;
                name: string;
                updatedAt: Date;
                code: string;
                group: string;
            };
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            roleId: string;
            permissionId: string;
        })[];
    } & {
        id: string;
        tenantId: string;
        createdAt: Date;
        name: string;
        updatedAt: Date;
        description: string | null;
    }>;
    findAll(tenantId: string): Promise<({
        _count: {
            userRoles: number;
        };
        rolePermissions: ({
            permission: {
                id: string;
                createdAt: Date;
                name: string;
                updatedAt: Date;
                code: string;
                group: string;
            };
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            roleId: string;
            permissionId: string;
        })[];
    } & {
        id: string;
        tenantId: string;
        createdAt: Date;
        name: string;
        updatedAt: Date;
        description: string | null;
    })[]>;
    findOne(tenantId: string, id: string): Promise<{
        _count: {
            userRoles: number;
        };
        rolePermissions: ({
            permission: {
                id: string;
                createdAt: Date;
                name: string;
                updatedAt: Date;
                code: string;
                group: string;
            };
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            roleId: string;
            permissionId: string;
        })[];
    } & {
        id: string;
        tenantId: string;
        createdAt: Date;
        name: string;
        updatedAt: Date;
        description: string | null;
    }>;
    update(tenantId: string, id: string, dto: UpdateRoleDto, userId: string): Promise<{
        _count: {
            userRoles: number;
        };
        rolePermissions: ({
            permission: {
                id: string;
                createdAt: Date;
                name: string;
                updatedAt: Date;
                code: string;
                group: string;
            };
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            roleId: string;
            permissionId: string;
        })[];
    } & {
        id: string;
        tenantId: string;
        createdAt: Date;
        name: string;
        updatedAt: Date;
        description: string | null;
    }>;
    remove(tenantId: string, id: string, userId: string): Promise<{
        success: boolean;
    }>;
    assignPermission(tenantId: string, roleId: string, permissionId: string, userId: string): Promise<{
        permission: {
            id: string;
            createdAt: Date;
            name: string;
            updatedAt: Date;
            code: string;
            group: string;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        roleId: string;
        permissionId: string;
    }>;
    assignMultiplePermissions(tenantId: string, roleId: string, permissionIds: string[], userId: string): Promise<{
        _count: {
            userRoles: number;
        };
        rolePermissions: ({
            permission: {
                id: string;
                createdAt: Date;
                name: string;
                updatedAt: Date;
                code: string;
                group: string;
            };
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            roleId: string;
            permissionId: string;
        })[];
    } & {
        id: string;
        tenantId: string;
        createdAt: Date;
        name: string;
        updatedAt: Date;
        description: string | null;
    }>;
    removePermission(tenantId: string, roleId: string, permissionId: string, userId: string): Promise<{
        success: boolean;
    }>;
}
