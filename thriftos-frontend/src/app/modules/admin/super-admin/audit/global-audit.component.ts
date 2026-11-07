/**
 * Audit trail (v2 review): what happened, in plain words, newest first, with who, which business and when. Filter by
 * business (the business page links here with ?business=), search the event or the person, and page through it.
 * Background noise (sessions renewed, console page views) is hidden unless "Show everything" is on.
 */
import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { API_ENDPOINTS } from '../../../../core/config/api.config';
import { AppPageBodyComponent, AppPageComponent, AppPageHeaderComponent } from '../../../../shared/ui';
import { auditLabel } from '../audit-labels';
import { moment } from '../console-format';

interface AuditRow {
  id: string; action: string; entityType: string | null; userName: string; tenantName: string; companyCode: string; ipAddress: string | null; createdAt: string; metadataJson: unknown;
}
const PAGE = 50;

@Component({
  selector: 'app-global-audit',
  standalone: true,
  imports: [FormsModule, JsonPipe, AppPageComponent, AppPageHeaderComponent, AppPageBodyComponent],
  template: `
    <app-page>
      <app-page-header>
        <div><h1 class="page-title">Audit trail</h1><p class="page-subtitle">What happened, who did it and when, in every business</p></div>
      </app-page-header>
      <app-page-body>
        <form class="bar" (ngSubmit)="go(1)">
          <select name="business" [(ngModel)]="business" (change)="go(1)" aria-label="Business">
            <option value="">All businesses</option>
            @for (b of businesses(); track b.id) { <option [value]="b.id">{{ b.name }}</option> }
          </select>
          <input type="search" name="q" [(ngModel)]="query" placeholder="Search event or person" aria-label="Search" />
          <button type="submit" class="btn">Search</button>
          <label class="opt"><input type="checkbox" name="all" [(ngModel)]="everything" (change)="go(1)" /> Show everything (sessions, page loads)</label>
        </form>
        @if (failed()) {
          <p class="err" role="alert">Could not load the audit trail.</p>
        } @else {
          <div class="card flush table-wrap"><table class="plain">
            <thead><tr><th scope="col">What</th><th scope="col">Who</th><th scope="col">Business</th><th scope="col">When</th><th scope="col"><span class="sr-only">Details</span></th></tr></thead>
            <tbody>
              @for (l of rows(); track l.id) {
                <tr>
                  <td>{{ label(l.action) }}</td>
                  <td>{{ l.userName }}</td>
                  <td>{{ l.tenantName }}</td>
                  <td class="when">{{ moment(l.createdAt) }}</td>
                  <td class="end"><button type="button" class="link" (click)="open.set(open() === l.id ? null : l.id)">{{ open() === l.id ? 'Hide' : 'Details' }}</button></td>
                </tr>
                @if (open() === l.id) {
                  <tr class="details"><td colspan="5"><code>{{ l.action }}</code> · IP {{ l.ipAddress || '—' }}<pre>{{ l.metadataJson | json }}</pre></td></tr>
                }
              } @empty { <tr><td colspan="5" class="muted">{{ loaded() ? 'Nothing matches.' : 'Loading…' }}</td></tr> }
            </tbody>
          </table></div>
          <div class="pager">
            <span class="muted">{{ total() }} events · page {{ page() }} of {{ pages() }}</span>
            <button type="button" class="btn" [disabled]="page() <= 1" (click)="go(page() - 1)">Newer</button>
            <button type="button" class="btn" [disabled]="page() >= pages()" (click)="go(page() + 1)">Older</button>
          </div>
        }
      </app-page-body>
    </app-page>
  `,
  styleUrls: ['../console.css'],
  styles: [`
    .bar { display:flex; flex-wrap:wrap; align-items:center; gap:8px; margin-bottom:12px; }
    .bar select, .bar input[type=search] { min-height:38px; padding:0 12px; border:1px solid var(--color-border, #d6cfd3); border-radius:8px; font:inherit; background:var(--color-surface, #fff); color:inherit; }
    .bar input[type=search] { min-width:min(240px, 100%); }
    .opt { display:flex; align-items:center; gap:6px; color:var(--color-text-secondary, #6b6468); font-size:14px; }
    .card.flush { padding:4px 12px; }
    tr.details td { background:#faf7f9; font-size:13px; }
    pre { margin:6px 0 0; white-space:pre-wrap; word-break:break-word; font-size:12px; }
    .pager { display:flex; flex-wrap:wrap; align-items:center; justify-content:flex-end; gap:8px; margin-top:12px; }
  `],
})
export class GlobalAuditComponent {
  private readonly http = inject(HttpClient);
  protected readonly rows = signal<AuditRow[]>([]);
  protected readonly businesses = signal<{ id: string; name: string }[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly loaded = signal(false);
  protected readonly failed = signal(false);
  protected readonly open = signal<string | null>(null);
  protected readonly label = auditLabel;
  protected readonly moment = moment;
  protected business = '';
  protected query = '';
  protected everything = false;

  constructor() {
    this.business = inject(ActivatedRoute).snapshot.queryParamMap.get('business') ?? '';
    this.http.get<{ data: { id: string; name: string }[] }>(`${API_ENDPOINTS.superadmin}/tenants`, { params: { page: 1, limit: 500 } }).subscribe({
      next: (r) => this.businesses.set(r.data.map((t) => ({ id: t.id, name: t.name })).sort((a, b) => a.name.localeCompare(b.name))),
      error: () => undefined,
    });
    this.go(1);
  }

  protected pages(): number {
    return Math.max(1, Math.ceil(this.total() / PAGE));
  }

  protected go(page: number): void {
    this.page.set(page);
    this.failed.set(false);
    const params: Record<string, string | number> = { page, limit: PAGE };
    if (this.business) params['tenantId'] = this.business;
    if (this.query.trim()) params['q'] = this.query.trim();
    if (this.everything) params['all'] = 'true';
    this.http.get<{ data: AuditRow[]; total: number }>(`${API_ENDPOINTS.superadmin}/audit-logs`, { params }).subscribe({
      next: (r) => { this.rows.set(r.data); this.total.set(r.total); this.loaded.set(true); },
      error: () => this.failed.set(true),
    });
  }
}
