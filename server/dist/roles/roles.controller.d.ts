import { Request } from 'express';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AssignPermissionDto, AssignMultiplePermissionsDto } from './dto/assign-permission.dto';
import { CurrentUserData } from '../common/decorators/current-user.decorator';
export declare class RolesController {
    private readonly rolesService;
    constructor(rolesService: RolesService);
    create(dto: CreateRoleDto, user: CurrentUserData, req: Request): Promise<{
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
    findAll(user: CurrentUserData, req: Request): Promise<({
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
    findOne(id: string, user: CurrentUserData, req: Request): Promise<{
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
    update(id: string, dto: UpdateRoleDto, user: CurrentUserData, req: Request): Promise<{
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
    remove(id: string, user: CurrentUserData, req: Request): Promise<{
        success: boolean;
    }>;
    assignPermission(id: string, dto: AssignPermissionDto, user: CurrentUserData, req: Request): Promise<{
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
    assignMultiplePermissions(id: string, dto: AssignMultiplePermissionsDto, user: CurrentUserData, req: Request): Promise<{
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
    removePermission(id: string, permId: string, user: CurrentUserData, req: Request): Promise<{
        success: boolean;
    }>;
}
