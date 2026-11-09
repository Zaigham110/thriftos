import { NgTemplateOutlet } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { ArrowLeft, LucideAngularModule, Mail, UserPlus } from 'lucide-angular';
import { API_BASE_URL } from '../../core/config/api.config';
import { I18nService } from '../../core/i18n/i18n.service';
import { I18N } from '../../core/i18n/t.pipe';
import { ToastService } from '../../shared/floor/toast.service';
import { localPhone } from '../../shared/phone';
import { roleName } from './roles';

interface Member {
  id: string; name: string; email: string | null; phone: string | null; isActive: boolean; hasPin: boolean; locked: boolean;
  roles: string[]; roleIds: string[]; you: boolean;
}
interface Role { id: string; name: string; people: number }
type Panel = 'details' | 'pin' | null;

/** Error codes from the server shown in the person's language. */
const CODES = ['PHONE_INVALID', 'PHONE_TAKEN', 'PHONE_NEEDED', 'EMAIL_TAKEN', 'SELF', 'NOT_FOUND'];

/**
 * Settings → Team (v2 review): the one place for people. Everyone with their role in plain words; open a person
 * to fix the name or phone, change the role, set a new PIN, unlock it, or stop their access (a munshi who left)
 * and give it back. Add a munshi (phone + PIN) or someone who signs in with email (a first password is shown once).
 */
@Component({
  selector: 'app-team',
  standalone: true,
  imports: [FormsModule, NgTemplateOutlet, RouterLink, LucideAngularModule, I18N],
  template: `
    <section class="floor">
      <header class="floor-head">
        <a class="icon-btn back" routerLink="/settings" [attr.aria-label]="'common.back' | t"><lucide-icon [img]="icons.ArrowLeft" [size]="22" /></a>
        <h1>{{ 'settings.team' | t }}</h1>
      </header>

      @if (firstPassword(); as fp) {
        <div class="card first" role="status">
          <p><strong>{{ 'settings.tm.firstPassword' | t: { name: fp.name } }}</strong></p>
          <p class="pw ltr">{{ fp.password }}</p>
          <p class="hint">{{ 'settings.tm.firstPasswordHint' | t: { email: fp.email } }}</p>
          <button type="button" class="btn" (click)="firstPassword.set(null)">{{ 'common.done' | t }}</button>
        </div>
      }

      @if (adding() === 'munshi') {
        <form class="card" (ngSubmit)="addMunshi()">
          <h2>{{ 'settings.addMunshi' | t }}</h2>
          <label class="field">{{ 'setup.munshiName' | t }}<input name="name" [(ngModel)]="name" maxlength="120" autocomplete="off" /></label>
          <label class="field">{{ 'common.phone' | t }}<input name="phone" type="tel" inputmode="tel" [(ngModel)]="phone" [placeholder]="'common.phonePlaceholder' | t" /></label>
          <label class="field">{{ 'setup.munshiPin' | t }} <small>{{ 'auth.pinHint' | t }}</small><input name="pin" type="tel" inputmode="numeric" maxlength="6" [(ngModel)]="pin" class="ltr" autocomplete="off" /></label>
          <div class="row2">
            <button type="button" class="btn" (click)="adding.set(null)">{{ 'common.cancel' | t }}</button>
            <button type="submit" class="btn primary" [disabled]="!name.trim() || !phone.trim() || !validPin(pin) || saving()">{{ 'common.save' | t }}</button>
          </div>
        </form>
      } @else if (adding() === 'email') {
        <form class="card" (ngSubmit)="addPerson()">
          <h2>{{ 'settings.tm.addEmail' | t }}</h2>
          <label class="field">{{ 'settings.tm.name' | t }}<input name="name" [(ngModel)]="name" maxlength="120" autocomplete="off" /></label>
          <label class="field">{{ 'auth.email' | t }}<input name="email" type="email" [(ngModel)]="email" maxlength="200" autocomplete="off" class="ltr" /></label>
          <span class="field">{{ 'settings.tm.role' | t }}</span>
          <div class="chips">
            @for (r of roles(); track r.id) { <button type="button" class="chip" [class.on]="roleId === r.id" (click)="roleId = r.id">{{ role(r.name) }}</button> }
          </div>
          <div class="row2">
            <button type="button" class="btn" (click)="adding.set(null)">{{ 'common.cancel' | t }}</button>
            <button type="submit" class="btn primary" [disabled]="!name.trim() || !email.includes('@') || !roleId || saving()">{{ 'common.save' | t }}</button>
          </div>
        </form>
      }

      <ul class="list">
        @for (m of active(); track m.id) { <ng-container *ngTemplateOutlet="person; context: { $implicit: m }" /> }
      </ul>
      @if (stopped().length) {
        <h2 class="sub">{{ 'settings.tm.stoppedTitle' | t }}</h2>
        <ul class="list">
          @for (m of stopped(); track m.id) { <ng-container *ngTemplateOutlet="person; context: { $implicit: m }" /> }
        </ul>
      }

      <ng-template #person let-m>
        <li class="member" [class.off]="!m.isActive">
          <button type="button" class="row head" (click)="toggle(m)" [attr.aria-expanded]="open() === m.id">
            <span>
              <strong>{{ m.name }}@if (m.you) { <small class="you">· {{ 'settings.tm.you' | t }}</small> }</strong>
              <small class="ltr">{{ contact(m) }}</small>
              <small>{{ roles$(m) }}@if (m.locked) { · <b class="warn">{{ 'settings.lockedUntil' | t }}</b> }@if (!m.isActive) { · <b class="warn">{{ 'settings.tm.stopped' | t }}</b> }</small>
            </span>
          </button>
          @if (open() === m.id) {
            <div class="panel">
              @if (panel() === 'details') {
                <form (ngSubmit)="saveDetails(m)" class="grid">
                  <label class="field">{{ 'settings.tm.name' | t }}<input name="dName" [(ngModel)]="dName" maxlength="120" /></label>
                  <label class="field">{{ 'common.phone' | t }}<input name="dPhone" type="tel" inputmode="tel" [(ngModel)]="dPhone" class="ltr" /></label>
                  <div class="row2">
                    <button type="button" class="btn" (click)="panel.set(null)">{{ 'common.cancel' | t }}</button>
                    <button type="submit" class="btn primary" [disabled]="!dName.trim() || saving()">{{ 'common.save' | t }}</button>
                  </div>
                </form>
              } @else if (panel() === 'pin') {
                <form (ngSubmit)="savePin(m)" class="grid">
                  <label class="field">{{ 'settings.resetPin' | t }} <small>{{ 'auth.pinHint' | t }}</small><input name="newPin" type="tel" inputmode="numeric" maxlength="6" [(ngModel)]="newPin" class="ltr" autocomplete="off" /></label>
                  <div class="row2">
                    <button type="button" class="btn" (click)="panel.set(null)">{{ 'common.cancel' | t }}</button>
                    <button type="submit" class="btn primary" [disabled]="!validPin(newPin) || saving()">{{ 'common.save' | t }}</button>
                  </div>
                </form>
              } @else {
                @if (!m.you && m.isActive) {
                  <span class="field">{{ 'settings.tm.role' | t }}</span>
                  <div class="chips">
                    @for (r of roles(); track r.id) { <button type="button" class="chip" [class.on]="m.roleIds.includes(r.id)" (click)="setRole(m, r)" [disabled]="saving()">{{ role(r.name) }}</button> }
                  </div>
                }
                <div class="acts">
                  <button type="button" class="chip" (click)="editDetails(m)">{{ 'settings.tm.edit' | t }}</button>
                  @if (m.hasPin && m.isActive) { <button type="button" class="chip" (click)="newPin = ''; panel.set('pin')">{{ 'settings.resetPin' | t }}</button> }
                  @if (m.locked && m.isActive) { <button type="button" class="chip" (click)="unlock(m)">{{ 'settings.unlock' | t }}</button> }
                  @if (!m.you) {
                    @if (m.isActive) {
                      <button type="button" class="chip danger" (click)="stop(m)">{{ 'settings.tm.stop' | t }}</button>
                    } @else {
                      <button type="button" class="chip" (click)="start(m)">{{ 'settings.tm.start' | t }}</button>
                    }
                  }
                </div>
                @if (!m.you && m.isActive) { <p class="hint">{{ 'settings.tm.stopHint' | t }}</p> }
              }
            </div>
          }
        </li>
      </ng-template>

      @if (!adding()) {
        <footer class="action-bar">
          <button type="button" class="btn primary" (click)="startAdd('munshi')"><lucide-icon [img]="icons.UserPlus" [size]="20" /> {{ 'settings.addMunshi' | t }}</button>
          <button type="button" class="btn" (click)="startAdd('email')"><lucide-icon [img]="icons.Mail" [size]="20" /> {{ 'settings.tm.addEmail' | t }}</button>
        </footer>
      }
    </section>
  `,
  styles: [`
    .member .head { width:100%; border:0; background:transparent; font:inherit; text-align:start; cursor:pointer; }
    .member small { display:block; }
    .member .you { display:inline; color:var(--tos-ink-soft); font-weight:600; }
    .member.off strong { color:var(--tos-ink-soft); }
    .panel { display:grid; gap:10px; padding:0 16px 14px; }
    .panel .grid { display:grid; gap:10px; }
    .acts { display:flex; flex-wrap:wrap; gap:6px; }
    .chip.danger { color:var(--tos-bad, #b42318); border-color:currentColor; }
    .sub { margin:8px 0 0; color:var(--tos-ink-soft); font-size:14px; }
    .card h2 { margin:0; font-size:17px; }
    .first .pw { margin:4px 0; font-size:22px; font-weight:800; letter-spacing:.04em; }
    .field small { color:var(--tos-ink-soft); font-weight:600; }
    .action-bar { display:flex; flex-wrap:wrap; gap:8px; }
    .action-bar .btn { flex:1 1 200px; }
  `],
})
export class TeamComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  protected readonly icons = { ArrowLeft, Mail, UserPlus };
  protected readonly team = signal<Member[]>([]);
  protected readonly roles = signal<Role[]>([]);
  protected readonly active = computed(() => this.team().filter((m) => m.isActive));
  protected readonly stopped = computed(() => this.team().filter((m) => !m.isActive));
  protected readonly adding = signal<'munshi' | 'email' | null>(null);
  protected readonly saving = signal(false);
  protected readonly open = signal<string | null>(null);
  protected readonly panel = signal<Panel>(null);
  protected readonly firstPassword = signal<{ name: string; email: string; password: string } | null>(null);
  protected name = '';
  protected phone = '';
  protected pin = '';
  protected email = '';
  protected roleId = '';
  protected newPin = '';
  protected dName = '';
  protected dPhone = '';

  ngOnInit(): void {
    this.load();
    this.http.get<Role[]>(`${API_BASE_URL}/users/team/roles`).subscribe({ next: (r) => this.roles.set(r), error: () => undefined });
  }

  protected role(name: string): string {
    return roleName(this.i18n, name);
  }
  protected roles$(m: Member): string {
    return m.roles.map((r) => this.role(r)).join(', ');
  }
  protected contact(m: Member): string {
    return m.phone ? localPhone(m.phone) : (m.email ?? '');
  }
  protected validPin(pin: string): boolean {
    return /^\d{4,6}$/.test(pin);
  }

  protected toggle(m: Member): void {
    this.panel.set(null);
    this.open.set(this.open() === m.id ? null : m.id);
  }
  protected startAdd(kind: 'munshi' | 'email'): void {
    this.name = this.phone = this.pin = this.email = '';
    this.roleId = this.roles().find((r) => r.name === 'Manager')?.id ?? '';
    this.adding.set(kind);
  }

  protected addMunshi(): void {
    const name = this.name.trim();
    this.run(this.http.post(`${API_BASE_URL}/users/munshi`, { name, phone: this.phone.trim(), pin: this.pin }), () => {
      this.adding.set(null);
      this.toast.show(this.i18n.t('settings.munshiAdded', { name }));
    });
  }

  protected addPerson(): void {
    const name = this.name.trim();
    const email = this.email.trim();
    this.run(this.http.post<{ temporaryPassword?: string }>(`${API_BASE_URL}/users/team/person`, { name, email, roleId: this.roleId }), (r) => {
      this.adding.set(null);
      if (r?.temporaryPassword) this.firstPassword.set({ name, email, password: r.temporaryPassword });
    });
  }

  protected editDetails(m: Member): void {
    this.dName = m.name;
    this.dPhone = m.phone ? localPhone(m.phone) : '';
    this.panel.set('details');
  }
  protected saveDetails(m: Member): void {
    this.run(this.http.patch(`${API_BASE_URL}/users/${m.id}/details`, { name: this.dName.trim(), phone: this.dPhone.trim() }), () => {
      this.panel.set(null);
      this.toast.show(this.i18n.t('settings.tm.saved'));
    });
  }

  protected setRole(m: Member, r: Role): void {
    if (m.roleIds.length === 1 && m.roleIds[0] === r.id) return;
    this.run(this.http.put(`${API_BASE_URL}/users/${m.id}/role`, { roleId: r.id }), () => this.toast.show(this.i18n.t('settings.tm.roleSaved', { name: m.name, role: this.role(r.name) })));
  }

  protected savePin(m: Member): void {
    this.run(this.http.post(`${API_BASE_URL}/users/${m.id}/pin`, { pin: this.newPin }), () => {
      this.panel.set(null);
      this.toast.show(this.i18n.t('settings.pinSaved'));
    });
  }

  protected unlock(m: Member): void {
    this.run(this.http.post(`${API_BASE_URL}/users/${m.id}/unlock`, {}), () => this.toast.show(this.i18n.t('settings.unlocked', { name: m.name })));
  }

  protected stop(m: Member): void {
    if (!confirm(this.i18n.t('settings.tm.stopConfirm', { name: m.name }))) return;
    this.run(this.http.post(`${API_BASE_URL}/users/${m.id}/stop`, {}), () => {
      this.open.set(null);
      this.toast.show(this.i18n.t('settings.tm.stoppedToast', { name: m.name }));
    });
  }

  protected start(m: Member): void {
    this.run(this.http.post(`${API_BASE_URL}/users/${m.id}/start`, {}), () => {
      this.open.set(null);
      this.toast.show(this.i18n.t('settings.tm.startedToast', { name: m.name }));
    });
  }

  /** One request; on success reload the list, on failure a message in the person's language. */
  private run<T>(req: Observable<T>, done: (r: T) => void): void {
    this.saving.set(true);
    req.subscribe({
      next: (r) => {
        this.saving.set(false);
        done(r);
        this.load();
      },
      error: (e: HttpErrorResponse) => {
        this.saving.set(false);
        const code = e.error?.code as string | undefined;
        this.toast.error(this.i18n.t(code && CODES.includes(code) ? `settings.tm.err.${code}` : 'common.couldNotSave'));
      },
    });
  }

  private load(): void {
    this.http.get<Member[]>(`${API_BASE_URL}/users/team`).subscribe({ next: (t) => this.team.set(t), error: () => undefined });
  }
}
