import { Component, input } from '@angular/core';
import { Download, LucideAngularModule, Printer } from 'lucide-angular';
import { TPipe } from '../../../core/i18n/t.pipe';
import type { WsColumn, WsRow } from './data-grid.component';

/** A CSV cell: quoted, and a leading = + - @ made harmless for spreadsheets. */
function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

/** Turns a report table into CSV (raw numbers, so a spreadsheet can add them up). */
export function toCsv(columns: WsColumn[], rows: WsRow[]): string {
  const head = columns.map((c) => csvCell(c.label)).join(',');
  const body = rows.map((r) => columns.map((c) => csvCell(r[c.key])).join(','));
  return '﻿' + [head, ...body].join('\r\n');
}

/**
 * Export and print for a report (enterprise plan E4.5): downloads the table as CSV with the filename given, and
 * prints the page (the workspace hides its menu and bars when printing).
 */
@Component({
  selector: 'ws-report-actions',
  standalone: true,
  imports: [LucideAngularModule, TPipe],
  template: `
    <div class="actions">
      <button type="button" class="ws-btn" (click)="download()" [disabled]="!rows().length"><lucide-icon [img]="icons.Download" [size]="16" aria-hidden="true" />{{ 'ws.report.csv' | t }}</button>
      <button type="button" class="ws-btn" (click)="print()"><lucide-icon [img]="icons.Printer" [size]="16" aria-hidden="true" />{{ 'ws.report.print' | t }}</button>
    </div>
  `,
  styles: [`.actions { display:inline-flex; gap:var(--ws-2); } @media print { .actions { display:none; } }`],
})
export class WsReportActionsComponent {
  readonly columns = input.required<WsColumn[]>();
  readonly rows = input.required<WsRow[]>();
  /** Without extension, e.g. "thriftos-sales-by-customer". */
  readonly filename = input.required<string>();
  protected readonly icons = { Download, Printer };

  protected download(): void {
    const blob = new Blob([toCsv(this.columns(), this.rows())], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.filename()}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  protected print(): void {
    window.print();
  }
}
