import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { InventoryStatus, MovementType, Prisma, StockSource, StockUnit } from '@prisma/client';
import { Workbook } from 'exceljs';
import { AuditService } from '../audit/audit.service';
import { toE164 } from '../common/phone/phone';
import { costPerKg, dec, money } from '../costing/costing';
import { PrismaService } from '../prisma/prisma.service';
import { cleanText, COLUMNS, ImportKind, MAX_ROWS, norm, parseAmount, parseUnit, RawRow, readRows, rowKeys } from './import-parse';

export type RowStatus = 'new' | 'exists' | 'imported' | 'error';

/** A problem or note on a row: `code` + `params` let the app say it in Urdu; `errors`/`notes` hold the English text. */
export interface RowIssue {
  level: 'error' | 'note';
  code: string;
  params: Record<string, string | number>;
}

export interface PreviewRow {
  line: number;
  status: RowStatus;
  /** Cleaned values as they will be saved (amounts as decimal strings). */
  values: Record<string, string | null>;
  errors: string[];
  notes: string[];
  issues: RowIssue[];
}

const MESSAGES: Record<string, string> = {
  nameEmpty: 'Name is empty',
  nameLong: 'Name is longer than 120 letters',
  phoneBad: 'Phone "{value}" is not a mobile number (e.g. 0300-1234567)',
  notAmount: '{field}: "{value}" is not an amount',
  tooLarge: '{field}: "{value}" is too large',
  belowZero: '{field} cannot be below zero',
  sameName: 'Same name as row {row}. Give each one a different name (e.g. add the city).',
  unitEmpty: 'Unit is empty: write bale, kg or piece',
  unitBad: '"{value}" is not a unit: write bale, kg or piece',
  qtyEmpty: 'Quantity is empty or zero',
  qtyWhole: 'Bales and pieces are counted in whole numbers',
  costEmpty: 'Total cost is empty (or fill "Cost per unit")',
  whatIsIt: 'Write what it is: an item name or a category',
  exists: 'Already in ThriftOS; left as it is.',
  categoryKept: 'Category "{value}" is not in your list; kept in the item name.',
  gradeKept: 'Grade "{value}" is not in your list; kept in the item name.',
  newSupplier: 'New supplier "{value}" will be added.',
};

const FIELD_LABELS: Record<string, string> = {
  openingBalance: 'Opening udhaar',
  creditLimit: 'Credit limit',
  quantity: 'Quantity',
  weightKg: 'Weight',
  totalCost: 'Total cost',
  unitCost: 'Cost per unit',
  salePrice: 'Sale price',
};

function say(row: { errors: string[]; notes: string[]; issues: RowIssue[] }, level: RowIssue['level'], code: string, params: Record<string, string | number> = {}) {
  const text = MESSAGES[code].replace(/\{(\w+)\}/g, (_, k: string) => String(k === 'field' ? FIELD_LABELS[params.field as string] ?? params.field : params[k] ?? ''));
  (level === 'error' ? row.errors : row.notes).push(text);
  row.issues.push({ level, code, params });
}

export interface Preview {
  kind: ImportKind;
  missingColumns: Array<{ en: string; ur: string }>;
  unknownHeaders: string[];
  counts: Record<RowStatus, number>;
  rows: PreviewRow[];
}

interface Planned extends PreviewRow {
  key: string;
}

export interface UploadedSheet {
  buffer: Buffer;
  originalname: string;
  size: number;
}

export const IMPORT_MAX_BYTES = 5 * 1024 * 1024;

/**
 * Brings a business's paper register or Excel sheet in (v2 6.1): customers with their opening udhaar, suppliers and
 * opening stock. Upload → preview with plain-words errors per row → confirm. Rows already brought in (same values) are
 * skipped, so uploading the same file twice adds nothing; names that already exist are left as they are.
 */
@Injectable()
export class ImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async preview(tenantId: string, kind: ImportKind, file: UploadedSheet | undefined): Promise<Preview> {
    const { rows, ...rest } = await this.plan(tenantId, kind, file);
    return { ...rest, rows: rows.map(({ key: _key, ...row }) => row) };
  }

  async commit(tenantId: string, kind: ImportKind, file: UploadedSheet | undefined, userId: string) {
    const plan = await this.plan(tenantId, kind, file);
    if (plan.missingColumns.length) throw new BadRequestException(`Columns missing: ${plan.missingColumns.map((c) => c.en).join(', ')}`);
    const todo = plan.rows.filter((r) => r.status === 'new');
    let newSuppliers = 0;
    try {
      await this.prisma.$transaction(
        async (tx) => {
          const vendorIds = new Map<string, string>();
          for (const row of todo) {
            const entityId = await this.write(tx, tenantId, kind, row.values, vendorIds, () => newSuppliers++);
            await tx.importedRow.create({ data: { tenantId, kind, rowKey: row.key, entityId, createdBy: userId } });
          }
        },
        { timeout: 120_000, maxWait: 10_000 },
      );
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('This file is being imported already, or some names were just added. Check the preview again.');
      }
      throw e;
    }
    const result = {
      added: todo.length,
      skippedExisting: plan.counts.exists,
      skippedImported: plan.counts.imported,
      skippedErrors: plan.counts.error,
      newSuppliers,
    };
    await this.audit.log({ tenantId, userId, action: 'DATA_IMPORTED', entityType: 'Import', entityId: kind, metadataJson: { kind, ...result } });
    return result;
  }

  /** An empty sheet with the headers in English and Urdu, and a help sheet with an example for each column. */
  async template(kind: ImportKind): Promise<Buffer> {
    const wb = new Workbook();
    wb.creator = 'ThriftOS';
    const name = { CUSTOMERS: 'Customers', SUPPLIERS: 'Suppliers', STOCK: 'Opening stock' }[kind];
    const sheet = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1, rightToLeft: false }] });
    const cols = COLUMNS[kind];
    sheet.columns = cols.map((c) => ({ header: `${c.en}${c.required ? ' *' : ''} / ${c.ur}`, key: c.key, width: Math.max(18, c.en.length + c.ur.length + 8) }));
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1E9EF' } };

    const help = wb.addWorksheet('Help - مدد');
    help.columns = [
      { header: 'Column / کالم', key: 'col', width: 30 },
      { header: 'Needed?', key: 'req', width: 10 },
      { header: 'Example', key: 'ex', width: 22 },
      { header: 'How to fill', key: 'help', width: 80 },
    ];
    help.getRow(1).font = { bold: true };
    for (const c of cols) help.addRow({ col: `${c.en} / ${c.ur}`, req: c.required ? 'Yes' : '', ex: c.example, help: c.help });
    help.addRow({});
    help.addRow({ col: 'Fill one row per line of your register on the first sheet. Leave the header row as it is. Blank rows are ignored.' });
    help.addRow({ col: 'Uploading the same file again adds nothing twice. Names already in ThriftOS are left as they are.' });
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  // ---------------------------------------------------------------------------------------------------------------

  private async plan(tenantId: string, kind: ImportKind, file: UploadedSheet | undefined) {
    if (!file?.buffer?.length) throw new BadRequestException('Choose an Excel (.xlsx) or CSV file');
    if (file.size > IMPORT_MAX_BYTES) throw new BadRequestException('The file is larger than 5 MB');
    if (!/\.(xlsx|csv)$/i.test(file.originalname ?? '')) throw new BadRequestException('Use an Excel (.xlsx) or CSV file');
    let read;
    try {
      read = await readRows(kind, file.buffer, file.originalname);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
    if (read.rows.length > MAX_ROWS) throw new BadRequestException(`At most ${MAX_ROWS} rows in one file; split it into smaller files`);

    const checked = read.rows.map((raw) => this.check(kind, raw));
    const keys = rowKeys(kind, checked.map((c) => c.values));
    const rows: Planned[] = checked.map((c, i) => ({ ...c, key: keys[i] }));

    const done = new Set(
      (await this.prisma.importedRow.findMany({ where: { tenantId, kind, rowKey: { in: keys } }, select: { rowKey: true } })).map((r) => r.rowKey),
    );
    const ctx = await this.context(tenantId, kind);
    const namesInFile = new Map<string, number>();
    for (const row of rows) {
      if (row.errors.length) continue;
      if (done.has(row.key)) {
        row.status = 'imported';
        continue;
      }
      if (kind === 'STOCK') {
        this.matchStock(row, ctx);
        continue;
      }
      const name = norm(row.values.name ?? '');
      const earlier = namesInFile.get(name);
      if (earlier) {
        say(row, 'error', 'sameName', { row: earlier });
      } else if (ctx.names.has(name)) {
        row.status = 'exists';
        say(row, 'note', 'exists');
      }
      namesInFile.set(name, earlier ?? row.line);
    }
    for (const row of rows) if (row.errors.length) row.status = 'error';

    const counts: Record<RowStatus, number> = { new: 0, exists: 0, imported: 0, error: 0 };
    for (const row of rows) counts[row.status]++;
    return {
      kind,
      missingColumns: read.missing.map((c) => ({ en: c.en, ur: c.ur })),
      unknownHeaders: read.unknownHeaders,
      counts,
      rows,
    };
  }

  /** Cleans one row; problems become plain-words errors on the row instead of failing the file. */
  private check(kind: ImportKind, raw: RawRow): PreviewRow {
    const row: PreviewRow = { line: raw.line, status: 'new', values: {}, errors: [], notes: [], issues: [] };
    const c = raw.cells;
    const values = row.values;
    const error = (code: string, params?: Record<string, string | number>) => say(row, 'error', code, params);
    const text = (key: string) => cleanText(c[key]) || null;
    const amount = (field: string, allowNegative = false) => {
      let value: string | null;
      try {
        value = parseAmount(c[field]);
      } catch (e) {
        error(/too large/.test((e as Error).message) ? 'tooLarge' : 'notAmount', { field, value: cleanText(c[field]) });
        return null;
      }
      if (value !== null && !allowNegative && Number(value) < 0) {
        error('belowZero', { field });
        return null;
      }
      return value;
    };

    if (kind === 'CUSTOMERS' || kind === 'SUPPLIERS') {
      values.name = text('name');
      if (!values.name) error('nameEmpty');
      else if (values.name.length > 120) error('nameLong');
      const phoneText = text('phone');
      values.phone = null;
      if (phoneText) {
        const phone = toE164(phoneText);
        if (phone) values.phone = phone;
        else if (kind === 'CUSTOMERS') error('phoneBad', { value: phoneText });
        else values.phone = phoneText;
      }
      values.notes = text('notes');
      if (kind === 'CUSTOMERS') {
        values.city = text('city');
        values.openingBalance = amount('openingBalance', true) ?? '0.00';
        values.creditLimit = amount('creditLimit');
      } else {
        values.country = text('country');
        values.contactPerson = text('contactPerson');
      }
      return row;
    }

    values.item = text('item');
    values.category = text('category');
    values.grade = text('grade');
    values.supplier = text('supplier');
    values.unit = null;
    try {
      values.unit = parseUnit(c.unit);
      if (!values.unit) error('unitEmpty');
    } catch {
      error('unitBad', { value: cleanText(c.unit) });
    }
    values.quantity = amount('quantity');
    if (values.quantity === null || Number(values.quantity) === 0) {
      if (!row.issues.some((i) => i.params.field === 'quantity')) error('qtyEmpty');
    } else if (values.unit && values.unit !== StockUnit.KG && !Number.isInteger(Number(values.quantity))) {
      error('qtyWhole');
    }
    values.weightKg = amount('weightKg');
    let total = amount('totalCost');
    const each = amount('unitCost');
    if (total === null && each !== null && values.quantity) total = money(dec(each).mul(dec(values.quantity))).toFixed(2);
    if (total === null && !row.issues.some((i) => i.params.field === 'totalCost' || i.params.field === 'unitCost')) error('costEmpty');
    values.totalCost = total;
    values.salePrice = amount('salePrice');
    if (!values.item && !values.category) error('whatIsIt');
    return row;
  }

  private async context(tenantId: string, kind: ImportKind) {
    if (kind === 'CUSTOMERS') {
      const list = await this.prisma.customer.findMany({ where: { tenantId }, select: { name: true } });
      return { names: new Set(list.map((x) => norm(x.name))), categories: new Map<string, string>(), grades: new Map<string, string>(), vendors: new Map<string, string>() };
    }
    if (kind === 'SUPPLIERS') {
      const list = await this.prisma.vendor.findMany({ where: { tenantId }, select: { name: true } });
      return { names: new Set(list.map((x) => norm(x.name))), categories: new Map<string, string>(), grades: new Map<string, string>(), vendors: new Map<string, string>() };
    }
    const [categories, grades, vendors] = await Promise.all([
      this.prisma.category.findMany({ where: { tenantId }, select: { id: true, name: true } }),
      this.prisma.grade.findMany({ where: { tenantId }, select: { id: true, name: true } }),
      this.prisma.vendor.findMany({ where: { tenantId }, select: { id: true, name: true } }),
    ]);
    const byName = (list: Array<{ id: string; name: string }>) => new Map(list.map((x) => [norm(x.name), x.id] as const));
    return { names: new Set<string>(), categories: byName(categories), grades: byName(grades), vendors: byName(vendors) };
  }

  /** Category and grade by name; anything not found is kept in the item name so nothing typed is lost. */
  private matchStock(row: Planned, ctx: Awaited<ReturnType<ImportService['context']>>) {
    const v = row.values;
    const extra: string[] = [];
    v.categoryId = null;
    v.gradeId = null;
    v.supplierId = null;
    if (v.category) {
      v.categoryId = ctx.categories.get(norm(v.category)) ?? null;
      if (!v.categoryId) {
        extra.push(v.category);
        say(row, 'note', 'categoryKept', { value: v.category });
      }
    }
    if (v.grade) {
      v.gradeId = ctx.grades.get(norm(v.grade)) ?? null;
      if (!v.gradeId) {
        extra.push(v.grade);
        say(row, 'note', 'gradeKept', { value: v.grade });
      }
    }
    if (extra.length) v.item = [v.item, ...extra].filter(Boolean).join(' ');
    if (v.supplier) {
      v.supplierId = ctx.vendors.get(norm(v.supplier)) ?? null;
      if (!v.supplierId) say(row, 'note', 'newSupplier', { value: v.supplier });
    }
  }

  private async write(
    tx: Prisma.TransactionClient,
    tenantId: string,
    kind: ImportKind,
    v: Record<string, string | null>,
    vendorIds: Map<string, string>,
    onNewSupplier: () => void,
  ): Promise<string> {
    if (kind === 'CUSTOMERS') {
      const created = await tx.customer.create({
        data: {
          tenantId,
          name: v.name!,
          phone: v.phone,
          city: v.city,
          notes: v.notes,
          openingBalance: money(v.openingBalance ?? 0),
          ...(v.creditLimit !== null ? { creditLimit: money(v.creditLimit) } : {}),
        },
      });
      return created.id;
    }
    if (kind === 'SUPPLIERS') {
      const created = await tx.vendor.create({
        data: { tenantId, name: v.name!, country: v.country, originCountry: v.country, contactPerson: v.contactPerson, contactPhone: v.phone, notes: v.notes },
      });
      return created.id;
    }

    let vendorId = v.supplierId;
    if (!vendorId && v.supplier) {
      const key = norm(v.supplier);
      vendorId = vendorIds.get(key) ?? null;
      if (!vendorId) {
        const found = await tx.vendor.findFirst({ where: { tenantId, name: { equals: v.supplier, mode: 'insensitive' } }, select: { id: true } });
        vendorId = found?.id ?? (await tx.vendor.create({ data: { tenantId, name: v.supplier } })).id;
        if (!found) onNewSupplier();
        vendorIds.set(key, vendorId);
      }
    }
    const unit = v.unit as StockUnit;
    const quantity = dec(v.quantity!);
    const totalCost = money(v.totalCost!);
    const weightKg = unit === StockUnit.KG ? quantity : v.weightKg ? dec(v.weightKg) : null;
    const item = await tx.inventoryItem.create({
      data: {
        tenantId,
        source: StockSource.PURCHASED,
        name: v.item,
        categoryId: v.categoryId,
        gradeId: v.gradeId,
        vendorId,
        unit,
        quantity,
        totalCost,
        unitCost: costPerKg(totalCost, quantity),
        salePrice: v.salePrice === null ? null : money(v.salePrice),
        weightKg,
        avgCost: weightKg && weightKg.greaterThan(0) ? money(costPerKg(totalCost, weightKg)) : null,
        pcsCount: unit === StockUnit.PIECE ? quantity.toNumber() : 0,
        status: InventoryStatus.AVAILABLE,
      },
    });
    await tx.stockMovement.create({
      data: {
        inventoryItemId: item.id,
        movementType: MovementType.INTAKE,
        quantityKg: weightKg ?? 0,
        quantityPcs: item.pcsCount,
        metadataJson: { source: StockSource.PURCHASED, reason: 'OPENING_STOCK_IMPORT', unit, quantity: quantity.toFixed(2), totalCost: totalCost.toFixed(2) },
      },
    });
    return item.id;
  }
}
