import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';

import { AppTopbarComponent } from '../app-topbar/app-topbar.component';
import { AppSidebarComponent, type SidebarNavConfig } from '../app-sidebar/app-sidebar.component';

/**
 * app-shell-layout
 * Phase-0 locked shell: Topbar + Sidebar + Workspace.
 * Screens should only render this primitive post-login.
 */
@Component({
  selector: 'app-shell-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, AppTopbarComponent, AppSidebarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="shell">
      <div class="shell-sidebar">
        <app-sidebar [nav]="nav" />
      </div>

      <div class="shell-main">
        <div class="shell-topbar">
          <app-topbar>
            <div slot="left" class="tenant-name" [title]="tenantName">
              {{ tenantName }}
            </div>

            <div slot="right" class="topbar-right">
              <div class="user">
                <button
                  class="avatar"
                  type="button"
                  (click)="toggleUserMenu()"
                  aria-haspopup="menu"
                  [attr.aria-expanded]="userMenuOpen"
                >
                  {{ userInitial }}
                </button>

                @if (userMenuOpen) {
                  <div class="menu" role="menu">
                    <div class="menu-header">
                      <div class="menu-header-left">
                        <div class="menu-avatar">{{ userInitial }}</div>
                        <div class="menu-header-text">
                          <div class="menu-name">{{ userName }}</div>
                          <div class="menu-subtitle">Signed in</div>
                        </div>
                      </div>
                    </div>

                    <div class="menu-body">
                      <button
                        class="menu-item"
                        type="button"
                        role="menuitem"
                        (click)="profile.emit(); closeUserMenu()"
                      >
                        Profile
                      </button>

                      @if (showSwitchTenant) {
                        <button
                          class="menu-item"
                          type="button"
                          role="menuitem"
                          (click)="switchTenant.emit(); closeUserMenu()"
                        >
                          Switch Tenant
                        </button>
                      }

                      <div class="divider"></div>

                      <button
                        class="menu-item danger"
                        type="button"
                        role="menuitem"
                        (click)="signOut.emit(); closeUserMenu()"
                      >
                        Sign Out
                      </button>
                    </div>
                  </div>
                }
              </div>
            </div>
          </app-topbar>
        </div>

        @if (showImpersonationBanner) {
          <div class="impersonation-banner" role="status" aria-live="polite">
            <div class="impersonation-text">{{ impersonationBannerText }}</div>
            <button
              type="button"
              class="impersonation-exit"
              (click)="exitImpersonation.emit()"
            >
              Exit Impersonation
            </button>
          </div>
        }

        <div class="shell-workspace">
          <router-outlet />
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .shell {
        height: 100vh;
        width: 100%;
        display: grid;
        grid-template-columns: 240px 1fr;
        overflow: hidden;
        background: var(--app-bg-page);
      }

      .shell-sidebar {
        min-height: 0;
      }

      .shell-main {
        min-height: 0;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      .shell-topbar {
        flex: 0 0 auto;
      }

      .shell-workspace {
        background: var(--app-bg-page);
        overflow: auto;
        min-height: 0;
        padding: var(--space-lg);
      }

      .impersonation-banner {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-md);
        padding: var(--space-sm) var(--space-lg);
        border-bottom: 1px solid var(--app-border-subtle);
        background: var(--app-primary-light);
        color: var(--app-text-primary);
      }

      .impersonation-text {
        font-size: var(--font-size-table-header);
        font-weight: var(--font-weight-section-title);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .impersonation-exit {
        border: 1px solid var(--app-border-strong);
        background: var(--app-bg-surface);
        color: var(--app-text-primary);
        border-radius: var(--border-radius);
        padding: 6px 10px;
        cursor: pointer;
        font-size: var(--font-size-table-header);
        font-weight: var(--font-weight-table-header);
        white-space: nowrap;
      }

      .impersonation-exit:hover {
        background: var(--app-bg-page);
      }

      .impersonation-exit:focus-visible {
        outline: none;
        box-shadow: 0 0 0 3px var(--app-primary-light);
      }

      .tenant-name {
        font-size: var(--font-size-section-title);
        font-weight: var(--font-weight-section-title);
        color: var(--app-text-primary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 520px;
      }

      .topbar-right {
        display: flex;
        align-items: center;
      }

      .user {
        position: relative;
        display: flex;
        align-items: center;
      }

      .avatar {
        width: 32px;
        height: 32px;
        border-radius: 999px;
        border: 1px solid var(--app-border-subtle);
        background: var(--app-bg-surface);
        color: var(--app-text-primary);
        font-size: var(--font-size-table-header);
        font-weight: var(--font-weight-page-title);
        cursor: pointer;
      }

      .avatar:hover {
        border-color: var(--app-border-strong);
        background: var(--app-bg-page);
      }

      .avatar:active {
        background: var(--app-primary-light);
      }

      .avatar:focus-visible {
        outline: none;
        box-shadow: 0 0 0 3px var(--app-primary-light);
      }

      .menu {
        position: absolute;
        top: calc(100% + 8px);
        right: 0;
        width: 260px;
        background: var(--app-bg-surface);
        border: 1px solid var(--app-border-subtle);
        border-top: 3px solid var(--app-primary);
        border-radius: var(--border-radius);
        box-shadow: var(--shadow-md);
        z-index: 1000;
        overflow: hidden;
      }

      .menu::before {
        content: '';
        position: absolute;
        top: -6px;
        right: 12px;
        width: 10px;
        height: 10px;
        background: var(--app-bg-surface);
        border-left: 1px solid var(--app-border-subtle);
        border-top: 1px solid var(--app-border-subtle);
        transform: rotate(45deg);
      }

      .menu-header {
        padding: var(--space-md);
        border-bottom: 1px solid var(--app-border-subtle);
        background: var(--app-primary-light);
      }

      .menu-body {
        padding: var(--space-xs) 0;
        background: var(--app-bg-surface);
      }

      .menu-header-left {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
        min-width: 0;
      }

      .menu-avatar {
        width: 28px;
        height: 28px;
        border-radius: 999px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--app-bg-surface);
        color: var(--app-text-primary);
        border: 1px solid var(--app-border-strong);
        font-size: var(--font-size-table-header);
        font-weight: var(--font-weight-page-title);
        flex: 0 0 auto;
      }

      .menu-header-text {
        display: flex;
        flex-direction: column;
        min-width: 0;
      }

      .menu-name {
        font-size: var(--font-size-table-header);
        font-weight: var(--font-weight-page-title);
        color: var(--app-text-primary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .menu-subtitle {
        font-size: var(--font-size-meta);
        font-weight: var(--font-weight-meta);
        color: var(--app-text-muted);
      }

      .menu-item {
        width: 100%;
        text-align: left;
        border: none;
        background: transparent;
        padding: var(--space-sm) var(--space-md);
        font-size: var(--font-size-table-header);
        font-weight: var(--font-weight-table-header);
        color: var(--app-text-primary);
        cursor: pointer;
      }

      .menu-item + .menu-item {
        border-top: 1px solid var(--app-border-subtle);
      }

      .menu-item:focus-visible {
        outline: none;
        box-shadow: inset 0 0 0 2px var(--app-primary);
        background: var(--app-primary-light);
      }

      .menu-item:hover {
        background: var(--app-primary-light);
      }

      .menu-item.danger {
        color: var(--app-danger);
      }

      .menu-item.danger:hover {
        background: var(--app-danger-light);
      }

      .divider {
        height: 1px;
        background: var(--app-border-subtle);
      }
    `,
  ],
})
export class AppShellLayoutComponent {
  @Input({ required: true }) tenantName!: string;

  @Input({ required: true }) userName!: string;
  @Input() showSwitchTenant = false;

  @Input() showImpersonationBanner = false;
  @Input() impersonationBannerText = '';

  @Input({ required: true }) nav!: SidebarNavConfig;

  @Output() profile = new EventEmitter<void>();
  @Output() switchTenant = new EventEmitter<void>();
  @Output() signOut = new EventEmitter<void>();
  @Output() exitImpersonation = new EventEmitter<void>();

  protected userMenuOpen = false;

  protected get userInitial(): string {
    return (this.userName.trim()[0] || 'U').toUpperCase();
  }

  toggleUserMenu(): void {
    this.userMenuOpen = !this.userMenuOpen;
  }

  closeUserMenu(): void {
    this.userMenuOpen = false;
  }
}
