import type { TenantModule } from '../../core/tenant/tenant.service';
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
  /** Money with paisa (prices per kg); other money columns show whole rupees. */
  exact?: boolean;
  /** Dictionary key of a note on what the column means (an "i" next to its name). */
  info?: string;
  /** Left out while every row on the page is empty (Godown before any godown exists). */
  hideIfEmpty?: boolean;
  /** 'sign': below zero shows red (a loss). */
  tone?: 'sign';
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
  /** PATCH body to move a record to a value (the server checks the allowed steps). Absent: the board only shows. */
  move?: (id: string, value: string) => { url: string; body: Record<string, unknown> };
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
  /** Shown instead when nothing is searched or filtered: the list is empty because nothing was added yet. */
  emptyNew?: { heading: string; message: string };
  /** Dictionary key of a line under the table: what this list leaves out and where it is. */
  footnote?: string;
  /** Help screen offered when the list is empty (v2 6.4), e.g. `sale` opens /help/sale. */
  help?: string;
  columns: ListColumnConfig[];
  defaultColumns: string[];
  /** Field the date-range picker filters on (absent: no date range). */
  dateField?: string;
  /** `month`: a date field grouped by month (the server sends "2026-11" keys). */
  groupBy: Array<{ key: string; label: string; enumPrefix?: string; month?: boolean }>;
  quickFilters: QuickFilterConfig[];
  /** Where a row opens (the row is there for lists whose rows point at another record). */
  rowLink: (id: string, row?: Record<string, unknown>) => unknown[];
  /** Filters a fresh list starts with (no saved view), e.g. stock that is not sold. */
  defaultFilters?: Array<{ field: string; op: 'eq' | 'ne' | 'isnull' | 'notnull'; value?: string }>;
  /** Primary action in the header. */
  create?: { label: string; link: string };
  /**
   * A one-of choice shown as a switch (Stock: In stock / Sold / All) instead of a filter chip: picks the
   * filter on `field`; the first option is the screen's default.
   */
  switch?: { field: string; label: string; options: Array<{ label: string; op?: 'eq' | 'ne' | 'isnull' | 'notnull'; value?: string }> };
  /**
   * One figure over the list (v2 review), e.g. Expenses: "Spent this month Rs …" — the sum of `field` for this
   * month, with the switch's first option (so cancelled ones never count).
   */
  headline?: { field: string; label: string };
  /** On a phone the rows show as cards (v2 review): a title, a line under it, and the amount on the right. */
  cards?: { title: string; sub: string[]; amount: string };
  /** A related page shown as a plain button before the primary action (Suppliers → Supplier scorecard). */
  related?: { label: string; link: string };
  /** Sibling lists shown as tabs over the title (Purchasing: containers, gaari / lots). */
  /** A tab whose module is off is not shown (v2 modules). */
  tabs?: Array<{ label: string; link: string; module?: TenantModule }>;
  board?: BoardConfig;
}
