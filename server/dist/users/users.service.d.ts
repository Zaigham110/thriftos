import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PasswordService } from '../auth/password.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
export declare class UsersService {
    private prisma;
    private auditService;
    private passwordService;
    constructor(prisma: PrismaService, auditService: AuditService, passwordService: PasswordService);
    private userSelect;
    create(tenantId: string, dto: CreateUserDto, creatorUserId: string): Promise<{
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
    findAll(tenantId: string, includeInactive?: boolean): Promise<{
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
    findOne(tenantId: string, id: string): Promise<{
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
    update(tenantId: string, id: string, dto: UpdateUserDto, updaterUserId: string): Promise<{
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
    block(tenantId: string, id: string, blockerUserId: string): Promise<{
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
    unblock(tenantId: string, id: string, unblockerUserId: string): Promise<{
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
    resetPassword(tenantId: string, id: string, resetterUserId: string): Promise<{
        success: boolean;
        temporaryPassword: string;
        message: string;
    }>;
    assignRole(tenantId: string, userId: string, roleId: string, assignerUserId: string): Promise<{
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
    assignMultipleRoles(tenantId: string, userId: string, roleIds: string[], assignerUserId: string): Promise<{
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
    removeRole(tenantId: string, userId: string, roleId: string, removerUserId: string): Promise<{
        success: boolean;
    }>;
    getUserPermissions(userId: string): Promise<string[]>;
}
