import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ArrowLeft, LucideAngularModule } from 'lucide-angular';
import { I18nService } from '../../core/i18n/i18n.service';
import { I18N } from '../../core/i18n/t.pipe';
import { ToastService } from '../../shared/floor/toast.service';

/** Change my own PIN (people who sign in with phone + PIN; v2 review: Settings). */
@Component({
  selector: 'app-change-pin',
  standalone: true,
  imports: [FormsModule, RouterLink, LucideAngularModule, I18N],
  template: `
    <section class="floor">
      <header class="floor-head">
        <a class="icon-btn back" routerLink="/settings" [attr.aria-label]="'common.back' | t"><lucide-icon [img]="icons.ArrowLeft" [size]="22" /></a>
        <h1>{{ 'settings.item.pin' | t }}</h1>
      </header>
      @if (error(); as e) { <p class="notice error" role="alert">{{ e | t }}</p> }
      <form class="card" (ngSubmit)="save()">
        <label class="field">{{ 'settings.pin.current' | t }}<input name="current" type="password" inputmode="numeric" maxlength="6" autocomplete="current-password" [(ngModel)]="current" class="ltr" /></label>
        <label class="field">{{ 'settings.pin.new' | t }} <small>{{ 'auth.pinHint' | t }}</small><input name="p1" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password" [(ngModel)]="p1" class="ltr" /></label>
        <label class="field">{{ 'settings.pin.again' | t }}<input name="p2" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password" [(ngModel)]="p2" class="ltr" /></label>
        <button type="submit" class="btn primary block" [disabled]="!ok(current) || !ok(p1) || !p2 || busy()">{{ (busy() ? 'common.saving' : 'settings.pin.save') | t }}</button>
      </form>
    </section>
  `,
  styles: [`.field small { color:var(--tos-ink-soft); font-weight:600; }`],
})
export class ChangePinComponent {
  private readonly http = inject(HttpClient);
  private readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  protected readonly icons = { ArrowLeft };
  protected current = '';
  protected p1 = '';
  protected p2 = '';
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected ok(pin: string): boolean {
    return /^\d{4,6}$/.test(pin);
  }

  protected save(): void {
    if (this.p1 !== this.p2) { this.error.set('settings.pin.differ'); return; }
    this.busy.set(true);
    this.error.set(null);
    this.http.post('/api/auth/pin', { currentPin: this.current, newPin: this.p1 }).subscribe({
      next: () => {
        this.busy.set(false);
        this.toast.show(this.i18n.t('settings.pin.saved'));
        void this.router.navigate(['/settings']);
      },
      error: (e: HttpErrorResponse) => {
        this.busy.set(false);
        const code = e.error?.code as string | undefined;
        this.error.set(e.status === 429 ? 'auth.tooMany' : code === 'PIN_WRONG' || code === 'SAME_PIN' || code === 'NO_PIN' ? `settings.pin.err.${code}` : 'common.couldNotSave');
      },
    });
  }
}
