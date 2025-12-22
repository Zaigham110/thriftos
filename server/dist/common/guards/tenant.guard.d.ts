import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuditService } from '../../audit/audit.service';
export declare class TenantGuard implements CanActivate {
    private reflector;
    private auditService;
    private readonly logger;
    constructor(reflector: Reflector, auditService: AuditService);
    canActivate(context: ExecutionContext): Promise<boolean>;
    private logSecurityEvent;
}
