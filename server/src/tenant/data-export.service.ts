import { Injectable } from '@nestjs/common';
import { strToU8, zipSync } from 'fflate';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { exportTables, fileName, NAMED_IDS, SECRET_FIELD, toCsv, withNames } from './data-export';

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
    const counts: Record<string, number> = {};
    // Everything is read first, so each file can show names beside its id columns.
    const tables: Array<{ model: string; columns: string[]; rows: Record<string, unknown>[] }> = [{ model: 'Tenant', columns: tenantColumns, rows: [tenant] }];
    for (const t of exportTables()) {
      const delegate = (this.prisma as unknown as Record<string, { findMany: (a: object) => Promise<Record<string, unknown>[]> }>)[t.delegate];
      const rows = await delegate.findMany({ where: t.where(tenantId), select: Object.fromEntries(t.columns.map((c) => [c, true])) });
      if (!rows.length) continue;
      tables.push({ model: t.model, columns: t.columns, rows });
      counts[t.model] = rows.length;
    }
    const lookups = new Map<string, Map<string, string>>();
    for (const { model, field } of Object.values(NAMED_IDS)) {
      const table = tables.find((t) => t.model === model);
      if (table && !lookups.has(model)) lookups.set(model, new Map(table.rows.map((r) => [String(r['id']), String(r[field] ?? '')])));
    }
    const files: Record<string, Uint8Array> = {};
    const listed: string[] = [];
    for (const t of tables) {
      const named = withNames(t.columns, t.rows, lookups);
      const name = `${fileName(t.model)}.csv`;
      files[name] = strToU8(toCsv(named.columns, named.rows));
      listed.push(`${name}: ${t.rows.length} ${t.rows.length === 1 ? 'row' : 'rows'}`);
    }
    files['README.txt'] = strToU8(
      [
        `ThriftOS export of "${tenant.name}" made ${new Date().toISOString()}.`,
        '',
        'One CSV file per kind of record (UTF-8, opens in Excel). Each row has its id; where a row points to another',
        'record (customerId, vendorId, saleId...), the column after it gives the name or number it stands for.',
        'Money is in the business currency. Dates are in UTC.',
        '',
        'Not in this zip: passwords, PINs and sign-in tokens; and the photos and files attached to records',
        '(payment screenshots, sale attachments). "Attached files (list).csv", when present, lists them by name.',
        '',
        'Files:',
        ...listed.sort(),
        '',
      ].join('\r\n'),
    );
    await this.audit.log({ tenantId, userId, action: 'DATA_EXPORTED', metadataJson: counts });
    const day = new Date().toISOString().slice(0, 10);
    const slug = tenant.companyCode.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return { filename: `thriftos-${slug}-${day}.zip`, zip: zipSync(files, { level: 6 }) };
  }
}
