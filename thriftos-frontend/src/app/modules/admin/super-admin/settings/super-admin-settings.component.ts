/**
 * Platform settings (v2 review): the platform's name and how businesses reach support, in plain fields. Kept on the
 * server (they used to reset on every restart) and recorded in the audit trail.
 */
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AppPageBodyComponent, AppPageComponent, AppPageHeaderComponent } from '../../../../shared/ui';
import { SuperAdminDataService, type SystemSettings } from '../super-admin-data.service';

@Component({
  selector: 'app-super-admin-settings',
  standalone: true,
  imports: [FormsModule, AppPageComponent, AppPageHeaderComponent, AppPageBodyComponent],
  template: `
    <app-page>
      <app-page-header>
        <div><h1 class="page-title">Platform settings</h1><p class="page-subtitle">The platform's name and how businesses reach you for help.</p></div>
      </app-page-header>
      <app-page-body>
        @if (failed()) {
          <p class="err" role="alert">Could not load the settings. <button type="button" class="link" (click)="load()">Try again</button></p>
        } @else if (loaded()) {
          <form class="card form" (ngSubmit)="save()">
            <label>Platform name<input name="platformName" required maxlength="80" [(ngModel)]="s.platformName" /></label>
            <div class="two">
              <label>Support WhatsApp / phone<input name="supportPhone" maxlength="30" inputmode="tel" dir="ltr" placeholder="0300 1234567" [(ngModel)]="s.supportPhone" /></label>
              <label>Support email<input name="supportEmail" type="email" maxlength="200" dir="ltr" placeholder="help@example.com" [(ngModel)]="s.supportEmail" /></label>
            </div>
            <label>Legal company name (optional)<input name="companyLegalName" maxlength="150" [(ngModel)]="s.companyLegalName" /></label>
            @if (error()) { <p class="err" role="alert">{{ error() }}</p> }
            <div class="foot">
              @if (saved()) { <span class="ok" role="status">Saved</span> }
              <button type="submit" class="btn primary" [disabled]="saving() || !s.platformName.trim()">{{ saving() ? 'Saving…' : 'Save' }}</button>
            </div>
          </form>
        } @else {
          <p class="muted">Loading…</p>
        }
      </app-page-body>
    </app-page>
  `,
  styleUrls: ['../console.css'],
  styles: [`
    .form { max-width:720px; gap:16px; }
    .form label { display:grid; gap:6px; font-weight:600; font-size:14px; }
    .form input { min-height:42px; padding:8px 12px; border:1px solid var(--color-border, #d6cfd3); border-radius:8px; font:inherit; font-weight:400; font-size:15px; background:transparent; color:inherit; }
    .two { display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:16px; }
    .foot { display:flex; align-items:center; justify-content:flex-end; gap:12px; }
    .ok { color:#047857; font-weight:600; }
  `],
})
export class SuperAdminSettingsComponent {
  private readonly data = inject(SuperAdminDataService);
  private readonly destroyRef = inject(DestroyRef);
  protected s: SystemSettings = { platformName: '', supportPhone: '', supportEmail: '', companyLegalName: '' };
  protected readonly loaded = signal(false);
  protected readonly failed = signal(false);
  protected readonly saving = signal(false);
  protected readonly saved = signal(false);
  protected readonly error = signal('');

  constructor() {
    this.load();
  }

  protected load(): void {
    this.failed.set(false);
    this.data.getSettings().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (s) => { this.s = { ...this.s, ...s }; this.loaded.set(true); },
      error: () => this.failed.set(true),
    });
  }

  protected save(): void {
    this.saving.set(true);
    this.saved.set(false);
    this.error.set('');
    const { platformName, supportPhone, supportEmail, companyLegalName } = this.s;
    this.data.updateSettings({ platformName: platformName.trim(), supportPhone: supportPhone.trim(), supportEmail: supportEmail.trim(), companyLegalName: companyLegalName.trim() }).subscribe({
      next: (s) => { this.s = { ...this.s, ...s }; this.saving.set(false); this.saved.set(true); setTimeout(() => this.saved.set(false), 2500); },
      error: (e) => {
        this.saving.set(false);
        const m = e?.error?.message;
        this.error.set(Array.isArray(m) ? m.join('. ') : m || 'Could not save. Try again.');
      },
    });
  }
}
