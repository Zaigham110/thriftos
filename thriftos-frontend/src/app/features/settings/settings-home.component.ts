import { moduleOn } from '../../core/tenant/module-on';
import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Building2, ChevronRight, CreditCard, CircleHelp, Download, FileText, FileUp, KeyRound, Languages, LogOut, LucideAngularModule, SlidersHorizontal, Users } from 'lucide-angular';
import { AuthService } from '../../core/auth';
import { I18nService } from '../../core/i18n/i18n.service';
import { I18N } from '../../core/i18n/t.pipe';
import { TenantService } from '../../core/tenant/tenant.service';
import { ToastService } from '../../shared/floor/toast.service';
import { localPhone } from '../../shared/phone';
import { LangPickerComponent } from '../../shared/ui/lang-picker.component';

type Icon = typeof Building2;
interface Item { key: string; icon: Icon; path?: string; show: boolean }

/** Master data behind Advanced; anyone allowed to open one of them sees it. */
const ADVANCED = ['role.read', 'category.read', 'grade.read', 'warehouse.read', 'vendor.read', 'price.manage'];

/**
 * Settings (v2 review): who is signed in and in which business at the top, then only what this person may use,
 * each with one line saying what it is for. A munshi sees their PIN, the language and help; the owner also sees the
 * business, team, import, export and Advanced. People who sign in with phone + PIN change their PIN here.
 */
@Component({
  selector: 'app-settings-home',
  standalone: true,
  imports: [LangPickerComponent, RouterLink, LucideAngularModule, I18N],
  template: `
    <section class="floor">
      <header class="floor-head"><h1>{{ 'settings.title' | t }}</h1></header>
      <div class="card me">
        <span class="who">
          <strong>{{ auth.user()?.name }}</strong>
          <small>{{ business() }}</small>
          <small>{{ signsIn() }}</small>
        </span>
        <button type="button" class="btn" (click)="signOut()"><lucide-icon [img]="icons.LogOut" [size]="18" /> {{ 'settings.signOut' | t }}</button>
      </div>
      <ul class="list">
        @for (i of items(); track i.key) {
          <li>
            @if (i.key === 'language') {
              <div class="row lang"><span class="item"><lucide-icon [img]="i.icon" [size]="22" /><span><strong>{{ 'setup.language' | t }}</strong><small>{{ 'settings.hint.language' | t }}</small></span></span><app-lang-picker class="amount" [iconSize]="0" /></div>
            } @else if (i.key === 'export') {
              <button type="button" class="row" (click)="exportData()" [disabled]="exporting()"><span class="item"><lucide-icon [img]="i.icon" [size]="22" /><span><strong>{{ 'settings.export' | t }}</strong><small>{{ (exporting() ? 'common.loading' : 'settings.exportHint') | t }}</small></span></span><lucide-icon [img]="icons.ChevronRight" [size]="20" class="go" /></button>
            } @else {
              <a class="row" [routerLink]="i.path"><span class="item"><lucide-icon [img]="i.icon" [size]="22" /><span><strong>{{ 'settings.item.' + i.key | t }}</strong><small>{{ 'settings.hint.' + i.key | t }}</small></span></span><lucide-icon [img]="icons.ChevronRight" [size]="20" class="go" /></a>
            }
          </li>
        }
      </ul>
    </section>
  `,
  styles: [`
    button.row { width:100%; border:0; background:transparent; font:inherit; cursor:pointer; text-align:start; }
    .item { display:flex !important; align-items:center; gap:12px; min-width:0; }
    .item > span { display:grid; gap:2px; min-width:0; }
    .item lucide-icon { flex:none; color:var(--tos-primary); }
    .item small { color:var(--tos-ink-soft); font-size:13px; font-weight:500; }
    .me { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:12px; }
    .me .who { display:grid; gap:2px; min-width:0; }
    .me small { color:var(--tos-ink-soft); font-size:14px; }
    html[dir='rtl'] .go { transform:scaleX(-1); }
    /* On a laptop the language is in the top bar. */
    @media (min-width: 1024px) { .row.lang { display:none; } li:has(> .row.lang) { display:none; } }
  `],
})
export class SettingsHomeComponent {
  private readonly on = moduleOn();
  protected readonly auth = inject(AuthService);
  private readonly i18n = inject(I18nService);
  private readonly http = inject(HttpClient);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly tenants = inject(TenantService);
  protected readonly icons = { ChevronRight, LogOut };
  protected readonly exporting = signal(false);

  protected readonly business = computed(() => this.tenants.tenant()?.name ?? '');
  /** "Signs in with 0300 1234567 and a PIN" / "… with owner@shop.pk". */
  protected readonly signsIn = computed(() => {
    const u = this.auth.user();
    if (!u) return '';
    return u.email ? this.i18n.t('settings.signsInEmail', { email: u.email }) : u.phone ? this.i18n.t('settings.signsInPin', { phone: localPhone(u.phone) }) : '';
  });

  protected readonly items = computed<Item[]>(() => {
    this.auth.permissions();
    const can = (p: string) => this.auth.hasPermission(p);
    const u = this.auth.user();
    return [
      { key: 'business', icon: Building2, path: '/settings/business', show: can('tenant.update') },
      // Phase 7: the plan, paying and invoices (owners; a business set up by hand has nothing to pay).
      { key: 'billing', icon: CreditCard, path: '/settings/billing', show: can('tenant.update') && !!this.tenants.tenant()?.billing && this.tenants.tenant()?.billing?.state !== 'CUSTOM' },
      { key: 'team', icon: Users, path: '/settings/team', show: can('user.read') },
      { key: 'pin', icon: KeyRound, path: '/settings/pin', show: !!u?.hasPin },
      { key: 'password', icon: KeyRound, path: '/settings/password', show: !!u?.email },
      { key: 'language', icon: Languages, show: true },
      { key: 'import', icon: FileUp, path: '/settings/admin/import', show: can('data.import') && this.on('IMPORT') },
      { key: 'export', icon: Download, show: can('data.export') },
      { key: 'help', icon: CircleHelp, path: '/help', show: true },
      { key: 'terms', icon: FileText, path: '/terms', show: true },
      { key: 'advanced', icon: SlidersHorizontal, path: '/settings/admin', show: ADVANCED.some(can) },
    ].filter((i) => i.show);
  });

  protected signOut(): void {
    this.auth.logout().subscribe(() => this.router.navigate(['/auth/login']));
  }

  /** Everything this business has, as a zip of CSV files (owners only). */
  protected exportData(): void {
    this.exporting.set(true);
    this.http.get('/api/tenant/export', { observe: 'response', responseType: 'blob' }).subscribe({
      next: (res) => {
        this.exporting.set(false);
        const name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? 'thriftos-export.zip';
        const url = URL.createObjectURL(res.body!);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
      },
      error: (e: { status?: number }) => {
        this.exporting.set(false);
        this.toast.show(this.i18n.t(e.status === 403 ? 'settings.exportNotAllowed' : 'common.couldNotLoad'));
      },
    });
  }
}
