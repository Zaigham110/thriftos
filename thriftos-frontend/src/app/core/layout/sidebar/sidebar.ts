/**
 * Sidebar Component - Navigation sidebar with permission-driven menu
 * Phase 1: Authentication & Shell
 */

import { ChangeDetectionStrategy, Component, computed, input, signal, OnInit, DestroyRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { LucideAngularModule, ChevronDown, ChevronRight } from 'lucide-angular';
import * as LucideIcons from 'lucide-angular';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs/operators';
import { AuthService } from '../../auth';
import { NavItem, getNavigation } from '../navigation.config';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule, LucideAngularModule],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarComponent implements OnInit {
  readonly collapsed = input<boolean>(false);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);

  protected readonly expandedItems = signal<Set<string>>(new Set(['admin']));

  protected readonly navItems = computed(() => {
    return getNavigation(
      this.authService.isSuperAdmin(),
      this.authService.isImpersonating()
    );
  });

  protected readonly icons = {
    ChevronDown,
    ChevronRight,
  };

  constructor(private readonly authService: AuthService) {}

  ngOnInit(): void {
    // Expand menu items based on current route on init
    this.expandMenuForCurrentRoute();

    // Listen for route changes to auto-expand parent menus
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => {
      this.expandMenuForCurrentRoute();
    });
  }

  /**
   * Expand parent menu items that contain the current active route
   */
  private expandMenuForCurrentRoute(): void {
    const currentUrl = this.router.url;
    const navItems = this.navItems();
    const expandIds = new Set<string>();

    const findAndExpandParents = (items: NavItem[], parentIds: string[] = []): boolean => {
      for (const item of items) {
        if (item.route && currentUrl.startsWith(item.route)) {
          // Found active route - expand all parent IDs
          parentIds.forEach(id => expandIds.add(id));
          expandIds.add(item.id);
          return true;
        }
        if (item.children && item.children.length > 0) {
          if (findAndExpandParents(item.children, [...parentIds, item.id])) {
            return true;
          }
        }
      }
      return false;
    };

    findAndExpandParents(navItems);

    if (expandIds.size > 0) {
      this.expandedItems.update(current => {
        const newSet = new Set(current);
        expandIds.forEach(id => newSet.add(id));
        return newSet;
      });
    }
  }

  getIcon(iconName: string): LucideIcons.LucideIconData {
    const iconKey = this.toPascalCase(iconName) as keyof typeof LucideIcons;
    return (LucideIcons[iconKey] as LucideIcons.LucideIconData) || LucideIcons.Circle;
  }

  private toPascalCase(str: string): string {
    return str
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join('');
  }

  isExpanded(itemId: string): boolean {
    return this.expandedItems().has(itemId);
  }

  toggleExpand(itemId: string): void {
    this.expandedItems.update((items) => {
      const newItems = new Set(items);
      if (newItems.has(itemId)) {
        newItems.delete(itemId);
      } else {
        newItems.add(itemId);
      }
      return newItems;
    });
  }

  canViewItem(item: NavItem): boolean {
    if (item.superAdminOnly) {
      return this.authService.isSuperAdmin() && !this.authService.isImpersonating();
    }
    if (item.permissions && item.permissions.length > 0) {
      return this.authService.hasAnyPermission(item.permissions);
    }
    return true;
  }
}
