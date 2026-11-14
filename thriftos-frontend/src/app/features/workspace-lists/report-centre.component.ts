import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BarChart3, BookOpen, Coins, Factory, Gauge, HandCoins, Layers3, LucideAngularModule, PackageSearch, Receipt, ShoppingCart, TrendingUp, Users, Wallet } from 'lucide-angular';
import { TenantService } from '../../core/tenant/tenant.service';
import { AuthService } from '../../core/auth';
import { TPipe } from '../../core/i18n/t.pipe';
import { WsPageHeaderComponent } from '../../shared/ui/workspace';

type Icon = typeof BarChart3;
interface Report { key: string; path: string; icon: Icon; permission?: string; query?: Record<string, string>; module?: string }
interface Section { key: string; reports: Report[] }

/** Every report, grouped like the menu; each has filters, a chart and a table, CSV export and print. */
const SECTIONS: Section[] = [
  { key: 'overview', reports: [{ key: 'dashboard', path: '/home', icon: BarChart3 }, { key: 'pnl', path: '/finance/pnl', icon: TrendingUp, permission: 'cost.view' }] },
  { key: 'sales', reports: [{ key: 'salesAnalytics', path: '/sell/analytics', icon: ShoppingCart }, { key: 'collections', path: '/khata/records', icon: BookOpen }] },
  { key: 'purchasing', reports: [{ key: 'scorecard', path: '/receive/scorecard', icon: Factory }, { key: 'yield', path: '/sort/yield', icon: Gauge, permission: 'SORTING_STAGE1_VIEW' },
    // What is owed to each supplier, and who sorts how much (v2 review: neither was on the list).
    { key: 'suppliersOwed', path: '/receive/records/suppliers', icon: HandCoins, permission: 'cost.view' },
    { key: 'productivity', path: '/payroll', query: { tab: 'productivity' }, icon: Users, permission: 'tenant.update', module: 'PAYROLL' }] },
  { key: 'stock', reports: [{ key: 'stockValue', path: '/stock/value', icon: Coins, permission: 'INVENTORY_VIEW' }, { key: 'lots', path: '/sort/records', icon: Layers3, permission: 'SORTING_STAGE1_VIEW' }, { key: 'stockList', path: '/stock/items', icon: PackageSearch, permission: 'INVENTORY_VIEW' }] },
  { key: 'money', reports: [{ key: 'book', path: '/finance/book', icon: Wallet, permission: 'finance.view' }, { key: 'expenses', path: '/finance/expenses', icon: Receipt, permission: 'finance.view' }] },
];

/**
 * Report centre (enterprise plan E4.5): all reports in one place on the laptop, each shown to people who may
 * open it.
 */
@Component({
  selector: 'app-report-centre',
  standalone: true,
  imports: [RouterLink, LucideAngularModule, TPipe, WsPageHeaderComponent],
  template: `
      <div class="page">
        <ws-page-header [heading]="'ws.reports.title' | t" [subtitle]="'ws.reports.subtitle' | t" />
        @for (s of sections(); track s.key) {
          <section>
            <h2>{{ 'ws.reports.section.' + s.key | t }}</h2>
            <div class="grid">
              @for (r of s.reports; track r.key) {
                <a class="report" [routerLink]="r.path" [queryParams]="r.query ?? null">
                  <lucide-icon [img]="r.icon" [size]="20" aria-hidden="true" />
                  <strong>{{ 'ws.reports.item.' + r.key + '.name' | t }}</strong>
                  <small>{{ 'ws.reports.item.' + r.key + '.hint' | t }}</small>
                </a>
              }
            </div>
          </section>
        }
      </div>
  `,
  styles: [`
    .page { display:grid; gap:var(--ws-5); max-width:var(--ws-content-max); margin-inline:auto; font-family:var(--ws-font); color:var(--ws-ink); }
    section { display:grid; gap:var(--ws-3); }
    h2 { margin:0; color:var(--ws-ink-2); font-size:var(--ws-text-xs); font-weight:600; letter-spacing:.06em; text-transform:uppercase; }
    .grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(260px, 1fr)); gap:var(--ws-3); }
    .report { display:grid; grid-template-columns:auto 1fr; grid-template-rows:auto auto; column-gap:var(--ws-3); row-gap:2px; padding:var(--ws-4); border:1px solid var(--ws-line); border-radius:var(--ws-r-lg); background:var(--ws-surface); color:var(--ws-ink); text-decoration:none; }
    .report:hover { border-color:var(--ws-brand); box-shadow:var(--ws-shadow-sm, none); }
    .report lucide-icon { grid-row:span 2; color:var(--ws-brand); }
    .report small { color:var(--ws-ink-2); font-size:var(--ws-text-sm); }
  `],
})
export class ReportCentreComponent {
  private readonly auth = inject(AuthService);
  private readonly tenants = inject(TenantService);
  protected readonly sections = computed(() => {
    const can = (p?: string) => !p || this.auth.isSuperAdmin() || this.auth.permissions().includes(p);
    const on = (m?: string) => !m || this.tenants.isModuleEnabled(m as never, this.tenants.tenant());
    return SECTIONS.map((s) => ({ ...s, reports: s.reports.filter((r) => can(r.permission) && on(r.module)) })).filter((s) => s.reports.length);
  });
}
