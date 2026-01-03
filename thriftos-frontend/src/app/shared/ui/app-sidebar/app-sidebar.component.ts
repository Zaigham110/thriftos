import { ChangeDetectionStrategy, Component, signal, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppBrandPanelComponent } from '../app-brand-panel/app-brand-panel.component';
import { AppNavGroupComponent, type AppNavGroupItem } from '../app-nav-group/app-nav-group.component';
import { AppNavItemComponent } from '../app-nav-item/app-nav-item.component';
import { effect, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

export interface SidebarNavItem extends AppNavGroupItem {}

export interface SidebarNavGroup {
  id: string;
  label: string;
  icon: string;
  items: SidebarNavItem[];
}

export interface SidebarNavConfig {
  productName: string;
  productSubtitle: string;
  logoUrl: string;

  dashboard: SidebarNavItem;
  groups: SidebarNavGroup[];
}

/**
 * app-sidebar - Sidebar Navigation Primitive
 * 
 * Odoo-Style Design System
 * Primary navigation sidebar with fixed modules
 * 
 * Features:
 * - Fixed 240px width
 * - Full viewport height
 * - Background distinct from workspace
 * - Collapsible groups with nested items
 * - Only one group expanded at a time
 * 
 * @example
 * <app-sidebar
 *   [modules]="modules"
 *   [activeModuleId]="activeId"
 *   (moduleClick)="onNavigate($event)"
 * />
 */
@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, AppBrandPanelComponent, AppNavGroupComponent, AppNavItemComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <aside class="sidebar">
      <!-- Sidebar Header -->
      <div class="sidebar-header">
        <div class="sidebar-brand">
          <app-brand-panel
            variant="product"
            size="md"
            [name]="nav().productName"
            [subtitle]="nav().productSubtitle"
            [logoUrl]="nav().logoUrl"
          />
        </div>
      </div>

      <!-- Sidebar Navigation -->
      <nav class="sidebar-nav">
        <app-nav-item
          [label]="nav().dashboard.label"
          [route]="nav().dashboard.route"
          [icon]="nav().dashboard.icon"
          [exact]="true"
        />

        @for (group of nav().groups; track group.id) {
          <app-nav-group
            [id]="group.id"
            [label]="group.label"
            [icon]="group.icon"
            [items]="group.items"
            [expanded]="expandedGroupId() === group.id"
            (toggle)="toggleGroup($event)"
          />
        }
      </nav>
    </aside>
  `,
  styles: [`
    .sidebar {
      width: 240px;
      background: var(--app-bg-surface);
      border-right: 1px solid var(--app-border-subtle);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      height: 100%;
    }

    .sidebar-header {
      padding: var(--space-md);
      background: var(--app-bg-surface);
    }

    .sidebar-brand {
      display: flex;
      align-items: center;
      justify-content: flex-start;
      min-height: 56px;
      width: 100%;
      padding: var(--space-sm);
      background: var(--app-bg-surface);
      border: 1px solid var(--app-border-subtle);
      border-radius: var(--border-radius);
      box-shadow: var(--shadow-sm);
    }

    .sidebar-nav {
      display: flex;
      flex-direction: column;
      gap: var(--space-xs);
      padding: var(--space-sm);
      flex: 1;
      overflow: auto;
      background: var(--app-bg-surface);
    }

    .sidebar-nav > :first-child {
      margin-bottom: var(--space-xs);
    }

    .sidebar-sep {
      height: 1px;
      background: var(--app-border-subtle);
      margin: var(--space-xs) 0;
    }
  `],
})
export class AppSidebarComponent {
  private readonly router = inject(Router);

  nav = input<SidebarNavConfig>({
    productName: 'ThriftOS',
    productSubtitle: 'Operations & Inventory Platform',
    logoUrl: '/favicon.ico',
    dashboard: { id: 'dashboard', label: 'Dashboard', route: '/dashboard', icon: 'layout-dashboard' },
    groups: [],
  });

  protected readonly expandedGroupId = signal<string | null>(null);

  constructor() {
    // Keep expansion in sync with nav config changes (and initial render)
    effect(() => {
      this.nav(); // track dependency
      this.syncExpandedGroupWithUrl(this.router.url);
    });

    // Expand matching group on navigation changes
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((e) => this.syncExpandedGroupWithUrl(e.urlAfterRedirects));
  }

  toggleGroup(groupId: string): void {
    this.expandedGroupId.update((current) => (current === groupId ? null : groupId));
  }

  private syncExpandedGroupWithUrl(url: string): void {
    const cleanUrl = (url ?? '').split(/[?#]/)[0];

    // If dashboard matches, collapse groups
    if (this.routeMatches(cleanUrl, this.nav().dashboard.route)) {
      this.expandedGroupId.set(null);
      return;
    }

    let bestMatch: { groupId: string; routeLen: number } | null = null;

    for (const group of this.nav().groups ?? []) {
      for (const item of group.items ?? []) {
        const route = (item as any)?.route as string | undefined;
        if (!route) continue;

        if (this.routeMatches(cleanUrl, route)) {
          const routeLen = route.length;
          if (!bestMatch || routeLen > bestMatch.routeLen) {
            bestMatch = { groupId: group.id, routeLen };
          }
        }
      }
    }

    this.expandedGroupId.set(bestMatch?.groupId ?? null);
  }

  private routeMatches(currentUrl: string, route?: string): boolean {
    if (!route) return false;
    // match exact or child routes (e.g. /inventory matches /inventory/items)
    return currentUrl === route || currentUrl.startsWith(route + '/');
  }
}
