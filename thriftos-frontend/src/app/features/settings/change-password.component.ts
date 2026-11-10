import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { AuthService } from '../../core/auth';
import { TenantService } from '../../core/tenant/tenant.service';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ArrowLeft, LucideAngularModule } from 'lucide-angular';
import { I18nService } from '../../core/i18n/i18n.service';
import { I18N } from '../../core/i18n/t.pipe';
import { ToastService } from '../../shared/floor/toast.service';

/** Change my password (email users). Other devices are signed out. */
@Component({
  selector: 'app-change-password',
  standalone: true,
  imports: [FormsModule, RouterLink, LucideAngularModule, I18N],
  template: `
    <section class="floor">
      <header class="floor-head">
        @if (!first()) { <a class="icon-btn back" routerLink="/settings" [attr.aria-label]="'common.back' | t"><lucide-icon [img]="icons.ArrowLeft" [size]="22" /></a> }
        <h1>{{ (first() ? 'auth.firstPassword' : 'settings.password') | t }}</h1>
      </header>
      @if (first()) { <p class="notice">{{ 'auth.firstPasswordHint' | t }}</p> }
      @if (error(); as e) { <p class="notice error" role="alert">{{ e | t }}</p> }
      <form class="card" (ngSubmit)="save()">
        <label class="field">{{ (first() ? 'auth.passwordYouGot' : 'auth.currentPassword') | t }}<input name="current" type="password" autocomplete="current-password" [(ngModel)]="current" required /></label>
        <label class="field">{{ 'auth.newPassword' | t }} <small>{{ 'auth.passwordRule' | t }}</small><input name="p1" type="password" autocomplete="new-password" [(ngModel)]="p1" minlength="10" required /></label>
        <label class="field">{{ 'auth.confirmPassword' | t }}<input name="p2" type="password" autocomplete="new-password" [(ngModel)]="p2" required /></label>
        <button type="submit" class="btn primary block" [disabled]="!current || p1.length < 10 || !p2 || busy()">{{ (busy() ? 'common.saving' : 'auth.savePassword') | t }}</button>
      </form>
    </section>
  `,
})
export class ChangePasswordComponent {
  private readonly http = inject(HttpClient);
  private readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly tenants = inject(TenantService);
  /** Signed in with a password ThriftOS made (new owner, reset): choose their own before anything else. */
  protected readonly first = computed(() => !!this.auth.user()?.mustChangePassword);
  protected readonly icons = { ArrowLeft };
  protected current = '';
  protected p1 = '';
  protected p2 = '';
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected save(): void {
    if (this.p1 !== this.p2) { this.error.set('auth.passwordsDiffer'); return; }
    this.busy.set(true);
    this.error.set(null);
    this.http.post('/api/auth/password', { currentPassword: this.current, newPassword: this.p1 }).subscribe({
      next: () => {
        const wasFirst = this.first();
        // The server no longer marks the password as made by ThriftOS: read it again, then go on.
        this.auth.loadCurrentUser().subscribe({
          next: () => {
            this.busy.set(false);
            this.toast.show(this.i18n.t('auth.passwordSaved'));
            if (!wasFirst) { void this.router.navigate(['/settings']); return; }
            // A new owner goes on to the setup if the business is not set up yet.
            this.tenants.loadTenant(true).subscribe({
              next: (t) => void this.router.navigate([t && t.setupCompletedAt === null && this.auth.permissions().includes('tenant.update') ? '/setup' : '/home']),
              error: () => void this.router.navigate(['/home']),
            });
          },
          error: () => this.busy.set(false),
        });
      },
      error: (e: HttpErrorResponse) => {
        this.busy.set(false);
        this.error.set(e.status === 401 ? 'auth.currentWrong' : e.status === 400 ? 'auth.samePassword' : e.status === 429 ? 'auth.tooMany' : 'common.couldNotSave');
      },
    });
  }
}
