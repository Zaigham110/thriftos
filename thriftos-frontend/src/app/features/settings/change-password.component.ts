import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
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
        <a class="icon-btn back" routerLink="/settings" [attr.aria-label]="'common.back' | t"><lucide-icon [img]="icons.ArrowLeft" [size]="22" /></a>
        <h1>{{ 'settings.password' | t }}</h1>
      </header>
      @if (error(); as e) { <p class="notice error" role="alert">{{ e | t }}</p> }
      <form class="card" (ngSubmit)="save()">
        <label class="field">{{ 'auth.currentPassword' | t }}<input name="current" type="password" autocomplete="current-password" [(ngModel)]="current" required /></label>
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
        this.busy.set(false);
        this.toast.show(this.i18n.t('auth.passwordSaved'));
        void this.router.navigate(['/settings']);
      },
      error: (e: HttpErrorResponse) => {
        this.busy.set(false);
        this.error.set(e.status === 401 ? 'auth.currentWrong' : e.status === 400 ? 'auth.samePassword' : e.status === 429 ? 'auth.tooMany' : 'common.couldNotSave');
      },
    });
  }
}
