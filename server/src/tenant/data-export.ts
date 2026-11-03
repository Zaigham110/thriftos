import { Prisma } from '@prisma/client';

/**
 * Pure helpers for the whole-business export (v2 5.6, "your data is yours; export any time").
 * Which tables belong to a business is read from the Prisma schema, so a new table is exported without
 * a code change: a model with `tenantId`, or one whose parent (a required relation) has it.
 */
const SKIP_MODELS = new Set(['Tenant', 'GlobalConfig', 'GlobalCategoryTemplate', 'Permission', 'RefreshToken', 'PasswordResetToken', 'IdempotencyKey']);
/** Never exported: password and PIN hashes, tokens. */
export const SECRET_FIELD = /(hash|token|secret)$/i;

export interface ExportTable {
  model: string;
  /** Prisma delegate name (camelCase). */
  delegate: string;
  /** Builds the `where` for one business. */
  where: (tenantId: string) => Record<string, unknown>;
  columns: string[];
}

export function exportTables(dmmf = Prisma.dmmf): ExportTable[] {
  const models = dmmf.datamodel.models;
  const hasTenant = new Set(models.filter((m) => m.fields.some((f) => f.name === 'tenantId')).map((m) => m.name));
  const tables: ExportTable[] = [];
  for (const m of models) {
    if (SKIP_MODELS.has(m.name)) continue;
    const columns = m.fields.filter((f) => f.kind !== 'object' && !SECRET_FIELD.test(f.name)).map((f) => f.name);
    const delegate = m.name[0].toLowerCase() + m.name.slice(1);
    if (hasTenant.has(m.name)) {
      tables.push({ model: m.name, delegate, where: (tenantId) => ({ tenantId }), columns });
      continue;
    }
    const parent = m.fields.find((f) => f.kind === 'object' && f.relationFromFields?.length && f.isRequired && hasTenant.has(f.type));
    if (parent) tables.push({ model: m.name, delegate, where: (tenantId) => ({ [parent.name]: { tenantId } }), columns });
  }
  return tables;
}

function cell(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s =
    v instanceof Date ? v.toISOString() : Prisma.Decimal.isDecimal(v) ? (v as Prisma.Decimal).toString() : typeof v === 'object' ? JSON.stringify(v) : String(v);
  // Quote when needed; a leading = + - @ is prefixed so spreadsheets do not run it as a formula.
  const safe = /^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** CSV with a header row (column keys, or `header` labels); UTF-8 BOM so Excel shows Urdu names correctly. */
export function toCsv(columns: string[], rows: Record<string, unknown>[], header: string[] = columns): string {
  const lines = [header.map((h) => cell(h)).join(','), ...rows.map((r) => columns.map((c) => cell(r[c])).join(','))];
  return '﻿' + lines.join('\r\n') + '\r\n';
}
