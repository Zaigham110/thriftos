import { auditLabel } from '../audit-labels';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { CheckCircle2, LogIn, LucideAngularModule, RefreshCw } from 'lucide-angular';
import { AuthService } from '../../../../core/auth';
import { WsColumn, WsDataGridComponent, WsKpiCardComponent, WsPageHeaderComponent, WsRow, WsStateComponent } from '../../../../shared/ui/workspace';
import { SuperAdminDataService, type SuperAdminSummary } from '../super-admin-data.service';

/**
 * Platform overview for the super admin (enterprise UI pass): how many businesses and people, what they have
 * recorded, real server status (database, uptime, release), the newest businesses (open one as its owner to
 * help) and the latest audit events.
 */
@Component({
  selector: 'app-super-admin-dashboard',
  standalone: true,
  imports: [RouterLink, LucideAngularModule, WsDataGridComponent, WsKpiCardComponent, WsPageHeaderComponent, WsStateComponent],
  template: `
    <div class="page">
      <ws-page-header heading="Platform overview" subtitle="Businesses, people and activity across ThriftOS">
        <button actions type="button" class="ws-btn" (click)="load()" [disabled]="loading()"><lucide-icon [img]="icons.RefreshCw" [size]="16" aria-hidden="true" />Refresh</button>
      </ws-page-header>
      @if (error(); as e) {
        <ws-state kind="error" [heading]="e" (retry)="load()" />
      } @else if (summary(); as s) {
        <section class="kpis">
          <ws-kpi-card label="Businesses" [value]="num(s.kpis.activeTenants) + ' active'" [hint]="num(s.kpis.totalTenants) + ' in all · ' + num(s.kpis.inactiveTenants) + ' switched off'" link="/admin/tenants" />
          <ws-kpi-card label="People" [value]="num(s.kpis.activeUsers) + ' active'" [hint]="num(s.kpis.totalUsers) + ' accounts'" link="/admin/users" />
          <ws-kpi-card label="Kg received" [value]="num(s.kpis.totalWeightKg) + ' kg'" hint="All businesses" />
          <ws-kpi-card label="Sales recorded" [value]="sales(s.kpis.salesByCurrency, 0)" [hint]="salesHint(s.kpis.salesByCurrency)" />
        </section>
        <section class="health" aria-label="Server status">
          <span><lucide-icon [img]="icons.CheckCircle2" [size]="16" aria-hidden="true" />Database connected</span>
          <span>Server running for {{ uptime(s.systemHealth.uptimeHours) }}</span>
          <span>Release {{ s.systemHealth.version ?? 'not set' }}</span>
          @if (s.systemHealth.lastAuditAt) { <span>Last activity {{ time(s.systemHealth.lastAuditAt) }}</span> }
        </section>
        <div class="two">
          <section class="panel">
            <header><h2>Newest businesses</h2><a routerLink="/admin/tenants">All businesses</a></header>
            <table>
              <caption class="sr-only">Newest businesses</caption>
              <thead><tr><th scope="col">Business</th><th scope="col">Code</th><th scope="col" class="num">People</th><th scope="col">Status</th><th scope="col"><span class="sr-only">Open</span></th></tr></thead>
              <tbody>
                @for (t of s.recentTenants; track t.id) {
                  <tr>
                    <td><a [routerLink]="['/admin/tenants', t.id]">{{ t.name }}</a></td>
                    <td class="code">{{ t.companyCode }}</td>
                    <td class="num">{{ t.userCount }}</td>
                    <td><span class="pill" [class.off]="t.status !== 'ACTIVE'">{{ t.status === 'ACTIVE' ? 'Active' : 'Off' }}</span></td>
                    <td class="end">
                      @if (t.companyCode !== 'SYSTEM') {
                        <button type="button" class="ws-btn small" (click)="impersonate(t.id)" [disabled]="!!impersonatingId()" title="Open this business as its owner, to help them"><lucide-icon [img]="icons.LogIn" [size]="14" aria-hidden="true" />{{ impersonatingId() === t.id ? 'Opening…' : 'Open' }}</button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </section>
          <section class="panel">
            <header><h2>Latest activity</h2><a routerLink="/admin/audit">Audit trail</a></header>
            <ws-data-grid caption="Latest activity" [columns]="auditColumns" [rows]="auditRows()" emptyHeading="Nothing yet" />
          </section>
        </div>
      } @else {
        <ws-state kind="loading" />
      }
    </div>
  `,
  styles: [`
    .page { display:grid; grid-template-columns:minmax(0, 1fr); gap:var(--ws-4); max-width:var(--ws-content-max); margin-inline:auto; font-family:var(--ws-font); color:var(--ws-ink); }
    .kpis { display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:var(--ws-3); }
    .health { display:flex; flex-wrap:wrap; gap:var(--ws-2) var(--ws-5); padding:var(--ws-3) var(--ws-4); border:1px solid var(--ws-line); border-radius:var(--ws-r-lg); background:var(--ws-surface); color:var(--ws-ink-2); font-size:var(--ws-text-sm); }
    .health span { display:inline-flex; align-items:center; gap:6px; }
    .health lucide-icon { color:var(--ws-good); }
    .two { display:grid; grid-template-columns:repeat(auto-fit, minmax(420px, 1fr)); gap:var(--ws-4); align-items:start; }
    .panel { display:grid; gap:var(--ws-3); padding:var(--ws-4); border:1px solid var(--ws-line); border-radius:var(--ws-r-lg); background:var(--ws-surface); }
    .panel header { display:flex; align-items:center; justify-content:space-between; }
    h2 { margin:0; font-size:var(--ws-text-md); font-weight:600; }
    .panel header a, td a { color:var(--ws-brand); text-decoration:none; } .panel header a:hover, td a:hover { text-decoration:underline; }
    table { width:100%; border-collapse:collapse; font-size:var(--ws-text-sm); }
    th, td { padding:var(--ws-2); border-bottom:1px solid var(--ws-line); text-align:start; }
    th { color:var(--ws-ink-2); font-size:var(--ws-text-xs); font-weight:600; text-transform:uppercase; letter-spacing:.03em; }
    .num { text-align:end; } .end { text-align:end; }
    .code { font-family:ui-monospace, monospace; color:var(--ws-ink-2); }
    .pill { padding:2px 8px; border-radius:999px; background:var(--ws-good-soft, #dcfce7); color:var(--ws-good); font-size:var(--ws-text-xs); font-weight:600; }
    .pill.off { background:var(--ws-bad-soft); color:var(--ws-bad); }
    .ws-btn.small { height:30px; padding-inline:var(--ws-2); font-size:var(--ws-text-sm); }
    .sr-only { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); }
  `],
})
export class SuperAdminDashboardComponent {
  private readonly data = inject(SuperAdminDataService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly icons = { CheckCircle2, LogIn, RefreshCw };
  protected readonly summary = signal<SuperAdminSummary | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly impersonatingId = signal<string | null>(null);
  protected readonly auditColumns: WsColumn[] = [
    { key: 'action', label: 'What' },
    { key: 'userName', label: 'Who' },
    { key: 'tenantName', label: 'Business' },
    { key: 'createdAt', label: 'When', format: 'date' },
  ];
  protected readonly auditRows = computed<WsRow[]>(() =>
    (this.summary()?.recentLogs ?? []).map((l) => ({ ...l, action: auditLabel(l.action) })) as unknown as WsRow[],
  );

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.data.getSummary().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (s) => { this.summary.set(s); this.loading.set(false); },
      error: (e) => { this.error.set(e?.error?.message || 'The overview could not be loaded'); this.loading.set(false); },
    });
  }

  /** Sales in one currency: "Rs 3,091,600"; several: the biggest, with the others in the hint. */
  protected sales(list: { currency: string; amount: string }[] | undefined, i: number): string {
    const x = list?.[i];
    return x ? `${x.currency === 'PKR' ? 'Rs' : x.currency} ${this.num(x.amount)}` : '0';
  }
  protected salesHint(list: { currency: string; amount: string }[] | undefined): string {
    if (!list || list.length <= 1) return 'All businesses';
    return 'Also ' + list.slice(1).map((_, i) => this.sales(list, i + 1)).join(', ');
  }

  protected num(v: string | number): string {
    return Number(v).toLocaleString('en-PK', { maximumFractionDigits: 0 });
  }

  protected uptime(hours: number): string {
    return hours >= 48 ? `${Math.floor(hours / 24)} days` : hours >= 1 ? `${hours} hours` : `${Math.max(1, Math.round(hours * 60))} minutes`;
  }

  protected time(v: string): string {
    return new Date(v).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  /** Opens the business as its owner (audited on the server) to help them. */
  protected impersonate(tenantId: string): void {
    if (this.impersonatingId()) return;
    this.impersonatingId.set(tenantId);
    this.auth.impersonateTenant(tenantId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.impersonatingId.set(null);
        void this.router.navigate(['/home']);
      },
      error: () => this.impersonatingId.set(null),
    });
  }
}
