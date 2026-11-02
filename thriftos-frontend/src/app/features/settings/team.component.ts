import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ArrowLeft, LucideAngularModule, UserPlus } from 'lucide-angular';
import { API_BASE_URL } from '../../core/config/api.config';
import { I18nService } from '../../core/i18n/i18n.service';
import { I18N } from '../../core/i18n/t.pipe';
import { ToastService } from '../../shared/floor/toast.service';

interface Member { id: string; name: string; email: string | null; phone: string | null; isActive: boolean; hasPin: boolean; locked: boolean; roles: string[] }

/** Settings → Team: add a munshi (name, phone, PIN), set a new PIN, unlock a PIN locked after wrong tries. */
@Component({
  selector: 'app-team',
  standalone: true,
  imports: [FormsModule, RouterLink, LucideAngularModule, I18N],
  template: `
    <section class="floor">
      <header class="floor-head">
        <a class="icon-btn back" routerLink="/settings" [attr.aria-label]="'common.back' | t"><lucide-icon [img]="icons.ArrowLeft" [size]="22" /></a>
        <h1>{{ 'settings.team' | t }}</h1>
      </header>

      @if (adding()) {
        <form class="card" (ngSubmit)="add()">
          <label class="field">{{ 'setup.munshiName' | t }}<input name="name" [(ngModel)]="name" maxlength="120" autocomplete="off" /></label>
          <label class="field">{{ 'common.phone' | t }}<input name="phone" type="tel" inputmode="tel" [(ngModel)]="phone" [placeholder]="'common.phonePlaceholder' | t" /></label>
          <label class="field">{{ 'setup.munshiPin' | t }} <small>{{ 'auth.pinHint' | t }}</small><input name="pin" type="tel" inputmode="numeric" maxlength="6" [(ngModel)]="pin" class="ltr" autocomplete="off" /></label>
          <div class="row2">
            <button type="button" class="btn" (click)="adding.set(false)">{{ 'common.cancel' | t }}</button>
            <button type="submit" class="btn primary" [disabled]="!name.trim() || !phone.trim() || !validPin(pin) || saving()">{{ 'common.save' | t }}</button>
          </div>
        </form>
      }

      <ul class="list">
        @for (m of team(); track m.id) {
          <li class="row member">
            <span><strong>{{ m.name }}</strong><small class="ltr">{{ m.phone || m.email }}</small><small>{{ m.roles.join(', ') }}@if (m.locked) { · <b class="warn">{{ 'settings.lockedUntil' | t }}</b> }</small></span>
            @if (m.hasPin) {
              <span class="acts">
                @if (m.locked) { <button type="button" class="chip" (click)="unlock(m)">{{ 'settings.unlock' | t }}</button> }
                <button type="button" class="chip" (click)="resetPin(m)">{{ 'settings.resetPin' | t }}</button>
              </span>
            }
          </li>
        }
      </ul>

      @if (resetting(); as m) {
        <form class="card" (ngSubmit)="savePin(m)">
          <label class="field">{{ m.name }} · {{ 'settings.resetPin' | t }} <small>{{ 'auth.pinHint' | t }}</small><input name="newPin" type="tel" inputmode="numeric" maxlength="6" [(ngModel)]="newPin" class="ltr" autocomplete="off" /></label>
          <div class="row2">
            <button type="button" class="btn" (click)="resetting.set(null)">{{ 'common.cancel' | t }}</button>
            <button type="submit" class="btn primary" [disabled]="!validPin(newPin) || saving()">{{ 'common.save' | t }}</button>
          </div>
        </form>
      }

      @if (!adding()) {
        <footer class="action-bar">
          <button type="button" class="btn primary" (click)="adding.set(true)"><lucide-icon [img]="icons.UserPlus" [size]="20" /> {{ 'settings.addMunshi' | t }}</button>
        </footer>
      }
    </section>
  `,
  styles: [`
    .member small { display:block; }
    .acts { display:flex; flex-wrap:wrap; gap:6px; justify-content:flex-end; }
    .field small { color:var(--tos-ink-soft); font-weight:600; }
  `],
})
export class TeamComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  protected readonly icons = { ArrowLeft, UserPlus };
  protected readonly team = signal<Member[]>([]);
  protected readonly adding = signal(false);
  protected readonly saving = signal(false);
  protected readonly resetting = signal<Member | null>(null);
  protected name = '';
  protected phone = '';
  protected pin = '';
  protected newPin = '';

  ngOnInit(): void {
    this.load();
  }

  protected validPin(pin: string): boolean {
    return /^\d{4,6}$/.test(pin);
  }

  protected add(): void {
    this.saving.set(true);
    this.http.post(`${API_BASE_URL}/users/munshi`, { name: this.name.trim(), phone: this.phone.trim(), pin: this.pin }).subscribe({
      next: () => {
        this.saving.set(false);
        this.adding.set(false);
        this.toast.show(this.i18n.t('settings.munshiAdded', { name: this.name.trim() }));
        this.name = this.phone = this.pin = '';
        this.load();
      },
      error: (e) => this.fail(e),
    });
  }

  protected resetPin(m: Member): void {
    this.newPin = '';
    this.resetting.set(m);
  }

  protected savePin(m: Member): void {
    this.saving.set(true);
    this.http.post(`${API_BASE_URL}/users/${m.id}/pin`, { pin: this.newPin }).subscribe({
      next: () => {
        this.saving.set(false);
        this.resetting.set(null);
        this.toast.show(this.i18n.t('settings.pinSaved'));
        this.load();
      },
      error: (e) => this.fail(e),
    });
  }

  protected unlock(m: Member): void {
    this.http.post(`${API_BASE_URL}/users/${m.id}/unlock`, {}).subscribe({
      next: () => {
        this.toast.show(this.i18n.t('settings.unlocked', { name: m.name }));
        this.load();
      },
      error: (e) => this.fail(e),
    });
  }

  private load(): void {
    this.http.get<Member[]>(`${API_BASE_URL}/users/team`).subscribe({ next: (t) => this.team.set(t), error: () => undefined });
  }

  private fail(e: { error?: { message?: string } }): void {
    this.saving.set(false);
    this.toast.error(e?.error?.message || this.i18n.t('common.couldNotSave'));
  }
}
