import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { API_ENDPOINTS } from '../../../../../core/config/api.config';
import { AuthService } from '../../../../../core/auth';
import { AppPageBodyComponent, AppPageComponent, AppPageHeaderComponent, AppStackComponent } from '../../../../../shared/ui';

interface QuickResult {
  tenant: { id: string; name: string; companyCode: string };
  owner: { id: string; name: string; phone: string; email: string | null };
  pin: string;
  signInUrl: string;
  welcome: string;
  isTest?: boolean;
}

/**
 * v2 6.5: a business for a customer in under 2 minutes. Business name, owner's name and phone (email, language and
 * sorting optional) → the business with its defaults, the owner in the Admin role with a 6-digit PIN, and a welcome
 * message to send on WhatsApp. The PIN is shown once.
 */
@Component({
  selector: 'app-tenant-quick',
  standalone: true,
  imports: [FormsModule, RouterLink, AppPageComponent, AppPageHeaderComponent, AppPageBodyComponent, AppStackComponent],
  template: `
    <app-page>
      <app-page-header>
        <app-stack direction="vertical" spacing="xs">
          <h1 class="page-title">New business</h1>
          <p class="page-subtitle">Three fields. The owner signs in with their phone and a PIN.</p>
        </app-stack>
      </app-page-header>
      <app-page-body>
        @if (result(); as r) {
          <section class="qc done" aria-live="polite">
            <h2>{{ r.tenant.name }} is ready</h2>
            <dl>
              <dt>Owner</dt><dd>{{ r.owner.name }} · <span dir="ltr">{{ r.owner.phone }}</span></dd>
              <dt>PIN</dt><dd><strong class="pin" dir="ltr">{{ r.pin }}</strong> <small>shown only now</small></dd>
              <dt>Code</dt><dd dir="ltr">{{ r.tenant.companyCode }}</dd>
            </dl>
            <label class="msg">Welcome message
              <textarea readonly rows="7" dir="auto" [value]="r.welcome"></textarea>
            </label>
            <div class="row">
              <a class="btn primary" [href]="whatsapp(r)" target="_blank" rel="noopener">Send on WhatsApp</a>
              <button type="button" class="btn" (click)="copy(r.welcome)">{{ copied() ? 'Copied' : 'Copy message' }}</button>
              <a class="btn" [routerLink]="['/admin/tenants', r.tenant.id]">{{ r.isTest ? 'Business page (sample data)' : 'Business page' }}</a>
              <button type="button" class="btn" (click)="open(r)">Open support view</button>
              <button type="button" class="btn" (click)="again()">Make another</button>
            </div>
          </section>
        } @else {
          <form class="qc" (ngSubmit)="save()" #f="ngForm">
            <label>Business name<input name="businessName" [(ngModel)]="businessName" required minlength="2" maxlength="100" autocomplete="off" placeholder="Al-Madina Traders" /></label>
            <label>Owner's name<input name="ownerName" [(ngModel)]="ownerName" required maxlength="100" autocomplete="off" placeholder="Haji Rafiq" /></label>
            <label>Owner's phone<input name="ownerPhone" [(ngModel)]="ownerPhone" required maxlength="30" inputmode="tel" autocomplete="off" dir="ltr" placeholder="0300 1234567" /></label>
            <label class="opt test"><input type="checkbox" name="isTest" [(ngModel)]="isTest" /> Test business: for trying ThriftOS out. It can get sample data and be deleted later.</label>
            <details>
              <summary>Email, language and sorting (optional)</summary>
              <label>Owner's email<input name="ownerEmail" type="email" [(ngModel)]="ownerEmail" maxlength="200" autocomplete="off" dir="ltr" /></label>
              <fieldset><legend>Language</legend>
                <label class="opt"><input type="radio" name="language" value="ur" [(ngModel)]="language" /> Urdu</label>
                <label class="opt"><input type="radio" name="language" value="en" [(ngModel)]="language" /> English</label>
              </fieldset>
              <fieldset><legend>Sorting</legend>
                <label class="opt"><input type="radio" name="sorting" [value]="2" [(ngModel)]="sortingStages" /> Category and grade</label>
                <label class="opt"><input type="radio" name="sorting" [value]="1" [(ngModel)]="sortingStages" /> Category only</label>
                <label class="opt"><input type="radio" name="sorting" [value]="0" [(ngModel)]="sortingStages" /> Trading only, no sorting</label>
              </fieldset>
            </details>
            @if (error()) { <p class="err" role="alert">{{ error() }}</p> }
            <div class="row">
              <button type="submit" class="btn primary" [disabled]="saving() || !businessName.trim() || !ownerName.trim() || !ownerPhone.trim()">{{ saving() ? 'Creating…' : 'Create business' }}</button>
              <a class="btn" routerLink="/admin/tenants">Cancel</a>
            </div>
          </form>
        }
      </app-page-body>
    </app-page>
  `,
  styles: [`
    .qc { display:grid; gap:16px; max-width:560px; padding:20px; border:1px solid var(--color-border, #e3dde0); border-radius:12px; background:var(--color-surface, #fff); }
    .qc label { display:grid; gap:6px; font-weight:600; font-size:14px; }
    .qc input:not([type=radio]), .qc textarea { min-height:42px; padding:8px 12px; border:1px solid var(--color-border, #d6cfd3); border-radius:8px; font:inherit; font-weight:400; font-size:15px; background:transparent; color:inherit; }
    .qc textarea { resize:vertical; font-family:inherit; line-height:1.5; }
    .qc details { display:grid; gap:12px; }
    .qc summary { cursor:pointer; font-weight:600; color:var(--color-primary, #6f3f63); }
    .qc details[open] > *:not(summary) { margin-block-start:12px; }
    .qc fieldset { display:flex; flex-wrap:wrap; gap:8px 16px; margin:0; padding:0; border:0; }
    .qc legend { width:100%; margin-block-end:6px; font-weight:600; font-size:14px; }
    .qc .opt { display:flex; align-items:center; gap:6px; font-weight:400; }
    .qc .opt.test { align-items:flex-start; padding:10px 12px; border:1px solid #f3d98b; border-radius:8px; background:#fffbeb; }
    .qc .row { display:flex; flex-wrap:wrap; gap:8px; }
    .btn { display:inline-flex; align-items:center; min-height:40px; padding:0 16px; border:1px solid var(--color-border, #d6cfd3); border-radius:8px; background:transparent; color:inherit; font:inherit; font-weight:600; text-decoration:none; cursor:pointer; }
    .btn.primary { border-color:var(--color-primary, #6f3f63); background:var(--color-primary, #6f3f63); color:#fff; }
    .btn:disabled { opacity:.55; cursor:default; }
    .link { color:var(--color-primary, #6f3f63); font-weight:600; }
    .err { margin:0; color:var(--color-danger, #b3261e); }
    .done h2 { margin:0; font-size:20px; }
    .done dl { display:grid; grid-template-columns:auto 1fr; gap:6px 16px; margin:0; }
    .done dt { color:var(--color-text-secondary, #6b6468); }
    .done dd { margin:0; }
    .pin { font-size:22px; letter-spacing:.15em; }
    .done small { color:var(--color-text-secondary, #6b6468); }
  `],
})
export class TenantQuickComponent {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  protected businessName = '';
  protected ownerName = '';
  protected ownerPhone = '';
  protected ownerEmail = '';
  protected language: 'ur' | 'en' = 'ur';
  protected sortingStages = 2;
  protected isTest = false;
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly copied = signal(false);
  protected readonly result = signal<QuickResult | null>(null);

  protected save(): void {
    this.saving.set(true);
    this.error.set('');
    const body = {
      businessName: this.businessName.trim(),
      ownerName: this.ownerName.trim(),
      ownerPhone: this.ownerPhone.trim(),
      ...(this.ownerEmail.trim() ? { ownerEmail: this.ownerEmail.trim() } : {}),
      language: this.language,
      sortingStages: Number(this.sortingStages),
      ...(this.isTest ? { isTest: true } : {}),
    };
    this.http.post<QuickResult>(`${API_ENDPOINTS.superadmin}/tenants/quick`, body).subscribe({
      next: (r) => {
        this.saving.set(false);
        this.result.set(r);
      },
      error: (e) => {
        this.saving.set(false);
        const m = e?.error?.message;
        this.error.set(Array.isArray(m) ? m.join('. ') : m || 'Could not create the business. Try again.');
      },
    });
  }

  protected whatsapp(r: QuickResult): string {
    return `https://wa.me/${r.owner.phone.replace(/\D/g, '')}?text=${encodeURIComponent(r.welcome)}`;
  }

  protected copy(text: string): void {
    void navigator.clipboard?.writeText(text).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    });
  }

  protected open(r: QuickResult): void {
    this.auth.impersonateTenant(r.tenant.id, { reason: 'Onboarding: first look after creating the business', name: r.tenant.name }).subscribe();
  }

  protected again(): void {
    this.result.set(null);
    this.businessName = this.ownerName = this.ownerPhone = this.ownerEmail = '';
    this.isTest = false;
    this.copied.set(false);
  }
}
