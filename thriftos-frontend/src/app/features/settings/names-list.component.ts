import { moduleOn } from '../../core/tenant/module-on';
import type { TenantModule } from '../../core/tenant/tenant.service';
import { NgTemplateOutlet } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Observable, forkJoin } from 'rxjs';
import { AuthService } from '../../core/auth';
import { API_BASE_URL } from '../../core/config/api.config';
import { I18nService } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { ToastService } from '../../shared/floor/toast.service';
import { WsPageHeaderComponent, WsStateComponent } from '../../shared/ui/workspace';

type Row = Record<string, unknown> & { id: string; name: string; isActive?: boolean; isDefault?: boolean; isSystemGenerated?: boolean };
interface Extra { key: string; type: 'number' | 'text' | 'select'; options?: string[]; label: string; optionPrefix?: string }
export type NamesKind = 'categories' | 'grades' | 'raw' | 'waste' | 'warehouses';

/** Each list: where it lives on the server, what else it keeps besides the name, and who may change it. */
interface Kind {
  url: string; update: 'patch' | 'put'; remove: 'off' | 'delete'; extras: Extra[];
  create: string; edit: string; order?: (a: Row, b: Row) => number;
  /** Adding more needs this module (v2 modules: a second godown is "More than one godown"). */
  module?: TenantModule;
  body: (name: string, extra: Record<string, unknown>, rows: Row[]) => Record<string, unknown>;
}
const num = (v: unknown) => (v === '' || v === null || v === undefined ? null : Number(v));
/** A short code for a godown from its name ("Shershah godown" → "SHERSHAH"), the server wants one. */
const codeOf = (name: string, rows: Row[]) => {
  const base = name.toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 8) || 'GODOWN';
  let code = base;
  for (let i = 2; rows.some((r) => r['code'] === code); i++) code = `${base.slice(0, 6)}${i}`;
  return code;
};

const KINDS: Record<NamesKind, Kind> = {
  categories: {
    url: '/admin/categories', update: 'patch', remove: 'off', create: 'category.create', edit: 'category.update',
    extras: [{ key: 'baleWeightKg', type: 'number', label: 'ws.names.baleKg'}],
    order: (a, b) => Number(a['sortOrder'] ?? 0) - Number(b['sortOrder'] ?? 0),
    body: (name, x, rows) => ({ name, sortOrder: rows.length, baleWeightKg: num(x['baleWeightKg']) }),
  },
  grades: {
    url: '/admin/grades', update: 'patch', remove: 'off', create: 'grade.create', edit: 'grade.update', extras: [],
    order: (a, b) => Number(a['rank'] ?? 0) - Number(b['rank'] ?? 0),
    body: (name, _x, rows) => ({ name, rank: Math.max(0, ...rows.map((r) => Number(r['rank'] ?? 0))) + 1 }),
  },
  raw: {
    url: '/tenant/raw-categories', update: 'put', remove: 'delete', create: 'category.create', edit: 'category.update',
    extras: [{ key: 'rawType', type: 'select', options: ['BALE', 'RAG', 'BOTH'], optionPrefix: 'ws.names.rawType.', label: 'ws.names.comesAs' }],
    order: (a, b) => Number(a['sortOrder'] ?? 0) - Number(b['sortOrder'] ?? 0),
    body: (name, x, rows) => ({ name, rawType: x['rawType'] || 'BALE', sortOrder: rows.length }),
  },
  waste: {
    url: '/admin/waste-categories', update: 'patch', remove: 'off', create: 'category.create', edit: 'category.update',
    extras: [
      { key: 'unitType', type: 'select', options: ['KG', 'PCS'], optionPrefix: 'ws.names.unit.', label: 'ws.names.soldBy' },
      { key: 'defaultResalePrice', type: 'number', label: 'ws.names.resalePrice'},
    ],
    body: (name, x) => ({ name, unitType: x['unitType'] || 'KG', defaultResalePrice: num(x['defaultResalePrice']) ?? 0 }),
  },
  warehouses: {
    url: '/admin/warehouses', update: 'patch', remove: 'off', create: 'warehouse.create', edit: 'warehouse.update', module: 'WAREHOUSES',
    extras: [{ key: 'location', type: 'text', label: 'ws.names.location' }],
    body: (name, x, rows) => ({ name, code: codeOf(name, rows), ...(x['location'] ? { location: String(x['location']).trim() } : {}) }),
  },
};

/**
 * Settings → Advanced lists (v2 review): categories, grades, what comes in, waste and godowns on one simple,
 * translated page each instead of the old English dashboards. Add a name (and the one or two things it keeps),
 * rename, turn off (or remove) and turn back on. Turned-off ones are listed apart and are not offered anywhere.
 */
@Component({
  selector: 'app-names-list',
  standalone: true,
  imports: [FormsModule, NgTemplateOutlet, TPipe, WsPageHeaderComponent, WsStateComponent],
  template: `
    <div class="page">
      <ws-page-header [heading]="'ws.names.' + kindKey() + '.title' | t" [subtitle]="'ws.names.' + kindKey() + '.hint' | t" />
      @if (canCreate()) {
        <form class="add" (ngSubmit)="add()">
          <label>{{ 'ws.names.name' | t }}<input name="newName" [(ngModel)]="newName" maxlength="80" [placeholder]="'ws.names.' + kindKey() + '.placeholder' | t" /></label>
          @for (x of kind().extras; track x.key) {
            <label>{{ x.label | t }}
              @if (x.type === 'select') {
                <select [name]="'new-' + x.key" [(ngModel)]="newExtra[x.key]">
                  @for (o of x.options; track o) { <option [ngValue]="o">{{ x.optionPrefix + o | t }}</option> }
                </select>
              } @else {
                <input [name]="'new-' + x.key" [type]="x.type === 'number' ? 'number' : 'text'" [inputMode]="x.type === 'number' ? 'decimal' : 'text'" min="0" [(ngModel)]="newExtra[x.key]" />
              }
            </label>
          }
          <button type="submit" class="ws-btn ws-btn-primary" [disabled]="!newName.trim() || busy()">{{ 'ws.names.add' | t }}</button>
        </form>
      }
      @if (failed()) {
        <ws-state kind="error" [heading]="'common.couldNotLoad' | t" (retry)="load()" />
      } @else if (loaded()) {
        <ul class="rows">
          @for (r of active(); track r.id) { <ng-container [ngTemplateOutlet]="row" [ngTemplateOutletContext]="{ $implicit: r }" /> }
          @if (!active().length) { <li class="empty">{{ 'ws.names.empty' | t }}</li> }
        </ul>
        @if (off().length) {
          <h2>{{ 'ws.names.offTitle' | t }}</h2>
          <ul class="rows off">
            @for (r of off(); track r.id) { <ng-container [ngTemplateOutlet]="row" [ngTemplateOutletContext]="{ $implicit: r }" /> }
          </ul>
        }
      } @else {
        <ws-state kind="loading" />
      }
    </div>

    <ng-template #row let-r>
      <li>
        @if (editing() === r.id) {
          <form class="edit" (ngSubmit)="save(r)">
            <label>{{ 'ws.names.name' | t }}<input name="eName" [(ngModel)]="eName" maxlength="80" [disabled]="!!r.isSystemGenerated" /></label>
            @for (x of kind().extras; track x.key) {
              <label>{{ x.label | t }}
                @if (x.type === 'select') {
                  <select [name]="'e-' + x.key" [(ngModel)]="eExtra[x.key]">
                    @for (o of x.options; track o) { <option [ngValue]="o">{{ x.optionPrefix + o | t }}</option> }
                  </select>
                } @else {
                  <input [name]="'e-' + x.key" [type]="x.type === 'number' ? 'number' : 'text'" min="0" [(ngModel)]="eExtra[x.key]" />
                }
              </label>
            }
            <span class="btns">
              <button type="button" class="ws-btn" (click)="editing.set(null)">{{ 'common.cancel' | t }}</button>
              <button type="submit" class="ws-btn ws-btn-primary" [disabled]="!eName.trim() || busy()">{{ 'common.save' | t }}</button>
            </span>
          </form>
        } @else {
          <span class="what">
            <strong>{{ r.name }}@if (r.isDefault) { <small class="badge">{{ 'ws.names.main' | t }}</small> }</strong>
            @if (details(r); as d) { <small>{{ d }}</small> }
          </span>
          @if (canEdit()) {
            <span class="btns">
              @if (r.isActive !== false) {
                @if (kind().order && canMove(r, -1)) { <button type="button" class="ws-btn" [disabled]="busy()" [attr.aria-label]="('ws.names.moveUp' | t) + ': ' + r.name" [title]="'ws.names.moveUp' | t" (click)="move(r, -1)">↑</button> }
                @if (kind().order && canMove(r, 1)) { <button type="button" class="ws-btn" [disabled]="busy()" [attr.aria-label]="('ws.names.moveDown' | t) + ': ' + r.name" [title]="'ws.names.moveDown' | t" (click)="move(r, 1)">↓</button> }
                <button type="button" class="ws-btn" (click)="edit(r)">{{ 'ws.names.change' | t }}</button>
                @if (kindKey() === 'warehouses' && !r.isDefault) { <button type="button" class="ws-btn" (click)="makeMain(r)">{{ 'ws.names.makeMain' | t }}</button> }
                @if (canTurnOff(r)) { <button type="button" class="ws-btn" (click)="turnOff(r)">{{ (kind().remove === 'delete' ? 'ws.names.remove' : 'ws.names.turnOff') | t }}</button> }
              } @else {
                <button type="button" class="ws-btn" (click)="turnOn(r)">{{ 'ws.names.turnOn' | t }}</button>
              }
            </span>
          }
        }
      </li>
    </ng-template>
  `,
  styles: [`
    .page { display:grid; gap:var(--ws-4); max-width:860px; margin-inline:auto; font-family:var(--ws-font); color:var(--ws-ink); }
    form.add, form.edit { display:flex; flex-wrap:wrap; align-items:flex-end; gap:var(--ws-3); }
    form.add { padding:var(--ws-4); border:1px solid var(--ws-line); border-radius:var(--ws-r-lg); background:var(--ws-surface); }
    label { display:grid; gap:4px; flex:1 1 160px; color:var(--ws-ink-2); font-size:var(--ws-text-sm); }
    input, select { height:var(--ws-control-h); padding-inline:var(--ws-2); border:1px solid var(--ws-line); border-radius:var(--ws-r-md); background:var(--ws-surface); color:var(--ws-ink); font:inherit; min-width:0; }
    .rows { list-style:none; margin:0; padding:0; border:1px solid var(--ws-line); border-radius:var(--ws-r-lg); background:var(--ws-surface); overflow:hidden; }
    .rows li { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:var(--ws-2) var(--ws-3); padding:var(--ws-3) var(--ws-4); }
    .rows li + li { border-top:1px solid var(--ws-line); }
    .rows li form.edit { flex:1 1 100%; }
    .rows.off .what strong { color:var(--ws-ink-2); }
    .what { display:grid; gap:2px; min-width:0; }
    .what small { color:var(--ws-ink-2); font-size:var(--ws-text-sm); }
    .badge { display:inline-block; margin-inline-start:var(--ws-2); padding:0 6px; border-radius:999px; background:var(--ws-brand-soft); color:var(--ws-brand); font-size:var(--ws-text-xs); font-weight:600; }
    .btns { display:flex; flex-wrap:wrap; gap:var(--ws-2); }
    .empty { color:var(--ws-ink-2); }
    h2 { margin:0; color:var(--ws-ink-2); font-size:var(--ws-text-sm); font-weight:600; }
  `],
})
export class NamesListComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);
  protected readonly kindKey = signal<NamesKind>((inject(ActivatedRoute).snapshot.data['kind'] as NamesKind) ?? 'categories');
  protected readonly kind = computed(() => KINDS[this.kindKey()]);
  protected readonly rows = signal<Row[]>([]);
  protected readonly loaded = signal(false);
  protected readonly failed = signal(false);
  protected readonly busy = signal(false);
  protected readonly editing = signal<string | null>(null);
  protected readonly active = computed(() => this.sorted().filter((r) => r.isActive !== false));
  protected readonly off = computed(() => this.sorted().filter((r) => r.isActive === false));
  private readonly on = moduleOn();
  protected readonly canCreate = computed(() => this.auth.hasPermission(this.kind().create) && (!this.kind().module || this.on(this.kind().module!)));
  protected readonly canEdit = computed(() => this.auth.hasPermission(this.kind().edit));
  protected newName = '';
  protected newExtra: Record<string, unknown> = {};
  protected eName = '';
  protected eExtra: Record<string, unknown> = {};

  private readonly sorted = computed(() => {
    const order = this.kind().order;
    return order ? [...this.rows()].sort(order) : [...this.rows()].sort((a, b) => a.name.localeCompare(b.name));
  });

  ngOnInit(): void {
    this.resetNew();
    this.load();
  }

  /** "Bale · about 45 kg" — what else the row keeps, in words. */
  protected details(r: Row): string {
    return this.kind().extras
      .map((x) => {
        const v = r[x.key];
        if (v === null || v === undefined || v === '') return '';
        if (x.type === 'select') return this.i18n.t(`${x.optionPrefix}${v}`);
        if (x.key === 'defaultResalePrice') return `${this.i18n.t(x.label)}: ${this.i18n.money(v as string)}`;
        if (x.key === 'baleWeightKg') return this.i18n.t('ws.names.aboutKg', { kg: this.i18n.num(v as string) });
        return String(v);
      })
      .filter(Boolean)
      .join(' · ');
  }

  protected add(): void {
    const name = this.newName.trim();
    this.run(this.http.post(this.url(), this.kind().body(name, this.newExtra, this.rows())), () => {
      this.toast.show(this.i18n.t('ws.names.added', { name }));
      this.newName = '';
      this.resetNew();
    });
  }

  protected edit(r: Row): void {
    this.eName = r.name;
    this.eExtra = Object.fromEntries(this.kind().extras.map((x) => [x.key, r[x.key] ?? null]));
    this.editing.set(r.id);
  }

  protected save(r: Row): void {
    const extras = Object.fromEntries(this.kind().extras.map((x) => [x.key, x.type === 'number' ? num(this.eExtra[x.key]) : this.eExtra[x.key]]));
    const body: Record<string, unknown> = { ...(r.isSystemGenerated ? {} : { name: this.eName.trim() }), ...extras };
    if (this.kindKey() === 'waste' && body['defaultResalePrice'] === null) body['defaultResalePrice'] = 0;
    this.run(this.http.request(this.kind().update.toUpperCase(), `${this.url()}/${r.id}`, { body }), () => {
      this.editing.set(null);
      this.toast.show(this.i18n.t('ws.names.saved'));
    });
  }

  /**
   * A waste type made with a category can be turned off too (v2 review: nine of them could not), as long as one
   * waste type stays on; anything else that is not the main one or system-made can be turned off or removed.
   */
  protected canTurnOff(r: Row): boolean {
    if (r.isDefault) return false;
    if (this.kindKey() === 'waste') return this.rows().filter((x) => x.isActive !== false).length > 1;
    return !r.isSystemGenerated;
  }

  /** The rows that are on, in their order: what the arrows move within. */
  private ordered(): Row[] {
    const order = this.kind().order!;
    return this.rows().filter((x) => x.isActive !== false).sort(order);
  }
  protected canMove(r: Row, by: -1 | 1): boolean {
    const list = this.ordered();
    const i = list.findIndex((x) => x.id === r.id);
    return i >= 0 && i + by >= 0 && i + by < list.length;
  }
  /**
   * Moves a name up or down (v2 review: "best first" could not be arranged). The list is numbered again from the
   * top, so old ties go too; only rows whose number changed are saved.
   */
  protected move(r: Row, by: -1 | 1): void {
    const list = this.ordered();
    const i = list.findIndex((x) => x.id === r.id);
    if (i < 0 || !this.canMove(r, by)) return;
    [list[i], list[i + by]] = [list[i + by], list[i]];
    const field = this.kindKey() === 'grades' ? 'rank' : 'sortOrder';
    const first = this.kindKey() === 'grades' ? 1 : 0;
    const changed = list.map((x, n) => ({ x, value: n + first })).filter(({ x, value }) => Number(x[field] ?? -1) !== value);
    const verb = this.kind().update.toUpperCase();
    this.run(forkJoin(changed.map(({ x, value }) => this.http.request(verb, `${this.url()}/${x.id}`, { body: this.kindKey() === 'raw' ? { name: x.name, rawType: x['rawType'], [field]: value } : { [field]: value } }))), () => this.toast.show(this.i18n.t('ws.names.orderSaved')));
  }

  protected turnOff(r: Row): void {
    if (this.kind().remove === 'delete') {
      if (!confirm(this.i18n.t('ws.names.removeConfirm', { name: r.name }))) return;
      this.run(this.http.delete(`${this.url()}/${r.id}`), () => this.toast.show(this.i18n.t('ws.names.removed', { name: r.name })));
    } else {
      this.run(this.http.patch(`${this.url()}/${r.id}`, { isActive: false }), () => this.toast.show(this.i18n.t('ws.names.turnedOff', { name: r.name })));
    }
  }

  protected turnOn(r: Row): void {
    this.run(this.http.patch(`${this.url()}/${r.id}`, { isActive: true }), () => this.toast.show(this.i18n.t('ws.names.turnedOn', { name: r.name })));
  }

  protected makeMain(r: Row): void {
    this.run(this.http.patch(`${this.url()}/${r.id}/default`, {}), () => this.toast.show(this.i18n.t('ws.names.mainSaved', { name: r.name })));
  }

  protected load(): void {
    this.failed.set(false);
    this.http.get<Row[] | { data: Row[] }>(this.url()).subscribe({
      next: (r) => {
        this.rows.set(Array.isArray(r) ? r : (r?.data ?? []));
        this.loaded.set(true);
      },
      error: () => this.failed.set(true),
    });
  }

  private url(): string {
    return `${API_BASE_URL}${this.kind().url}`;
  }

  private resetNew(): void {
    this.newExtra = Object.fromEntries(this.kind().extras.map((x) => [x.key, x.type === 'select' ? x.options![0] : '']));
  }

  private run<T>(req: Observable<T>, done: () => void): void {
    this.busy.set(true);
    req.subscribe({
      next: () => {
        this.busy.set(false);
        done();
        this.load();
      },
      error: (e: HttpErrorResponse) => {
        this.busy.set(false);
        this.toast.error(this.i18n.t(e.status === 409 || /exist/i.test(String(e.error?.message ?? '')) ? 'ws.names.taken' : e.status === 403 ? 'ws.names.notAllowed' : 'common.couldNotSave'));
      },
    });
  }
}
