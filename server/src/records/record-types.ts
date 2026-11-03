/** Records that have an activity panel (enterprise plan E2.4), with where each opens in the app. */
export interface RecordType {
  /** Prisma model delegate name. */
  model: 'sale' | 'container' | 'customer' | 'inventoryItem' | 'rag' | 'payment' | 'vendor';
  /** AuditLog.entityType values written for this kind of record. */
  auditEntities: string[];
  /** Field shown as the record's name in notifications. */
  labelField: string;
  link: (id: string) => string;
}

export const RECORD_TYPES: Record<string, RecordType> = {
  sale: { model: 'sale', auditEntities: ['Sale'], labelField: 'saleNumber', link: (id) => `/sell/records/${id}` },
  container: { model: 'container', auditEntities: ['Container'], labelField: 'containerNumber', link: (id) => `/receive/records/containers/${id}` },
  customer: { model: 'customer', auditEntities: ['Customer'], labelField: 'name', link: (id) => `/khata/${id}` },
  stockItem: { model: 'inventoryItem', auditEntities: ['InventoryItem', 'RepackUnit'], labelField: 'name', link: (id) => `/stock/items/${id}` },
  lot: { model: 'rag', auditEntities: ['Rag'], labelField: 'ragCode', link: (id) => `/receive/records/rags/${id}/edit` },
  payment: { model: 'payment', auditEntities: ['Payment'], labelField: 'reference', link: () => '/khata' },
  supplier: { model: 'vendor', auditEntities: ['Vendor'], labelField: 'name', link: (id) => `/receive/records/suppliers/${id}` },
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
