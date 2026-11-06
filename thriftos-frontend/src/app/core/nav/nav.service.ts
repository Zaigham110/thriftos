import { Location } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, UrlTree } from '@angular/router';
import { filter, map } from 'rxjs';
import { Crumb, crumbsFor } from '../../shell/workspace/workspace-nav';

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
  /** Where you are: "Purchasing › Containers › CONT-2026-006". */
  readonly crumbs = computed<Crumb[]>(() => crumbsFor(this.url(), this.names()));
  /**
   * Page headers on screen. A page with a header shows the breadcrumb inside it, lined up with its heading;
   * the shell shows it only for pages without one.
   */
  readonly headers = signal(0);

  constructor() {
    this.router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd)).subscribe(() => this.inApp++);
  }

  /** A record page says its name, e.g. setName(container.id, 'CONT-2026-006'). */
  setName(id: string, name: string): void {
    if (!id || !name || this.names()[id] === name) return;
    this.names.update((n) => ({ ...n, [id]: name }));
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
