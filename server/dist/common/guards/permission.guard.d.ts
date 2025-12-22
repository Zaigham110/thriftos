import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
export declare class PermissionGuard implements CanActivate {
    private reflector;
    private prisma;
    private auditService;
    private readonly logger;
    constructor(reflector: Reflector, prisma: PrismaService, auditService: AuditService);
    canActivate(context: ExecutionContext): Promise<boolean>;
    private getUserPermissions;
    private logSecurityEvent;
}
