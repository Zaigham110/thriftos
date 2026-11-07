/**
 * Platform overview for the super admin (v2 review, plain like the other console pages): how many businesses and
 * people, what they have recorded, server status, the newest businesses and the latest activity. Background noise
 * (session renewals, page views) is left out by the server.
 */
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { AppPageBodyComponent, AppPageComponent, AppPageHeaderComponent } from '../../../../shared/ui';
import { auditLabel } from '../audit-labels';
import { day, moment } from '../console-format';
import { typeLabel } from '../business-type';
import { SuperAdminDataService, type SuperAdminSummary } from '../super-admin-data.service';

@Component({
  selector: 'app-super-admin-dashboard',
  standalone: true,
  imports: [RouterLink, AppPageComponent, AppPageHeaderComponent, AppPageBodyComponent],
  template: `
    <app-page>
      <app-page-header>
        <div><h1 class="page-title">Overview</h1><p class="page-subtitle">Businesses, people and activity across ThriftOS</p></div>
        <div class="btns">
          <button type="button" class="btn" (click)="load()" [disabled]="loading()">{{ loading() ? 'Loading…' : 'Refresh' }}</button>
          <a class="btn primary" routerLink="/admin/tenants/quick">New business</a>
        </div>
      </app-page-header>
      <app-page-body>
        @if (error(); as e) {
          <p class="err" role="alert">{{ e }} <button type="button" class="link" (click)="load()">Try again</button></p>
        } @else if (summary(); as s) {
          <div class="page">
            <dl class="stats">
              <a routerLink="/admin/tenants"><dt>Businesses</dt><dd>{{ num(s.kpis.activeTenants) }} working</dd><small>{{ num(s.kpis.totalTenants) }} in all · {{ num(s.kpis.inactiveTenants) }} switched off</small></a>
              <a routerLink="/admin/users"><dt>People</dt><dd>{{ num(s.kpis.activeUsers) }} can sign in</dd><small>{{ num(s.kpis.totalUsers) }} in all</small></a>
              <div><dt>Kg received</dt><dd>{{ num(s.kpis.totalWeightKg) }} kg</dd><small>All businesses</small></div>
              <div><dt>Sales recorded</dt><dd>{{ sales(s.kpis.salesByCurrency, 0) }}</dd><small>{{ salesHint(s.kpis.salesByCurrency) }}</small></div>
            </dl>
            <p class="health" aria-label="Server status">
              <span class="dot" aria-hidden="true"></span><span>Database connected</span>
              <span>Server running for {{ uptime(s.systemHealth.uptimeHours) }}</span>
              <span>Release {{ s.systemHealth.version ?? 'not set' }}</span>
              @if (s.systemHealth.lastAuditAt) { <span>Last activity {{ moment(s.systemHealth.lastAuditAt) }}</span> }
            </p>
            <div class="two">
              <section class="card">
                <div class="card-head"><h2>Newest businesses</h2><a class="link" routerLink="/admin/tenants">All businesses</a></div>
                <div class="table-wrap">
                  <table class="plain">
                    <thead><tr><th scope="col">Business</th><th scope="col">Works as</th><th scope="col">People</th><th scope="col">Made</th></tr></thead>
                    <tbody>
                      @for (t of s.recentTenants; track t.id) {
                        <tr>
                          <td><a [routerLink]="['/admin/tenants', t.id]">{{ t.name }}</a>@if (t.status !== 'ACTIVE') { <span class="tag off">Switched off</span> }</td>
                          <td>{{ typeLabel(t.sortingStages) }}</td>
                          <td>{{ t.userCount }}</td>
                          <td class="when">{{ day(t.createdAt) }}</td>
                        </tr>
                      } @empty { <tr><td colspan="4" class="muted">No businesses yet.</td></tr> }
                    </tbody>
                  </table>
                </div>
              </section>
              <section class="card">
                <div class="card-head"><h2>Latest activity</h2><a class="link" routerLink="/admin/audit">Audit trail</a></div>
                <div class="table-wrap">
                  <table class="plain">
                    <thead><tr><th scope="col">What</th><th scope="col">Who</th><th scope="col">Business</th><th scope="col">When</th></tr></thead>
                    <tbody>
                      @for (l of s.recentLogs; track l.id) {
                        <tr><td>{{ label(l.action) }}</td><td>{{ l.userName }}</td><td>{{ l.tenantName }}</td><td class="when">{{ moment(l.createdAt) }}</td></tr>
                      } @empty { <tr><td colspan="4" class="muted">Nothing yet.</td></tr> }
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          </div>
        } @else {
          <p class="muted">Loading…</p>
        }
      </app-page-body>
    </app-page>
  `,
  styleUrls: ['../console.css'],
  styles: [`
    .page { display:grid; gap:16px; min-width:0; }
    .stats { display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:12px; margin:0; }
    .stats > * { display:grid; gap:2px; padding:14px 16px; border:1px solid var(--color-border, #e3dde0); border-radius:12px; background:var(--color-surface, #fff); color:inherit; text-decoration:none; }
    .stats > a:hover { border-color:var(--color-primary, #6f3f63); }
    .stats dt { color:var(--color-text-secondary, #6b6468); font-size:13px; }
    .stats dd { margin:0; font-size:22px; font-weight:700; }
    .stats small { color:var(--color-text-secondary, #6b6468); font-size:12px; }
    .health { display:flex; flex-wrap:wrap; align-items:center; gap:6px 20px; margin:0; padding:10px 16px; border:1px solid var(--color-border, #e3dde0); border-radius:12px; background:var(--color-surface, #fff); color:var(--color-text-secondary, #6b6468); font-size:13px; }
    .dot { width:8px; height:8px; margin-inline-end:-14px; border-radius:50%; background:#16a34a; }
    .stats dd { overflow-wrap:anywhere; }
    .two { display:grid; grid-template-columns:repeat(auto-fit, minmax(min(100%, 440px), 1fr)); gap:16px; align-items:start; min-width:0; }
  `],
})
export class SuperAdminDashboardComponent {
  private readonly data = inject(SuperAdminDataService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly summary = signal<SuperAdminSummary | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly label = auditLabel;
  protected readonly day = day;
  protected readonly moment = moment;
  protected readonly typeLabel = typeLabel;

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.data.getSummary().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (s) => { this.summary.set(s); this.loading.set(false); },
      error: (e) => { this.error.set(e?.error?.message || 'The overview could not be loaded.'); this.loading.set(false); },
    });
  }

  /** Sales in one currency: "Rs 3,091,600"; several: the biggest, with the others in the hint. */
  protected sales(list: { currency: string; amount: string }[] | undefined, i: number): string {
    const x = list?.[i];
    return x ? `${x.currency === 'PKR' ? 'Rs' : x.currency} ${this.num(x.amount)}` : 'Rs 0';
  }
  protected salesHint(list: { currency: string; amount: string }[] | undefined): string {
    if (!list || list.length <= 1) return 'All businesses';
    return 'Also ' + list.slice(1).map((_, i) => this.sales(list, i + 1)).join(', ');
  }

  protected num(v: string | number): string {
    return Number(v).toLocaleString('en-PK', { maximumFractionDigits: 0 });
  }

  protected uptime(hours: number): string {
    const n = hours >= 48 ? Math.floor(hours / 24) : hours >= 1 ? Math.round(hours) : Math.max(1, Math.round(hours * 60));
    const unit = hours >= 48 ? 'day' : hours >= 1 ? 'hour' : 'minute';
    return `${n} ${unit}${n === 1 ? '' : 's'}`;
  }
}
