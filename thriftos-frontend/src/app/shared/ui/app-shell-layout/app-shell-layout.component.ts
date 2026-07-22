import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import {
  LucideAngularModule,
  Search,
  Bell,
  HelpCircle,
  Building2,
  ChevronDown,
  User,
  Settings,
  LogOut,
  Command,
  Shield,
  Sparkles,
} from 'lucide-angular';

import { AppTopbarComponent } from '../app-topbar/app-topbar.component';
import { AppSidebarComponent, type SidebarNavConfig } from '../app-sidebar/app-sidebar.component';

/**
 * app-shell-layout
 * Professional Business SaaS Shell: Premium Topbar + Sidebar + Workspace.
 */
@Component({
  selector: 'app-shell-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    LucideAngularModule,
    AppTopbarComponent,
    AppSidebarComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="shell">
      <div class="shell-sidebar">
        <app-sidebar [nav]="nav" />
      </div>

      <div class="shell-main">
        <div class="shell-topbar">
          <app-topbar>
            <!-- Left Slot: Tenant Organization Badge & Quick Search -->
            <div slot="left" class="topbar-left-content">
              <div class="tenant-pill" [title]="tenantName">
                <div class="tenant-icon">
                  <lucide-icon [img]="icons.Building2" [size]="16"></lucide-icon>
                </div>
                <span class="tenant-name">{{ tenantName }}</span>
                <span class="tenant-status-dot" title="Active Enterprise Tenant"></span>
              </div>

              <div class="header-search">
                <lucide-icon [img]="icons.Search" [size]="15" class="search-icon"></lucide-icon>
                <input
                  type="text"
                  class="search-input"
                  placeholder="Search resources, bales, orders... (⌘K)"
                />
                <kbd class="search-kbd">⌘K</kbd>
              </div>
            </div>

            <!-- Right Slot: System Actions, Notifications, & User Profile -->
            <div slot="right" class="topbar-right-content">
              <!-- System Status & Quick Actions -->
              <div class="header-actions">
                <button type="button" class="header-icon-btn" title="Notifications" aria-label="Notifications">
                  <lucide-icon [img]="icons.Bell" [size]="18"></lucide-icon>
                  <span class="notification-dot"></span>
                </button>

                <button type="button" class="header-icon-btn" title="Help & Documentation" aria-label="Help">
                  <lucide-icon [img]="icons.HelpCircle" [size]="18"></lucide-icon>
                </button>
              </div>

              <div class="header-divider"></div>

              <!-- User Profile Dropdown Pill -->
              <div class="user-profile-wrapper">
                <button
                  class="user-profile-btn"
                  type="button"
                  (click)="toggleUserMenu()"
                  aria-haspopup="menu"
                  [attr.aria-expanded]="userMenuOpen"
                >
                  <div class="user-avatar-pill">
                    {{ userInitial }}
                  </div>
                  <div class="user-profile-meta">
                    <span class="user-profile-name">{{ userName }}</span>
                    <span class="user-profile-role">Enterprise Admin</span>
                  </div>
                  <lucide-icon [img]="icons.ChevronDown" [size]="14" class="chevron-icon" [class.rotated]="userMenuOpen"></lucide-icon>
                </button>

                @if (userMenuOpen) {
                  <div class="profile-dropdown-card" role="menu">
                    <div class="dropdown-header">
                      <div class="dropdown-user-avatar">{{ userInitial }}</div>
                      <div class="dropdown-user-info">
                        <div class="dropdown-user-name">{{ userName }}</div>
                        <div class="dropdown-user-tenant">{{ tenantName }}</div>
                      </div>
                    </div>

                    <div class="dropdown-section">
                      <button
                        class="dropdown-item"
                        type="button"
                        role="menuitem"
                        (click)="profile.emit(); closeUserMenu()"
                      >
                        <lucide-icon [img]="icons.User" [size]="15"></lucide-icon>
                        <span>My Account</span>
                      </button>

                      @if (showSwitchTenant) {
                        <button
                          class="dropdown-item"
                          type="button"
                          role="menuitem"
                          (click)="switchTenant.emit(); closeUserMenu()"
                        >
                          <lucide-icon [img]="icons.Building2" [size]="15"></lucide-icon>
                          <span>Switch Organization</span>
                        </button>
                      }

                      <button
                        class="dropdown-item"
                        type="button"
                        role="menuitem"
                        (click)="closeUserMenu()"
                      >
                        <lucide-icon [img]="icons.Settings" [size]="15"></lucide-icon>
                        <span>System Settings</span>
                      </button>
                    </div>

                    <div class="dropdown-divider"></div>

                    <div class="dropdown-section">
                      <button
                        class="dropdown-item danger"
                        type="button"
                        role="menuitem"
                        (click)="signOut.emit(); closeUserMenu()"
                      >
                        <lucide-icon [img]="icons.LogOut" [size]="15"></lucide-icon>
                        <span>Sign Out</span>
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
            <div class="impersonation-text">
              <lucide-icon [img]="icons.Shield" [size]="16"></lucide-icon>
              <span>{{ impersonationBannerText }}</span>
            </div>
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
        background: var(--app-bg-page, #f9fafb);
        font-family: 'Inter', system-ui, sans-serif;
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
        background: var(--app-bg-page, #f9fafb);
        overflow: auto;
        min-height: 0;
        padding: 1.5rem;
      }

      /* Left Topbar Content */
      .topbar-left-content {
        display: flex;
        align-items: center;
        gap: 1.25rem;
      }

      .tenant-pill {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.35rem 0.75rem;
        background: #f3f4f6;
        border: 1px solid #e5e7eb;
        border-radius: 0.375rem;

        .tenant-icon {
          display: flex;
          align-items: center;
          color: #714b67;
        }

        .tenant-name {
          font-size: 0.8125rem;
          font-weight: 600;
          color: #111827;
          max-width: 220px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .tenant-status-dot {
          width: 0.4rem;
          height: 0.4rem;
          border-radius: 50%;
          background: #16a34a;
        }
      }

      .header-search {
        position: relative;
        display: flex;
        align-items: center;
        width: 320px;

        .search-icon {
          position: absolute;
          left: 0.75rem;
          color: #9ca3af;
          pointer-events: none;
        }

        .search-input {
          width: 100%;
          padding: 0.4rem 2.5rem 0.4rem 2.25rem;
          font-size: 0.8125rem;
          border: 1px solid #e5e7eb;
          border-radius: 0.375rem;
          background: #f9fafb;
          color: #111827;
          transition: all 0.15s ease;

          &:focus {
            outline: none;
            background: #ffffff;
            border-color: #714b67;
            box-shadow: 0 0 0 3px rgba(113, 75, 103, 0.12);
          }

          &::placeholder {
            color: #9ca3af;
          }
        }

        .search-kbd {
          position: absolute;
          right: 0.5rem;
          padding: 0.15rem 0.35rem;
          font-size: 0.6875rem;
          font-family: monospace;
          font-weight: 600;
          color: #6b7280;
          background: #ffffff;
          border: 1px solid #d1d5db;
          border-radius: 0.25rem;
          pointer-events: none;
        }
      }

      /* Right Topbar Content */
      .topbar-right-content {
        display: flex;
        align-items: center;
        gap: 1rem;
      }

      .header-actions {
        display: flex;
        align-items: center;
        gap: 0.375rem;
      }

      .header-icon-btn {
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 2.125rem;
        height: 2.125rem;
        border-radius: 0.375rem;
        border: 1px solid transparent;
        background: transparent;
        color: #4b5563;
        cursor: pointer;
        transition: all 0.15s ease;

        &:hover {
          background: #f3f4f6;
          color: #111827;
          border-color: #e5e7eb;
        }

        .notification-dot {
          position: absolute;
          top: 0.35rem;
          right: 0.35rem;
          width: 0.4375rem;
          height: 0.4375rem;
          border-radius: 50%;
          background: #dc2626;
          border: 1.5px solid #ffffff;
        }
      }

      .header-divider {
        width: 1px;
        height: 1.5rem;
        background: #e5e7eb;
      }

      /* User Profile Pill & Dropdown */
      .user-profile-wrapper {
        position: relative;
      }

      .user-profile-btn {
        display: flex;
        align-items: center;
        gap: 0.625rem;
        padding: 0.25rem 0.5rem 0.25rem 0.25rem;
        border: 1px solid #e5e7eb;
        border-radius: 9999px;
        background: #ffffff;
        cursor: pointer;
        transition: all 0.15s ease;

        &:hover {
          border-color: #d1d5db;
          background: #f9fafb;
        }

        .user-avatar-pill {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 1.875rem;
          height: 1.875rem;
          border-radius: 50%;
          background: #714b67;
          color: #ffffff;
          font-size: 0.75rem;
          font-weight: 700;
          flex-shrink: 0;
        }

        .user-profile-meta {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          line-height: 1.15;

          .user-profile-name {
            font-size: 0.8125rem;
            font-weight: 600;
            color: #111827;
          }

          .user-profile-role {
            font-size: 0.6875rem;
            color: #6b7280;
          }
        }

        .chevron-icon {
          color: #6b7280;
          transition: transform 0.2s ease;

          &.rotated {
            transform: rotate(180deg);
          }
        }
      }

      /* Dropdown Card */
      .profile-dropdown-card {
        position: absolute;
        top: calc(100% + 0.5rem);
        right: 0;
        width: 240px;
        background: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 0.5rem;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.05);
        z-index: 1000;
        overflow: hidden;
        animation: dropdownFadeIn 0.15s ease;
      }

      @keyframes dropdownFadeIn {
        from { opacity: 0; transform: translateY(-4px); }
        to { opacity: 1; transform: translateY(0); }
      }

      .dropdown-header {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.875rem 1rem;
        background: #f9fafb;
        border-bottom: 1px solid #e5e7eb;

        .dropdown-user-avatar {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 2.25rem;
          height: 2.25rem;
          border-radius: 50%;
          background: #714b67;
          color: white;
          font-size: 0.875rem;
          font-weight: 700;
          flex-shrink: 0;
        }

        .dropdown-user-info {
          display: flex;
          flex-direction: column;
          min-width: 0;

          .dropdown-user-name {
            font-size: 0.875rem;
            font-weight: 600;
            color: #111827;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .dropdown-user-tenant {
            font-size: 0.75rem;
            color: #6b7280;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
        }
      }

      .dropdown-section {
        padding: 0.375rem;
      }

      .dropdown-item {
        display: flex;
        align-items: center;
        gap: 0.625rem;
        width: 100%;
        padding: 0.5rem 0.75rem;
        font-size: 0.8125rem;
        font-weight: 500;
        color: #374151;
        border: none;
        background: transparent;
        border-radius: 0.375rem;
        cursor: pointer;
        transition: all 0.15s ease;

        &:hover {
          background: #f3f4f6;
          color: #111827;
        }

        &.danger {
          color: #dc2626;

          &:hover {
            background: #fee2e2;
            color: #b91c1c;
          }
        }
      }

      .dropdown-divider {
        height: 1px;
        background: #e5e7eb;
      }

      /* Impersonation Banner */
      .impersonation-banner {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        padding: 0.5rem 1.5rem;
        border-bottom: 1px solid #e5e7eb;
        background: #f3e8f0;
        color: #714b67;

        .impersonation-text {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.8125rem;
          font-weight: 600;
        }

        .impersonation-exit {
          border: 1px solid #714b67;
          background: #ffffff;
          color: #714b67;
          border-radius: 0.375rem;
          padding: 0.25rem 0.625rem;
          cursor: pointer;
          font-size: 0.75rem;
          font-weight: 600;
          transition: all 0.15s ease;

          &:hover {
            background: #714b67;
            color: #ffffff;
          }
        }
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

  readonly icons = {
    Search,
    Bell,
    HelpCircle,
    Building2,
    ChevronDown,
    User,
    Settings,
    LogOut,
    Command,
    Shield,
    Sparkles,
  };

  protected get userInitial(): string {
    return (this.userName?.trim()[0] || 'U').toUpperCase();
  }

  toggleUserMenu(): void {
    this.userMenuOpen = !this.userMenuOpen;
  }

  closeUserMenu(): void {
    this.userMenuOpen = false;
  }
}
