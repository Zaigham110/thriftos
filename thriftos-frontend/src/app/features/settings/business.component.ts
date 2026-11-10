import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ArrowLeft, Check, ChevronRight, LucideAngularModule, Minus } from 'lucide-angular';
import { API_BASE_URL } from '../../core/config/api.config';
import { I18nService, LANGS } from '../../core/i18n/i18n.service';
import { I18N } from '../../core/i18n/t.pipe';
import { ModuleCatalogue, TenantService } from '../../core/tenant/tenant.service';
import { ToastService } from '../../shared/floor/toast.service';

/** GET/PATCH /api/tenant/business */
interface Business {
  name: string; phone: string; address: string; city: string;
  currency: string; currencyLocked: boolean; language: string; sortingStages: number; modules?: string[];
  categories: number; grades: number; contact: string | null;
}

/**
 * Settings → Business (v2 review): one plain page instead of the five-step setup wizard. Name, phone, address
 * and city (printed under the name on bills and receipts, and in WhatsApp messages), the currency (fixed once
 * money is recorded), the language of messages and bills. What the business has (its modules and how it sorts)
 * is shown read-only: ThriftOS sets it (v2 modules).
 */
@Component({
  selector: 'app-business',
  standalone: true,
  imports: [FormsModule, RouterLink, LucideAngularModule, I18N],
  template: `
    <section class="floor">
      <header class="floor-head">
        <a class="icon-btn back" routerLink="/settings" [attr.aria-label]="'common.back' | t"><lucide-icon [img]="icons.ArrowLeft" [size]="22" /></a>
        <h1>{{ 'settings.business' | t }}</h1>
      </header>
      @if (error(); as e) { <p class="notice error" role="alert">{{ e | t }}</p> }
      @if (b(); as d) {
        <form class="card" (ngSubmit)="save()">
          <label class="field">{{ 'setup.businessName' | t }}<input name="name" [(ngModel)]="name" maxlength="120" autocomplete="organization" required /></label>
          <label class="field">{{ 'settings.biz.phone' | t }}<input name="phone" type="tel" inputmode="tel" [(ngModel)]="phone" [placeholder]="'common.phonePlaceholder' | t" class="ltr" /></label>
          <label class="field">{{ 'settings.biz.address' | t }}<input name="address" [(ngModel)]="address" maxlength="200" [placeholder]="'settings.biz.addressHint' | t" /></label>
          <label class="field">{{ 'settings.biz.city' | t }}<input name="city" [(ngModel)]="city" maxlength="60" /></label>
          <p class="hint">{{ 'settings.biz.onBills' | t }}</p>
          @if (preview(); as p) { <p class="preview"><strong>{{ name || d.name }}</strong><span>{{ p }}</span></p> }

          <span class="field">{{ 'setup.currency' | t }}</span>
          @if (d.currencyLocked) {
            <p class="hint"><strong>{{ d.currency }}</strong> · {{ 'settings.biz.currencyLocked' | t }}</p>
          } @else {
            <div class="chips">@for (c of currencies; track c) { <button type="button" class="chip" [class.on]="currency === c" (click)="currency = c">{{ c }}</button> }</div>
          }

          <span class="field">{{ 'settings.biz.language' | t }}</span>
          <div class="chips">@for (l of langs; track l.id) { <button type="button" class="chip" [class.on]="language === l.id" (click)="language = l.id">{{ l.name }}</button> }</div>
          <p class="hint">{{ 'settings.biz.languageHint' | t }}</p>

          <button type="submit" class="btn primary block" [disabled]="!name.trim() || saving()">{{ (saving() ? 'common.saving' : 'common.save') | t }}</button>
        </form>

        <section class="card has" aria-labelledby="has-h">
          <h2 id="has-h">{{ 'settings.biz.has' | t }}</h2>
          <p class="hint">{{ ('settings.biz.sorts' + d.sortingStages) | t }}</p>
          @if (cat(); as c) {
            <ul class="mods">
              @for (m of c.modules; track m.key) {
                @if (m.key !== 'SORT') {
                  <li [class.off]="!c.on?.includes(m.key)"><lucide-icon [img]="c.on?.includes(m.key) ? icons.Check : icons.Minus" [size]="16" /><span>{{ m.name[i18n.lang()] || m.name['en'] }}</span></li>
                }
              }
            </ul>
          }
          <p class="hint">{{ 'settings.biz.hasHint' | t }}</p>
        </section>

        @if (d.sortingStages >= 1) {
          <ul class="list">
            <li><a class="row" routerLink="/settings/admin/categories"><span><strong>{{ 'ws.adminIdx.area.categories.name' | t }}</strong><small>{{ 'settings.biz.count' | t: { n: d.categories } }}</small></span><lucide-icon [img]="icons.ChevronRight" [size]="20" class="go" /></a></li>
            @if (d.sortingStages === 2) {
              <li><a class="row" routerLink="/settings/admin/grades"><span><strong>{{ 'ws.adminIdx.area.grades.name' | t }}</strong><small>{{ 'settings.biz.count' | t: { n: d.grades } }}</small></span><lucide-icon [img]="icons.ChevronRight" [size]="20" class="go" /></a></li>
            }
          </ul>
        }
      }
    </section>
  `,
  styles: [`
    .card { display:grid; gap:12px; }
    .has { display:grid; gap:10px; }
    .has h2 { margin:0; font-size:17px; }
    .mods { list-style:none; margin:0; padding:0; display:grid; grid-template-columns:repeat(auto-fill, minmax(180px, 1fr)); gap:6px 16px; }
    .mods li { display:flex; align-items:center; gap:8px; font-size:15px; }
    .mods li lucide-icon { color:var(--tos-primary); flex:none; }
    .mods li.off { color:var(--tos-ink-soft); }
    .mods li.off lucide-icon { color:var(--tos-ink-soft); }
    .preview { display:grid; gap:2px; margin:0; padding:10px 12px; border:1px dashed var(--tos-line); border-radius:12px; text-align:center; }
    .preview span { color:var(--tos-ink-soft); font-size:14px; }
    html[dir='rtl'] .go { transform:scaleX(-1); }
  `],
})
export class BusinessComponent implements OnInit {
  private readonly http = inject(HttpClient);
  protected readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);
  private readonly tenants = inject(TenantService);
  protected readonly icons = { ArrowLeft, Check, ChevronRight, Minus };
  protected readonly currencies = ['PKR', 'USD', 'AED'];
  protected readonly langs = LANGS;
  protected readonly b = signal<Business | null>(null);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected name = '';
  protected phone = '';
  protected address = '';
  protected city = '';
  protected currency = 'PKR';
  protected language = 'ur';

  /** What ThriftOS turned on for this business (set when it was made; read-only here). */
  protected readonly cat = signal<ModuleCatalogue | null>(null);

  ngOnInit(): void {
    this.tenants.moduleCatalogue().subscribe({ next: (c) => this.cat.set(c), error: () => undefined });
    this.http.get<Business>(`${API_BASE_URL}/tenant/business`).subscribe({
      next: (d) => this.fill(d),
      error: () => this.error.set('common.couldNotLoad'),
    });
  }

  /** The line under the name on a bill, as it will print. */
  protected preview(): string {
    return [this.phone.trim(), this.address.trim(), this.city.trim()].filter(Boolean).join(' · ');
  }

  protected save(): void {
    const d = this.b();
    if (!d) return;
    this.saving.set(true);
    this.error.set(null);
    const body = {
      name: this.name.trim(), phone: this.phone.trim(), address: this.address.trim(), city: this.city.trim(), language: this.language,
      ...(d.currencyLocked ? {} : { currency: this.currency }),
    };
    this.http.patch<Business>(`${API_BASE_URL}/tenant/business`, body).subscribe({
      next: (fresh) => {
        this.saving.set(false);
        this.fill(fresh);
        this.toast.show(this.i18n.t('settings.biz.saved'));
        this.tenants.loadTenant(true).subscribe({ error: () => undefined });
      },
      error: (e: HttpErrorResponse) => {
        this.saving.set(false);
        const code = e.error?.code as string | undefined;
        this.error.set(code && ['PHONE_INVALID', 'CURRENCY_LOCKED'].includes(code) ? `settings.biz.err.${code}` : 'common.couldNotSave');
      },
    });
  }

  private fill(d: Business): void {
    this.b.set(d);
    this.name = d.name;
    this.phone = d.phone;
    this.address = d.address;
    this.city = d.city;
    this.currency = d.currency;
    this.language = d.language;
  }
}
