import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import {
  BarChart3,
  BookOpen,
  Home,
  Languages,
  Layers3,
  LogOut,
  LucideAngularModule,
  Menu,
  PackageSearch,
  Settings2,
  ShoppingCart,
  Truck,
} from 'lucide-angular';

import { AuthService } from '../core/auth';
import { OfflineQueueService } from '../core/offline/offline-queue.service';
import { PwaService } from '../core/pwa/pwa.service';
import { I18nService } from '../core/i18n/i18n.service';
import { TPipe } from '../core/i18n/t.pipe';
import { ToastComponent } from '../shared/floor/toast.component';
import { TenantModule, TenantService } from '../core/tenant/tenant.service';
import { ThemeService } from '../core/theme/theme.service';
import { WorkspaceShellComponent } from './workspace/workspace-shell.component';
import { LangPickerComponent } from '../shared/ui/lang-picker.component';

type LayoutMode = 'phone' | 'tablet' | 'desktop';

interface NavItem {
  label: string;
  path: string;
  module?: TenantModule;
  icon: typeof Home;
}

const NAV: NavItem[] = [
  { label: 'nav.home', path: '/home', icon: Home },
  { label: 'nav.receive', path: '/receive', module: 'RECEIVE', icon: Truck },
  { label: 'nav.sort', path: '/sort', module: 'SORT', icon: Layers3 },
  { label: 'nav.sell', path: '/sell', module: 'SELL', icon: ShoppingCart },
  { label: 'nav.khata', path: '/khata', module: 'KHATA', icon: BookOpen },
  { label: 'nav.stock', path: '/stock', module: 'STOCK', icon: PackageSearch },
  { label: 'nav.reports', path: '/reports', module: 'REPORTS', icon: BarChart3 },
  { label: 'nav.settings', path: '/settings', icon: Settings2 },
];

/**
 * The one app shell: bottom tabs on phones (Home, Receive, Sort, Sell, Khata; the rest under
 * "More" in the top bar), an icon rail on tablets, and the workspace (ws-shell: top bar, grouped menu,
 * Ctrl/⌘ K) from 1024 px.
 * Modules the tenant has not enabled are not shown at all.
 */
@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [LangPickerComponent, LucideAngularModule, RouterLink, RouterLinkActive, RouterOutlet, TPipe, ToastComponent, WorkspaceShellComponent],
  template: `
    <tos-toast />
    @if (layout() === 'desktop') {
      <ws-shell (signOut)="signOut()"><router-outlet /></ws-shell>
    } @else if (layout() === 'tablet') {
      <div class="tablet">
        <aside class="rail" [attr.aria-label]="'nav.menu' | t">
          <a routerLink="/home" class="rail-brand" [attr.aria-label]="'nav.home' | t">T</a>
          @for (item of visibleNav(); track item.path) {
            <a [routerLink]="item.path" routerLinkActive="active" class="rail-item" [attr.aria-label]="item.label | t">
              <lucide-icon [img]="item.icon" [size]="20" /><small>{{ item.label | t }}</small>
            </a>
          }
          <button type="button" class="rail-signout" (click)="signOut()" [attr.aria-label]="'nav.signOut' | t"><lucide-icon [img]="icons.LogOut" [size]="19" /></button>
        </aside>
        <main class="content"><router-outlet /></main>
      </div>
    } @else {
      <div class="phone">
        <header class="topbar">
          <a routerLink="/home" class="topbar-brand">ThriftOS</a>
          <span class="sync" [class.offline]="!offline.online()"><i></i>{{ syncLabel() }}</span>
          <button type="button" class="more-button" (click)="moreOpen.set(true)" [attr.aria-label]="'nav.more' | t"><lucide-icon [img]="icons.Menu" [size]="22" /></button>
        </header>
        @if (pwa.updateReady()) {
          <div class="pwa-bar" role="status"><span>{{ 'pwa.update' | t }}</span><button type="button" (click)="pwa.reload()">{{ 'pwa.reload' | t }}</button></div>
        } @else if (pwa.canInstall()) {
          <div class="pwa-bar" role="status"><span>{{ 'pwa.install' | t }}</span><button type="button" (click)="pwa.install()">{{ 'pwa.installButton' | t }}</button><button type="button" class="ghost" (click)="pwa.notNow()">{{ 'pwa.notNow' | t }}</button></div>
        }
        <main class="content"><router-outlet /></main>
        @if (moreOpen()) {
          <div class="sheet-backdrop" (click)="moreOpen.set(false)">
            <section class="sheet" (click)="$event.stopPropagation()" [attr.aria-label]="'nav.more' | t">
              @for (item of phoneMore(); track item.path) {
                <a [routerLink]="item.path" (click)="moreOpen.set(false)"><lucide-icon [img]="item.icon" [size]="22" />{{ item.label | t }}</a>
              }
              <app-lang-picker class="lang-row" [iconSize]="22" />
              <button type="button" (click)="signOut()"><lucide-icon [img]="icons.LogOut" [size]="22" />{{ 'nav.signOut' | t }}</button>
            </section>
          </div>
        }
        <nav class="tabs" [attr.aria-label]="'nav.menu' | t">
          @for (item of phoneTabs(); track item.path) {
            <a [routerLink]="item.path" routerLinkActive="active"><lucide-icon [img]="item.icon" [size]="22" /><span>{{ item.label | t }}</span></a>
          }
        </nav>
      </div>
    }
  `,
  styles: [`
    :host { display:block; min-height:100vh; color:var(--flow-ink); font-family:var(--font-family); background:var(--flow-canvas); }
    .content { min-width:0; padding:28px 32px; }
    .sync { display:inline-flex; align-items:center; gap:6px; font-size:12px; font-weight:700; }
    .sync i { width:8px; height:8px; border-radius:50%; background:#2f9e8f; }
    .sync.offline i { background:#e09b2d; }


    .tablet { min-height:100vh; display:grid; grid-template-columns:84px minmax(0,1fr); }
    .rail { position:sticky; top:0; height:100vh; display:flex; flex-direction:column; align-items:center; gap:6px; padding:16px 8px; box-sizing:border-box; background:var(--flow-ink); }
    .rail-brand { width:44px; height:44px; display:grid; place-items:center; margin-bottom:8px; border-radius:12px; background:#e4f4f0; color:#154d47; font-weight:900; text-decoration:none; }
    .rail-item { width:100%; min-height:56px; display:grid; justify-items:center; align-content:center; gap:3px; border-radius:10px; color:#bdcfcb; text-decoration:none; }
    .rail-item small { font-size:10px; font-weight:700; }
    .rail-item.active { background:var(--tos-primary-soft); color:var(--tos-primary); }
    .rail-signout { margin-top:auto; width:48px; height:48px; border:0; background:transparent; color:#bdcfcb; cursor:pointer; }

    .phone { min-height:100vh; padding-bottom:76px; }
    .phone .content { padding:16px; }
    .topbar { position:sticky; top:0; z-index:5; min-height:56px; display:flex; align-items:center; gap:12px; padding-block:0; padding-inline:16px 8px; border-bottom:1px solid var(--flow-line); background:var(--flow-canvas); }
    .topbar-brand { margin-inline-end:auto; color:var(--flow-ink); font-size:17px; font-weight:800; text-decoration:none; }
    .more-button { width:48px; height:48px; display:grid; place-items:center; border:0; background:transparent; color:var(--flow-ink); }
    .tabs { position:fixed; inset:auto 0 0 0; z-index:5; display:grid; grid-template-columns:repeat(auto-fit,minmax(0,1fr)); min-height:64px; padding-bottom:env(safe-area-inset-bottom); border-top:1px solid var(--flow-line); background:#fff; }
    .tabs a { display:grid; justify-items:center; align-content:center; gap:2px; min-height:64px; color:var(--flow-ink-soft); font-size:11px; font-weight:700; text-decoration:none; }
    .tabs a.active { color:var(--tos-primary); }
    .pwa-bar { display:flex; align-items:center; gap:8px; padding-block:8px; padding-inline:16px 12px; background:#f4eef3; color:#4a2f43; font-size:14px; font-weight:650; }
    .pwa-bar span { margin-inline-end:auto; }
    .pwa-bar button { min-height:44px; padding:0 14px; border:0; border-radius:10px; background:#714b67; color:#fff; font:inherit; font-weight:700; }
    .pwa-bar button.ghost { background:transparent; color:#714b67; }
    .sheet-backdrop { position:fixed; inset:0; z-index:10; display:flex; align-items:flex-end; background:rgb(0 0 0 / .35); }
    .sheet { width:100%; display:grid; padding:8px 8px calc(8px + env(safe-area-inset-bottom)); border-radius:16px 16px 0 0; background:#fff; }
    .sheet a, .sheet button, .sheet .lang-row { min-height:56px; display:flex; align-items:center; gap:14px; padding:0 16px; border:0; border-radius:10px; background:transparent; color:var(--flow-ink); font:inherit; font-size:16px; font-weight:650; text-decoration:none; text-align:start; }
  `],
})
export class AppShellComponent {
  private readonly auth = inject(AuthService);
  private readonly tenantService = inject(TenantService);
  private readonly router = inject(Router);
  protected readonly offline = inject(OfflineQueueService);
  protected readonly pwa = inject(PwaService);
  private readonly i18n = inject(I18nService);
  // Applies the person's light/dark and density choice on every layout.
  private readonly theme = inject(ThemeService);
  protected readonly icons = { Languages, LogOut, Menu };
  protected readonly layout = signal<LayoutMode>(layoutFor(window.innerWidth));
  protected readonly moreOpen = signal(false);
  protected readonly tenantName = computed(() => this.tenantService.tenant()?.name || 'ThriftOS');
  protected readonly visibleNav = computed(() => {
    const tenant = this.tenantService.tenant();
    return NAV.filter((item) => !item.module || this.tenantService.isModuleEnabled(item.module, tenant));
  });
  private readonly phoneTabPaths = ['/home', '/receive', '/sort', '/sell', '/khata'];
  protected readonly phoneTabs = computed(() => this.visibleNav().filter((item) => this.phoneTabPaths.includes(item.path)));
  protected readonly phoneMore = computed(() => this.visibleNav().filter((item) => !this.phoneTabPaths.includes(item.path)));
  protected readonly syncLabel = computed(() => {
    const t = (k: string, n: number) => this.i18n.t(k, { n });
    if (!this.offline.online()) return t('sync.offline', this.offline.pendingCount());
    if (this.offline.failed().length) return t('sync.attention', this.offline.failed().length);
    return this.offline.pendingCount() ? t('sync.pending', this.offline.pendingCount()) : this.i18n.t('sync.synced');
  });

  constructor() {
    this.tenantService.loadTenant().subscribe({ next: (tenant) => this.i18n.useDefault(tenant?.defaultLanguage), error: () => undefined });
  }

  @HostListener('window:resize')
  protected onResize(): void {
    this.layout.set(layoutFor(window.innerWidth));
  }


  protected async signOut(): Promise<void> {
    this.moreOpen.set(false);
    // Cached answers belong to this person: gone before the next person signs in on this phone.
    await this.pwa.clearDataCaches();
    this.auth.logout().subscribe(() => this.router.navigate(['/auth/login']));
  }
}

function layoutFor(width: number): LayoutMode {
  return width < 600 ? 'phone' : width < 1024 ? 'tablet' : 'desktop';
}
