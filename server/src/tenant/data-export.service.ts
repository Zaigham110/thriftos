import { Injectable } from '@nestjs/common';
import { strToU8, zipSync } from 'fflate';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { exportTables, SECRET_FIELD, toCsv } from './data-export';

/** One zip of CSV files with everything that belongs to one business. */
@Injectable()
export class DataExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async exportZip(tenantId: string, userId: string): Promise<{ filename: string; zip: Uint8Array }> {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    const tenantColumns = Object.keys(tenant).filter((c) => !SECRET_FIELD.test(c));
    const files: Record<string, Uint8Array> = { 'Tenant.csv': strToU8(toCsv(tenantColumns, [tenant])) };
    const counts: Record<string, number> = {};
    for (const t of exportTables()) {
      const delegate = (this.prisma as unknown as Record<string, { findMany: (a: object) => Promise<Record<string, unknown>[]> }>)[t.delegate];
      const rows = await delegate.findMany({ where: t.where(tenantId), select: Object.fromEntries(t.columns.map((c) => [c, true])) });
      if (!rows.length) continue;
      files[`${t.model}.csv`] = strToU8(toCsv(t.columns, rows));
      counts[t.model] = rows.length;
    }
    files['README.txt'] = strToU8(
      `ThriftOS export of "${tenant.name}" made ${new Date().toISOString()}.\r\nOne CSV per table (UTF-8). Password and PIN hashes and sign-in tokens are left out.\r\n`,
    );
    await this.audit.log({ tenantId, userId, action: 'DATA_EXPORTED', metadataJson: counts });
    const day = new Date().toISOString().slice(0, 10);
    const slug = tenant.companyCode.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return { filename: `thriftos-${slug}-${day}.zip`, zip: zipSync(files, { level: 6 }) };
  }
}
