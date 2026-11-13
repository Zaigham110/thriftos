import { HttpClient } from '@angular/common/http';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, Trash2 } from 'lucide-angular';
import { I18nService } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { ToastService } from '../../shared/floor/toast.service';
import { WsPageHeaderComponent, WsStateComponent } from '../../shared/ui/workspace';

/** GET /api/workspace/price-lists */
export interface PriceLists {
  groups: { name: string; customers: number; prices: number }[];
  entries: { id: string; group: string; categoryId: string; category: string; gradeId: string | null; grade: string | null; unit: string; price: string }[];
  categories: { id: string; name: string }[];
  grades: { id: string; name: string }[];
  /** Every customer with the group they are in (null: none). */
  customers?: { id: string; name: string; city: string | null; group: string | null }[];
}

const UNITS = ['BALE', 'KG', 'PIECE'] as const;
const UNIT_WORDS: Record<string, string> = { BALE: 'unit.bale', KG: 'unit.kgShort', PIECE: 'unit.piece' };

/**
 * Price lists by customer group (enterprise plan E3.4): one price per category (and grade, or any grade) and
 * unit for each group — e.g. Wholesale pays Rs 180/kg for Jeans A. Put a customer in a group on their page;
 * the sale screen then suggests the group price first.
 */
@Component({
  selector: 'app-price-lists',
  standalone: true,
  imports: [FormsModule, LucideAngularModule, TPipe, WsPageHeaderComponent, WsStateComponent],
  template: `
    <div class="page">
      <ws-page-header [heading]="'ws.prices.title' | t" [subtitle]="'ws.prices.subtitle' | t" />
      @if (failed()) {
        <ws-state kind="error" (retry)="load()" />
      } @else if (data(); as d) {
        <!-- Which price the sale screen uses, so two places for prices make sense (v2 review). -->
        <aside class="order" aria-labelledby="ws-price-order">
          <strong id="ws-price-order">{{ 'ws.sp2.orderTitle' | t }}</strong>
          <ol><li>{{ 'ws.sp2.order1' | t }}</li><li>{{ 'ws.sp2.order2' | t }}</li><li>{{ 'ws.sp2.order3' | t }}</li></ol>
        </aside>
        <div class="layout">
          <nav class="groups" [attr.aria-label]="'ws.prices.groups' | t">
            @for (g of groupNames(); track g) {
              <button type="button" class="group" [class.on]="group() === g" [attr.aria-pressed]="group() === g" (click)="group.set(g)">
                <strong>{{ g }}</strong><small>{{ info(g) }}</small>
                @if (!count(g, 'customers')) { <small class="warn">{{ 'ws.sp2.noCustomers' | t }}</small> }
              </button>
            }
            <form class="newgroup" (ngSubmit)="addGroup()">
              <label>{{ 'ws.prices.newGroup' | t }}<input name="newGroup" maxlength="40" [(ngModel)]="newGroup" [placeholder]="'ws.prices.newGroupHint' | t" /></label>
              <button type="submit" class="ws-btn" [disabled]="!newGroup.trim()">{{ 'ws.prices.addGroup' | t }}</button>
            </form>
          </nav>
          <section class="prices">
            @if (group(); as g) {
              <div class="head">
                <h2>{{ g }}</h2>
                <button type="button" class="ws-btn" [disabled]="busy()" (click)="rename(g)">{{ 'ws.prices.rename' | t }}</button>
                <button type="button" class="ws-btn" [disabled]="busy()" (click)="removeGroup(g)">{{ 'ws.prices.removeGroup' | t }}</button>
              </div>
              <table>
                <caption class="sr-only">{{ g }}</caption>
                <thead><tr><th scope="col">{{ 'ws.container.category' | t }}</th><th scope="col">{{ 'ws.container.grade' | t }}</th><th scope="col">{{ 'ws.stock.col.unit' | t }}</th><th scope="col" class="num">{{ 'ws.stock.col.price' | t }}</th><th scope="col"><span class="sr-only">{{ 'ws.saleEntry.remove' | t }}</span></th></tr></thead>
                <tbody>
                  @for (e of entries(); track e.id) {
                    <tr>
                      <td>{{ e.category }}</td><td>{{ e.grade ?? ('ws.prices.anyGrade' | t) }}</td><td>{{ 'ws.stock.unit.' + e.unit | t }}</td>
                      <td class="num"><input type="number" min="0" step="1" [ngModel]="+e.price" (change)="update(e, $any($event.target).value)" [attr.aria-label]="'ws.stock.col.price' | t" /></td>
                      <td><button type="button" class="icon" (click)="remove(e.id)" [attr.aria-label]="'ws.saleEntry.remove' | t"><lucide-icon [img]="icons.Trash2" [size]="16" aria-hidden="true" /></button></td>
                    </tr>
                  } @empty {
                    <tr><td colspan="5" class="empty">{{ 'ws.prices.empty' | t }}</td></tr>
                  }
                </tbody>
              </table>
              <form class="add" (ngSubmit)="add(g)">
                <label>{{ 'ws.container.category' | t }}
                  <select name="cat" required [(ngModel)]="categoryId"><option value="" disabled>{{ 'ws.sp2.pickCategory' | t }}</option>@for (c of d.categories; track c.id) { <option [value]="c.id">{{ c.name }}</option> }</select>
                </label>
                <label>{{ 'ws.container.grade' | t }}
                  <select name="grade" [(ngModel)]="gradeId"><option value="">{{ 'ws.prices.anyGrade' | t }}</option>@for (x of d.grades; track x.id) { <option [value]="x.id">{{ x.name }}</option> }</select>
                </label>
                <label>{{ 'ws.stock.col.unit' | t }}
                  <select name="unit" [(ngModel)]="unit">@for (u of units; track u) { <option [value]="u">{{ 'ws.stock.unit.' + u | t }}</option> }</select>
                </label>
                <label>{{ 'ws.si.pricePer' | t: { unit: unitWord() } }}<input name="price" type="number" min="0" step="1" required [(ngModel)]="price" /></label>
                <button type="submit" class="ws-btn primary" [disabled]="busy() || !categoryId || price === null">{{ 'ws.prices.setPrice' | t }}</button>
              </form>
              <!-- Who gets these prices (v2 review: the page only showed a count). -->
              <section class="members" [attr.aria-label]="'ws.prices.members' | t">
                <h3>{{ 'ws.prices.members' | t }}</h3>
                <ul>
                  @for (c of members(); track c.id) {
                    <li><span>{{ c.name }}@if (c.city) { <small> · {{ c.city }}</small> }</span><button type="button" class="ws-btn" [disabled]="busy()" (click)="setMember(c.id, null)">{{ 'ws.prices.removeMember' | t }}</button></li>
                  } @empty { <li class="empty">{{ 'ws.prices.noMembers' | t }}</li> }
                </ul>
                <form class="add" (ngSubmit)="setMember(memberId, g)">
                  <label>{{ 'ws.prices.addMember' | t }}
                    <select name="member" [(ngModel)]="memberId"><option value="" disabled>{{ 'ws.prices.pickCustomer' | t }}</option>@for (c of others(); track c.id) { <option [value]="c.id">{{ c.group ? ('ws.prices.inGroup' | t: { name: c.name, group: c.group }) : c.name }}</option> }</select>
                  </label>
                  <button type="submit" class="ws-btn" [disabled]="busy() || !memberId">{{ 'ws.prices.addGroup' | t }}</button>
                </form>
              </section>
            } @else {
              <ws-state kind="empty" [heading]="'ws.prices.start' | t" />
            }
          </section>
        </div>
      } @else {
        <ws-state kind="loading" />
      }
    </div>
  `,
  styles: [`
    .page { display:grid; gap:var(--ws-4); max-width:var(--ws-content-max); margin-inline:auto; font-family:var(--ws-font); color:var(--ws-ink); }
    .layout { display:grid; grid-template-columns:260px minmax(0, 1fr); gap:var(--ws-4); align-items:start; }
    .groups { display:grid; gap:var(--ws-2); }
    .group { display:grid; gap:2px; padding:var(--ws-3); border:1px solid var(--ws-line); border-radius:var(--ws-r-lg); background:var(--ws-surface); color:var(--ws-ink); font:inherit; text-align:start; cursor:pointer; }
    .group.on { border-color:var(--ws-brand); background:var(--ws-brand-soft); }
    .group small { color:var(--ws-ink-2); font-size:var(--ws-text-xs); }
    .newgroup, .add { display:flex; flex-wrap:wrap; align-items:end; gap:var(--ws-2); }
    .prices { display:grid; gap:var(--ws-3); padding:var(--ws-4); border:1px solid var(--ws-line); border-radius:var(--ws-r-lg); background:var(--ws-surface); }
    .head { display:flex; align-items:center; gap:var(--ws-2); }
    .head h2 { flex:1; }
    .members { display:grid; gap:var(--ws-2); margin-top:var(--ws-4); }
    .members h3 { margin:0; font-size:var(--ws-text-md, 15px); }
    .members ul { list-style:none; margin:0; padding:0; }
    .members li { display:flex; align-items:center; justify-content:space-between; gap:var(--ws-2); padding:var(--ws-2) 0; border-bottom:1px solid var(--ws-line); }
    .members li.empty { color:var(--ws-ink-2); font-size:var(--ws-text-sm); }
    h2 { margin:0; font-size:var(--ws-text-lg, 1.125rem); }
    label { display:grid; gap:4px; color:var(--ws-ink-2); font-size:var(--ws-text-sm); }
    input, select { height:var(--ws-control-h); padding-inline:var(--ws-2); border:1px solid var(--ws-line); border-radius:var(--ws-r-md); background:var(--ws-surface); color:var(--ws-ink); font:inherit; }
    table { width:100%; border-collapse:collapse; font-variant-numeric:tabular-nums; }
    th, td { padding:var(--ws-2); border-bottom:1px solid var(--ws-line); text-align:start; }
    th { color:var(--ws-ink-2); font-size:var(--ws-text-xs); font-weight:600; text-transform:uppercase; }
    .num { text-align:end; }
    .order { padding:var(--ws-3) var(--ws-4); border:1px solid var(--ws-line); border-radius:var(--ws-r-lg); background:var(--ws-surface); font-size:var(--ws-text-sm); }
    .order ol { margin:var(--ws-1, 4px) 0 0; padding-inline-start:1.25rem; color:var(--ws-ink-2); }
    .group small.warn { color:var(--ws-warn, var(--ws-bad)); font-weight:600; }
    td.num input { width:120px; text-align:end; }
    .empty { color:var(--ws-ink-2); text-align:center; }
    .icon { display:inline-grid; place-items:center; width:32px; height:32px; border:0; border-radius:var(--ws-r-md); background:transparent; color:var(--ws-ink-2); cursor:pointer; }
    .icon:hover { color:var(--ws-bad); background:var(--ws-surface-hover); }
    .sr-only { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); }
    @media (max-width: 1199px) { .layout { grid-template-columns:minmax(0, 1fr); } }
  `],
})
export class PriceListsComponent {
  protected readonly i18n = inject(I18nService);
  private readonly http = inject(HttpClient);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly icons = { Trash2 };
  protected readonly units = UNITS;
  protected readonly data = signal<PriceLists | null>(null);
  protected readonly failed = signal(false);
  protected readonly busy = signal(false);
  protected readonly group = signal<string | null>(null);
  /** Groups named here but without a price yet. */
  private readonly drafts = signal<string[]>([]);
  protected newGroup = '';
  protected categoryId = '';
  protected gradeId = '';
  protected unit: (typeof UNITS)[number] = 'BALE';
  protected price: number | null = null;
  protected memberId = '';
  protected readonly members = computed(() => (this.data()?.customers ?? []).filter((c) => c.group === this.group()));
  protected readonly others = computed(() => (this.data()?.customers ?? []).filter((c) => c.group !== this.group()));

  protected readonly groupNames = computed(() => [...new Set([...(this.data()?.groups ?? []).map((g) => g.name), ...this.drafts()])].sort());
  protected readonly entries = computed(() => (this.data()?.entries ?? []).filter((e) => e.group === this.group()));

  constructor() {
    this.load();
  }

  /** "2 prices · 1 customer": each word in the singular for one. */
  protected info(g: string): string {
    const p = this.count(g, 'prices');
    const c = this.count(g, 'customers');
    return `${this.i18n.t(p === 1 ? 'ws.prices.priceOne' : 'ws.prices.pricesN', { n: p })} · ${this.i18n.t(c === 1 ? 'ws.prices.customerOne' : 'ws.prices.customersN', { n: c })}`;
  }
  protected unitWord(): string {
    return this.i18n.t(UNIT_WORDS[this.unit]);
  }

  /** Puts a customer in this group, or (group null) takes them out. */
  protected setMember(customerId: string, group: string | null): void {
    if (!customerId) return;
    this.busy.set(true);
    this.http.patch(`/api/workspace/customers/${customerId}/price-group`, { group }).subscribe({
      next: () => { this.busy.set(false); this.memberId = ''; if (group) this.drafts.set(this.drafts().filter((d) => d !== group)); this.toast.show(this.i18n.t('ws.prices.memberSaved')); this.load(); },
      error: () => { this.busy.set(false); this.toast.show(this.i18n.t('common.couldNotSave')); },
    });
  }

  /** A new name for the group: its prices and customers keep it. A group not saved yet is renamed here only. */
  protected rename(g: string): void {
    const name = (prompt(this.i18n.t('ws.prices.renameAsk'), g) ?? '').trim();
    if (!name || name === g) return;
    if (this.groupNames().includes(name)) { this.toast.show(this.i18n.t('ws.prices.nameTaken')); return; }
    if (this.drafts().includes(g)) { this.drafts.set(this.drafts().map((d) => (d === g ? name : d))); this.group.set(name); return; }
    this.busy.set(true);
    this.http.patch(`/api/workspace/price-lists/groups/${encodeURIComponent(g)}`, { name }).subscribe({
      next: () => { this.busy.set(false); this.group.set(name); this.toast.show(this.i18n.t('ws.prices.renamed')); this.load(); },
      error: (e: { status?: number }) => { this.busy.set(false); this.toast.show(this.i18n.t(e.status === 409 ? 'ws.prices.nameTaken' : 'common.couldNotSave')); },
    });
  }

  protected removeGroup(g: string): void {
    if (this.drafts().includes(g)) { this.drafts.set(this.drafts().filter((d) => d !== g)); this.group.set(this.groupNames()[0] ?? null); return; }
    if (!confirm(this.i18n.t('ws.prices.removeAsk', { name: g }))) return;
    this.busy.set(true);
    this.http.delete(`/api/workspace/price-lists/groups/${encodeURIComponent(g)}`).subscribe({
      next: () => { this.busy.set(false); this.group.set(null); this.toast.show(this.i18n.t('ws.prices.groupRemoved')); this.load(); },
      error: () => { this.busy.set(false); this.toast.show(this.i18n.t('common.couldNotSave')); },
    });
  }

  protected count(g: string, what: 'prices' | 'customers'): number {
    return this.data()?.groups.find((x) => x.name === g)?.[what] ?? 0;
  }

  protected load(): void {
    this.failed.set(false);
    this.http.get<PriceLists>('/api/workspace/price-lists').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (d) => {
        this.data.set(d);
        if (!this.group() && d.groups.length) this.group.set(d.groups[0].name);
      },
      error: () => this.failed.set(true),
    });
  }

  protected addGroup(): void {
    const g = this.newGroup.trim();
    if (!g) return;
    this.drafts.set([...this.drafts(), g]);
    this.group.set(g);
    this.newGroup = '';
  }

  private put(body: object, done: string): void {
    this.busy.set(true);
    this.http.put('/api/workspace/price-lists/entries', body).subscribe({
      next: () => { this.busy.set(false); this.toast.show(this.i18n.t(done)); this.load(); },
      error: () => { this.busy.set(false); this.toast.show(this.i18n.t('common.couldNotSave')); },
    });
  }

  protected add(group: string): void {
    if (!this.categoryId || this.price === null) return;
    this.put({ group, categoryId: this.categoryId, gradeId: this.gradeId || null, unit: this.unit, price: this.price }, 'ws.prices.saved');
    this.price = null;
  }

  protected update(e: PriceLists['entries'][number], value: string): void {
    if (value === '' || +value < 0) return;
    this.put({ group: e.group, categoryId: e.categoryId, gradeId: e.gradeId, unit: e.unit, price: +value }, 'ws.prices.saved');
  }

  protected remove(id: string): void {
    this.http.delete(`/api/workspace/price-lists/entries/${id}`).subscribe({
      next: () => { this.toast.show(this.i18n.t('ws.prices.removed')); this.load(); },
      error: () => this.toast.show(this.i18n.t('common.couldNotSave')),
    });
  }
}
