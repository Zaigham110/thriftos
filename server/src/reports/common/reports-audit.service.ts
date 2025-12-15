import { Injectable } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';

@Injectable()
export class ReportsAuditService {
  constructor(private audit: AuditService) {}

  async logAccess(input: {
    tenantId: string;
    userId: string;
    report: string;
    exported: boolean;
    params: Record<string, any>;
  }) {
    await this.audit.log({
      tenantId: input.tenantId,
      userId: input.userId,
      action: input.exported ? 'REPORT_EXPORTED' : 'REPORT_ACCESSED',
      entityType: 'Report',
      entityId: input.report,
      metadataJson: input.params,
    });
  }
}


