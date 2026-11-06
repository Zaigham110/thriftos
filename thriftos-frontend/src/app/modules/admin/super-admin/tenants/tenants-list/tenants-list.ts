/**
 * Businesses on ThriftOS (v2 review): a plain list with search, a status filter and a "Test" mark, newest first.
 * The platform's own account is not listed. A row opens the business.
 */
import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { API_ENDPOINTS } from '../../../../../core/config/api.config';
import { AppPageBodyComponent, AppPageComponent, AppPageHeaderComponent } from '../../../../../shared/ui';
import { Tenant } from '../tenant.models';

type Row = Tenant & { isTest?: boolean; _count?: Tenant['_count'] };
type Show = 'all' | 'real' | 'test' | 'off';

@Component({
  selector: 'app-tenants-list',
  standalone: true,
  imports: [FormsModule, RouterLink, DatePipe, AppPageComponent, AppPageHeaderComponent, AppPageBodyComponent],
  template: `
    <app-page>
      <app-page-header>
        <div><h1 class="page-title">Businesses</h1><p class="page-subtitle">{{ subtitle() }}</p></div>
        <a class="btn primary" routerLink="/admin/tenants/quick">New business</a>
      </app-page-header>
      <app-page-body>
        <div class="bar">
          <input type="search" [(ngModel)]="query" placeholder="Search name or code" aria-label="Search businesses" />
          <div class="seg" role="group" aria-label="Show">
            @for (s of shows; track s.id) { <button type="button" [class.on]="show() === s.id" [attr.aria-pressed]="show() === s.id" (click)="show.set(s.id)">{{ s.label }} <span>{{ count(s.id) }}</span></button> }
          </div>
        </div>
        @if (failed()) {
          <p class="err" role="alert">Could not load the businesses. <button type="button" class="link" (click)="load()">Try again</button></p>
        } @else {
          <table>
            <thead><tr><th scope="col">Business</th><th scope="col">People</th><th scope="col">Last activity</th><th scope="col">Made</th></tr></thead>
            <tbody>
              @for (t of rows(); track t.id) {
                <tr (click)="open(t)" tabindex="0" (keydown.enter)="open(t)">
                  <td><a [routerLink]="['/admin/tenants', t.id]" (click)="$event.stopPropagation()">{{ t.name }}</a>
                    @if (t.isTest) { <span class="chip test">Test</span> }
                    @if (t.status !== 'ACTIVE') { <span class="chip off">Switched off</span> }
                    <small dir="ltr">{{ t.companyCode }}</small></td>
                  <td>{{ t._count?.users ?? 0 }}</td>
                  <td>{{ activity(t) }}</td>
                  <td>{{ t.createdAt | date: 'd MMM y' }}</td>
                </tr>
              } @empty {
                <tr><td colspan="4" class="muted">{{ loaded() ? 'No business matches.' : 'Loading…' }}</td></tr>
              }
            </tbody>
          </table>
        }
      </app-page-body>
    </app-page>
  `,
  styles: [`
    .bar { display:flex; flex-wrap:wrap; gap:12px; align-items:center; margin-bottom:12px; }
    .bar input { min-height:38px; min-width:260px; padding:0 12px; border:1px solid var(--color-border, #d6cfd3); border-radius:8px; font:inherit; background:transparent; color:inherit; }
    .seg { display:inline-flex; gap:2px; padding:3px; border:1px solid var(--color-border, #e3dde0); border-radius:8px; }
    .seg button { padding:6px 12px; border:0; border-radius:6px; background:transparent; color:inherit; font:inherit; font-weight:500; cursor:pointer; }
    .seg button.on { background:#f3e8ef; color:var(--color-primary, #6f3f63); font-weight:600; }
    .seg span { margin-inline-start:4px; color:var(--color-text-secondary, #6b6468); font-size:12px; }
    table { width:100%; border-collapse:collapse; font-size:14px; background:var(--color-surface, #fff); border:1px solid var(--color-border, #e3dde0); border-radius:12px; overflow:hidden; }
    th { color:var(--color-text-secondary, #6b6468); font-size:12px; font-weight:600; text-align:start; }
    th, td { padding:10px 12px; border-bottom:1px solid var(--color-border, #eee8eb); text-align:start; }
    tbody tr { cursor:pointer; }
    tbody tr:hover { background:#faf7f9; }
    td a { color:inherit; font-weight:600; text-decoration:none; }
    td small { margin-inline-start:8px; color:var(--color-text-secondary, #6b6468); }
    .chip { margin-inline-start:6px; padding:2px 8px; border-radius:999px; font-size:12px; font-weight:600; }
    .chip.test { background:#fef3c7; color:#92400e; }
    .chip.off { background:#fee2e2; color:#b91c1c; }
    .btn { display:inline-flex; align-items:center; min-height:38px; padding:0 14px; border-radius:8px; font-weight:600; text-decoration:none; }
    .btn.primary { background:var(--color-primary, #6f3f63); color:#fff; }
    .muted { color:var(--color-text-secondary, #6b6468); }
    .err { color:var(--color-danger, #b3261e); }
    .link { border:0; background:none; padding:0; color:var(--color-primary, #6f3f63); font:inherit; font-weight:600; cursor:pointer; }
  `],
})
export class TenantsListComponent {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  protected readonly all = signal<Row[]>([]);
  protected readonly loaded = signal(false);
  protected readonly failed = signal(false);
  protected readonly show = signal<Show>('all');
  protected query = '';
  protected readonly shows: { id: Show; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'real', label: 'Real' },
    { id: 'test', label: 'Test' },
    { id: 'off', label: 'Switched off' },
  ];
  private readonly q = signal('');

  protected readonly subtitle = computed(() => {
    const rows = this.all();
    const tests = rows.filter((r) => r.isTest).length;
    return `${rows.length} businesses${tests ? `, ${tests} for testing` : ''}`;
  });

  constructor() {
    this.load();
  }

  protected load(): void {
    this.failed.set(false);
    this.http.get<{ data: Row[] }>(`${API_ENDPOINTS.superadmin}/tenants`, { params: { page: 1, limit: 500 } }).subscribe({
      next: (r) => { this.all.set(r.data); this.loaded.set(true); },
      error: () => this.failed.set(true),
    });
  }

  private match(t: Row, s: Show): boolean {
    if (s === 'real') return !t.isTest;
    if (s === 'test') return !!t.isTest;
    if (s === 'off') return t.status !== 'ACTIVE';
    return true;
  }

  protected count(s: Show): number {
    return this.all().filter((t) => this.match(t, s)).length;
  }

  protected rows(): Row[] {
    const q = this.query.trim().toLowerCase();
    return this.all().filter((t) => this.match(t, this.show()) && (!q || t.name.toLowerCase().includes(q) || t.companyCode.toLowerCase().includes(q)));
  }

  protected activity(t: Row): string {
    return activityLabel(t.lastActivity);
  }

  protected open(t: Row): void {
    void this.router.navigate(['/admin/tenants', t.id]);
  }
}

export function activityLabel(last: Tenant['lastActivity'], now = new Date()): string {
  if (!last) return 'No activity yet';
  const at = new Date(last.at);
  const what = { sale: 'sale', payment: 'payment', container: 'container', app: 'used the app' }[last.kind];
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((day(now) - day(at)) / 86_400_000);
  const time = at.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true });
  const when = days <= 0 ? `Today ${time}` : days === 1 ? `Yesterday ${time}` : days < 30 ? `${days} days ago` : at.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${when} · ${what}`;
}
