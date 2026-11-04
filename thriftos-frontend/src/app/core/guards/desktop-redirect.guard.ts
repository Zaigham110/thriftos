import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

/** The laptop workspace starts at 1024 px (same as the shell). */
export const isDesktop = (): boolean => typeof window !== 'undefined' && window.innerWidth >= 1024;

/**
 * On the laptop, a phone hub screen forwards to its workspace page (e.g. /sell → /sell/records), so menu
 * links, breadcrumbs and old bookmarks land on the full screen. Phones and tablets keep the hub. `:param`
 * parts of the target are filled from the route (e.g. /khata/:id → /khata/records/:id).
 */
export function desktopRedirect(target: string): CanActivateFn {
  return (route) => {
    if (!isDesktop()) return true;
    const path = target.replace(/:(\w+)/g, (_, p: string) => encodeURIComponent(route.paramMap.get(p) ?? ''));
    return inject(Router).parseUrl(path);
  };
}
