/**
 * Businesses on ThriftOS (v2 review): a plain list with search, a status filter and a "Test" mark, newest first.
 * The platform's own account is not listed. A row opens the business.
 */
import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { API_ENDPOINTS } from '../../../../../core/config/api.config';
import { AppPageBodyComponent, AppPageComponent, AppPageHeaderComponent } from '../../../../../shared/ui';
import { Tenant } from '../tenant.models';
import { day, moment } from '../../console-format';
import { typeLabel } from '../../business-type';

type Row = Tenant & { isTest?: boolean; sortingStages?: number; _count?: Tenant['_count'] };
type Show = 'all' | 'real' | 'test' | 'off';

@Component({
  selector: 'app-tenants-list',
  standalone: true,
  imports: [FormsModule, RouterLink, AppPageComponent, AppPageHeaderComponent, AppPageBodyComponent],
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
          <div class="card flush table-wrap"><table class="plain">
            <thead><tr><th scope="col">Business</th><th scope="col">Works as</th><th scope="col">People</th><th scope="col">Last activity</th><th scope="col">Made</th></tr></thead>
            <tbody>
              @for (t of rows(); track t.id) {
                <tr (click)="open(t)" tabindex="0" (keydown.enter)="open(t)">
                  <td><a [routerLink]="['/admin/tenants', t.id]" (click)="$event.stopPropagation()">{{ t.name }}</a>@if (t.isTest) { <span class="tag test">Test</span> }@if (t.status !== 'ACTIVE') { <span class="tag off">Switched off</span> }<span class="code" dir="ltr">{{ t.companyCode }}</span></td>
                  <td>{{ typeLabel(t.sortingStages) }}</td>
                  <td>{{ t._count?.users ?? 0 }}</td>
                  <td class="when">{{ activity(t) }}</td>
                  <td class="when">{{ day(t.createdAt) }}</td>
                </tr>
              } @empty {
                <tr><td colspan="5" class="muted">{{ loaded() ? 'No business matches.' : 'Loading…' }}</td></tr>
              }
            </tbody>
          </table></div>
        }
      </app-page-body>
    </app-page>
  `,
  styleUrls: ['../../console.css'],
  styles: [`
    .bar { display:flex; flex-wrap:wrap; gap:12px; align-items:center; margin-bottom:12px; }
    .bar input { min-height:38px; min-width:min(260px, 100%); padding:0 12px; border:1px solid var(--color-border, #d6cfd3); border-radius:8px; font:inherit; background:var(--color-surface, #fff); color:inherit; }
    .seg { display:inline-flex; flex-wrap:wrap; gap:2px; padding:3px; border:1px solid var(--color-border, #e3dde0); border-radius:8px; background:var(--color-surface, #fff); }
    .seg button { min-height:32px; padding:0 12px; border:0; border-radius:6px; background:transparent; color:inherit; font:inherit; font-size:14px; font-weight:500; cursor:pointer; }
    .seg button.on { background:#f3e8ef; color:var(--color-primary, #6f3f63); font-weight:600; }
    .seg span { margin-inline-start:4px; color:var(--color-text-secondary, #6b6468); font-size:12px; }
    .card.flush { padding:4px 12px; }
    tbody tr { cursor:pointer; }
    tbody tr:hover { background:#faf7f9; }
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

  protected readonly day = day;
  protected readonly typeLabel = typeLabel;

  protected activity(t: Row): string {
    return activityLabel(t.lastActivity);
  }

  protected open(t: Row): void {
    void this.router.navigate(['/admin/tenants', t.id]);
  }
}

export function activityLabel(last: Tenant['lastActivity'], now = new Date()): string {
  if (!last) return 'No activity yet';
  const what = { sale: 'sale', payment: 'payment', container: 'container', app: 'used the app' }[last.kind];
  return `${moment(last.at, now)} · ${what}`;
}
