import { HttpClient } from '@angular/common/http';
import { WsBreadcrumbsComponent } from '../../shared/ui/workspace/breadcrumbs.component';
import { Component, DestroyRef, HostListener, computed, inject, output, signal, effect } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import {
  Bell,
  BookOpen,
  Boxes,
  ChevronRight,
  Coins,
  Package,
  ShoppingCart,
  Truck,
  ChevronsLeft,
  ChevronsRight,
  Keyboard,
  KeyRound,
  Languages,
  LogOut,
  LucideAngularModule,
  Moon,
  Plus,
  Rows3,
  Search,
  Sun,
} from 'lucide-angular';
import { Observable, filter, interval, map, startWith, switchMap, catchError, of } from 'rxjs';
import { AuthService } from '../../core/auth';
import { I18nService, LANGS } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { OfflineQueueService } from '../../core/offline/offline-queue.service';
import { TenantService } from '../../core/tenant/tenant.service';
import { ThemeService } from '../../core/theme/theme.service';
import { CommandPaletteComponent, PaletteCommand } from './command-palette.component';
import { WS_CREATE, WS_NAV, WS_SETTINGS, WsNavItem, crumbsFor } from './workspace-nav';
import { NavService } from '../../core/nav/nav.service';
import { Title } from '@angular/platform-browser';
import { LangPickerComponent } from '../../shared/ui/lang-picker.component';

const NAV_KEY = 'thriftos.navCollapsed';

/** True when the key press is going into a text field (so single-key shortcuts stay out of the way). */
function typing(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  return !!t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));
}

/**
 * The laptop workspace (≥ 1024 px, enterprise plan E1.2): top bar with the business, search and commands
 * (Ctrl/⌘ K), quick create, theme, language and account; grouped menu that can collapse; breadcrumbs.
 * Phones and tablets keep the floor layout (app-shell). Modules a business has not turned on are not shown.
 */
@Component({
  selector: 'ws-shell',
  standalone: true,
  imports: [WsBreadcrumbsComponent, LangPickerComponent, RouterLink, RouterLinkActive, LucideAngularModule, TPipe, CommandPaletteComponent],
  template: `
    <a class="skip" href="#ws-main">{{ 'ws.skip' | t }}</a>
    <div class="ws" [class.collapsed]="collapsed()">
      <header class="topbar">
        <a routerLink="/home" class="brand"><img src="os_sm.png" alt="" width="28" height="28" /><span>ThriftOS</span></a>
        <span class="business" [title]="tenantName()">{{ tenantName() }}</span>
        <button type="button" class="search" (click)="paletteOpen.set(true)" aria-keyshortcuts="Control+K Meta+K /">
          <lucide-icon [img]="icons.Search" [size]="16" aria-hidden="true" /><span>{{ 'ws.search' | t }}</span><kbd>{{ modKey }} K</kbd>
        </button>
        <div class="tools">
          <span class="sync" [class.offline]="!offline.online()" role="status"><i aria-hidden="true"></i>{{ syncLabel() }}</span>
          <div class="menu-wrap">
            <button type="button" class="tool primary" (click)="toggleMenu('create', $event)" [attr.aria-expanded]="menu() === 'create'" aria-haspopup="menu">
              <lucide-icon [img]="icons.Plus" [size]="16" aria-hidden="true" /><span>{{ 'ws.create' | t }}</span>
            </button>
            @if (menu() === 'create') {
              <div class="menu" role="menu" (click)="$event.stopPropagation()">
                @for (item of createItems(); track item.path) {
                  <a role="menuitem" [routerLink]="item.path" (click)="menu.set(null)"><lucide-icon [img]="item.icon" [size]="16" aria-hidden="true" />{{ item.label | t }}</a>
                }
              </div>
            }
          </div>
          <button type="button" class="tool icon" (click)="theme.toggleTheme()" [attr.aria-label]="(theme.theme() === 'dark' ? 'ws.theme.light' : 'ws.theme.dark') | t" [title]="(theme.theme() === 'dark' ? 'ws.theme.light' : 'ws.theme.dark') | t">
            <lucide-icon [img]="theme.theme() === 'dark' ? icons.Sun : icons.Moon" [size]="17" aria-hidden="true" />
          </button>
          <app-lang-picker class="tool" />
          <div class="menu-wrap">
            <button type="button" class="tool icon bell" (click)="toggleMenu('bell', $event)" [attr.aria-expanded]="menu() === 'bell'" aria-haspopup="menu" [attr.aria-label]="unreadLabel()">
              <lucide-icon [img]="icons.Bell" [size]="17" aria-hidden="true" />
              @if (unread().length) { <span class="count ws-num" aria-hidden="true">{{ unread().length > 9 ? '9+' : unread().length }}</span> }
            </button>
            @if (menu() === 'bell') {
              <div class="menu end notes" role="menu" (click)="$event.stopPropagation()">
                <div class="who"><strong>{{ 'ws.notifications.title' | t }}</strong>
                  @if (unread().length) { <button type="button" class="link" (click)="readAll()">{{ 'ws.notifications.readAll' | t }}</button> }
                </div>
                @for (n of unread(); track n.id) {
                  <a role="menuitem" [routerLink]="n.link || '/home'" (click)="read(n.id)"><span class="note"><strong>{{ n.title }}</strong><small>{{ n.body }}</small></span></a>
                } @empty { <p class="none">{{ 'ws.notifications.none' | t }}</p> }
              </div>
            }
          </div>
          <div class="menu-wrap">
            <button type="button" class="avatar" (click)="toggleMenu('account', $event)" [attr.aria-expanded]="menu() === 'account'" aria-haspopup="menu" [title]="'ws.account' | t"><span aria-hidden="true">{{ initials() }}</span><span class="ws-visually-hidden">{{ 'ws.account' | t }}</span></button>
            @if (menu() === 'account') {
              <div class="menu end" role="menu" (click)="$event.stopPropagation()">
                <div class="who"><strong>{{ userName() }}</strong><small>{{ userContact() }}</small></div>
                <a role="menuitem" routerLink="/settings/password" (click)="menu.set(null)"><lucide-icon [img]="icons.KeyRound" [size]="16" aria-hidden="true" />{{ 'settings.password' | t }}</a>
                <button type="button" role="menuitem" (click)="toggleDensity()"><lucide-icon [img]="icons.Rows3" [size]="16" aria-hidden="true" />{{ (theme.density() === 'compact' ? 'ws.density.comfortable' : 'ws.density.compact') | t }}</button>
                <button type="button" role="menuitem" (click)="menu.set(null); shortcutsOpen.set(true)"><lucide-icon [img]="icons.Keyboard" [size]="16" aria-hidden="true" />{{ 'ws.shortcuts' | t }}</button>
                <button type="button" role="menuitem" (click)="signOut.emit()"><lucide-icon [img]="icons.LogOut" [size]="16" aria-hidden="true" />{{ 'nav.signOut' | t }}</button>
              </div>
            }
          </div>
        </div>
      </header>

      <aside class="nav" [attr.aria-label]="'nav.menu' | t">
        <nav>
          @for (group of navGroups(); track group.label) {
            @if (group.label) { <div class="group-label">{{ group.label | t }}</div> }
            @for (item of group.items; track item.path) {
              <a [routerLink]="item.path" routerLinkActive="active" [class.also]="alsoHere(item)" class="nav-item" [title]="collapsed() ? (item.label | t) : ''">
                <lucide-icon [img]="item.icon" [size]="18" aria-hidden="true" /><span>{{ item.label | t }}</span>
              </a>
            }
          }
        </nav>
        <div class="nav-foot">
          <a [routerLink]="settings.path" routerLinkActive="active" class="nav-item" [title]="collapsed() ? (settings.label | t) : ''">
            <lucide-icon [img]="settings.icon" [size]="18" aria-hidden="true" /><span>{{ settings.label | t }}</span>
          </a>
          <button type="button" class="nav-item" (click)="toggleCollapsed()" [attr.aria-label]="(collapsed() ? 'ws.expand' : 'ws.collapse') | t">
            <lucide-icon [img]="collapsed() ? icons.ChevronsRight : icons.ChevronsLeft" [size]="18" class="flip" aria-hidden="true" /><span>{{ 'ws.collapse' | t }}</span>
          </button>
        </div>
      </aside>

      <main id="ws-main" class="content" tabindex="-1">
        <!-- Pages with the shared header show the breadcrumb in it (lined up with the heading); others here. -->
        @if (!nav.headers()) { <ws-breadcrumbs /> }
        <ng-content />
      </main>
    </div>

    @if (paletteOpen()) { <ws-command-palette [commands]="commands()" [search]="searchRecords" (close)="paletteOpen.set(false)" /> }
    @if (shortcutsOpen()) {
      <div class="backdrop" (click)="shortcutsOpen.set(false)">
        <section class="dialog" role="dialog" aria-modal="true" [attr.aria-label]="'ws.shortcuts' | t" (click)="$event.stopPropagation()">
          <h2>{{ 'ws.shortcuts' | t }}</h2>
          <dl>
            <dt><kbd>{{ modKey }}</kbd> <kbd>K</kbd> · <kbd>/</kbd></dt><dd>{{ 'ws.shortcut.palette' | t }}</dd>
            <dt><kbd>[</kbd></dt><dd>{{ 'ws.shortcut.nav' | t }}</dd>
            <dt><kbd>?</kbd></dt><dd>{{ 'ws.shortcut.help' | t }}</dd>
            <dt><kbd>Esc</kbd></dt><dd>{{ 'ws.shortcut.close' | t }}</dd>
          </dl>
          <button type="button" class="tool" (click)="shortcutsOpen.set(false)">{{ 'common.done' | t }}</button>
        </section>
      </div>
    }
  `,
  styles: [`
    :host { display:block; min-height:100vh; background:var(--ws-page); color:var(--ws-ink); font-family:var(--ws-font); font-size:var(--ws-text-md); }
    .skip { position:absolute; inset-inline-start:-999px; top:8px; z-index:60; padding:8px 12px; border-radius:var(--ws-r-md); background:var(--ws-brand); color:var(--ws-brand-ink); }
    .skip:focus { inset-inline-start:8px; }
    .ws { display:grid; grid-template-columns:var(--ws-nav-w) minmax(0,1fr); grid-template-rows:var(--ws-topbar-h) minmax(0,1fr); min-height:100vh; }
    .ws.collapsed { grid-template-columns:var(--ws-nav-w-min) minmax(0,1fr); }
    /* Printing a report: only the page itself, full width. */
    @media print { .skip, .topbar, .nav, .crumbs { display:none !important; } .ws, .ws.collapsed { display:block; min-height:0; } }

    .topbar { grid-column:1 / -1; position:sticky; top:0; z-index:20; display:flex; align-items:center; gap:var(--ws-4); padding-inline:var(--ws-4); border-block-end:1px solid var(--ws-line); background:var(--ws-surface); }
    .brand { display:flex; align-items:center; gap:var(--ws-2); color:var(--ws-ink); font-size:var(--ws-text-lg); font-weight:700; text-decoration:none; }
    .business { max-width:220px; padding-inline-start:var(--ws-4); border-inline-start:1px solid var(--ws-line); color:var(--ws-ink-2); font-weight:500; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
    .search { flex:1; max-width:520px; height:var(--ws-control-h); display:flex; align-items:center; gap:var(--ws-2); margin-inline:auto; padding-inline:var(--ws-3); border:1px solid var(--ws-line); border-radius:var(--ws-r-md); background:var(--ws-surface-2); color:var(--ws-ink-3); font:inherit; cursor:pointer; }
    .search span { flex:1; text-align:start; }
    .search:hover { border-color:var(--ws-line-strong); }
    kbd { padding:1px 6px; border:1px solid var(--ws-line); border-radius:var(--ws-r-sm); background:var(--ws-surface); color:var(--ws-ink-3); font:inherit; font-size:var(--ws-text-xs); }
    .tools { display:flex; align-items:center; gap:var(--ws-2); }
    .sync { display:inline-flex; align-items:center; gap:6px; margin-inline-end:var(--ws-2); color:var(--ws-ink-2); font-size:var(--ws-text-xs); font-weight:500; }
    .sync i { width:8px; height:8px; border-radius:50%; background:var(--ws-good); }
    .sync.offline i { background:var(--ws-warn); }
    .tool { height:var(--ws-control-h); display:inline-flex; align-items:center; gap:6px; padding-inline:var(--ws-3); border:1px solid var(--ws-line); border-radius:var(--ws-r-md); background:var(--ws-surface); color:var(--ws-ink); font:inherit; font-weight:500; cursor:pointer; }
    .tool:hover { background:var(--ws-surface-hover); }
    .tool.icon { width:var(--ws-control-h); justify-content:center; padding:0; }
    .tool.primary { border-color:var(--ws-brand); background:var(--ws-brand); color:var(--ws-brand-ink); }
    .tool.primary:hover { background:var(--ws-brand-hover); }
    .avatar { width:34px; height:34px; border:0; border-radius:50%; background:var(--ws-brand-soft); color:var(--ws-brand); font:inherit; font-weight:700; cursor:pointer; }
    .menu-wrap { position:relative; }
    .menu { position:absolute; inset-block-start:calc(100% + 6px); inset-inline-start:0; z-index:30; min-width:220px; display:grid; padding:var(--ws-1); border:1px solid var(--ws-line); border-radius:var(--ws-r-lg); background:var(--ws-surface); box-shadow:var(--ws-shadow-pop); }
    .menu.end { inset-inline-start:auto; inset-inline-end:0; }
    .menu a, .menu button { display:flex; align-items:center; gap:var(--ws-3); min-height:36px; padding-inline:var(--ws-3); border:0; border-radius:var(--ws-r-md); background:transparent; color:var(--ws-ink); font:inherit; text-align:start; text-decoration:none; cursor:pointer; }
    .menu a:hover, .menu button:hover { background:var(--ws-surface-hover); }
    .menu lucide-icon { color:var(--ws-ink-3); }
    .who { display:grid; gap:2px; padding:var(--ws-2) var(--ws-3) var(--ws-3); margin-block-end:var(--ws-1); border-block-end:1px solid var(--ws-line); }
    .who small { color:var(--ws-ink-3); }
    .bell { position:relative; }
    .bell .count { position:absolute; inset-block-start:-4px; inset-inline-end:-4px; min-width:18px; height:18px; display:grid; place-items:center; padding-inline:3px; border-radius:9px; background:var(--ws-bad); color:#fff; font-size:11px; font-weight:700; }
    .notes { width:320px; }
    .notes .who { display:flex; align-items:center; justify-content:space-between; }
    .notes .link { min-height:0; padding:0; border:0; background:transparent; color:var(--ws-brand); font:inherit; font-size:var(--ws-text-sm); cursor:pointer; }
    .note { display:grid; gap:2px; padding-block:var(--ws-1); }
    .note small { color:var(--ws-ink-2); display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
    .none { margin:0; padding:var(--ws-3); color:var(--ws-ink-3); }

    .nav { position:sticky; top:var(--ws-topbar-h); height:calc(100vh - var(--ws-topbar-h)); display:flex; flex-direction:column; justify-content:space-between; padding:var(--ws-3) var(--ws-2); box-sizing:border-box; border-inline-end:1px solid var(--ws-line); background:var(--ws-surface); overflow-y:auto; }
    nav { display:grid; gap:2px; }
    .group-label { padding:var(--ws-4) var(--ws-3) var(--ws-1); color:var(--ws-ink-3); font-size:var(--ws-text-xs); font-weight:600; text-transform:uppercase; letter-spacing:.06em; }
    .nav-item { display:flex; align-items:center; gap:var(--ws-3); min-height:38px; padding-inline:var(--ws-3); border:0; border-radius:var(--ws-r-md); background:transparent; color:var(--ws-ink-2); font:inherit; font-weight:500; text-align:start; text-decoration:none; cursor:pointer; white-space:nowrap; }
    .nav-item:hover { background:var(--ws-surface-hover); color:var(--ws-ink); }
    .nav-item.active, .nav-item.also { background:var(--ws-brand-soft); color:var(--ws-brand); font-weight:600; }
    .nav-foot { display:grid; gap:2px; padding-block-start:var(--ws-2); border-block-start:1px solid var(--ws-line); }
    .collapsed .nav-item span, .collapsed .group-label { display:none; }
    .collapsed .nav-item { justify-content:center; padding:0; }
    html[dir='rtl'] .flip { transform:scaleX(-1); }

    .content { min-width:0; padding:var(--ws-6) var(--ws-8) var(--ws-8); outline:none; }
    .crumbs ol { display:flex; flex-wrap:wrap; align-items:center; gap:var(--ws-1); margin:0 0 var(--ws-4); padding:0; list-style:none; font-size:var(--ws-text-sm); color:var(--ws-ink-3); }
    .crumbs li { display:inline-flex; align-items:center; gap:var(--ws-1); }
    .crumbs a { color:var(--ws-ink-2); text-decoration:none; }
    .crumbs a:hover { color:var(--ws-brand); text-decoration:underline; }
    .crumbs [aria-current] { color:var(--ws-ink); font-weight:500; }

    .backdrop { position:fixed; inset:0; z-index:50; display:grid; place-items:center; background:var(--ws-overlay); }
    .dialog { width:min(440px, calc(100vw - 32px)); display:grid; gap:var(--ws-4); padding:var(--ws-6); border-radius:var(--ws-r-lg); background:var(--ws-surface); color:var(--ws-ink); box-shadow:var(--ws-shadow-pop); }
    .dialog h2 { margin:0; font-size:var(--ws-text-xl); }
    .dialog dl { display:grid; grid-template-columns:auto 1fr; gap:var(--ws-3) var(--ws-4); margin:0; align-items:center; }
    .dialog dd { margin:0; color:var(--ws-ink-2); }
    .dialog .tool { justify-self:end; }
  `],
})
export class WorkspaceShellComponent {
  private readonly auth = inject(AuthService);
  private readonly tenantService = inject(TenantService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly offline = inject(OfflineQueueService);
  protected readonly theme = inject(ThemeService);
  readonly signOut = output<void>();

  protected readonly icons = { Bell, ChevronRight, ChevronsLeft, ChevronsRight, Keyboard, KeyRound, Languages, LogOut, Moon, Plus, Rows3, Search, Sun };
  protected readonly settings = WS_SETTINGS;
  protected readonly modKey = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl';
  protected readonly paletteOpen = signal(false);
  protected readonly shortcutsOpen = signal(false);
  protected readonly menu = signal<'create' | 'account' | 'bell' | null>(null);
  protected readonly collapsed = signal(readCollapsed());

  private readonly url = toSignal(
    this.router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd), map((e) => e.urlAfterRedirects)),
    { initialValue: this.router.url },
  );
  protected readonly nav = inject(NavService);
  private readonly title = inject(Title);
  protected readonly crumbs = this.nav.crumbs;
  /** The browser tab says where you are, in your language: "CONT-2026-006 · Containers · ThriftOS". */
  private readonly tabTitle = effect(() => {
    const c = this.crumbs();
    this.i18n.lang();
    const words = c.slice(-2).reverse().map((x) => (x.raw ? x.label : this.i18n.t(x.label)));
    if (words.length) this.title.setTitle([...words, 'ThriftOS'].join(' · '));
  });
  protected alsoHere(item: WsNavItem): boolean {
    const u = this.url().split(/[?#]/)[0];
    return !!item.also?.some((p) => u === p || u.startsWith(p + '/'));
  }
  protected readonly tenantName = computed(() => this.tenantService.tenant()?.name || 'ThriftOS');
  protected readonly userName = computed(() => this.auth.user()?.name ?? '');
  protected readonly userContact = computed(() => this.auth.user()?.email ?? this.auth.user()?.phone ?? '');
  protected readonly initials = computed(() =>
    (this.userName() || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join(''),
  );

  private readonly allowed = (item: WsNavItem) =>
    (!item.module || this.tenantService.isModuleEnabled(item.module, this.tenantService.tenant())) &&
    (!item.permission || this.auth.isSuperAdmin() || this.auth.permissions().includes(item.permission));
  protected readonly navGroups = computed(() => WS_NAV.map((g) => ({ ...g, items: g.items.filter(this.allowed) })).filter((g) => g.items.length));
  protected readonly createItems = computed(() => WS_CREATE.filter(this.allowed));
  protected readonly commands = computed<PaletteCommand[]>(() => [
    ...this.navGroups().flatMap((g) => g.items).concat(WS_SETTINGS).map((i) => ({ id: 'go' + i.path.replace(/\//g, '-'), label: i.label, group: 'pages' as const, icon: i.icon, keywords: i.keywords, path: i.path })),
    ...this.createItems().map((i) => ({ id: 'new' + i.path.replace(/\//g, '-'), label: i.label, group: 'create' as const, icon: i.icon, keywords: i.keywords, path: i.path })),
    { id: 'theme', label: this.theme.theme() === 'dark' ? 'ws.theme.light' : 'ws.theme.dark', group: 'actions', icon: this.theme.theme() === 'dark' ? Sun : Moon, keywords: 'theme dark light', run: () => this.theme.toggleTheme() },
    { id: 'density', label: this.theme.density() === 'compact' ? 'ws.density.comfortable' : 'ws.density.compact', group: 'actions', icon: Rows3, keywords: 'density rows compact', run: () => this.toggleDensity() },
    { id: 'lang', label: 'ws.switchLanguage', group: 'actions', icon: Languages, keywords: 'language urdu english roman', run: () => this.nextLang() },
    { id: 'password', label: 'settings.password', group: 'actions', icon: KeyRound, keywords: 'password', path: '/settings/password' },
    { id: 'shortcuts', label: 'ws.shortcuts', group: 'actions', icon: Keyboard, keywords: 'keyboard shortcuts help', run: () => this.shortcutsOpen.set(true) },
    { id: 'signout', label: 'nav.signOut', group: 'actions', icon: LogOut, keywords: 'logout sign out', run: () => this.signOut.emit() },
  ]);
  protected readonly syncLabel = computed(() => {
    const t = (k: string, n: number) => this.i18n.t(k, { n });
    if (!this.offline.online()) return t('sync.offline', this.offline.pendingCount());
    if (this.offline.failed().length) return t('sync.attention', this.offline.failed().length);
    return this.offline.pendingCount() ? t('sync.pending', this.offline.pendingCount()) : this.i18n.t('sync.synced');
  });

  // ---- notifications (mentions; checked every minute) ----
  protected readonly unread = signal<Array<{ id: string; title: string; body?: string | null; link?: string | null }>>([]);
  protected readonly unreadLabel = computed(() => this.i18n.t('ws.notifications.button', { n: this.unread().length }));
  private readonly poll = interval(60_000)
    .pipe(startWith(0), switchMap(() => this.http.get<Array<{ id: string; title: string; body?: string; link?: string }>>('/api/notifications', { params: { unread: '1' } }).pipe(catchError(() => of(null)))), takeUntilDestroyed(this.destroyRef))
    .subscribe((list) => { if (list) this.unread.set(list); });

  protected read(id: string): void {
    this.menu.set(null);
    this.unread.set(this.unread().filter((n) => n.id !== id));
    this.http.post(`/api/notifications/${id}/read`, {}).subscribe({ error: () => undefined });
  }

  protected readAll(): void {
    this.unread.set([]);
    this.http.post('/api/notifications/all/read', {}).subscribe({ error: () => undefined });
  }

  /** Record search for the command palette (GET /api/search/global). */
  /** Command palette: English → اردو → Roman Urdu → English. */
  protected nextLang(): void {
    const i = LANGS.findIndex((l) => l.id === this.i18n.lang());
    this.i18n.use(LANGS[(i + 1) % LANGS.length].id);
  }

  protected readonly searchRecords = (q: string): Observable<PaletteCommand[]> => {
    const icon: Record<string, typeof Truck> = { truck: Truck, boxes: Boxes, package: Package, book: BookOpen, cart: ShoppingCart, coins: Coins };
    return this.http.get<Array<{ id: string; title: string; subtitle: string; route: string; type: string; icon: string }>>('/api/search/global', { params: { q } }).pipe(
      map((list) => list.map((r) => ({ id: `rec-${r.type}-${r.id}`, label: '', text: r.title, hint: r.subtitle, group: 'records' as const, icon: icon[r.icon] ?? Package, path: r.route }))),
    );
  };

  @HostListener('document:keydown', ['$event'])
  protected onKey(e: KeyboardEvent): void {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); this.paletteOpen.set(!this.paletteOpen()); return; }
    if (e.key === 'Escape') { this.menu.set(null); this.shortcutsOpen.set(false); return; }
    if (typing(e) || this.paletteOpen() || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === '/') { e.preventDefault(); this.paletteOpen.set(true); }
    else if (e.key === '?') { e.preventDefault(); this.shortcutsOpen.set(true); }
    else if (e.key === '[') { e.preventDefault(); this.toggleCollapsed(); }
  }

  @HostListener('document:click')
  protected closeMenus(): void {
    this.menu.set(null);
  }

  protected toggleMenu(which: 'create' | 'account' | 'bell', e: Event): void {
    e.stopPropagation();
    this.menu.set(this.menu() === which ? null : which);
  }

  protected toggleCollapsed(): void {
    this.collapsed.set(!this.collapsed());
    try { localStorage.setItem(NAV_KEY, this.collapsed() ? '1' : '0'); } catch { /* storage blocked */ }
  }

  protected toggleDensity(): void {
    this.theme.setDensity(this.theme.density() === 'compact' ? 'comfortable' : 'compact');
  }

}

function readCollapsed(): boolean {
  try { return localStorage.getItem(NAV_KEY) === '1'; } catch { return false; }
}
