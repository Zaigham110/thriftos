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

/**
 * What each file is called (v2 review: the files were named after database tables, "Rag.csv", "Vendor.csv").
 * A table not listed here is named after itself in words ("Repack input allocation").
 */
const FILE_NAMES: Record<string, string> = {
  Tenant: 'Business', Customer: 'Customers', Vendor: 'Suppliers', Rag: 'Lots', Container: 'Containers', ContainerCharge: 'Container charges',
  LotCharge: 'Lot charges', PurchaseOrder: 'Purchase orders', Sale: 'Sales', SaleLine: 'Sale lines', Payment: 'Customer payments',
  PaymentPromise: 'Payment promises', SupplierPayment: 'Supplier payments', Expense: 'Expenses', CashClose: 'Cash closes', CashMove: 'Cash moves',
  Category: 'Categories', Grade: 'Grades', RawCategory: 'Raw types', WasteCategory: 'Waste types', Warehouse: 'Godowns',
  InventoryItem: 'Stock items', RepackUnit: 'Bales', BaleKind: 'Bale codes', QRLabel: 'Bale stickers', StockMovement: 'Stock movements',
  StockAdjustment: 'Stock counts', SortSession: 'Sorting sessions', CategoryOutput: 'Sorted output', PriceListEntry: 'Price lists',
  User: 'People', Role: 'Roles', UserRole: 'People and roles', RolePermission: 'Role permissions', AuditLog: 'Activity log',
  Worker: 'Workers', WorkerAdvance: 'Worker advances', PaySheet: 'Pay sheets', PaySheetLine: 'Pay sheet lines', LabourCost: 'Labour cost',
  SubscriptionPayment: 'Plan payments', Attachment: 'Attached files (list)', RecordNote: 'Notes',
};
export const fileName = (model: string): string => FILE_NAMES[model] ?? model.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^(.)(.*)$/, (_m, a: string, b: string) => a + b.toLowerCase());

/**
 * Id columns that get a readable column beside them (v2 review: Sale.csv showed a customer id, not a name):
 * the id column → the table it points to, the field that names a row there, and what the new column is called.
 */
export const NAMED_IDS: Record<string, { model: string; field: string; column: string }> = {
  customerId: { model: 'Customer', field: 'name', column: 'customer' },
  vendorId: { model: 'Vendor', field: 'name', column: 'supplier' },
  categoryId: { model: 'Category', field: 'name', column: 'category' },
  gradeId: { model: 'Grade', field: 'name', column: 'grade' },
  rawCategoryId: { model: 'RawCategory', field: 'name', column: 'rawType' },
  wasteCategoryId: { model: 'WasteCategory', field: 'name', column: 'wasteType' },
  warehouseId: { model: 'Warehouse', field: 'name', column: 'godown' },
  saleId: { model: 'Sale', field: 'saleNumber', column: 'sale' },
  ragId: { model: 'Rag', field: 'ragCode', column: 'lot' },
  ragBaleId: { model: 'Rag', field: 'ragCode', column: 'lot' },
  containerId: { model: 'Container', field: 'containerNumber', column: 'container' },
  repackUnitId: { model: 'RepackUnit', field: 'unitCode', column: 'baleNumber' },
  baleKindId: { model: 'BaleKind', field: 'code', column: 'baleCode' },
  workerId: { model: 'Worker', field: 'name', column: 'worker' },
  roleId: { model: 'Role', field: 'name', column: 'role' },
  userId: { model: 'User', field: 'name', column: 'person' },
  createdBy: { model: 'User', field: 'name', column: 'createdByName' },
  receivedBy: { model: 'User', field: 'name', column: 'receivedByName' },
  requestedBy: { model: 'User', field: 'name', column: 'requestedByName' },
  decidedBy: { model: 'User', field: 'name', column: 'decidedByName' },
  cancelledBy: { model: 'User', field: 'name', column: 'cancelledByName' },
};

/**
 * Adds the readable columns: each named id column is followed by the name it stands for. `lookups` maps a table
 * to its rows' names by id (built from the same export, so only this business's rows).
 */
export function withNames(columns: string[], rows: Record<string, unknown>[], lookups: Map<string, Map<string, string>>): { columns: string[]; rows: Record<string, unknown>[] } {
  const named = columns.filter((c) => NAMED_IDS[c] && lookups.has(NAMED_IDS[c].model) && !columns.includes(NAMED_IDS[c].column));
  if (!named.length) return { columns, rows };
  const out = columns.flatMap((c) => (named.includes(c) ? [c, NAMED_IDS[c].column] : [c]));
  return {
    columns: out,
    rows: rows.map((r) => {
      const copy = { ...r };
      for (const c of named) copy[NAMED_IDS[c].column] = lookups.get(NAMED_IDS[c].model)!.get(String(r[c] ?? '')) ?? null;
      return copy;
    }),
  };
}

function cell(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s =
    v instanceof Date ? v.toISOString() : Prisma.Decimal.isDecimal(v) ? (v as Prisma.Decimal).toString() : typeof v === 'object' ? JSON.stringify(v) : String(v);
  // Quote when needed; a leading = + - @ is prefixed so spreadsheets do not run it as a formula.
  // A phone number (+923001234567) is not a formula: it stays as written (v2 review: it came out as '+92…).
  const safe = /^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s) && !/^\+\d[\d ]*$/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** CSV with a header row (column keys, or `header` labels); UTF-8 BOM so Excel shows Urdu names correctly. */
export function toCsv(columns: string[], rows: Record<string, unknown>[], header: string[] = columns): string {
  const lines = [header.map((h) => cell(h)).join(','), ...rows.map((r) => columns.map((c) => cell(r[c])).join(','))];
  return '﻿' + lines.join('\r\n') + '\r\n';
}
