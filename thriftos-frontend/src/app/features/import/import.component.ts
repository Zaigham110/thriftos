import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CheckCircle2, Download, FileUp, LucideAngularModule, TriangleAlert } from 'lucide-angular';
import { I18nService } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { WsPageHeaderComponent, WsTab, WsTabsComponent } from '../../shared/ui/workspace';

type Kind = 'customers' | 'suppliers' | 'stock';
type Status = 'new' | 'exists' | 'imported' | 'error';

interface Issue {
  level: 'error' | 'note';
  code: string;
  params: Record<string, string | number>;
}
interface Row {
  line: number;
  status: Status;
  values: Record<string, string | null>;
  errors: string[];
  notes: string[];
  issues: Issue[];
}
interface Preview {
  missingColumns: Array<{ en: string; ur: string }>;
  unknownHeaders: string[];
  counts: Record<Status, number>;
  rows: Row[];
}
interface Result {
  added: number;
  skippedExisting: number;
  skippedImported: number;
  skippedErrors: number;
  newSuppliers: number;
}

/** Columns shown in the preview for each kind; money columns are formatted as rupees. */
const SHOWN: Record<Kind, Array<{ key: string; money?: boolean; unit?: boolean }>> = {
  customers: [{ key: 'name' }, { key: 'phone' }, { key: 'city' }, { key: 'openingBalance', money: true }],
  suppliers: [{ key: 'name' }, { key: 'country' }, { key: 'contactPerson' }, { key: 'phone' }],
  stock: [{ key: 'item' }, { key: 'quantity' }, { key: 'unit', unit: true }, { key: 'totalCost', money: true }, { key: 'salePrice', money: true }, { key: 'supplier' }],
};

const LIST_LINK: Record<Kind, string> = { customers: '/khata', suppliers: '/receive/records/suppliers', stock: '/stock' };
const UNIT_KEY: Record<string, string> = { BALE: 'unit.bale', KG: 'unit.kgShort', PIECE: 'unit.piece' };

/**
 * Bring a business's old register in (v2 6.1): download the sheet, fill it (or use your own), upload, check every row
 * with plain-words problems, then add. The same file twice adds nothing.
 */
@Component({
  selector: 'app-import',
  standalone: true,
  imports: [RouterLink, LucideAngularModule, TPipe, WsPageHeaderComponent, WsTabsComponent],
  template: `
    <div class="page">
      <ws-page-header [heading]="'import.title' | t" [subtitle]="'import.subtitle' | t" />
      <ws-tabs [tabs]="tabs()" [active]="kind()" (activeChange)="switchTo($any($event))" [label]="'import.title' | t" />

      <section class="step" [attr.aria-labelledby]="'s1'">
        <div>
          <h2 id="s1">{{ 'import.step1' | t }}</h2>
          <p>{{ 'import.step1Hint' | t }}</p>
        </div>
        <button type="button" class="ws-btn" (click)="downloadTemplate()" [disabled]="busy()"><lucide-icon [img]="icons.Download" [size]="16" aria-hidden="true" />{{ 'import.download' | t }}</button>
      </section>

      <section class="step" [attr.aria-labelledby]="'s2'">
        <div>
          <h2 id="s2">{{ 'import.step2' | t }}</h2>
          <p>{{ 'import.step2Hint' | t }}</p>
        </div>
        <label class="ws-btn primary file">
          <lucide-icon [img]="icons.FileUp" [size]="16" aria-hidden="true" />{{ (busy() === 'reading' ? 'import.reading' : 'import.choose') | t }}
          <input #picker type="file" accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" (change)="choose(picker.files?.[0]); picker.value = ''" [disabled]="!!busy()" />
        </label>
      </section>

      @if (message(); as m) {
        <p class="banner" [class.bad]="m.bad" role="status">
          <lucide-icon [img]="m.bad ? icons.TriangleAlert : icons.CheckCircle2" [size]="18" aria-hidden="true" />
          <span>{{ m.text }}</span>
          @if (!m.bad && result()) { <a [routerLink]="listLink()">{{ 'import.open' | t }}</a> }
        </p>
      }

      @if (preview(); as p) {
        <section class="step result" aria-labelledby="s3">
          <h2 id="s3">{{ 'import.step3' | t }} · <span class="file">{{ fileName() }}</span></h2>
          @if (p.missingColumns.length) {
            <p class="banner bad" role="alert"><lucide-icon [img]="icons.TriangleAlert" [size]="18" aria-hidden="true" />{{ 'import.missing' | t: { cols: missingText() } }}</p>
          }
          @if (p.unknownHeaders.length) { <p class="muted">{{ 'import.unknown' | t: { cols: p.unknownHeaders.join(', ') } }}</p> }
          <div class="counts">
            @for (s of statuses; track s) {
              @if (p.counts[s]) { <span class="pill" [attr.data-s]="s">{{ 'import.count.' + s | t: { n: p.counts[s] } }}</span> }
            }
            <span class="grow"></span>
            @if (p.counts.error) {
              <label class="toggle"><input type="checkbox" [checked]="onlyProblems()" (change)="onlyProblems.set(!onlyProblems())" />{{ 'import.onlyProblems' | t }}</label>
            }
          </div>
          @if (p.counts.error) { <p class="muted">{{ 'import.fixHint' | t }}</p> }
          <div class="table-wrap">
            <table>
              <caption class="sr-only">{{ 'import.step3' | t }}</caption>
              <thead>
                <tr>
                  <th scope="col" class="num">{{ 'import.col.line' | t }}</th>
                  <th scope="col">{{ 'import.col.status' | t }}</th>
                  @for (c of columns(); track c.key) { <th scope="col" [class.num]="c.money">{{ 'import.field.' + c.key | t }}</th> }
                  <th scope="col">{{ 'import.col.problem' | t }}</th>
                </tr>
              </thead>
              <tbody>
                @for (r of shownRows(); track r.line) {
                  <tr [attr.data-s]="r.status">
                    <td class="num">{{ r.line }}</td>
                    <td><span class="pill" [attr.data-s]="r.status">{{ 'import.status.' + r.status | t }}</span></td>
                    @for (c of columns(); track c.key) { <td [class.num]="c.money"><bdi [attr.dir]="c.key === 'phone' || c.money ? 'ltr' : null">{{ cell(r, c) }}</bdi></td> }
                    <td class="issues">
                      @for (i of r.issues; track $index) { <div [class.err]="i.level === 'error'">{{ issue(i) }}</div> }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <div class="actions">
            <button type="button" class="ws-btn" (click)="reset()" [disabled]="!!busy()">{{ 'import.another' | t }}</button>
            <button type="button" class="ws-btn primary" (click)="commit()" [disabled]="!!busy() || !p.counts.new || p.missingColumns.length > 0">
              {{ (busy() === 'adding' ? 'import.adding' : 'import.add') | t: { n: p.counts.new } }}
            </button>
          </div>
        </section>
      }
    </div>
  `,
  styles: [`
    .page { display:grid; grid-template-columns:minmax(0,1fr); gap:var(--ws-4); max-width:var(--ws-content-max); margin-inline:auto; font-family:var(--ws-font); color:var(--ws-ink); }
    .step { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:var(--ws-3); padding:var(--ws-4); border:1px solid var(--ws-line); border-radius:var(--ws-r-lg); background:var(--ws-surface); }
    .step.result { display:grid; grid-template-columns:minmax(0,1fr); justify-content:stretch; align-items:start; }
    h2 { margin:0 0 2px; font-size:var(--ws-text-md); font-weight:600; }
    p { margin:0; color:var(--ws-ink-2); font-size:var(--ws-text-sm); }
    .file input { position:absolute; width:1px; height:1px; opacity:0; }
    .file { position:relative; cursor:pointer; }
    .file:focus-within { outline:2px solid var(--ws-brand); outline-offset:2px; }
    .file span, h2 .file { font-weight:400; color:var(--ws-ink-2); }
    .banner { display:flex; align-items:center; gap:var(--ws-2); padding:var(--ws-3); border-radius:var(--ws-r-md); background:var(--ws-good-soft, #dcfce7); color:var(--ws-ink); font-size:var(--ws-text-sm); }
    .banner lucide-icon { color:var(--ws-good); flex:none; }
    .banner.bad { background:var(--ws-bad-soft); }
    .banner.bad lucide-icon { color:var(--ws-bad); }
    .banner a { margin-inline-start:auto; color:var(--ws-brand); font-weight:600; }
    .muted { color:var(--ws-ink-3); }
    .counts { display:flex; flex-wrap:wrap; align-items:center; gap:var(--ws-2); }
    .grow { flex:1; }
    .pill { display:inline-block; padding:2px 10px; border-radius:999px; background:var(--ws-surface-2); color:var(--ws-ink-2); font-size:var(--ws-text-xs); font-weight:600; white-space:nowrap; }
    .pill[data-s='new'] { background:var(--ws-good-soft, #dcfce7); color:var(--ws-good); }
    .pill[data-s='error'] { background:var(--ws-bad-soft); color:var(--ws-bad); }
    .toggle { display:inline-flex; align-items:center; gap:6px; font-size:var(--ws-text-sm); cursor:pointer; }
    .table-wrap { overflow:auto; max-height:60vh; border:1px solid var(--ws-line); border-radius:var(--ws-r-md); }
    table { width:100%; border-collapse:collapse; font-size:var(--ws-text-sm); }
    th, td { padding:var(--ws-2); border-bottom:1px solid var(--ws-line); text-align:start; vertical-align:top; }
    th { position:sticky; top:0; background:var(--ws-surface-2); color:var(--ws-ink-2); font-size:var(--ws-text-xs); font-weight:600; text-transform:uppercase; letter-spacing:.03em; white-space:nowrap; }
    .num { text-align:end; font-variant-numeric:tabular-nums; }
    tr[data-s='error'] { background:color-mix(in srgb, var(--ws-bad-soft) 45%, transparent); }
    tr[data-s='exists'] td, tr[data-s='imported'] td { color:var(--ws-ink-3); }
    .issues { min-width:240px; color:var(--ws-ink-2); }
    .issues .err { color:var(--ws-bad); font-weight:500; }
    .actions { display:flex; justify-content:flex-end; gap:var(--ws-2); flex-wrap:wrap; }
    .sr-only { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); }
  `],
})
export class ImportComponent {
  private readonly http = inject(HttpClient);
  private readonly i18n = inject(I18nService);
  protected readonly icons = { CheckCircle2, Download, FileUp, TriangleAlert };
  protected readonly statuses: Status[] = ['new', 'exists', 'imported', 'error'];

  protected readonly kind = signal<Kind>('customers');
  protected readonly file = signal<File | null>(null);
  protected readonly preview = signal<Preview | null>(null);
  protected readonly result = signal<Result | null>(null);
  protected readonly busy = signal<'' | 'reading' | 'adding' | 'template'>('');
  protected readonly onlyProblems = signal(false);
  protected readonly message = signal<{ text: string; bad: boolean } | null>(null);

  protected readonly tabs = computed<WsTab[]>(() =>
    (['customers', 'suppliers', 'stock'] as Kind[]).map((id) => ({ id, label: this.i18n.t(`import.tab.${id}`) })),
  );
  protected readonly columns = computed(() => SHOWN[this.kind()]);
  protected readonly listLink = computed(() => LIST_LINK[this.kind()]);
  protected readonly fileName = computed(() => this.file()?.name ?? '');
  protected readonly shownRows = computed(() => {
    const rows = this.preview()?.rows ?? [];
    return this.onlyProblems() ? rows.filter((r) => r.status === 'error') : rows;
  });
  protected readonly missingText = computed(() =>
    (this.preview()?.missingColumns ?? []).map((c) => (this.i18n.lang() === 'ur' ? c.ur : c.en)).join(', '),
  );

  protected switchTo(kind: Kind): void {
    if (kind === this.kind()) return;
    this.kind.set(kind);
    this.reset();
  }

  protected reset(): void {
    this.file.set(null);
    this.preview.set(null);
    this.result.set(null);
    this.message.set(null);
    this.onlyProblems.set(false);
  }

  protected downloadTemplate(): void {
    this.busy.set('template');
    this.http.get(`/api/import/${this.kind()}/template`, { observe: 'response', responseType: 'blob' }).subscribe({
      next: (res) => {
        this.busy.set('');
        const name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? 'thriftos-import.xlsx';
        const url = URL.createObjectURL(res.body!);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
      },
      error: (e) => this.fail(e),
    });
  }

  protected choose(file: File | undefined): void {
    if (!file) return;
    this.reset();
    this.file.set(file);
    this.busy.set('reading');
    this.http.post<Preview>(`/api/import/${this.kind()}/preview`, this.form(file)).subscribe({
      next: (p) => {
        this.busy.set('');
        this.preview.set(p);
        this.onlyProblems.set(p.counts.error > 0 && p.counts.error < p.rows.length && p.rows.length > 20);
        if (!p.rows.length) this.message.set({ text: this.i18n.t('import.nothing'), bad: true });
      },
      error: (e) => this.fail(e),
    });
  }

  protected commit(): void {
    const file = this.file();
    if (!file) return;
    this.busy.set('adding');
    this.http.post<Result>(`/api/import/${this.kind()}/commit`, this.form(file)).subscribe({
      next: (r) => {
        this.busy.set('');
        this.preview.set(null);
        this.result.set(r);
        const skipped = r.skippedErrors + r.skippedExisting + r.skippedImported;
        let text = this.i18n.t('import.done', { n: r.added, skipped });
        if (r.newSuppliers) text += ' ' + this.i18n.t('import.doneSuppliers', { n: r.newSuppliers });
        this.message.set({ text, bad: false });
      },
      error: (e) => this.fail(e),
    });
  }

  protected cell(row: Row, col: { key: string; money?: boolean; unit?: boolean }): string {
    const v = row.values[col.key];
    if (v === null || v === undefined || v === '') return '';
    if (col.money) return this.i18n.money(v);
    if (col.unit) return UNIT_KEY[v] ? this.i18n.t(UNIT_KEY[v]) : v;
    if (col.key === 'quantity') return this.i18n.num(v, 2).replace(/\.00$/, '');
    return v;
  }

  /** The row's problem in the app's language; the field name inside it is translated too. */
  protected issue(i: Issue): string {
    const params = { ...i.params };
    if (typeof params['field'] === 'string') params['field'] = this.i18n.t(`import.field.${params['field']}`);
    // What the person typed stays left-to-right inside an Urdu sentence (phone numbers, amounts).
    if (typeof params['value'] === 'string') params['value'] = '\u2066' + params['value'] + '\u2069';
    return this.i18n.t(`import.err.${i.code}`, params);
  }

  private form(file: File): FormData {
    const data = new FormData();
    data.append('file', file, file.name);
    return data;
  }

  private fail(e: { status?: number; error?: { message?: string | string[] } }): void {
    this.busy.set('');
    const msg = e?.error?.message;
    const text =
      e?.status === 403 ? this.i18n.t('import.notAllowed') : e?.status === 400 && msg ? (Array.isArray(msg) ? msg.join(', ') : msg) : this.i18n.t('common.couldNotLoad');
    this.message.set({ text, bad: true });
  }
}
