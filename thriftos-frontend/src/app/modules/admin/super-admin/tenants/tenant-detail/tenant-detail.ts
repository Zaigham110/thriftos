/**
 * A business in the super admin console (v2 review), in plain words: who the owner is and their phone, the people
 * and how they sign in (with New PIN / New password / Edit), what the business has done, and its recent activity.
 * A test business can be filled with sample data and deleted. Support view opens it read-only.
 */
import { HttpClient } from '@angular/common/http';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { API_ENDPOINTS } from '../../../../../core/config/api.config';
import { AuthService } from '../../../../../core/auth';
import { localPhone } from '../../../../../shared/phone';
import { AppPageBodyComponent, AppPageComponent, AppPageHeaderComponent } from '../../../../../shared/ui';
import { auditLabel } from '../../audit-labels';
import { activityLabel } from '../tenants-list/tenants-list';
import { Tenant } from '../tenant.models';

interface Person {
  id: string; name: string; email: string | null; phone: string | null; hasPin: boolean; pinLocked: boolean; isActive: boolean; roles: string[];
}
type Business = Tenant & {
  defaultLanguage?: 'ur' | 'en';
  isTest?: boolean;
  sample?: { state: 'running' | 'done' | 'failed'; sales?: number; bales?: number; message?: string } | null;
  users?: Person[];
  _count?: Tenant['_count'] & { sales?: number; customers?: number };
};
type Sheet = 'edit' | 'person' | 'switch' | 'support' | 'delete' | 'secret' | null;

@Component({
  selector: 'app-tenant-detail',
  standalone: true,
  imports: [FormsModule, RouterLink, DatePipe, AppPageComponent, AppPageHeaderComponent, AppPageBodyComponent],
  template: `
    <app-page>
      <app-page-header>
        <div class="head">
          <a class="back" routerLink="/admin/tenants">← Businesses</a>
          @if (b(); as t) {
            <h1 class="page-title">{{ t.name }}
              @if (t.isTest) { <span class="chip test">Test</span> }
              @if (t.status !== 'ACTIVE') { <span class="chip off">Switched off</span> }
            </h1>
            <p class="page-subtitle">{{ t.defaultLanguage === 'en' ? 'English' : 'Urdu' }} · {{ t.currencyCode }} · made {{ t.createdAt | date: 'd MMM y' }} · code <span dir="ltr">{{ t.companyCode }}</span></p>
          }
        </div>
        @if (b(); as t) {
          <div class="row">
            @if (t.status === 'ACTIVE') { <button type="button" class="btn primary" (click)="open('support')">Open support view</button> }
            <button type="button" class="btn" (click)="openEdit()">Edit</button>
            <button type="button" class="btn" (click)="open('switch')">{{ t.status === 'ACTIVE' ? 'Switch off' : 'Switch on' }}</button>
          </div>
        }
      </app-page-header>
      <app-page-body>
        @if (error() && !sheet()) { <p class="err" role="alert">{{ error() }}</p> }
        @if (failed()) {
          <p class="err" role="alert">Could not load this business. <button type="button" class="link" (click)="load()">Try again</button></p>
        } @else if (b(); as t) {
          <div class="page">
            <section class="card test" [class.on]="t.isTest">
              @if (t.isTest) {
                <div>
                  <h2>Test business</h2>
                  <p class="muted">For trying ThriftOS out. It can get sample data and be deleted with everything in it.</p>
                  @if (t.sample?.state === 'running') { <p class="note" role="status">Adding sample data… this takes about a minute.</p> }
                  @if (t.sample?.state === 'done') { <p class="note ok" role="status">Sample data added: {{ t.sample?.sales }} sales, {{ t.sample?.bales }} bales.</p> }
                  @if (t.sample?.state === 'failed') { <p class="note bad" role="alert">Sample data failed: {{ t.sample?.message }}</p> }
                </div>
                <div class="row">
                  @if (empty() && t.sample?.state !== 'running') { <button type="button" class="btn primary" [disabled]="busy()" (click)="fillSample()">Fill with sample data</button> }
                  <button type="button" class="btn" [disabled]="busy()" (click)="markTest(false)">Mark as real</button>
                  <button type="button" class="btn danger" [disabled]="t.sample?.state === 'running'" (click)="open('delete')">Delete business</button>
                </div>
              } @else {
                <p class="muted">A real business. If this is only for trying ThriftOS out, mark it as a test to fill it with sample data or delete it later.</p>
                <button type="button" class="btn" [disabled]="busy()" (click)="markTest(true)">Mark as test</button>
              }
            </section>

            <dl class="stats">
              <div><dt>People</dt><dd>{{ t._count?.users ?? 0 }}</dd></div>
              <div><dt>Containers</dt><dd>{{ t._count?.containers ?? 0 }}</dd></div>
              <div><dt>Customers</dt><dd>{{ t._count?.customers ?? 0 }}</dd></div>
              <div><dt>Sales</dt><dd>{{ t._count?.sales ?? 0 }}</dd></div>
              <div><dt>Last activity</dt><dd class="small">{{ activityLabel(t.lastActivity) }}</dd></div>
            </dl>

            <section class="card">
              <h2>People</h2>
              <table>
                <thead><tr><th scope="col">Name</th><th scope="col">Phone</th><th scope="col">Email</th><th scope="col">Role</th><th scope="col">Signs in with</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead>
                <tbody>
                  @for (p of t.users ?? []; track p.id) {
                    <tr>
                      <td>{{ p.name }} @if (!p.isActive) { <span class="chip off">blocked</span> }</td>
                      <td dir="ltr">{{ phone(p.phone) || '—' }}</td>
                      <td>{{ p.email || '—' }}</td>
                      <td>{{ p.roles.join(', ') || '—' }}</td>
                      <td>{{ signIn(p) }} @if (p.pinLocked) { <span class="chip bad">locked</span> }</td>
                      <td class="acts">
                        @if (p.phone) { <button type="button" class="btn sm" [disabled]="busy()" (click)="newPin(p)">New PIN</button> }
                        @if (p.email) { <button type="button" class="btn sm" [disabled]="busy()" (click)="newPassword(p)">New password</button> }
                        <button type="button" class="btn sm" (click)="editPerson(p)">Edit</button>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </section>

            <section class="card">
              <div class="row between"><h2>Recent activity</h2><a class="link" routerLink="/admin/audit" [queryParams]="{ business: t.id }">All of it</a></div>
              <table>
                <tbody>
                  @for (l of t.auditLogs ?? []; track l.id) {
                    <tr><td>{{ label(l.action) }}</td><td>{{ l.userName }}</td><td class="end">{{ l.createdAt | date: 'd MMM, h:mm a' }}</td></tr>
                  } @empty { <tr><td class="muted">Nothing yet.</td></tr> }
                </tbody>
              </table>
            </section>
          </div>
        } @else {
          <p class="muted">Loading…</p>
        }
      </app-page-body>
    </app-page>

    @if (sheet(); as s) {
      <div class="backdrop" (click)="close()"></div>
      <div class="dialog" role="dialog" aria-modal="true" [attr.aria-label]="title(s)">
        <h2>{{ title(s) }}</h2>
        @switch (s) {
          @case ('edit') {
            <form id="d-form" class="form" (ngSubmit)="saveEdit()">
              <label>Business name<input name="name" required maxlength="100" [(ngModel)]="editName" /></label>
              <fieldset><legend>Opens in</legend>
                <label class="opt"><input type="radio" name="lang" value="ur" [(ngModel)]="editLang" /> Urdu</label>
                <label class="opt"><input type="radio" name="lang" value="en" [(ngModel)]="editLang" /> English</label>
              </fieldset>
            </form>
          }
          @case ('person') {
            <form id="d-form" class="form" (ngSubmit)="savePerson()">
              <label>Name<input name="pname" required maxlength="100" [(ngModel)]="personName" /></label>
              <label>Phone (their login with the PIN)<input name="pphone" maxlength="30" inputmode="tel" dir="ltr" [(ngModel)]="personPhone" placeholder="0300 1234567" /></label>
            </form>
          }
          @case ('switch') {
            <p>{{ b()?.status === 'ACTIVE' ? 'Nobody in ' + b()?.name + ' can sign in until you switch it on again. Nothing is deleted.' : b()?.name + ' can sign in and work again.' }}</p>
          }
          @case ('support') {
            <p>You see {{ b()?.name }} as its owner does, read-only: nothing can be changed. Opening it is recorded.</p>
            <label class="form">Why (optional, kept in the audit trail)<textarea rows="2" maxlength="300" [(ngModel)]="reason"></textarea></label>
          }
          @case ('delete') {
            <p>This deletes {{ b()?.name }} and everything in it: people, containers, stock, sales and khata. It cannot be undone.</p>
            <label class="form">Type the business name to delete it<input [(ngModel)]="confirmName" autocomplete="off" [placeholder]="b()?.name" /></label>
          }
          @case ('secret') {
            @if (secret(); as x) {
              @if (x.pin) {
                <p>New PIN for {{ x.name }} (shown only now). Their old PIN no longer works, and they are signed out.</p>
                <p class="pin" dir="ltr">{{ x.pin }}</p>
                <label class="form">Message<textarea readonly rows="6" dir="auto" [value]="x.message"></textarea></label>
              } @else {
                <p>Temporary password for {{ x.name }} ({{ x.email }}), shown only now. They are signed out.</p>
                <p class="pin" dir="ltr">{{ x.password }}</p>
              }
            }
          }
        }
        @if (error()) { <p class="err" role="alert">{{ error() }}</p> }
        <div class="row end">
          @switch (s) {
            @case ('secret') {
              @if (secret()?.pin) {
                <a class="btn primary" [href]="whatsapp()" target="_blank" rel="noopener">Send on WhatsApp</a>
                <button type="button" class="btn" (click)="copy(secret()!.message!)">{{ copied() ? 'Copied' : 'Copy message' }}</button>
              }
              <button type="button" class="btn" (click)="close()">Done</button>
            }
            @default {
              <button type="button" class="btn" (click)="close()">Cancel</button>
              @if (s === 'edit' || s === 'person') { <button type="submit" form="d-form" class="btn primary" [disabled]="busy()">Save</button> }
              @if (s === 'switch') { <button type="button" class="btn" [class.danger]="b()?.status === 'ACTIVE'" [class.primary]="b()?.status !== 'ACTIVE'" [disabled]="busy()" (click)="toggle()">{{ b()?.status === 'ACTIVE' ? 'Switch off' : 'Switch on' }}</button> }
              @if (s === 'support') { <button type="button" class="btn primary" [disabled]="busy()" (click)="support()">Open read-only</button> }
              @if (s === 'delete') { <button type="button" class="btn danger" [disabled]="busy() || confirmName.trim().toLowerCase() !== (b()?.name ?? '').trim().toLowerCase()" (click)="remove()">Delete for good</button> }
            }
          }
        </div>
      </div>
    }
  `,
  styles: [`
    .head { display:grid; gap:4px; }
    .back { color:var(--color-primary, #6f3f63); font-weight:600; font-size:13px; text-decoration:none; }
    .page-title { display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin:0; }
    .page { display:grid; gap:16px; }
    .card { display:grid; gap:12px; padding:16px 20px; border:1px solid var(--color-border, #e3dde0); border-radius:12px; background:var(--color-surface, #fff); }
    .card.test { grid-template-columns:minmax(0, 1fr) auto; align-items:center; }
    .card.test.on { border-color:#d9b44a; background:#fffbeb; }
    .card h2 { margin:0; font-size:16px; }
    .stats { display:grid; grid-template-columns:repeat(5, minmax(0, 1fr)); gap:12px; margin:0; }
    .stats div { padding:12px 16px; border:1px solid var(--color-border, #e3dde0); border-radius:12px; background:var(--color-surface, #fff); }
    .stats dt { color:var(--color-text-secondary, #6b6468); font-size:13px; }
    .stats dd { margin:4px 0 0; font-size:22px; font-weight:700; }
    .stats dd.small { font-size:14px; font-weight:600; }
    table { width:100%; border-collapse:collapse; font-size:14px; }
    th { color:var(--color-text-secondary, #6b6468); font-size:12px; font-weight:600; text-align:start; }
    th, td { padding:8px; border-bottom:1px solid var(--color-border, #eee8eb); text-align:start; }
    td.end { text-align:end; color:var(--color-text-secondary, #6b6468); white-space:nowrap; }
    td.acts { text-align:end; white-space:nowrap; }
    .row { display:flex; flex-wrap:wrap; align-items:center; gap:8px; }
    .row.between { justify-content:space-between; }
    .row.end { justify-content:flex-end; }
    .btn { display:inline-flex; align-items:center; min-height:38px; padding:0 14px; border:1px solid var(--color-border, #d6cfd3); border-radius:8px; background:transparent; color:inherit; font:inherit; font-weight:600; text-decoration:none; cursor:pointer; }
    .btn.sm { min-height:30px; padding:0 10px; font-size:13px; }
    .btn.primary { border-color:var(--color-primary, #6f3f63); background:var(--color-primary, #6f3f63); color:#fff; }
    .btn.danger { border-color:var(--color-danger, #b3261e); color:var(--color-danger, #b3261e); }
    .btn:disabled { opacity:.5; cursor:default; }
    .link { border:0; background:none; padding:0; color:var(--color-primary, #6f3f63); font:inherit; font-weight:600; text-decoration:none; cursor:pointer; }
    .chip { padding:2px 8px; border-radius:999px; font-size:12px; font-weight:600; background:#eee; }
    .chip.test { background:#fef3c7; color:#92400e; }
    .chip.off, .chip.bad { background:#fee2e2; color:#b91c1c; }
    .muted { margin:0; color:var(--color-text-secondary, #6b6468); }
    .note { margin:6px 0 0; font-weight:600; }
    .note.ok { color:#047857; }
    .note.bad, .err { color:var(--color-danger, #b3261e); }
    .err { margin:0; }
    .backdrop { position:fixed; inset:0; background:rgba(0,0,0,.35); z-index:50; }
    .dialog { position:fixed; z-index:51; inset-inline:0; top:12vh; margin-inline:auto; width:min(480px, calc(100vw - 32px)); display:grid; gap:12px; padding:20px; border-radius:12px; background:var(--color-surface, #fff); color:inherit; box-shadow:0 10px 40px rgba(0,0,0,.2); }
    .dialog h2 { margin:0; font-size:18px; }
    .dialog p { margin:0; }
    .form { display:grid; gap:10px; }
    .form label, label.form { display:grid; gap:6px; font-weight:600; font-size:14px; }
    .form input:not([type=radio]), label.form input, label.form textarea, .form textarea { min-height:40px; padding:8px 12px; border:1px solid var(--color-border, #d6cfd3); border-radius:8px; font:inherit; font-weight:400; background:transparent; color:inherit; }
    fieldset { display:flex; gap:16px; margin:0; padding:0; border:0; }
    legend { margin-block-end:6px; font-weight:600; font-size:14px; }
    .opt { display:flex; align-items:center; gap:6px; font-weight:400; }
    .pin { font-size:26px; font-weight:700; letter-spacing:.15em; }
    .sr-only { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); }
    @media (max-width: 900px) { .stats { grid-template-columns:repeat(2, minmax(0, 1fr)); } .card.test { grid-template-columns:1fr; } table { display:block; overflow-x:auto; } }
  `],
})
export class TenantDetailComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly api = `${API_ENDPOINTS.superadmin}/tenants`;

  protected readonly b = signal<Business | null>(null);
  protected readonly failed = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly sheet = signal<Sheet>(null);
  protected readonly secret = signal<{ name: string; phone?: string; pin?: string; message?: string; email?: string; password?: string } | null>(null);
  protected readonly copied = signal(false);
  protected readonly activityLabel = activityLabel;
  protected readonly label = auditLabel;
  protected readonly phone = localPhone;
  protected readonly empty = computed(() => {
    const c = this.b()?._count;
    return !c?.containers && !c?.sales && !c?.customers;
  });
  protected editName = '';
  protected editLang: 'ur' | 'en' = 'ur';
  protected personId = '';
  protected personName = '';
  protected personPhone = '';
  protected reason = '';
  protected confirmName = '';
  private poll: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.load();
    this.destroyRef.onDestroy(() => this.stopPoll());
  }

  protected load(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;
    this.failed.set(false);
    this.http.get<Business>(`${this.api}/${id}`).subscribe({
      next: (t) => {
        this.b.set(t);
        if (t.sample?.state === 'running') this.startPoll();
        else this.stopPoll();
      },
      error: () => this.failed.set(true),
    });
  }

  protected title(s: Exclude<Sheet, null>): string {
    const t = this.b();
    return {
      edit: 'Edit business',
      person: 'Edit person',
      switch: t?.status === 'ACTIVE' ? 'Switch off this business?' : 'Switch this business on?',
      support: 'Open support view',
      delete: 'Delete this test business?',
      secret: this.secret()?.pin ? 'New PIN' : 'New password',
    }[s];
  }

  protected signIn(p: Person): string {
    if (p.phone && p.hasPin) return p.email ? 'PIN or email' : 'Phone and PIN';
    if (p.email) return 'Email and password';
    return 'Not set';
  }

  protected open(s: Exclude<Sheet, null>): void {
    this.error.set('');
    this.reason = '';
    this.confirmName = '';
    this.sheet.set(s);
  }

  protected close(): void {
    this.sheet.set(null);
    this.secret.set(null);
    this.error.set('');
  }

  protected openEdit(): void {
    const t = this.b();
    if (!t) return;
    this.editName = t.name;
    this.editLang = t.defaultLanguage === 'en' ? 'en' : 'ur';
    this.open('edit');
  }

  protected saveEdit(): void {
    this.run(this.http.patch(`${this.api}/${this.b()!.id}`, { name: this.editName.trim(), defaultLanguage: this.editLang }), () => this.close());
  }

  protected editPerson(p: Person): void {
    this.personId = p.id;
    this.personName = p.name;
    this.personPhone = localPhone(p.phone);
    this.open('person');
  }

  protected savePerson(): void {
    const body = { name: this.personName.trim(), ...(this.personPhone.trim() ? { phone: this.personPhone.trim() } : {}) };
    this.run(this.http.patch(`${this.api}/${this.b()!.id}/users/${this.personId}`, body), () => this.close());
  }

  protected newPin(p: Person): void {
    this.error.set('');
    this.busy.set(true);
    this.http.post<{ pin: string; phone: string; message: string }>(`${this.api}/${this.b()!.id}/users/${p.id}/pin`, {}).subscribe({
      next: (r) => {
        this.busy.set(false);
        this.secret.set({ name: p.name, ...r });
        this.sheet.set('secret');
        this.load();
      },
      error: (e) => this.fail(e),
    });
  }

  protected newPassword(p: Person): void {
    this.error.set('');
    this.busy.set(true);
    this.http.post<{ email: string; temporaryPassword: string }>(`${this.api}/${this.b()!.id}/users/${p.id}/password`, {}).subscribe({
      next: (r) => {
        this.busy.set(false);
        this.secret.set({ name: p.name, email: r.email, password: r.temporaryPassword });
        this.sheet.set('secret');
      },
      error: (e) => this.fail(e),
    });
  }

  protected toggle(): void {
    const t = this.b()!;
    this.run(this.http.post(`${this.api}/${t.id}/${t.status === 'ACTIVE' ? 'deactivate' : 'activate'}`, {}), () => this.close());
  }

  protected support(): void {
    const t = this.b()!;
    this.busy.set(true);
    this.auth.impersonateTenant(t.id, { reason: this.reason.trim() || undefined, name: t.name }).subscribe({
      next: () => { this.busy.set(false); this.close(); },
      error: (e) => this.fail(e),
    });
  }

  protected markTest(isTest: boolean): void {
    this.run(this.http.post(`${this.api}/${this.b()!.id}/test`, { isTest }));
  }

  protected fillSample(): void {
    this.run(this.http.post(`${this.api}/${this.b()!.id}/sample-data`, {}));
  }

  protected remove(): void {
    const t = this.b()!;
    this.busy.set(true);
    this.http.delete(`${this.api}/${t.id}`, { body: { confirmName: this.confirmName.trim() } }).subscribe({
      next: () => {
        this.busy.set(false);
        this.close();
        void this.router.navigate(['/admin/tenants']);
      },
      error: (e) => this.fail(e),
    });
  }

  protected whatsapp(): string {
    const x = this.secret();
    return `https://wa.me/${(x?.phone ?? '').replace(/\D/g, '')}?text=${encodeURIComponent(x?.message ?? '')}`;
  }

  protected copy(text: string): void {
    void navigator.clipboard?.writeText(text).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    });
  }

  private run(req: ReturnType<HttpClient['post']>, done?: () => void): void {
    this.error.set('');
    this.busy.set(true);
    req.subscribe({
      next: () => {
        this.busy.set(false);
        done?.();
        this.load();
      },
      error: (e) => this.fail(e),
    });
  }

  private fail(e: { error?: { message?: string | string[] } }): void {
    this.busy.set(false);
    const m = e?.error?.message;
    this.error.set(Array.isArray(m) ? m.join('. ') : m || 'That did not work. Try again.');
  }

  private startPoll(): void {
    if (this.poll) return;
    this.poll = setInterval(() => this.load(), 3000);
  }

  private stopPoll(): void {
    if (this.poll) clearInterval(this.poll);
    this.poll = null;
  }
}
