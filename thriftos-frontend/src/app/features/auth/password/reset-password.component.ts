import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { I18N } from '../../../core/i18n/t.pipe';

/** The page the emailed link opens (?token=…): set a new password, then sign in with it. */
@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [FormsModule, RouterLink, I18N],
  template: `
    <main class="auth-page">
      <h1>{{ 'auth.newPassword' | t }}</h1>
      @if (done()) {
        <p class="notice" role="status">{{ 'auth.resetDone' | t }}</p>
        <a class="btn primary block" routerLink="/auth/login">{{ 'auth.signIn' | t }}</a>
      } @else if (!token()) {
        <p class="notice error" role="alert">{{ 'auth.linkExpired' | t }}</p>
        <a class="link-btn" routerLink="/auth/forgot-password">{{ 'auth.forgot' | t }}</a>
      } @else {
        @if (error(); as e) { <p class="notice error" role="alert">{{ e | t }}</p> }
        <form class="card" (ngSubmit)="save()">
          <label class="field">{{ 'auth.newPassword' | t }} <small>{{ 'auth.passwordRule' | t }}</small><input name="p1" type="password" autocomplete="new-password" [(ngModel)]="p1" minlength="10" required /></label>
          <label class="field">{{ 'auth.confirmPassword' | t }}<input name="p2" type="password" autocomplete="new-password" [(ngModel)]="p2" required /></label>
          <button type="submit" class="btn primary block" [disabled]="p1.length < 10 || !p2 || busy()">{{ (busy() ? 'common.saving' : 'auth.savePassword') | t }}</button>
        </form>
      }
    </main>
  `,
  styles: [`
    :host { display:block; min-height:100vh; background:var(--tos-canvas); }
    .auth-page { display:grid; gap:14px; max-width:420px; margin:0 auto; padding:32px 16px; }
    h1 { margin:0; font-size:24px; }
    .link-btn { justify-self:center; }
  `],
})
export class ResetPasswordComponent {
  private readonly http = inject(HttpClient);
  /** From the query string (component input binding is on). */
  readonly token = input<string>('');
  protected p1 = '';
  protected p2 = '';
  protected readonly busy = signal(false);
  protected readonly done = signal(false);
  protected readonly error = signal<string | null>(null);

  protected save(): void {
    if (this.p1 !== this.p2) { this.error.set('auth.passwordsDiffer'); return; }
    this.busy.set(true);
    this.error.set(null);
    this.http.post('/api/auth/reset-password', { token: this.token(), newPassword: this.p1 }).subscribe({
      next: () => { this.busy.set(false); this.done.set(true); },
      error: (e: HttpErrorResponse) => {
        this.busy.set(false);
        this.error.set(e.status === 400 ? 'auth.linkExpired' : e.status === 429 ? 'auth.tooMany' : 'common.couldNotSave');
      },
    });
  }
}
