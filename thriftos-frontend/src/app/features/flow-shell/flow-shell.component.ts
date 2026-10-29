import { CommonModule } from '@angular/common';
import { Component, DestroyRef, HostListener, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import {
  BarChart3,
  Box,
  ClipboardList,
  LogOut,
  Menu,
  LucideAngularModule,
  PackageSearch,
  ScanLine,
  Settings2,
  ShoppingCart,
  Truck,
} from 'lucide-angular';
import { filter } from 'rxjs';

import { AuthService } from '../../core/auth';
import { OfflineDraftService } from '../../core/operations/offline-draft.service';
import { OperationalModule, TenantService } from '../../core/tenant/tenant.service';

type LayoutMode = 'mobile' | 'tablet' | 'desktop';

interface FlowNavigationItem {
  label: string;
  path: string;
  module?: OperationalModule;
  icon: typeof ClipboardList;
}

/**
 * The Flow shell is a parallel replacement for Lite's presentation layer.
 * It deliberately has distinct markup for phone, tablet and desktop;
 * pages retain the existing API contracts and route guards during migration.
 */
@Component({
  selector: 'app-flow-shell',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    @if (layoutMode() === 'desktop') {
      <div class="flow-desktop-shell">
        <aside class="flow-sidebar" aria-label="Primary navigation">
          <a routerLink="/app/flow/work" class="flow-brand" aria-label="ThriftOS Flow">T<span>Flow</span></a>
          <div class="flow-tenant"><span class="flow-live-dot"></span>{{ tenantName() }}</div>
          <nav class="flow-nav">
            @for (item of navigation; track item.path) {
              @if (!item.module || isModuleEnabled(item.module)) {
                <a [routerLink]="item.path" routerLinkActive="active" class="flow-nav-item">
                  <lucide-icon [img]="item.icon" [size]="18"></lucide-icon><span>{{ item.label }}</span>
                </a>
              }
            }
          </nav>
          <div class="flow-sidebar-footer">
            <span class="flow-sync" [class.is-offline]="!offlineDrafts.isOnline()">
              <i></i>{{ syncLabel() }}
            </span>
            <button type="button" class="flow-signout" (click)="onSignOut()"><lucide-icon [img]="icons.LogOut" [size]="17"></lucide-icon> Sign out</button>
          </div>
        </aside>
        <section class="flow-desktop-workspace">
          <header class="flow-commandbar">
            <div class="flow-command-copy"><span>Operations</span><strong>{{ sectionName() }}</strong></div>
            <button type="button" class="flow-scan-button" (click)="focusScan()"><lucide-icon [img]="icons.ScanLine" [size]="17"></lucide-icon> Scan or search <kbd>⌘ K</kbd></button>
            <div class="flow-user"><span>{{ userInitial() }}</span><b>{{ userName() }}</b></div>
          </header>
          <main class="flow-content"><router-outlet></router-outlet></main>
        </section>
      </div>
    } @else if (layoutMode() === 'tablet') {
      <div class="flow-tablet-shell">
        <aside class="flow-tablet-rail" aria-label="Primary navigation">
          <a routerLink="/app/flow/work" class="flow-rail-brand">T</a>
          @for (item of navigation; track item.path) {
            @if (!item.module || isModuleEnabled(item.module)) {
              <a [routerLink]="item.path" routerLinkActive="active" class="flow-rail-item" [attr.aria-label]="item.label">
                <lucide-icon [img]="item.icon" [size]="20"></lucide-icon><small>{{ item.label }}</small>
              </a>
            }
          }
          <button type="button" class="flow-rail-signout" (click)="onSignOut()" aria-label="Sign out"><lucide-icon [img]="icons.LogOut" [size]="19"></lucide-icon></button>
        </aside>
        <section class="flow-tablet-workspace">
          <header class="flow-tablet-header"><div><span>Operations</span><strong>{{ sectionName() }}</strong></div><button type="button" class="flow-scan-icon" (click)="focusScan()" aria-label="Scan or search"><lucide-icon [img]="icons.ScanLine" [size]="20"></lucide-icon></button></header>
          <main class="flow-content"><router-outlet></router-outlet></main>
        </section>
      </div>
    } @else {
      <div class="flow-mobile-shell">
        <header class="flow-mobile-header"><a routerLink="/app/flow/work" class="flow-mobile-brand">ThriftOS <span>Flow</span></a><span class="flow-mobile-sync" [class.is-offline]="!offlineDrafts.isOnline()">{{ syncLabel() }}</span></header>
        <main class="flow-content"><router-outlet></router-outlet></main>
        @if (mobileMoreOpen()) { <div class="flow-mobile-more-backdrop" (click)="mobileMoreOpen.set(false)"><section class="flow-mobile-more" (click)="$event.stopPropagation()"><header><div><span>More workspaces</span><strong>Continue your flow</strong></div><button type="button" (click)="mobileMoreOpen.set(false)" aria-label="Close more workspaces">×</button></header>@for (item of mobileMoreNavigation; track item.path) {@if (!item.module || isModuleEnabled(item.module)) {<a [routerLink]="item.path" (click)="mobileMoreOpen.set(false)"><lucide-icon [img]="item.icon" [size]="20"></lucide-icon><span>{{ item.label }}</span><small>Open <span aria-hidden="true">→</span></small></a>}}</section></div> }
        <nav class="flow-mobile-nav" aria-label="Primary tasks">
          @for (item of mobileNavigation; track item.path) {
            @if (!item.module || isModuleEnabled(item.module)) {
              <a [routerLink]="item.path" routerLinkActive="active"><lucide-icon [img]="item.icon" [size]="20"></lucide-icon><span>{{ item.label }}</span></a>
            }
          }
          <button type="button" [class.active]="mobileMoreOpen()" (click)="mobileMoreOpen.set(!mobileMoreOpen())"><lucide-icon [img]="icons.Menu" [size]="21"></lucide-icon><span>More</span></button>
        </nav>
      </div>
    }
  `,
  styles: [`
    :host { display:block; min-height:100vh; color:var(--flow-ink); font-family:var(--font-family); }
    .flow-desktop-shell { min-height:100vh; display:grid; grid-template-columns:244px minmax(0,1fr); background:var(--flow-canvas); }
    .flow-sidebar { position:sticky; top:0; height:100vh; display:flex; flex-direction:column; padding:22px 14px 16px; box-sizing:border-box; background:var(--flow-ink); color:#eff5f2; }
    .flow-brand { display:flex; align-items:center; gap:8px; width:max-content; color:#fff; text-decoration:none; font-size:20px; font-weight:800; letter-spacing:-.04em; }
    .flow-brand::first-letter,.flow-rail-brand { color:#8ee1d5; }
    .flow-brand span { color:#8ee1d5; font-size:13px; font-weight:650; letter-spacing:0; }
    .flow-tenant { display:flex; align-items:center; gap:7px; margin:28px 8px 20px; color:#b7c7c4; font-size:12px; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
    .flow-live-dot { width:7px; height:7px; border-radius:999px; background:#78d7ca; box-shadow:0 0 0 4px rgb(120 215 202 / .12); }
    .flow-nav { display:grid; gap:4px; }
    .flow-nav-item { min-height:46px; display:flex; align-items:center; gap:12px; padding:0 12px; border-radius:var(--flow-radius-sm); color:#bdcfcb; font-size:14px; font-weight:650; text-decoration:none; }
    .flow-nav-item:hover { background:#243339; color:#fff; }.flow-nav-item.active { background:#e4f4f0; color:#154d47; }
    .flow-sidebar-footer { display:grid; gap:12px; margin-top:auto; padding:14px 8px 0; border-top:1px solid #334348; }
    .flow-sync { display:flex; align-items:center; gap:7px; color:#b7c7c4; font-size:12px; }.flow-sync i { width:7px; height:7px; border-radius:50%; background:#78d7ca; }.flow-sync.is-offline i { background:#f7bd62; }.flow-sync.is-offline { color:#f7d49b; }
    .flow-signout { min-height:42px; display:flex; align-items:center; gap:9px; border:0; padding:0; background:transparent; color:#bdcfcb; font:inherit; font-size:13px; cursor:pointer; }.flow-signout:hover { color:#fff; }
    .flow-desktop-workspace,.flow-tablet-workspace { min-width:0; }.flow-commandbar { min-height:72px; display:flex; align-items:center; gap:24px; padding:0 32px; border-bottom:1px solid var(--flow-line); background:rgb(246 244 239 / .94); }.flow-command-copy { display:grid; gap:2px; min-width:150px; }.flow-command-copy span,.flow-tablet-header span { color:var(--flow-ink-soft); font-size:11px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; }.flow-command-copy strong,.flow-tablet-header strong { font-size:18px; letter-spacing:-.02em; }
    .flow-scan-button { flex:1; max-width:490px; min-height:42px; display:flex; align-items:center; gap:9px; padding:0 13px; border:1px solid var(--flow-line); border-radius:10px; background:var(--flow-surface); color:var(--flow-ink-soft); font:inherit; font-size:13px; text-align:left; cursor:pointer; }.flow-scan-button kbd { margin-left:auto; padding:2px 6px; border:1px solid var(--flow-line); border-radius:5px; color:var(--flow-ink-soft); font-size:11px; }
    .flow-user { display:flex; align-items:center; gap:8px; margin-left:auto; font-size:13px; }.flow-user span { width:30px; height:30px; display:grid; place-items:center; border-radius:50%; background:var(--flow-blue-soft); color:var(--flow-blue); font-size:12px; font-weight:800; }.flow-user b { font-weight:650; }
    .flow-content { min-width:0; padding:28px 32px; }.flow-tablet-shell { min-height:100vh; display:grid; grid-template-columns:82px minmax(0,1fr); background:var(--flow-canvas); }.flow-tablet-rail { position:sticky; top:0; height:100vh; display:flex; flex-direction:column; align-items:center; gap:8px; padding:16px 10px; box-sizing:border-box; background:var(--flow-ink); }.flow-rail-brand { width:42px; height:42px; display:grid; place-items:center; margin-bottom:10px; border-radius:12px; background:#e4f4f0; color:#154d47; font-weight:900; text-decoration:none; }.flow-rail-item { width:100%; min-height:54px; display:grid; place-items:center; gap:3px; border-radius:10px; color:#b9cbc7; text-decoration:none; }.flow-rail-item small { font-size:9px; font-weight:700; }.flow-rail-item.active { background:#284047; color:#fff; }.flow-rail-signout { width:42px; min-height:42px; margin-top:auto; border:1px solid #40555a; border-radius:10px; background:transparent; color:#b9cbc7; }.flow-tablet-header { min-height:70px; display:flex; align-items:center; justify-content:space-between; padding:0 24px; border-bottom:1px solid var(--flow-line); background:var(--flow-canvas); }.flow-tablet-header div { display:grid; gap:2px; }.flow-scan-icon { width:44px; height:44px; display:grid; place-items:center; border:1px solid var(--flow-line); border-radius:10px; background:var(--flow-surface); color:var(--flow-ink); }
    .flow-mobile-shell { min-height:100vh; padding-bottom:78px; background:var(--flow-canvas); }.flow-mobile-header { min-height:60px; display:flex; align-items:center; justify-content:space-between; padding:0 18px; border-bottom:1px solid var(--flow-line); background:var(--flow-canvas); }.flow-mobile-brand { color:var(--flow-ink); font-size:16px; font-weight:800; letter-spacing:-.035em; text-decoration:none; }.flow-mobile-brand span { color:var(--flow-teal); font-size:12px; letter-spacing:0; }.flow-mobile-sync { color:var(--flow-teal); font-size:11px; font-weight:750; }.flow-mobile-sync.is-offline { color:var(--flow-amber); }.flow-mobile-nav { position:fixed; z-index:30; right:0; bottom:0; left:0; height:70px; display:grid; grid-template-columns:repeat(5,1fr); border-top:1px solid var(--flow-line); background:#fff; box-shadow:0 -8px 24px rgb(23 33 38 / .08); }.flow-mobile-nav a,.flow-mobile-nav button { min-width:48px; display:grid;place-content:center;gap:3px;border:0;background:#fff;color:var(--flow-ink-soft);font:inherit;text-align:center;text-decoration:none; }.flow-mobile-nav span { font-size:10px; font-weight:700; }.flow-mobile-nav a.active,.flow-mobile-nav button.active { color:var(--flow-teal); }.flow-mobile-shell .flow-content { padding:18px; }.flow-mobile-more-backdrop{position:fixed;z-index:29;inset:0;background:rgb(13 29 31 / .32);display:flex;align-items:flex-end}.flow-mobile-more{width:100%;padding:16px 18px 86px;border-radius:20px 20px 0 0;background:#fff;box-shadow:0 -14px 36px rgb(13 29 31 / .18)}.flow-mobile-more header{display:flex;align-items:center;justify-content:space-between;padding:0 0 12px}.flow-mobile-more header div{display:grid;gap:2px}.flow-mobile-more header span{color:var(--flow-teal);font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase}.flow-mobile-more header strong{font-size:17px}.flow-mobile-more header button{width:34px;height:34px;border:1px solid var(--flow-line);border-radius:50%;background:#fff;color:var(--flow-ink);font-size:23px;line-height:1}.flow-mobile-more a{display:grid;grid-template-columns:28px 1fr auto;align-items:center;gap:9px;min-height:51px;border-top:1px solid var(--flow-line);color:var(--flow-ink);text-decoration:none}.flow-mobile-more a>lucide-icon{color:var(--flow-teal)}.flow-mobile-more a>span{font-size:13px;font-weight:750}.flow-mobile-more a small{color:var(--flow-ink-soft);font-size:11px}
    @media (min-width: 1024px) and (max-width: 1260px) { .flow-desktop-shell { grid-template-columns:76px minmax(0,1fr); }.flow-sidebar { align-items:center; padding-inline:10px; }.flow-brand span,.flow-tenant,.flow-nav-item span,.flow-sidebar-footer .flow-sync,.flow-signout { display:none; }.flow-nav-item { width:46px; justify-content:center; padding:0; }.flow-sidebar-footer { border:0; padding:0; }.flow-signout { width:42px; }.flow-content { padding:24px; }.flow-commandbar { padding:0 24px; } }
  `],
})
export class FlowShellComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly authService = inject(AuthService);
  private readonly tenantService = inject(TenantService);
  private readonly router = inject(Router);
  protected readonly offlineDrafts = inject(OfflineDraftService);
  protected readonly layoutMode = signal<LayoutMode>(this.getLayoutMode());
  protected readonly tenantName = computed(() => this.tenantService.tenant()?.name || 'ThriftOS');
  protected readonly userName = computed(() => this.authService.user()?.name || 'Operator');
  protected readonly userInitial = computed(() => this.userName().charAt(0).toUpperCase());
  protected readonly sectionName = signal('My Work');
  protected readonly syncLabel = computed(() => !this.offlineDrafts.isOnline() ? 'Offline' : this.offlineDrafts.pendingCount() ? `${this.offlineDrafts.pendingCount()} queued` : 'Synced');
  protected readonly icons = { ClipboardList, Truck, Box, PackageSearch, ShoppingCart, BarChart3, Settings2, ScanLine, LogOut, Menu };
  protected readonly navigation: FlowNavigationItem[] = [
    { label: 'My Work', path: '/app/flow/work', module: 'WORK', icon: ClipboardList },
    { label: 'Receive', path: '/app/flow/receive', module: 'INTAKE', icon: Truck },
    { label: 'Transform', path: '/app/flow/transform', module: 'SORTING', icon: Box },
    { label: 'Seal', path: '/app/flow/seal', module: 'REPACK', icon: Box },
    { label: 'Stock', path: '/app/flow/stock', module: 'STOCK', icon: PackageSearch },
    { label: 'Dispatch', path: '/app/flow/dispatch', module: 'SALES', icon: ShoppingCart },
    { label: 'Insights', path: '/app/flow/insights', module: 'INSIGHTS', icon: BarChart3 },
    { label: 'Control', path: '/app/flow/control', module: 'ADMINISTRATION', icon: Settings2 },
  ];
  protected readonly mobileNavigation = [this.navigation[0], this.navigation[1], this.navigation[2], this.navigation[4]];
  protected readonly mobileMoreNavigation = [this.navigation[3], this.navigation[5], this.navigation[6], this.navigation[7]];
  protected readonly mobileMoreOpen = signal(false);

  constructor() {
    this.tenantService.loadTenant().subscribe({ error: () => undefined });
    this.setSectionName(this.router.url);
    this.router.events.pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd), takeUntilDestroyed(this.destroyRef)).subscribe((event) => this.setSectionName(event.urlAfterRedirects));
  }

  protected isModuleEnabled(module: OperationalModule): boolean { const enabled = this.tenantService.tenant()?.operationalModules; return !enabled?.length || enabled.includes(module); }
  protected focusScan(): void { this.router.navigate(['/app/flow/stock'], { queryParams: { scan: 'true' } }); }
  protected onSignOut(): void { this.authService.logout().subscribe(() => this.router.navigate(['/auth/login'])); }
  @HostListener('window:resize') protected onViewportResize(): void { this.layoutMode.set(this.getLayoutMode()); }
  private getLayoutMode(): LayoutMode { return window.innerWidth < 600 ? 'mobile' : window.innerWidth < 1024 ? 'tablet' : 'desktop'; }
  private setSectionName(url: string): void { this.sectionName.set(url.includes('/receive') ? 'Receive' : url.includes('/grade') ? 'Quality Grade' : url.includes('/transform') ? 'Transform' : url.includes('/seal') ? 'Seal' : url.includes('/stock') ? 'Stock' : url.includes('/sale') ? 'Create sale' : url.includes('/dispatch') ? 'Dispatch' : url.includes('/insights') ? 'Insights' : url.includes('/control') ? 'Control center' : 'My Work'); }
}
