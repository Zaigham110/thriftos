import { SEE_SALES } from '../sales/sales-access';

/** Records that have an activity panel (enterprise plan E2.4), with where each opens in the app. */
export interface RecordType {
  /** Prisma model delegate name. */
  model: 'sale' | 'container' | 'customer' | 'inventoryItem' | 'rag' | 'payment' | 'vendor' | 'expense';
  /** AuditLog.entityType values written for this kind of record. */
  auditEntities: string[];
  /** Field shown as the record's name in notifications. */
  labelField: string;
  link: (id: string) => string;
  /** Who may read its activity, notes and files: one of these permissions (the same as opening the record). */
  read: readonly string[];
  /** Who may add a note or a file, when that differs from reading (an expense's receipt photo by whoever records it). */
  write?: readonly string[];
}

export const RECORD_TYPES: Record<string, RecordType> = {
  sale: { model: 'sale', auditEntities: ['Sale'], labelField: 'saleNumber', link: (id) => `/sell/records/${id}`, read: SEE_SALES },
  container: { model: 'container', auditEntities: ['Container'], labelField: 'containerNumber', link: (id) => `/receive/records/containers/${id}`, read: ['container.read'] },
  customer: { model: 'customer', auditEntities: ['Customer'], labelField: 'name', link: (id) => `/khata/records/${id}`, read: SEE_SALES },
  stockItem: { model: 'inventoryItem', auditEntities: ['InventoryItem', 'RepackUnit'], labelField: 'name', link: (id) => `/stock/items/${id}`, read: ['INVENTORY_VIEW'] },
  lot: { model: 'rag', auditEntities: ['Rag'], labelField: 'ragCode', link: (id) => `/sort/records/${id}`, read: ['rag.read', 'SORTING_STAGE1_VIEW'] },
  payment: { model: 'payment', auditEntities: ['Payment'], labelField: 'reference', link: () => '/khata/records', read: SEE_SALES },
  expense: { model: 'expense', auditEntities: ['Expense'], labelField: 'category', link: (id) => `/finance/expenses/${id}`, read: ['finance.view'], write: ['finance.view', 'expense.create'] },
  supplier: { model: 'vendor', auditEntities: ['Vendor'], labelField: 'name', link: (id) => `/receive/records/suppliers/${id}`, read: ['vendor.read'] },
};

/** What can be attached: photos, PDFs, spreadsheets and documents (≤ 10 MB). */
export const ATTACHMENT_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
  'text/csv': 'csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
};
export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
