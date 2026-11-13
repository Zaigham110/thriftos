import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { LucideAngularModule, Plus } from 'lucide-angular';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth';
import { I18nService } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { NavService } from '../../core/nav/nav.service';
import { ToastService } from '../../shared/floor/toast.service';
import { WsColumn, WsDataGridComponent, WsPageHeaderComponent, WsRow, WsSideSheetComponent, WsStateComponent } from '../../shared/ui/workspace';
import { STOCK_TABS } from './lists';

/** GET /api/workspace/stock/by-item (values are null without cost.view). */
interface ByItem {
  key: string; name: string; categoryName: string | null; gradeName: string | null; categoryId: string | null; gradeId: string | null;
  bales: string; pieces: string; looseKg: string; stockKg: string; baleKg: string; waste?: boolean; sortedKg: string; kg: string;
  stockValue: string | null; sortedValue: string | null; value: string | null;
}

/**
 * Inventory by what it is (v2 review): one row per category and grade — bales in stock, sorted kg not baled
 * yet, total kg and value — so "how many Jeans A do I have?" is one line. A row opens its bales; a price can be
 * set for all bales of a kind at once.
 */
@Component({
  selector: 'app-stock-by-item',
  standalone: true,
  imports: [FormsModule, RouterLink, RouterLinkActive, LucideAngularModule, TPipe, WsDataGridComponent, WsPageHeaderComponent, WsSideSheetComponent, WsStateComponent],
  template: `
    <div class="page">
      <nav class="tabs" [attr.aria-label]="'ws.stock.title' | t">
        @for (tab of tabs; track tab.link) { <a [routerLink]="tab.link" routerLinkActive="on" ariaCurrentWhenActive="page">{{ tab.label | t }}</a> }
      </nav>
      <ws-page-header [crumbs]="false" [heading]="'ws.stock.title' | t" [subtitle]="subtitle()">
        @if (canPrice()) { <button actions type="button" class="ws-btn" [disabled]="!rows().length" (click)="openPrice(null)">{{ 'ws.si.setPrice' | t }}</button> }
        <a actions class="ws-btn primary" routerLink="/stock/bale"><lucide-icon [img]="icons.Plus" [size]="16" aria-hidden="true" />{{ 'ws.new.bale' | t }}</a>
      </ws-page-header>
      @if (failed()) {
        <ws-state kind="error" [heading]="'common.couldNotLoad' | t" (retry)="load()" />
      } @else if (data(); as d) {
        <ws-data-grid [caption]="'ws.si.caption' | t" [columns]="columns()" [rows]="rows()" [clickable]="true" (rowClick)="open($event)" [emptyHeading]="'ws.stock.emptyHeading' | t" />
        <p class="hint">{{ 'ws.si.hint' | t }}</p>
      } @else {
        <ws-state kind="loading" />
      }
    </div>

    <ws-side-sheet [open]="!!priceFor()" [heading]="'ws.si.setPrice' | t" (close)="priceFor.set(null)">
      <form class="sheet-form" id="ws-kind-price" (ngSubmit)="savePrice()">
        <label>{{ 'ws.container.category' | t }}
          <select name="kind" [(ngModel)]="priceKey">
            @for (r of priceable(); track r.key) { <option [value]="r.key">{{ r.name }}</option> }
          </select>
        </label>
        <label>{{ 'ws.si.pricePerBale' | t }}<input name="price" type="number" min="1" step="1" required [(ngModel)]="price" /></label>
        <p class="hint">{{ 'ws.si.priceHint' | t }}</p>
      </form>
      <ng-container footer>
        <button type="button" class="ws-btn" (click)="priceFor.set(null)">{{ 'common.cancel' | t }}</button>
        <button type="submit" form="ws-kind-price" class="ws-btn primary" [disabled]="busy() || !price || price < 1 || !priceKey">{{ 'common.save' | t }}</button>
      </ng-container>
    </ws-side-sheet>
  `,
  styles: [`
    .page { display:grid; gap:var(--ws-4); max-width:var(--ws-content-max); margin-inline:auto; font-family:var(--ws-font); color:var(--ws-ink); }
    .tabs { display:inline-flex; justify-self:start; gap:2px; padding:3px; border:1px solid var(--ws-line); border-radius:var(--ws-r-md); background:var(--ws-surface); }
    .tabs a { padding:6px var(--ws-3); border-radius:calc(var(--ws-r-md) - 2px); color:var(--ws-ink-2); font-size:var(--ws-text-sm); font-weight:500; text-decoration:none; }
    .tabs a.on { background:var(--ws-brand-soft); color:var(--ws-brand); font-weight:600; }
    .hint { margin:0; color:var(--ws-ink-3); font-size:var(--ws-text-sm); }
    .sheet-form { display:grid; gap:var(--ws-3); }
    .sheet-form label { display:grid; gap:4px; color:var(--ws-ink-2); font-size:var(--ws-text-sm); }
    .sheet-form input, .sheet-form select { box-sizing:border-box; width:100%; min-height:var(--ws-control-h); padding:var(--ws-2); border:1px solid var(--ws-line); border-radius:var(--ws-r-md); background:var(--ws-surface); color:var(--ws-ink); font:inherit; }
  `],
})
export class StockByItemComponent {
  protected readonly i18n = inject(I18nService);
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly nav = inject(NavService);
  protected readonly icons = { Plus };
  protected readonly tabs = STOCK_TABS;
  protected readonly data = signal<ByItem[] | null>(null);
  protected readonly failed = signal(false);
  protected readonly busy = signal(false);
  protected readonly priceFor = signal<'open' | null>(null);
  protected priceKey = '';
  protected price: number | null = null;

  protected readonly canSeeCost = computed(() => (this.data() ?? []).some((r) => r.value !== null));
  protected readonly priceable = computed(() => (this.data() ?? []).filter((r) => r.categoryId && Number(r.bales) > 0));
  protected readonly subtitle = computed(() => {
    const d = this.data() ?? [];
    const kg = d.reduce((t, r) => t + Number(r.kg), 0);
    const value = d.reduce((t, r) => t + Number(r.value ?? 0), 0);
    return this.i18n.t(this.canSeeCost() ? 'ws.si.subtitle' : 'ws.si.subtitleKg', { kg: this.i18n.kg(kg), value: this.i18n.money(Math.round(value)) });
  });
  protected readonly columns = computed<WsColumn[]>(() => {
    const t = (k: string) => this.i18n.t(k);
    return [
      { key: 'name', label: t('ws.stock.col.name') },
      { key: 'bales', label: t('ws.stock.unit.BALE'), format: 'number', total: true },
      { key: 'baleKg', label: t('ws.si.inBales'), format: 'kg', total: true, info: t('ws.si.info.inBales') },
      { key: 'sortedKg', label: t('ws.si.sorted'), format: 'kg', total: true, info: t('ws.si.info.sorted') },
      // Stock kept loose by the kg (waste): its own column, only when there is some.
      ...((this.data() ?? []).some((r) => Number(r.looseKg) > 0) ? [{ key: 'looseKg', label: t('ws.si.loose'), format: 'kg' as const, total: true, info: t('ws.si.info.loose') }] : []),
      { key: 'kg', label: t('ws.si.totalKg'), format: 'kg', total: true },
      ...(this.canSeeCost() ? [{ key: 'value', label: t('ws.stock.col.value'), format: 'money' as const, total: true, round: true }] : []),
    ];
  });
  protected readonly rows = computed<WsRow[]>(() => (this.data() ?? []).map((r) => ({ ...r, id: r.key })) as unknown as WsRow[]);

  constructor() {
    this.load();
  }

  protected load(): void {
    this.failed.set(false);
    this.http.get<ByItem[]>('/api/workspace/stock/by-item').subscribe({ next: (d) => this.data.set(d), error: () => this.failed.set(true) });
  }

  protected canPrice(): boolean {
    return this.auth.isSuperAdmin() || this.auth.permissions().includes('price.manage');
  }

  /** A row opens its bales and items in stock (the list, filtered to this category and grade). */
  protected open(row: WsRow): void {
    const r = (this.data() ?? []).find((x) => x.key === row.id);
    if (!r) return;
    // By name, so the list shows readable chips ("Category: Jeans", "Grade: A").
    const filters = r.categoryName
      ? [{ field: 'category', op: 'eq', value: r.categoryName }, r.gradeName ? { field: 'grade', op: 'eq', value: r.gradeName } : { field: 'grade', op: 'isnull' }]
      : r.waste ? [{ field: 'source', op: 'eq', value: 'KAT' }] : [{ field: 'name', op: 'eq', value: r.name }];
    void this.nav.open(['/stock/items'], { queryParams: { v: JSON.stringify({ filters: [{ field: 'status', op: 'ne', value: 'SOLD' }, ...filters] }) } });
  }

  protected openPrice(row: ByItem | null): void {
    this.priceKey = row?.key ?? this.priceable()[0]?.key ?? '';
    this.price = null;
    this.priceFor.set('open');
  }

  protected async savePrice(): Promise<void> {
    const r = this.priceable().find((x) => x.key === this.priceKey);
    if (!r || !this.price) return;
    this.busy.set(true);
    try {
      const res = await firstValueFrom(this.http.patch<{ updated: number }>('/api/workspace/stock/price', { categoryId: r.categoryId, gradeId: r.gradeId, salePrice: Number(this.price) }));
      this.toast.show(this.i18n.t('ws.si.priceSaved', { n: this.i18n.num(res.updated), name: r.name }));
      this.priceFor.set(null);
    } catch (e: any) {
      this.toast.error(e?.error?.message || this.i18n.t('common.couldNotSave'));
    } finally {
      this.busy.set(false);
    }
  }
}
