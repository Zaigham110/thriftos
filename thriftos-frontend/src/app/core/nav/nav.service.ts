import { Location } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, UrlTree } from '@angular/router';
import { filter, map } from 'rxjs';
import { Crumb, crumbsFor, isMenuPage } from '../../shell/workspace/workspace-nav';

/**
 * Navigation the way an ERP needs it (v2 review):
 *  - record names for breadcrumbs and the browser tab ("Purchasing › Containers › CONT-2026-006"), set by a
 *    record page once it has loaded;
 *  - "back": the page you came from inside ThriftOS, else a sensible fallback (a link opened in a new tab);
 *  - "done": after saving a new record, open it in place of the form, so Back does not return to an empty form.
 */
@Injectable({ providedIn: 'root' })
export class NavService {
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  /** Record id (a URL segment) → its name. */
  readonly names = signal<Record<string, string>>({});
  /** How many pages were opened inside the app in this tab (the first one is where the tab started). */
  private inApp = 0;
  /** The current address (after redirects). */
  readonly url = toSignal(
    this.router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd), map((e) => e.urlAfterRedirects)),
    { initialValue: this.router.url },
  );
  /**
   * The way you came, when a page opened this one with `open()` (or a link with `[state]="nav.trailState()"`):
   * Suppliers › London Clothing Bank, then the lot you clicked. It lives in the browser's history entry, so Back
   * and Forward bring each page's own trail back.
   */
  private readonly trail = signal<Crumb[] | null>(null);
  /** Where you are: the way you came if known, else the page's place in the menu ("Purchasing › Containers › CONT-2026-006"). */
  readonly crumbs = computed<Crumb[]>(() => {
    const own = crumbsFor(this.url(), this.names());
    let trail = this.trail();
    if (!trail?.length) return own;
    const path = this.url().split(/[?#]/)[0];
    // Back on a page that is already in the trail (container → bale → that container): cut the loop.
    const seen = trail.findIndex((c) => c.path.split(/[?#]/)[0] === path);
    if (seen >= 0) trail = trail.slice(0, seen);
    if (!trail.length) return own;
    const self = own.find((c) => c.path === path);
    return self ? [...trail, self] : trail;
  });
  /** Pages straight from the menu show no breadcrumb (they are the top of their trail). */
  readonly onMenuPage = computed(() => isMenuPage(this.url()));
  /**
   * Page headers on screen. A page with a header shows the breadcrumb inside it, lined up with its heading;
   * the shell shows it only for pages without one.
   */
  readonly headers = signal(0);

  constructor() {
    this.router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd)).subscribe(() => {
      this.inApp++;
      const nav = this.router.getCurrentNavigation() ?? this.router.lastSuccessfulNavigation;
      const state = (nav?.extras.state ?? this.location.getState()) as { trail?: unknown } | null;
      this.trail.set(Array.isArray(state?.trail) ? (state!.trail as Crumb[]) : null);
    });
  }

  /** A record page says its name, e.g. setName(container.id, 'CONT-2026-006'). */
  setName(id: string, name: string): void {
    if (!id || !name || this.names()[id] === name) return;
    this.names.update((n) => ({ ...n, [id]: name }));
  }

  /**
   * History state for a link from this page to another (`[state]="nav.trailState()"`): the trail so far, its
   * last step pointing at this page exactly as it is now (search, filters, tab), at most 6 steps.
   */
  trailState(): { trail: Crumb[] } {
    const here = this.crumbs();
    const url = this.router.url;
    const trail = here.length ? [...here.slice(0, -1), { ...here[here.length - 1], path: url }] : [];
    return { trail: trail.slice(-6) };
  }

  /** Open another page from this one, keeping the way you came in its breadcrumb. */
  open(commands: unknown[], extras: { queryParams?: Record<string, string> } = {}): Promise<boolean> {
    return this.router.navigate(commands, { ...extras, state: this.trailState() });
  }

  /** Back to the previous page in ThriftOS, or to `fallback` when this tab started on the current page. */
  back(fallback: string | unknown[]): void {
    if (this.inApp > 1) this.location.back();
    else void this.go(fallback, true);
  }

  /** Open a page, replacing the current one in history (after saving a form). */
  replace(target: string | unknown[]): Promise<boolean> {
    return this.go(target, true);
  }

  private go(target: string | unknown[] | UrlTree, replaceUrl: boolean): Promise<boolean> {
    return typeof target === 'string' || target instanceof UrlTree
      ? this.router.navigateByUrl(target, { replaceUrl })
      : this.router.navigate(target as unknown[], { replaceUrl });
  }
}
