import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Delete, LucideAngularModule } from 'lucide-angular';
import { filter, take } from 'rxjs';
import { AuthService } from '../../../core/auth';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TPipe } from '../../../core/i18n/t.pipe';

type Mode = 'owner' | 'munshi';

/**
 * Sign in. Owner: email + password. Munshi: phone + 4–6 digit PIN on a big keypad (shown as dots).
 * Wrong PINs say how many tries are left; after 5 the PIN is locked for 15 minutes.
 */
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink, LucideAngularModule, TPipe],
  template: `
    <main class="login">
      <header>
        <img src="os_sm.png" alt="" width="56" height="56" />
        <h1>ThriftOS</h1>
        <p>{{ 'auth.subtitle' | t }}</p>
        <button type="button" class="link-btn lang" (click)="toggleLang()">{{ 'nav.language' | t }}</button>
      </header>

      <div class="chips who" role="tablist">
        <button type="button" role="tab" class="chip" [class.on]="mode() === 'munshi'" [attr.aria-selected]="mode() === 'munshi'" (click)="setMode('munshi')">{{ 'auth.munshi' | t }}</button>
        <button type="button" role="tab" class="chip" [class.on]="mode() === 'owner'" [attr.aria-selected]="mode() === 'owner'" (click)="setMode('owner')">{{ 'auth.owner' | t }}</button>
      </div>

      @if (error(); as e) { <p class="notice error" role="alert">{{ e }}</p> }

      @if (mode() === 'owner') {
        <form class="card" (ngSubmit)="signInOwner()">
          <label class="field">{{ 'auth.email' | t }}<input name="email" type="email" autocomplete="username" [(ngModel)]="email" class="ltr" required /></label>
          <label class="field">{{ 'auth.password' | t }}<input name="password" type="password" autocomplete="current-password" [(ngModel)]="password" required /></label>
          <button type="submit" class="btn primary block" [disabled]="!email.trim() || !password || busy()">{{ (busy() ? 'auth.signingIn' : 'auth.signIn') | t }}</button>
          <a class="link-btn forgot" routerLink="/auth/forgot-password">{{ 'auth.forgot' | t }}</a>
        </form>
      } @else {
        <form class="card" (ngSubmit)="signInMunshi()">
          <label class="field">{{ 'common.phone' | t }}<input name="phone" type="tel" inputmode="tel" autocomplete="tel" [(ngModel)]="phone" [placeholder]="'common.phonePlaceholder' | t" /></label>
          <div class="pin">
            <span class="label">{{ 'auth.pin' | t }} <small>{{ 'auth.pinHint' | t }}</small></span>
            <div class="dots" [attr.aria-label]="('auth.pin' | t) + ': ' + pin().length" aria-live="polite">
              @for (i of [0, 1, 2, 3, 4, 5]; track i) { <i [class.on]="i < pin().length" [class.extra]="i >= 4"></i> }
            </div>
            <div class="keys ltr">
              @for (k of keys; track k) {
                @if (k === '') { <span></span> }
                @else { <button type="button" (click)="press(k)" [attr.aria-label]="k === '<' ? ('common.clear' | t) : k">@if (k === '<') { <lucide-icon [img]="icons.Delete" [size]="24" /> } @else { {{ k }} }</button> }
              }
            </div>
          </div>
          <button type="submit" class="btn primary block" [disabled]="!canPin() || busy()">{{ (busy() ? 'auth.signingIn' : 'auth.signIn') | t }}</button>
        </form>
      }

      <nav class="legal"><a routerLink="/terms">{{ 'legal.terms.title' | t }}</a><a routerLink="/privacy">{{ 'legal.privacy.title' | t }}</a></nav>
    </main>
  `,
  styles: [`
    :host { display:block; min-height:100vh; background:var(--tos-canvas); }
    .forgot { justify-self:center; }
    .legal { display:flex; justify-content:center; gap:16px; font-size:14px; }
    .legal a { color:var(--tos-ink-soft); }
    .login { display:grid; gap:14px; max-width:420px; margin:0 auto; padding:24px 16px 32px; }
    header { position:relative; display:grid; justify-items:center; gap:4px; text-align:center; }
    header h1 { margin:6px 0 0; font-size:26px; }
    header p { margin:0; color:var(--tos-ink-soft); }
    .lang { position:absolute; inset-block-start:0; inset-inline-end:0; }
    .who { justify-content:center; }
    .who .chip { min-width:120px; }
    .pin { display:grid; gap:10px; }
    .pin .label { font-weight:700; }
    .pin small { color:var(--tos-ink-soft); font-weight:600; }
    .dots { display:flex; justify-content:center; gap:12px; direction:ltr; }
    .dots i { width:16px; height:16px; border-radius:50%; border:2px solid var(--tos-primary); }
    .dots i.extra:not(.on) { border-style:dashed; opacity:.5; }
    .dots i.on { background:var(--tos-primary); }
    .keys { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; }
    .keys button { min-height:58px; border:1px solid var(--tos-line); border-radius:14px; background:#faf8f9; color:var(--tos-ink); font:inherit; font-size:24px; font-weight:700; display:grid; place-items:center; }
    .keys button:active { background:var(--tos-primary-soft); }
  `],
})
export class LoginComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly icons = { Delete };
  protected readonly keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '<'];
  protected readonly mode = signal<Mode>(readMode());
  protected readonly pin = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly canPin = computed(() => this.pin().length >= 4);
  protected email = '';
  protected password = '';
  protected phone = readPhone();

  ngOnInit(): void {
    this.auth
      .waitForAuth()
      .pipe(filter((ready) => ready), take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.auth.isAuthenticated()) this.redirect();
      });
  }

  protected setMode(mode: Mode): void {
    this.mode.set(mode);
    this.error.set('');
    remember('thriftos.login-mode', mode);
  }

  protected toggleLang(): void {
    this.i18n.use(this.i18n.lang() === 'ur' ? 'en' : 'ur');
  }

  protected press(k: string): void {
    this.error.set('');
    if (k === '<') this.pin.update((p) => p.slice(0, -1));
    else if (this.pin().length < 6) this.pin.update((p) => p + k);
  }

  protected signInOwner(): void {
    this.busy.set(true);
    this.error.set('');
    this.auth.login({ email: this.email.trim(), password: this.password }).subscribe({
      next: () => {
        remember('thriftos.login-mode', 'owner');
        this.redirect();
      },
      error: () => {
        this.busy.set(false);
        this.error.set(this.i18n.t('auth.wrong'));
      },
    });
  }

  protected signInMunshi(): void {
    if (!this.canPin()) return;
    this.busy.set(true);
    this.error.set('');
    this.auth.loginWithPin({ phone: this.phone.trim(), pin: this.pin() }).subscribe({
      next: () => {
        remember('thriftos.login-mode', 'munshi');
        remember('thriftos.login-phone', this.phone.trim());
        this.redirect();
      },
      error: (e: HttpErrorResponse) => {
        this.busy.set(false);
        this.pin.set('');
        const body = e.error ?? {};
        if (e.status === 423) this.error.set(this.i18n.t('auth.locked', { n: body.minutes ?? 15 }));
        else if (e.status === 401 && body.triesLeft !== undefined) this.error.set(this.i18n.t('auth.wrongPin', { n: body.triesLeft }));
        else if (e.status === 0) this.error.set(this.i18n.t('common.couldNotLoad'));
        else this.error.set(this.i18n.t('auth.wrongPinPlain'));
        navigator.vibrate?.([60, 40, 60]);
      },
    });
  }

  private redirect(): void {
    if (this.auth.isSuperAdmin() && !this.auth.isImpersonating()) {
      void this.router.navigate(['/admin']);
      return;
    }
    const requested = this.route.snapshot.queryParams['returnUrl'];
    void this.router.navigateByUrl(requested && requested !== '/' && !requested.startsWith('/auth') ? requested : '/home');
  }
}

function remember(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode */
  }
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** The phone signs in the same way next time (owner the first time); a munshi's phone number is filled in. */
function readMode(): Mode {
  return read('thriftos.login-mode') === 'munshi' ? 'munshi' : 'owner';
}

function readPhone(): string {
  return read('thriftos.login-phone') ?? '';
}
