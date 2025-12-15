import { Request } from 'express';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AssignRoleDto, AssignMultipleRolesDto } from './dto/assign-role.dto';
import { CurrentUserData } from '../common/decorators/current-user.decorator';
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    create(dto: CreateUserDto, user: CurrentUserData, req: Request): Promise<{
        temporaryPassword: string;
        id: string;
        tenantId: string;
        createdAt: Date;
        name: string;
        email: string;
        isActive: boolean;
        updatedAt: Date;
        userRoles: ({
            role: {
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
            };
        } & {
            id: string;
            userId: string;
            createdAt: Date;
            updatedAt: Date;
            roleId: string;
        })[];
    }>;
    findAll(includeInactive: boolean, user: CurrentUserData, req: Request): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        name: string;
        email: string;
        isActive: boolean;
        updatedAt: Date;
        userRoles: ({
            role: {
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
            };
        } & {
            id: string;
            userId: string;
            createdAt: Date;
            updatedAt: Date;
            roleId: string;
        })[];
    }[]>;
    findOne(id: string, user: CurrentUserData, req: Request): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        name: string;
        email: string;
        isActive: boolean;
        updatedAt: Date;
        userRoles: ({
            role: {
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
            };
        } & {
            id: string;
            userId: string;
            createdAt: Date;
            updatedAt: Date;
            roleId: string;
        })[];
    }>;
    update(id: string, dto: UpdateUserDto, user: CurrentUserData, req: Request): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        name: string;
        email: string;
        isActive: boolean;
        updatedAt: Date;
        userRoles: ({
            role: {
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
            };
        } & {
            id: string;
            userId: string;
            createdAt: Date;
            updatedAt: Date;
            roleId: string;
        })[];
    }>;
    block(id: string, user: CurrentUserData, req: Request): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        name: string;
        email: string;
        isActive: boolean;
        updatedAt: Date;
        userRoles: ({
            role: {
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
            };
        } & {
            id: string;
            userId: string;
            createdAt: Date;
            updatedAt: Date;
            roleId: string;
        })[];
    }>;
    unblock(id: string, user: CurrentUserData, req: Request): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        name: string;
        email: string;
        isActive: boolean;
        updatedAt: Date;
        userRoles: ({
            role: {
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
            };
        } & {
            id: string;
            userId: string;
            createdAt: Date;
            updatedAt: Date;
            roleId: string;
        })[];
    }>;
    resetPassword(id: string, user: CurrentUserData, req: Request): Promise<{
        success: boolean;
        temporaryPassword: string;
        message: string;
    }>;
    assignRole(id: string, dto: AssignRoleDto, user: CurrentUserData, req: Request): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        name: string;
        email: string;
        isActive: boolean;
        updatedAt: Date;
        userRoles: ({
            role: {
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
            };
        } & {
            id: string;
            userId: string;
            createdAt: Date;
            updatedAt: Date;
            roleId: string;
        })[];
    }>;
    assignMultipleRoles(id: string, dto: AssignMultipleRolesDto, user: CurrentUserData, req: Request): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        name: string;
        email: string;
        isActive: boolean;
        updatedAt: Date;
        userRoles: ({
            role: {
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
            };
        } & {
            id: string;
            userId: string;
            createdAt: Date;
            updatedAt: Date;
            roleId: string;
        })[];
    }>;
    removeRole(id: string, roleId: string, user: CurrentUserData, req: Request): Promise<{
        success: boolean;
    }>;
}
