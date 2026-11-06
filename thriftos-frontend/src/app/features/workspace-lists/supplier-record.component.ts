import { HttpClient } from '@angular/common/http';
import { NavService } from '../../core/nav/nav.service';
import { Component, computed, inject, input, signal, effect } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Coins, Layers3, Percent, Receipt, Scale, Truck } from 'lucide-angular';
import { catchError, map, of, switchMap } from 'rxjs';
import { I18nService } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import {
  WsColumn,
  WsDataGridComponent,
  WsPageHeaderComponent,
  WsRecordActivityComponent,
  WsRow,
  WsSmartButtonComponent,
  WsStateComponent,
} from '../../shared/ui/workspace';

type Money = string | null;
/** GET /api/workspace/suppliers/:id — the supplier scorecard (money is null without cost.view). */
export interface SupplierScorecard {
  supplier: { id: string; name: string; originCountry: string | null; country: string | null; contactPerson: string | null; contactPhone: string | null; contactEmail: string | null; paymentTerms: string | null };
  totals: { containers: number; kg: string; landed: Money; revenue: string; profit: Money; profitPerKg: Money; yieldPercent: number | null; topGradePercent: number | null };
  containers: { id: string; number: string; date: string; status: string; origin: string | null; kg: string; landedCost: Money; costPerKg: Money; revenue: string; profit: Money; yield: number | null; topGrade: number | null }[];
}

/**
 * A supplier's scorecard (enterprise plan E3.1): what their containers cost, how they sorted and what they
 * earned — profit per kg, sorted % and A grade % over all of them — and each container, with activity.
 */
@Component({
  selector: 'app-supplier-record',
  standalone: true,
  imports: [TPipe, WsDataGridComponent, WsPageHeaderComponent, WsRecordActivityComponent, WsSmartButtonComponent, WsStateComponent],
  template: `
    @if (failed()) {
      <ws-state kind="error" [heading]="'ws.supplier.notFound' | t" (retry)="reload()" />
    } @else if (data(); as d) {
      <div class="record">
        <div class="main">
          <ws-page-header [heading]="d.supplier.name" [subtitle]="subtitle()" />
          <section class="smart">
            <ws-smart-button [label]="'ws.suppliers.col.containers' | t" [value]="i18n.num(d.totals.containers)" [icon]="icons.Truck" [link]="[]" />
            <ws-smart-button [label]="'ws.suppliers.col.kg' | t" [value]="i18n.kg(d.totals.kg)" [icon]="icons.Scale" [link]="[]" />
            @if (d.totals.landed !== null) { <ws-smart-button [label]="'ws.containers.col.landedCost' | t" [value]="i18n.money(d.totals.landed)" [icon]="icons.Receipt" [link]="[]" /> }
            <ws-smart-button [label]="'ws.containers.col.revenue' | t" [value]="i18n.money(d.totals.revenue)" [icon]="icons.Coins" [link]="[]" />
            @if (d.totals.profit !== null) {
              <ws-smart-button [label]="'ws.containers.col.profit' | t" [value]="i18n.money(d.totals.profit)" [icon]="icons.Coins" [tone]="+d.totals.profit >= 0 ? 'good' : 'bad'" [link]="[]" />
              <ws-smart-button [label]="'ws.suppliers.col.profitPerKg' | t" [value]="i18n.money(d.totals.profitPerKg)" [icon]="icons.Coins" [tone]="+(d.totals.profitPerKg ?? 0) >= 0 ? 'good' : 'bad'" [link]="[]" />
            }
            <ws-smart-button [label]="'ws.containers.col.yield' | t" [value]="pct(d.totals.yieldPercent)" [icon]="icons.Layers3" [link]="[]" />
            <ws-smart-button [label]="'ws.containers.col.topGrade' | t" [value]="pct(d.totals.topGradePercent)" [icon]="icons.Percent" [link]="[]" />
          </section>
          <ws-data-grid [caption]="'ws.containers.title' | t" [columns]="columns()" [rows]="rows()" [clickable]="true" (rowClick)="open($event)" [emptyHeading]="'ws.supplier.noContainers' | t" />
        </div>
        <aside class="side"><ws-record-activity type="supplier" [recordId]="d.supplier.id" /></aside>
      </div>
    } @else {
      <ws-state kind="loading" />
    }
  `,
  styles: [`
    .record { display:grid; grid-template-columns:minmax(0, 1fr) 340px; gap:var(--ws-5); max-width:var(--ws-content-max); margin-inline:auto; align-items:start; font-family:var(--ws-font); color:var(--ws-ink); }
    .main { display:grid; grid-template-columns:minmax(0, 1fr); gap:var(--ws-4); }
    .side { position:sticky; top:calc(var(--ws-topbar-h) + var(--ws-4)); }
    .smart { display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); gap:var(--ws-3); }
    @media (max-width: 1199px) { .record { grid-template-columns:minmax(0, 1fr); } .side { position:static; } }
  `],
})
export class SupplierRecordComponent {
  protected readonly i18n = inject(I18nService);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  /** Route parameter (component input binding). */
  readonly id = input.required<string>();
  private readonly nav = inject(NavService);
  /** The breadcrumb and browser tab name this record once it has loaded. */
  private readonly crumbName = effect(() => {
    const d = this.data();
    const id = this.id();
    if (d && id) this.nav.setName(id, d.supplier.name);
  });

  protected readonly icons = { Coins, Layers3, Percent, Receipt, Scale, Truck };
  protected readonly data = signal<SupplierScorecard | null>(null);
  protected readonly failed = signal(false);
  private readonly reloads = signal(0);

  protected readonly subtitle = computed(() => {
    const s = this.data()?.supplier;
    if (!s) return '';
    return [s.originCountry ?? s.country, s.contactPerson, s.contactPhone, s.contactEmail, s.paymentTerms].filter(Boolean).join(' · ');
  });
  protected readonly columns = computed<WsColumn[]>(() => {
    const cost = this.data()?.totals.profit !== null;
    const t = (k: string) => this.i18n.t(k);
    return [
      { key: 'number', label: t('ws.containers.col.number') },
      { key: 'date', label: t('ws.containers.col.date'), format: 'date' },
      { key: 'status', label: t('ws.col.status') },
      { key: 'kg', label: t('ws.containers.col.kg'), format: 'kg', total: true },
      ...(cost ? [{ key: 'landedCost', label: t('ws.containers.col.landedCost'), format: 'money' as const, total: true }] : []),
      { key: 'revenue', label: t('ws.containers.col.revenue'), format: 'money', total: true },
      ...(cost ? [{ key: 'profit', label: t('ws.containers.col.profit'), format: 'money' as const, total: true }] : []),
      { key: 'yield', label: t('ws.containers.col.yield'), format: 'percent' },
      { key: 'topGrade', label: t('ws.containers.col.topGrade'), format: 'percent' },
    ];
  });
  protected readonly rows = computed<WsRow[]>(() =>
    (this.data()?.containers ?? []).map((c) => ({ ...c, status: this.i18n.t(`ws.cstatus.${c.status}`) })) as unknown as WsRow[],
  );

  constructor() {
    const request = computed(() => ({ id: this.id(), n: this.reloads() }));
    toObservable(request)
      .pipe(
        switchMap(({ id }) =>
          this.http.get<SupplierScorecard>(`/api/workspace/suppliers/${id}`).pipe(
            map((d) => ({ ok: true as const, d })),
            catchError(() => of({ ok: false as const })),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((x) => {
        this.failed.set(!x.ok);
        if (x.ok) this.data.set(x.d);
      });
  }

  protected pct(v: number | null): string {
    return v === null ? '—' : `${this.i18n.num(v, 0)}%`;
  }

  protected reload(): void {
    this.reloads.set(this.reloads() + 1);
  }

  protected open(row: WsRow): void {
    void this.router.navigate(['/receive/records/containers', row.id]);
  }
}
