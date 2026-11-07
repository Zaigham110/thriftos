/**
 * Super Admin shell (enterprise UI pass): the platform console in the same look as the workspace — a top bar
 * with the brand, theme and account, and a short grouped menu. No business data lives here, only businesses,
 * people, the audit trail and platform settings.
 */

import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Building2, ChevronDown, LayoutDashboard, LogOut, LucideAngularModule, Moon, ScrollText, Settings2, ShieldCheck, Sun, Users } from 'lucide-angular';
import { AuthService } from '../../core/auth';
import { ThemeService } from '../../core/theme/theme.service';

type Icon = typeof LayoutDashboard;
interface Item { label: string; path: string; icon: Icon }
interface Group { label: string; items: Item[] }

const NAV: Group[] = [
  { label: '', items: [{ label: 'Overview', path: '/admin/dashboard', icon: LayoutDashboard }] },
  {
    label: 'Platform',
    items: [
      { label: 'Businesses', path: '/admin/tenants', icon: Building2 },
      { label: 'People', path: '/admin/users', icon: Users },
    ],
  },
  {
    label: 'Security',
    items: [
      { label: 'Audit trail', path: '/admin/audit', icon: ScrollText },
      { label: 'Platform settings', path: '/admin/settings', icon: Settings2 },
    ],
  },
];

@Component({
  selector: 'app-admin-shell',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet, LucideAngularModule],
  template: `
    <a class="skip" href="#admin-main">Skip to content</a>
    <div class="ws">
      <header class="topbar">
        <a routerLink="/admin/dashboard" class="brand"><img src="os_sm.png" alt="" width="28" height="28" /><span>ThriftOS</span></a>
        <span class="badge" title="Platform admin"><lucide-icon [img]="icons.ShieldCheck" [size]="14" aria-hidden="true" /><span>Platform admin</span></span>
        <span class="grow"></span>
        <button type="button" class="tool" (click)="theme.toggleTheme()" [attr.aria-label]="theme.theme() === 'dark' ? 'Light theme' : 'Dark theme'">
          <lucide-icon [img]="theme.theme() === 'dark' ? icons.Sun : icons.Moon" [size]="18" aria-hidden="true" />
        </button>
        <div class="account">
          <button type="button" class="tool who" (click)="menu.set(!menu())" [attr.aria-expanded]="menu()" aria-haspopup="menu">
            <span class="avatar" aria-hidden="true">{{ initials() }}</span><span class="name">{{ userName() }}</span>
            <lucide-icon [img]="icons.ChevronDown" [size]="14" aria-hidden="true" />
          </button>
          @if (menu()) {
            <div class="menu" role="menu">
              <p class="email">{{ email() }}</p>
              <button type="button" role="menuitem" (click)="signOut()"><lucide-icon [img]="icons.LogOut" [size]="16" aria-hidden="true" />Sign out</button>
            </div>
          }
        </div>
      </header>
      <aside class="nav" aria-label="Admin menu">
        <nav>
          @for (g of groups(); track g.label) {
            @if (g.label) { <div class="group-label">{{ g.label }}</div> }
            @for (i of g.items; track i.path) {
              <a [routerLink]="i.path" routerLinkActive="active" class="nav-item"><lucide-icon [img]="i.icon" [size]="18" aria-hidden="true" /><span>{{ i.label }}</span></a>
            }
          }
        </nav>
      </aside>
      <main id="admin-main" class="content" tabindex="-1"><router-outlet /></main>
    </div>
  `,
  styles: [`
    :host { display:block; min-height:100vh; background:var(--ws-bg); color:var(--ws-ink); font-family:var(--ws-font); }
    .skip { position:absolute; inset-inline-start:-999px; } .skip:focus { inset-inline-start:8px; top:8px; z-index:100; padding:8px 12px; background:var(--ws-surface); }
    .ws { display:grid; grid-template-columns:232px minmax(0,1fr); grid-template-rows:var(--ws-topbar-h) minmax(0,1fr); min-height:100vh; }
    .topbar { grid-column:1 / -1; display:flex; align-items:center; gap:var(--ws-3); padding-inline:var(--ws-4); border-bottom:1px solid var(--ws-line); background:var(--ws-surface); position:sticky; top:0; z-index:20; }
    .brand { display:inline-flex; align-items:center; gap:var(--ws-2); color:var(--ws-ink); font-weight:700; font-size:18px; text-decoration:none; }
    .badge { display:inline-flex; align-items:center; gap:6px; padding:4px 10px; border-radius:999px; background:var(--ws-brand-soft); color:var(--ws-brand); font-size:var(--ws-text-sm); font-weight:600; }
    .grow { flex:1; }
    .tool { display:inline-flex; align-items:center; gap:var(--ws-2); height:var(--ws-control-h); padding-inline:var(--ws-2); border:1px solid var(--ws-line); border-radius:var(--ws-r-md); background:var(--ws-surface); color:var(--ws-ink); font:inherit; cursor:pointer; }
    .tool:hover { background:var(--ws-surface-hover); }
    .avatar { display:inline-grid; place-items:center; width:26px; height:26px; border-radius:50%; background:var(--ws-brand-soft); color:var(--ws-brand); font-size:12px; font-weight:700; }
    .name { font-size:var(--ws-text-sm); }
    .account { position:relative; }
    .menu { position:absolute; inset-inline-end:0; top:calc(100% + 6px); min-width:220px; display:grid; padding:var(--ws-1); border:1px solid var(--ws-line); border-radius:var(--ws-r-lg); background:var(--ws-surface); box-shadow:var(--ws-shadow-pop); }
    .menu .email { margin:0; padding:var(--ws-2); color:var(--ws-ink-2); font-size:var(--ws-text-sm); border-bottom:1px solid var(--ws-line); }
    .menu button { display:flex; align-items:center; gap:var(--ws-2); min-height:36px; padding-inline:var(--ws-2); border:0; border-radius:var(--ws-r-md); background:none; color:var(--ws-ink); font:inherit; cursor:pointer; text-align:start; }
    .menu button:hover { background:var(--ws-surface-hover); }
    .nav { border-inline-end:1px solid var(--ws-line); background:var(--ws-surface); padding:var(--ws-3) var(--ws-2); }
    .nav nav { position:sticky; top:calc(var(--ws-topbar-h) + var(--ws-3)); display:grid; gap:2px; }
    .group-label { margin:var(--ws-3) var(--ws-2) var(--ws-1); color:var(--ws-ink-2); font-size:var(--ws-text-xs); font-weight:600; letter-spacing:.06em; text-transform:uppercase; }
    .nav-item { display:flex; align-items:center; gap:var(--ws-3); min-height:38px; padding-inline:var(--ws-3); border-radius:var(--ws-r-md); color:var(--ws-ink); text-decoration:none; font-size:var(--ws-text-md); }
    .nav-item:hover { background:var(--ws-surface-hover); }
    .nav-item.active { background:var(--ws-brand-soft); color:var(--ws-brand); font-weight:600; }
    .content { padding:var(--ws-5); min-width:0; }
    .content:focus { outline:none; }
    /* Phone (v2 review): the menu becomes a scrolling row of links under the top bar, and the pages get the full width. */
    @media (max-width: 760px) {
      .ws { grid-template-columns:minmax(0,1fr); grid-template-rows:var(--ws-topbar-h) auto minmax(0,1fr); }
      .topbar { gap:var(--ws-2); padding-inline:var(--ws-3); }
      .badge span, .name { display:none; }
      .badge { padding:4px 6px; }
      .nav { border-inline-end:0; border-bottom:1px solid var(--ws-line); padding:var(--ws-1) var(--ws-2); overflow-x:auto; }
      .nav nav { position:static; display:flex; gap:4px; }
      .group-label { display:none; }
      .nav-item { flex:none; min-height:36px; padding-inline:var(--ws-2); font-size:var(--ws-text-sm); white-space:nowrap; }
      .content { padding:var(--ws-3); }
    }
    @media print { .topbar, .nav, .skip { display:none !important; } .ws { display:block; } }
  `],
})
export class AdminShellComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly theme = inject(ThemeService);
  protected readonly icons = { ChevronDown, LogOut, Moon, ShieldCheck, Sun };
  protected readonly menu = signal(false);
  protected readonly userName = computed(() => this.auth.user()?.name || 'Super Admin');
  protected readonly email = computed(() => this.auth.user()?.email ?? '');
  protected readonly initials = computed(() => this.userName().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join(''));

  protected readonly groups = signal(NAV);

  protected signOut(): void {
    this.menu.set(false);
    this.auth.logout().subscribe(() => void this.router.navigate(['/auth/login']));
  }
}
