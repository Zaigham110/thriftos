import type { WsCellFormat } from '../../shared/ui/workspace';

/** One column of a workspace list: a server field, its dictionary label and how to show it. */
export interface ListColumnConfig {
  key: string;
  /** Dictionary key of the column name. */
  label: string;
  format?: WsCellFormat;
  /** Sum in the totals row (the server sends totals for summable fields). */
  total?: boolean;
  /** Worked out per page on the server: shown, never sorted. */
  computed?: boolean;
  /** Dictionary prefix for enum values, e.g. "ws.status." → "ws.status.PAID". */
  enumPrefix?: string;
  width?: string;
}

/** A quick filter shown as a picker next to search ("Status…", "Payment…"). */
export interface QuickFilterConfig {
  field: string;
  label: string;
  values: readonly string[];
  /** Dictionary prefix for the values. */
  prefix: string;
}

/** Board (kanban) view: one column per value of an enum field; dropping a card calls `move`. */
export interface BoardConfig {
  field: string;
  values: readonly string[];
  prefix: string;
  /** Card title and the lines under it (column keys). */
  title: string;
  lines: string[];
  /** PATCH body to move a record to a value (the server checks the allowed steps). */
  move: (id: string, value: string) => { url: string; body: Record<string, unknown> };
}

/** Everything a workspace list screen needs; screens are configured, not written (enterprise plan E2/E3). */
export interface ListConfig {
  /** Server list name (/api/lists/:resource) and saved-view key. */
  resource: string;
  title: string;
  /** "{n} sales" — dictionary key with {n}. */
  count: string;
  searchPlaceholder: string;
  emptyHeading: string;
  emptyMessage: string;
  columns: ListColumnConfig[];
  defaultColumns: string[];
  /** Field the date-range picker filters on (absent: no date range). */
  dateField?: string;
  groupBy: Array<{ key: string; label: string; enumPrefix?: string }>;
  quickFilters: QuickFilterConfig[];
  /** Where a row opens. */
  rowLink: (id: string) => unknown[];
  /** Primary action in the header. */
  create?: { label: string; link: string };
  board?: BoardConfig;
}
