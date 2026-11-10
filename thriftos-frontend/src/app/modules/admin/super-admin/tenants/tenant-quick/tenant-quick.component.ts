import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { API_ENDPOINTS } from '../../../../../core/config/api.config';
import { AuthService } from '../../../../../core/auth';
import { Lang, LANGS } from '../../../../../core/i18n/i18n.service';
import { ModuleCatalogueService, ModulePickerComponent, moduleProblem } from '../../module-picker.component';
import { AppPageBodyComponent, AppPageComponent, AppPageHeaderComponent } from '../../../../../shared/ui';

interface QuickResult {
  tenant: { id: string; name: string; companyCode: string };
  owner: { id: string; name: string; phone: string | null; phoneLocal?: string | null; email: string };
  temporaryPassword: string;
  signInUrl: string;
  welcome: string;
  isTest?: boolean;
}

/** Pakistani mobile or landline, any common spelling (0300 1234567, +92 300…, 021 3241…); the server checks again. */
const PHONE = /^(\+?92|0)?[\s-]?\d{2,4}[\s-]?\d{6,8}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ERRORS: Record<string, string> = {
  PHONE_INVALID: "The owner's phone does not look right. Use a number like 0300 1234567.",
  PHONE_TAKEN: '',
  EMAIL_TAKEN: 'This email already has a login. Use another.',
  BUSINESS_PHONE_INVALID: "The business phone does not look right. Use a number like 021 32412345 or 0300 1234567.",
  NO_BUYING: 'Choose at least one way they buy: containers, loose lots or ready bales.',
  SORT_NEEDS_LOTS: 'Sorting needs containers or loose lots. Turn one on, or choose No sorting.',
};

/**
 * New business (console, v2 modules): the business and its contact line on bills, the owner who signs in with
 * email and a first password (they choose their own at the first sign-in), and every module the customer gets —
 * from the server's list. Then the password once, with the welcome message to send. The owner's first sign-in asks only their category and grade names; the rest is set here.
 */
@Component({
  selector: 'app-tenant-quick',
  standalone: true,
  imports: [FormsModule, RouterLink, AppPageComponent, AppPageHeaderComponent, AppPageBodyComponent, ModulePickerComponent],
  template: `
    <app-page>
      <app-page-header>
        <div class="head">
          <nav class="crumbs" aria-label="Breadcrumb"><a routerLink="/admin/tenants">Businesses</a><span aria-hidden="true">›</span><span aria-current="page">New business</span></nav>
          <h1 class="page-title">{{ result() ? 'Business ready' : 'New business' }}</h1>
        </div>
      </app-page-header>
      <app-page-body>
        @if (result(); as r) {
          <div class="done">
            <section class="card ready" aria-live="polite">
              <h2>{{ r.tenant.name }} is ready</h2>
              <p class="muted">Send the owner this message. The password is shown only now; they choose their own the first time they sign in.</p>
              <div class="facts">
                <div><span>Owner</span><strong>{{ r.owner.name }}</strong>@if (r.owner.phoneLocal) { <small dir="ltr">{{ r.owner.phoneLocal }}</small> }</div>
                <div><span>Email (login)</span><strong dir="ltr" class="mail">{{ r.owner.email }}</strong></div>
                <div class="pinbox"><span>First password</span><strong class="pin" dir="ltr">{{ r.temporaryPassword }}</strong>
                  <button type="button" class="btn sm" (click)="copy(r.temporaryPassword, 'pin')">{{ copied() === 'pin' ? 'Copied' : 'Copy password' }}</button></div>
              </div>
              <label class="field">Welcome message
                <textarea readonly rows="7" dir="auto" [value]="r.welcome"></textarea>
              </label>
              <div class="btns">
                @if (r.owner.phone) { <a class="btn primary" [href]="whatsapp(r)" target="_blank" rel="noopener">Send on WhatsApp</a> }
                <button type="button" class="btn" [class.primary]="!r.owner.phone" (click)="copy(r.welcome, 'msg')">{{ copied() === 'msg' ? 'Copied' : 'Copy message' }}</button>
              </div>
            </section>
            <section class="card next">
              <h2>Next</h2>
              <a class="btn" [routerLink]="['/admin/tenants', r.tenant.id]">Open the business page</a>
              @if (r.isTest && sampleFits()) { <p class="muted small">On the business page you can add sample data to this test business.</p> }
              <button type="button" class="btn" (click)="open(r)">See it as the owner (read-only)</button>
              <button type="button" class="link" (click)="again()">Make another business</button>
            </section>
          </div>
        } @else {
          <form class="nb" (ngSubmit)="save()" novalidate>
            <section class="card">
              <div class="sh"><h2>Business</h2><p class="muted">The name and contact line print on its bills and WhatsApp messages. The owner can change them later.</p></div>
              <div class="grid">
                <label class="field wide"><span>Business name <span class="req">required</span></span>
                  <input name="businessName" [(ngModel)]="businessName" required minlength="2" maxlength="100" autocomplete="off" (blur)="touched.add('businessName')" [attr.aria-invalid]="show('businessName') && !businessName.trim()" />
                  @if (show('businessName') && businessName.trim().length < 2) { <small class="bad">Enter the business name.</small> } @else { <small class="hint">For example Al-Madina Traders</small> }
                </label>
                <label class="field"><span>Business phone</span>
                  <input name="businessPhone" type="tel" inputmode="tel" dir="ltr" [(ngModel)]="businessPhone" maxlength="30" autocomplete="off" (blur)="touched.add('businessPhone')" [attr.aria-invalid]="show('businessPhone') && !bizPhoneOk()" />
                  @if (show('businessPhone') && !bizPhoneOk()) { <small class="bad">Use a number like 021 32412345 or 0300 1234567.</small> } @else { <small class="hint">Optional. Printed on bills.</small> }
                </label>
                <label class="field"><span>City</span><input name="city" [(ngModel)]="city" maxlength="60" autocomplete="off" /><small class="hint">Optional</small></label>
                <label class="field wide"><span>Address</span><input name="address" [(ngModel)]="address" maxlength="200" autocomplete="off" /><small class="hint">Optional. Shop or godown, e.g. Shop 12, Landa Bazaar</small></label>
                <div class="field">Currency
                  <div class="seg" role="radiogroup" aria-label="Currency">
                    @for (c of currencies; track c) { <button type="button" role="radio" [attr.aria-checked]="currency === c" [class.on]="currency === c" (click)="currency = c">{{ c }}</button> }
                  </div>
                  <small class="hint">Fixed once money is recorded.</small>
                </div>
                <div class="field">Language of the app, bills and messages
                  <div class="seg" role="radiogroup" aria-label="Language">
                    @for (l of langs; track l.id) { <button type="button" role="radio" [attr.aria-checked]="language === l.id" [class.on]="language === l.id" (click)="language = l.id">{{ l.name }}</button> }
                  </div>
                </div>
              </div>
            </section>

            <section class="card">
              <div class="sh"><h2>Owner</h2><p class="muted">Signs in with this email and a first password you get on the next screen; they choose their own the first time.</p></div>
              <div class="grid">
                <label class="field"><span>Owner's name <span class="req">required</span></span>
                  <input name="ownerName" [(ngModel)]="ownerName" required maxlength="100" autocomplete="off" (blur)="touched.add('ownerName')" [attr.aria-invalid]="show('ownerName') && !ownerName.trim()" />
                  @if (show('ownerName') && !ownerName.trim()) { <small class="bad">Enter the owner's name.</small> } @else { <small class="hint">For example Haji Rafiq</small> }
                </label>
                <label class="field"><span>Owner's email <span class="req">required</span></span>
                  <input name="ownerEmail" type="email" dir="ltr" [(ngModel)]="ownerEmail" required maxlength="200" autocomplete="off" (blur)="touched.add('ownerEmail')" (input)="emailError.set('')" [attr.aria-invalid]="(show('ownerEmail') && !ownerEmailOk()) || !!emailError()" />
                  @if (emailError(); as ee) { <small class="bad">{{ ee }}</small> }
                  @else if (show('ownerEmail') && !ownerEmailOk()) { <small class="bad">Enter an email like rafiq@example.com.</small> }
                  @else { <small class="hint">Their login.</small> }
                </label>
                <label class="field wide"><span>Owner's phone</span>
                  <input name="ownerPhone" type="tel" inputmode="tel" dir="ltr" [(ngModel)]="ownerPhone" maxlength="30" autocomplete="off" (blur)="touched.add('ownerPhone')" (input)="phoneError.set('')" [attr.aria-invalid]="(show('ownerPhone') && !ownerPhoneOk()) || !!phoneError()" />
                  @if (phoneError(); as pe) { <small class="bad">{{ pe }}</small> }
                  @else if (show('ownerPhone') && !ownerPhoneOk()) { <small class="bad">Use a mobile number like 0300 1234567.</small> }
                  @else { <small class="hint">Optional. To send them the welcome message on WhatsApp; not a login.</small> }
                </label>
              </div>
            </section>

            <section class="card">
              <div class="sh"><h2>What they get</h2><p class="muted">Only what is on shows in their app; the server refuses the rest. You can change this any time on the business page.</p></div>
              <app-module-picker [(stages)]="stages" [(modules)]="modules" />
            </section>

            <section class="card">
              <label class="toggle">
                <span><strong>Test business</strong><small class="muted">For trying ThriftOS out. It can get sample data and be deleted later.</small></span>
                <input type="checkbox" role="switch" class="switch" name="isTest" [(ngModel)]="isTest" aria-label="Test business" />
              </label>
            </section>

            <footer class="bar">
              @if (error()) { <p class="bad" role="alert">{{ error() }}</p> }
              @else if (missing()) { <p class="muted">{{ missing() }}</p> }
              <div class="btns">
                <a class="btn" routerLink="/admin/tenants">Cancel</a>
                <button type="submit" class="btn primary" [disabled]="saving()">{{ saving() ? 'Creating…' : 'Create business' }}</button>
              </div>
            </footer>
          </form>
        }
      </app-page-body>
    </app-page>
  `,
  styleUrls: ['../../console.css'],
  styles: [`
    .head { display:grid; gap:4px; }
    .crumbs { display:flex; gap:6px; align-items:center; margin-block-end:4px; font-size:13px; color:var(--color-text-secondary, #6b6468); }
    .crumbs a { color:inherit; text-decoration:none; } .crumbs a:hover { color:var(--color-primary, #6f3f63); text-decoration:underline; }
    .page-title { margin:0; }
    .nb { display:grid; gap:16px; max-width:820px; padding-block-end:88px; }
    .sh { display:grid; gap:2px; }
    .sh .muted { font-size:13px; }
    .grid { display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:14px 16px; }
    .wide { grid-column:1 / -1; }
    @media (max-width:640px) { .grid { grid-template-columns:minmax(0, 1fr); } }
    .field { display:grid; gap:6px; align-content:start; font-size:14px; font-weight:600; }
    .field input, .field textarea { min-height:40px; padding:8px 12px; border:1px solid var(--color-border, #d6cfd3); border-radius:8px; background:var(--color-surface, #fff); color:inherit; font:inherit; font-weight:400; font-size:15px; }
    .field input:focus, .field textarea:focus { outline:2px solid var(--color-primary, #6f3f63); outline-offset:0; border-color:transparent; }
    .field input[aria-invalid='true'] { border-color:var(--color-danger, #b3261e); }
    .field textarea { resize:vertical; line-height:1.5; }
    .req { margin-inline-start:4px; color:var(--color-text-secondary, #6b6468); font-size:11px; font-weight:500; }
    .hint { color:var(--color-text-secondary, #6b6468); font-size:12px; font-weight:400; }
    .bad { margin:0; color:var(--color-danger, #b3261e); font-size:12px; font-weight:500; }
    .bar .bad { font-size:14px; }
    .seg { display:inline-flex; flex-wrap:wrap; gap:4px; width:max-content; max-width:100%; padding:3px; border:1px solid var(--color-border, #d6cfd3); border-radius:10px; background:var(--color-surface-2, #f6f2f4); }
    .seg button { min-height:32px; padding:0 12px; border:0; border-radius:8px; background:transparent; color:inherit; font:inherit; font-size:14px; font-weight:500; cursor:pointer; }
    .seg button.on { background:var(--color-surface, #fff); color:var(--color-primary, #6f3f63); font-weight:700; box-shadow:0 1px 2px rgba(0,0,0,.08); }
    .toggle { display:flex; align-items:center; justify-content:space-between; gap:16px; cursor:pointer; }
    .toggle span { display:grid; gap:2px; }
    .toggle small { font-size:13px; }
    .switch { appearance:none; flex:none; position:relative; width:40px; height:22px; margin:0; border-radius:999px; background:#cfc6cb; cursor:pointer; }
    .switch::after { content:''; position:absolute; inset-block-start:3px; inset-inline-start:3px; width:16px; height:16px; border-radius:50%; background:#fff; box-shadow:0 1px 2px rgba(0,0,0,.2); transition:inset-inline-start .15s; }
    .switch:checked { background:var(--color-primary, #6f3f63); }
    .switch:checked::after { inset-inline-start:21px; }
    .bar { position:sticky; inset-block-end:0; display:flex; flex-wrap:wrap; align-items:center; justify-content:flex-end; gap:8px 16px; padding:12px 16px; border:1px solid var(--color-border, #e3dde0); border-radius:12px; background:var(--color-surface, #fff); box-shadow:0 -4px 16px rgba(0,0,0,.06); }
    .bar > p { flex:1 1 240px; margin:0; font-size:13px; }
    .done { display:grid; grid-template-columns:minmax(0, 2fr) minmax(220px, 1fr); gap:16px; max-width:900px; align-items:start; }
    @media (max-width:760px) { .done { grid-template-columns:minmax(0, 1fr); } }
    .ready h2 { margin:0; font-size:20px; }
    .facts { display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:12px; padding:12px; border-radius:10px; background:var(--color-surface-2, #f6f2f4); }
    .facts div { display:grid; gap:2px; }
    .facts span { color:var(--color-text-secondary, #6b6468); font-size:12px; }
    .pinbox { grid-template-columns:auto; }
    .pin { font-size:22px; letter-spacing:.06em; word-break:break-all; }
    .mail { word-break:break-all; }
    .facts small { color:var(--color-text-secondary, #6b6468); }
    .next { align-content:start; }
    .next .btn { justify-content:flex-start; width:100%; white-space:normal; text-align:start; }
    .small { font-size:12px; }
  `],
})
export class TenantQuickComponent {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly catalogue = toSignal(inject(ModuleCatalogueService).catalogue$);
  protected readonly langs = LANGS;
  protected readonly currencies = ['PKR', 'USD', 'AED'];
  protected businessName = '';
  protected businessPhone = '';
  protected city = '';
  protected address = '';
  protected currency = 'PKR';
  protected language: Lang = 'ur';
  protected ownerName = '';
  protected ownerPhone = '';
  protected ownerEmail = '';
  protected isTest = false;
  /** Starts from the server's everyday set (category and grade sorting). */
  protected readonly stages = signal(2);
  protected readonly modules = signal<string[]>([]);
  private filled = false;
  protected readonly touched = new Set<string>();
  private submitted = false;
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly phoneError = signal('');
  protected readonly emailError = signal('');
  protected readonly copied = signal<'pin' | 'msg' | null>(null);
  protected readonly result = signal<QuickResult | null>(null);
  /** Sample data is a container sorted into categories and grades; only such a business can get it. */
  protected readonly sampleFits = computed(() => this.stages() === 2 && this.modules().includes('CONTAINERS'));

  constructor() {
    inject(ModuleCatalogueService).catalogue$.subscribe((c) => {
      if (!this.filled) {
        this.filled = true;
        this.modules.set(c.defaults.filter((k) => k !== 'SORT'));
      }
    });
  }

  protected show(field: string): boolean {
    return this.submitted || this.touched.has(field);
  }

  protected ownerPhoneOk(): boolean {
    return !this.ownerPhone.trim() || PHONE.test(this.ownerPhone.trim());
  }

  protected ownerEmailOk(): boolean {
    return EMAIL.test(this.ownerEmail.trim());
  }

  protected bizPhoneOk(): boolean {
    return !this.businessPhone.trim() || PHONE.test(this.businessPhone.trim());
  }

  /** What still stops Create, in one line (shown next to the button). */
  protected readonly missing = computed(() => {
    const c = this.catalogue();
    return c ? moduleProblem(this.modules(), this.stages(), c.buying) : '';
  });

  protected save(): void {
    this.submitted = true;
    this.error.set('');
    if (this.businessName.trim().length < 2 || !this.ownerName.trim() || !this.ownerEmailOk() || !this.ownerPhoneOk() || !this.bizPhoneOk()) {
      this.error.set('Fix the fields marked in red.');
      return;
    }
    if (this.missing()) {
      this.error.set(this.missing());
      return;
    }
    this.saving.set(true);
    const body = {
      businessName: this.businessName.trim(),
      ownerName: this.ownerName.trim(),
      ownerEmail: this.ownerEmail.trim(),
      ...(this.ownerPhone.trim() ? { ownerPhone: this.ownerPhone.trim() } : {}),
      ...(this.businessPhone.trim() ? { businessPhone: this.businessPhone.trim() } : {}),
      ...(this.city.trim() ? { city: this.city.trim() } : {}),
      ...(this.address.trim() ? { address: this.address.trim() } : {}),
      currency: this.currency,
      language: this.language,
      sortingStages: this.stages(),
      modules: this.modules(),
      ...(this.isTest ? { isTest: true } : {}),
    };
    this.http.post<QuickResult>(`${API_ENDPOINTS.superadmin}/tenants/quick`, body).subscribe({
      next: (r) => {
        this.saving.set(false);
        this.result.set(r);
      },
      error: (e: HttpErrorResponse) => {
        this.saving.set(false);
        const code = e.error?.code as string | undefined;
        const m = e.error?.message;
        const text = (code && ERRORS[code]) || (Array.isArray(m) ? m.join('. ') : typeof m === 'string' ? m : 'Could not create the business. Try again.');
        if (code === 'PHONE_TAKEN' || code === 'PHONE_INVALID') this.phoneError.set(text);
        else if (code === 'EMAIL_TAKEN') this.emailError.set(text);
        else this.error.set(text);
      },
    });
  }

  protected whatsapp(r: QuickResult): string {
    return `https://wa.me/${(r.owner.phone ?? '').replace(/\D/g, '')}?text=${encodeURIComponent(r.welcome)}`;
  }

  protected copy(text: string, what: 'pin' | 'msg'): void {
    void navigator.clipboard?.writeText(text).then(() => {
      this.copied.set(what);
      setTimeout(() => this.copied.set(null), 2000);
    });
  }

  protected open(r: QuickResult): void {
    this.auth.impersonateTenant(r.tenant.id, { reason: 'Onboarding: first look after creating the business', name: r.tenant.name }).subscribe();
  }

  protected again(): void {
    this.result.set(null);
    this.businessName = this.businessPhone = this.city = this.address = this.ownerName = this.ownerPhone = this.ownerEmail = '';
    this.isTest = false;
    this.submitted = false;
    this.touched.clear();
    this.copied.set(null);
    this.phoneError.set('');
    this.emailError.set('');
    this.stages.set(2);
    this.modules.set((this.catalogue()?.defaults ?? []).filter((k) => k !== 'SORT'));
  }
}
