/**
 * Everyone on ThriftOS (v2 review): name, phone, email, business, role and how they sign in. Search finds a person by
 * name, phone, email or business; a row opens their business, where New PIN, New password and Edit are.
 */
import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { API_ENDPOINTS } from '../../../../core/config/api.config';
import { localPhone } from '../../../../shared/phone';
import { AppPageBodyComponent, AppPageComponent, AppPageHeaderComponent } from '../../../../shared/ui';

interface PersonRow {
  id: string; name: string; email: string | null; phone: string | null; hasPin: boolean; pinLocked: boolean; isActive: boolean;
  tenantId: string; tenantName: string; companyCode: string; roles: string[];
}

@Component({
  selector: 'app-global-users',
  standalone: true,
  imports: [FormsModule, AppPageComponent, AppPageHeaderComponent, AppPageBodyComponent],
  template: `
    <app-page>
      <app-page-header>
        <div><h1 class="page-title">People</h1><p class="page-subtitle">Everyone who can sign in, in every business ({{ total() }})</p></div>
      </app-page-header>
      <app-page-body>
        <form class="bar" (ngSubmit)="search()">
          <input type="search" name="q" [(ngModel)]="query" placeholder="Name, phone, email or business" aria-label="Search people" />
          <button type="submit" class="btn">Search</button>
        </form>
        @if (failed()) {
          <p class="err" role="alert">Could not load people.</p>
        } @else {
          <div class="card flush table-wrap"><table class="plain">
            <thead><tr><th scope="col">Name</th><th scope="col">Phone</th><th scope="col">Email</th><th scope="col">Business</th><th scope="col">Role</th><th scope="col">Signs in with</th></tr></thead>
            <tbody>
              @for (p of rows(); track p.id) {
                <tr (click)="open(p)" tabindex="0" (keydown.enter)="open(p)">
                  <td><strong>{{ p.name }}</strong>@if (!p.isActive) { <span class="tag off">Blocked</span> }</td>
                  <td dir="ltr">{{ phone(p.phone) || '—' }}</td>
                  <td>{{ p.email || '—' }}</td>
                  <td>{{ p.tenantName }}</td>
                  <td>{{ p.roles.join(', ') || (p.companyCode === 'SYSTEM' ? 'Super admin' : '—') }}</td>
                  <td>{{ signIn(p) }}@if (p.pinLocked) { <span class="tag bad">Locked</span> }</td>
                </tr>
              } @empty { <tr><td colspan="6" class="muted">{{ loaded() ? 'Nobody matches.' : 'Loading…' }}</td></tr> }
            </tbody>
          </table></div>
          @if (total() > rows().length) { <p class="muted">Showing {{ rows().length }} of {{ total() }}. Search to narrow it down.</p> }
        }
      </app-page-body>
    </app-page>
  `,
  styleUrls: ['../console.css'],
  styles: [`
    .bar { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:12px; }
    .bar input { min-height:38px; min-width:min(300px, 100%); padding:0 12px; border:1px solid var(--color-border, #d6cfd3); border-radius:8px; font:inherit; background:var(--color-surface, #fff); color:inherit; }
    .card.flush { padding:4px 12px; }
    tbody tr { cursor:pointer; }
    tbody tr:hover { background:#faf7f9; }
    p.muted { margin-top:8px; }
  `],
})
export class GlobalUsersComponent {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  protected readonly rows = signal<PersonRow[]>([]);
  protected readonly total = signal(0);
  protected readonly loaded = signal(false);
  protected readonly failed = signal(false);
  protected readonly phone = localPhone;
  protected query = '';

  constructor() {
    this.search();
  }

  protected search(): void {
    this.failed.set(false);
    const params: Record<string, string | number> = { page: 1, limit: 200 };
    if (this.query.trim()) params['search'] = this.query.trim();
    this.http.get<{ data: PersonRow[]; total: number }>(`${API_ENDPOINTS.superadmin}/users`, { params }).subscribe({
      next: (r) => { this.rows.set(r.data); this.total.set(r.total); this.loaded.set(true); },
      error: () => this.failed.set(true),
    });
  }

  protected signIn(p: PersonRow): string {
    if (p.phone && p.hasPin) return p.email ? 'PIN or email' : 'Phone and PIN';
    return p.email ? 'Email and password' : 'Not set';
  }

  protected open(p: PersonRow): void {
    if (p.companyCode !== 'SYSTEM') void this.router.navigate(['/admin/tenants', p.tenantId]);
  }
}
