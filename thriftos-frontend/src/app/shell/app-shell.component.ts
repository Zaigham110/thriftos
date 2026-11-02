import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import {
  BarChart3,
  BookOpen,
  Home,
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
import { OfflineDraftService } from '../core/operations/offline-draft.service';
import { PwaService } from '../core/pwa/pwa.service';
import { TenantModule, TenantService } from '../core/tenant/tenant.service';

type LayoutMode = 'phone' | 'tablet' | 'desktop';

interface NavItem {
  label: string;
  path: string;
  module?: TenantModule;
  icon: typeof Home;
}

const NAV: NavItem[] = [
  { label: 'Home', path: '/home', icon: Home },
  { label: 'Receive', path: '/receive', module: 'RECEIVE', icon: Truck },
  { label: 'Sort', path: '/sort', module: 'SORT', icon: Layers3 },
  { label: 'Sell', path: '/sell', module: 'SELL', icon: ShoppingCart },
  { label: 'Khata', path: '/khata', module: 'KHATA', icon: BookOpen },
  { label: 'Stock', path: '/stock', module: 'STOCK', icon: PackageSearch },
  { label: 'Reports', path: '/reports', module: 'REPORTS', icon: BarChart3 },
  { label: 'Settings', path: '/settings', icon: Settings2 },
];

/**
 * The one app shell: bottom tabs on phones (Home, Receive, Sort, Sell, Khata; the rest under
 * "More" in the top bar), an icon rail on tablets and a side nav on desktop.
 * Modules the tenant has not enabled are not shown at all.
 */
@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [LucideAngularModule, RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    @if (layout() === 'desktop') {
      <div class="desktop">
        <aside class="sidebar" aria-label="Main menu">
          <a routerLink="/home" class="brand">ThriftOS</a>
          <div class="tenant">{{ tenantName() }}</div>
          <nav>
            @for (item of visibleNav(); track item.path) {
              <a [routerLink]="item.path" routerLinkActive="active" class="nav-item">
                <lucide-icon [img]="item.icon" [size]="18" /><span>{{ item.label }}</span>
              </a>
            }
          </nav>
          <div class="sidebar-footer">
            <span class="sync" [class.offline]="!offline.isOnline()"><i></i>{{ syncLabel() }}</span>
            <button type="button" class="signout" (click)="signOut()"><lucide-icon [img]="icons.LogOut" [size]="17" /> Sign out</button>
          </div>
        </aside>
        <main class="content"><router-outlet /></main>
      </div>
    } @else if (layout() === 'tablet') {
      <div class="tablet">
        <aside class="rail" aria-label="Main menu">
          <a routerLink="/home" class="rail-brand" aria-label="ThriftOS home">T</a>
          @for (item of visibleNav(); track item.path) {
            <a [routerLink]="item.path" routerLinkActive="active" class="rail-item" [attr.aria-label]="item.label">
              <lucide-icon [img]="item.icon" [size]="20" /><small>{{ item.label }}</small>
            </a>
          }
          <button type="button" class="rail-signout" (click)="signOut()" aria-label="Sign out"><lucide-icon [img]="icons.LogOut" [size]="19" /></button>
        </aside>
        <main class="content"><router-outlet /></main>
      </div>
    } @else {
      <div class="phone">
        <header class="topbar">
          <a routerLink="/home" class="topbar-brand">ThriftOS</a>
          <span class="sync" [class.offline]="!offline.isOnline()"><i></i>{{ syncLabel() }}</span>
          <button type="button" class="more-button" (click)="moreOpen.set(true)" aria-label="More"><lucide-icon [img]="icons.Menu" [size]="22" /></button>
        </header>
        @if (pwa.updateReady()) {
          <div class="pwa-bar" role="status"><span>New version ready</span><button type="button" (click)="pwa.reload()">Reload</button></div>
        } @else if (pwa.canInstall()) {
          <div class="pwa-bar" role="status"><span>Add ThriftOS to your phone</span><button type="button" (click)="pwa.install()">Install</button><button type="button" class="ghost" (click)="pwa.notNow()">Not now</button></div>
        }
        <main class="content"><router-outlet /></main>
        @if (moreOpen()) {
          <div class="sheet-backdrop" (click)="moreOpen.set(false)">
            <section class="sheet" (click)="$event.stopPropagation()" aria-label="More">
              @for (item of phoneMore(); track item.path) {
                <a [routerLink]="item.path" (click)="moreOpen.set(false)"><lucide-icon [img]="item.icon" [size]="22" />{{ item.label }}</a>
              }
              <button type="button" (click)="signOut()"><lucide-icon [img]="icons.LogOut" [size]="22" />Sign out</button>
            </section>
          </div>
        }
        <nav class="tabs" aria-label="Main tabs">
          @for (item of phoneTabs(); track item.path) {
            <a [routerLink]="item.path" routerLinkActive="active"><lucide-icon [img]="item.icon" [size]="22" /><span>{{ item.label }}</span></a>
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

    .desktop { min-height:100vh; display:grid; grid-template-columns:232px minmax(0,1fr); }
    .sidebar { position:sticky; top:0; height:100vh; display:flex; flex-direction:column; padding:22px 14px 16px; box-sizing:border-box; background:var(--flow-ink); color:#eff5f2; }
    .brand { color:#fff; text-decoration:none; font-size:20px; font-weight:800; letter-spacing:-.03em; }
    .tenant { margin:20px 8px; color:#b7c7c4; font-size:12px; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
    nav { display:grid; gap:4px; }
    .nav-item { min-height:48px; display:flex; align-items:center; gap:12px; padding:0 12px; border-radius:var(--flow-radius-sm); color:#bdcfcb; font-size:14px; font-weight:650; text-decoration:none; }
    .nav-item:hover { background:#243339; color:#fff; }
    .nav-item.active { background:#e4f4f0; color:#154d47; }
    .sidebar-footer { display:grid; gap:12px; margin-top:auto; padding:14px 8px 0; border-top:1px solid #334348; color:#b7c7c4; }
    .signout { min-height:48px; display:flex; align-items:center; gap:9px; border:0; padding:0; background:transparent; color:#bdcfcb; font:inherit; font-size:13px; cursor:pointer; }

    .tablet { min-height:100vh; display:grid; grid-template-columns:84px minmax(0,1fr); }
    .rail { position:sticky; top:0; height:100vh; display:flex; flex-direction:column; align-items:center; gap:6px; padding:16px 8px; box-sizing:border-box; background:var(--flow-ink); }
    .rail-brand { width:44px; height:44px; display:grid; place-items:center; margin-bottom:8px; border-radius:12px; background:#e4f4f0; color:#154d47; font-weight:900; text-decoration:none; }
    .rail-item { width:100%; min-height:56px; display:grid; justify-items:center; align-content:center; gap:3px; border-radius:10px; color:#bdcfcb; text-decoration:none; }
    .rail-item small { font-size:10px; font-weight:700; }
    .rail-item.active { background:#e4f4f0; color:#154d47; }
    .rail-signout { margin-top:auto; width:48px; height:48px; border:0; background:transparent; color:#bdcfcb; cursor:pointer; }

    .phone { min-height:100vh; padding-bottom:76px; }
    .phone .content { padding:16px; }
    .topbar { position:sticky; top:0; z-index:5; min-height:56px; display:flex; align-items:center; gap:12px; padding:0 8px 0 16px; border-bottom:1px solid var(--flow-line); background:var(--flow-canvas); }
    .topbar-brand { margin-right:auto; color:var(--flow-ink); font-size:17px; font-weight:800; text-decoration:none; }
    .more-button { width:48px; height:48px; display:grid; place-items:center; border:0; background:transparent; color:var(--flow-ink); }
    .tabs { position:fixed; inset:auto 0 0 0; z-index:5; display:grid; grid-template-columns:repeat(auto-fit,minmax(0,1fr)); min-height:64px; padding-bottom:env(safe-area-inset-bottom); border-top:1px solid var(--flow-line); background:#fff; }
    .tabs a { display:grid; justify-items:center; align-content:center; gap:2px; min-height:64px; color:var(--flow-ink-soft); font-size:11px; font-weight:700; text-decoration:none; }
    .tabs a.active { color:var(--flow-teal); }
    .pwa-bar { display:flex; align-items:center; gap:8px; padding:8px 12px 8px 16px; background:#f4eef3; color:#4a2f43; font-size:14px; font-weight:650; }
    .pwa-bar span { margin-right:auto; }
    .pwa-bar button { min-height:44px; padding:0 14px; border:0; border-radius:10px; background:#714b67; color:#fff; font:inherit; font-weight:700; }
    .pwa-bar button.ghost { background:transparent; color:#714b67; }
    .sheet-backdrop { position:fixed; inset:0; z-index:10; display:flex; align-items:flex-end; background:rgb(0 0 0 / .35); }
    .sheet { width:100%; display:grid; padding:8px 8px calc(8px + env(safe-area-inset-bottom)); border-radius:16px 16px 0 0; background:#fff; }
    .sheet a, .sheet button { min-height:56px; display:flex; align-items:center; gap:14px; padding:0 16px; border:0; border-radius:10px; background:transparent; color:var(--flow-ink); font:inherit; font-size:16px; font-weight:650; text-decoration:none; text-align:left; }
  `],
})
export class AppShellComponent {
  private readonly auth = inject(AuthService);
  private readonly tenantService = inject(TenantService);
  private readonly router = inject(Router);
  protected readonly offline = inject(OfflineDraftService);
  protected readonly pwa = inject(PwaService);
  protected readonly icons = { LogOut, Menu };
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
    if (!this.offline.isOnline()) return `Offline — saved on phone (${this.offline.pendingCount()})`;
    return this.offline.pendingCount() ? `${this.offline.pendingCount()} not synced yet` : 'Synced';
  });

  constructor() {
    this.tenantService.loadTenant().subscribe({ error: () => undefined });
  }

  @HostListener('window:resize')
  protected onResize(): void {
    this.layout.set(layoutFor(window.innerWidth));
  }

  protected signOut(): void {
    this.moreOpen.set(false);
    void this.pwa.clearDataCaches();
    this.auth.logout().subscribe(() => this.router.navigate(['/auth/login']));
  }
}

function layoutFor(width: number): LayoutMode {
  return width < 600 ? 'phone' : width < 1024 ? 'tablet' : 'desktop';
}
