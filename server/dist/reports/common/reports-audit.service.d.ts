import { AuditService } from '../../audit/audit.service';
export declare class ReportsAuditService {
    private audit;
    constructor(audit: AuditService);
    logAccess(input: {
        tenantId: string;
        userId: string;
        report: string;
        exported: boolean;
        params: Record<string, any>;
    }): Promise<void>;
}
