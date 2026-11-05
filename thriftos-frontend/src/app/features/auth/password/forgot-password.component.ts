import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { I18nService, serverLang } from '../../../core/i18n/i18n.service';
import { I18N } from '../../../core/i18n/t.pipe';

/** Forgot password: an email with a one-time link (the answer is the same whether or not the email has an account). */
@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [FormsModule, RouterLink, I18N],
  template: `
    <main class="auth-page">
      <h1>{{ 'auth.forgotTitle' | t }}</h1>
      @if (sent()) {
        <p class="notice" role="status">{{ 'auth.linkSent' | t }}</p>
      } @else {
        <p>{{ 'auth.forgotHint' | t }}</p>
        @if (error(); as e) { <p class="notice error" role="alert">{{ e | t }}</p> }
        <form class="card" (ngSubmit)="send()">
          <label class="field">{{ 'auth.email' | t }}<input name="email" type="email" autocomplete="username" [(ngModel)]="email" class="ltr" required /></label>
          <button type="submit" class="btn primary block" [disabled]="!email.trim() || busy()">{{ (busy() ? 'common.saving' : 'auth.sendLink') | t }}</button>
        </form>
      }
      <a class="link-btn" routerLink="/auth/login">{{ 'auth.backToSignIn' | t }}</a>
    </main>
  `,
  styles: [`
    :host { display:block; min-height:100vh; background:var(--tos-canvas); }
    .auth-page { display:grid; gap:14px; max-width:420px; margin:0 auto; padding:32px 16px; }
    h1 { margin:0; font-size:24px; }
    .link-btn { justify-self:center; }
  `],
})
export class ForgotPasswordComponent {
  private readonly http = inject(HttpClient);
  private readonly i18n = inject(I18nService);
  protected email = '';
  protected readonly busy = signal(false);
  protected readonly sent = signal(false);
  protected readonly error = signal<string | null>(null);

  protected send(): void {
    this.busy.set(true);
    this.error.set(null);
    this.http.post('/api/auth/forgot-password', { email: this.email.trim(), lang: serverLang(this.i18n.lang()) }).subscribe({
      next: () => { this.busy.set(false); this.sent.set(true); },
      error: (e: HttpErrorResponse) => { this.busy.set(false); this.error.set(e.status === 429 ? 'auth.tooMany' : 'common.couldNotSave'); },
    });
  }
}
