import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, HostListener, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterOutlet, Router } from '@angular/router';
import { of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
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
  Plus,
  TrendingUp,
  ShoppingBag,
  Truck,
  Package,
  Layers,
  Warehouse,
  X,
  Check,
  Zap,
  DollarSign,
  Trash2,
  ArrowRight,
  Tag,
  Users,
  Smartphone,
} from 'lucide-angular';

import { AppTopbarComponent } from '../app-topbar/app-topbar.component';
import { AppSidebarComponent, type SidebarNavConfig } from '../app-sidebar/app-sidebar.component';
import { API_BASE_URL } from '../../../core/config/api.config';

interface CmdSearchItem {
  id: string;
  title: string;
  subtitle: string;
  route: string;
  group: string;
  type?: string;
  icon: string;
  keywords?: string[];
}

@Component({
  selector: 'app-shell-layout',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
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
        @if (showImpersonationBanner) {
          <div class="impersonation-banner-strip">
            <div class="impersonation-content">
              <lucide-icon [img]="icons.Shield" [size]="16" class="impersonation-icon"></lucide-icon>
              <span class="impersonation-text">
                <strong>SUPERADMIN IMPERSONATION:</strong> {{ impersonationBannerText || ('Operating under ' + tenantName) }}
              </span>
            </div>
            <button type="button" class="btn-exit-impersonation" (click)="exitImpersonation.emit()">
              <lucide-icon [img]="icons.LogOut" [size]="14"></lucide-icon>
              <span>Exit Impersonation</span>
            </button>
          </div>
        }

        <div class="shell-topbar">
          <app-topbar>
            <!-- Left Slot: Tenant Badge, Environment Tag & Global Search Trigger -->
            <div slot="left" class="topbar-left-content">
              <div class="tenant-pill" [title]="tenantName">
                <div class="tenant-icon">
                  <lucide-icon [img]="icons.Building2" [size]="15"></lucide-icon>
                </div>
                <span class="tenant-name">{{ tenantName }}</span>
                <span class="env-tag">PROD</span>
              </div>

              <!-- Global Total Command Search Trigger -->
              <div class="header-search-btn" (click)="openCommandPalette()" role="button" tabindex="0">
                <lucide-icon [img]="icons.Search" [size]="14" class="search-icon"></lucide-icon>
                <span class="search-placeholder">Search PO #, Container #, Customer, Sorting... (⌘K)</span>
                <kbd class="search-kbd">⌘K</kbd>
              </div>
            </div>

            <!-- Right Slot: Quick Create, Live Status, System Actions & User Profile -->
            <div slot="right" class="topbar-right-content">
              <!-- Live Operational Status Indicator -->
              <div class="system-status-pill" title="All backend ERP services operational">
                <span class="status-pulse-dot"></span>
                <span class="status-txt">Live Systems</span>
              </div>

              <!-- Quick Create CTA Dropdown -->
              <div class="quick-create-wrapper">
                <button type="button" class="btn-quick-create" (click)="toggleQuickMenu()">
                  <lucide-icon [img]="icons.Plus" [size]="14"></lucide-icon>
                  <span>Quick Action</span>
                  <lucide-icon [img]="icons.ChevronDown" [size]="12"></lucide-icon>
                </button>

                @if (quickMenuOpen) {
                  <div class="quick-menu-dropdown" role="menu">
                    <div class="menu-label">Create Record</div>
                    <button type="button" class="menu-btn" (click)="navTo('/sell/records/new')">
                      <lucide-icon [img]="icons.ShoppingBag" [size]="14" class="text-purple"></lucide-icon>
                      <span>New Sales Order</span>
                    </button>
                    <button type="button" class="menu-btn" (click)="navTo('/receive/records/pos')">
                      <lucide-icon [img]="icons.Truck" [size]="14" class="text-blue"></lucide-icon>
                      <span>New Purchase Order</span>
                    </button>
                    <button type="button" class="menu-btn" (click)="navTo('/sort')">
                      <lucide-icon [img]="icons.Layers" [size]="14" class="text-emerald"></lucide-icon>
                      <span>Stage 1 Sorting Session</span>
                    </button>
                    <button type="button" class="menu-btn" (click)="navTo('/stock/bale')">
                      <lucide-icon [img]="icons.Package" [size]="14" class="text-amber"></lucide-icon>
                      <span>Repack Production Batch</span>
                    </button>
                  </div>
                }
              </div>

              <div class="header-divider"></div>

              <!-- Notifications & System Actions -->
              <div class="header-actions">
                <button
                  type="button"
                  class="mode-switch-pill-btn"
                  (click)="profile.emit()"
                  title="Switch to Touch Simplified Mobile Mode"
                >
                  <lucide-icon [img]="icons.Smartphone" [size]="14"></lucide-icon>
                  <span>Mobile Mode</span>
                </button>

                <button type="button" class="header-icon-btn" title="Notifications" aria-label="Notifications">
                  <lucide-icon [img]="icons.Bell" [size]="17"></lucide-icon>
                  <span class="notification-dot"></span>
                </button>

                <button type="button" class="header-icon-btn" title="Help & Documentation" aria-label="Help">
                  <lucide-icon [img]="icons.HelpCircle" [size]="17"></lucide-icon>
                </button>
              </div>

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
                  <lucide-icon [img]="icons.ChevronDown" [size]="13" class="chevron-icon" [class.rotated]="userMenuOpen"></lucide-icon>
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
                        <lucide-icon [img]="icons.Smartphone" [size]="14"></lucide-icon>
                        <span>Switch to Mobile Mode</span>
                      </button>

                      @if (showSwitchTenant) {
                        <button
                          class="dropdown-item"
                          type="button"
                          role="menuitem"
                          (click)="switchTenant.emit(); closeUserMenu()"
                        >
                          <lucide-icon [img]="icons.Building2" [size]="14"></lucide-icon>
                          <span>Switch Organization</span>
                        </button>
                      }

                      <button
                        class="dropdown-item"
                        type="button"
                        role="menuitem"
                        (click)="closeUserMenu()"
                      >
                        <lucide-icon [img]="icons.Settings" [size]="14"></lucide-icon>
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
                        <lucide-icon [img]="icons.LogOut" [size]="14"></lucide-icon>
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                }
              </div>
            </div>
          </app-topbar>
        </div>

        <div class="shell-workspace">
          <router-outlet />
        </div>
      </div>
    </div>

    <!-- Total Enterprise Command Palette Modal (⌘K) -->
    @if (commandPaletteOpen()) {
      <div class="cmd-overlay" (click)="closeCommandPalette()">
        <div class="cmd-modal" (click)="$event.stopPropagation()">
          <div class="cmd-header">
            <lucide-icon [img]="icons.Search" [size]="18" class="cmd-search-icon"></lucide-icon>
            <input
              type="text"
              class="cmd-input"
              placeholder="Search PO #, Container #, Customer, Sorting Session... (⌘K)"
              autoFocus
              [ngModel]="cmdSearchText()"
              (ngModelChange)="cmdSearchText.set($event)"
            />
            <kbd class="cmd-esc-kbd" (click)="closeCommandPalette()">ESC</kbd>
          </div>

          <div class="cmd-list">
            @if (allCombinedItems().length === 0) {
              <div class="cmd-no-results">
                <p class="font-bold text-gray-800">No matching search results</p>
                <p class="text-xs text-gray-500">Try searching for PO #, Container, Category, Report, or Customer.</p>
              </div>
            } @else {
              @for (item of allCombinedItems(); track item.id) {
                <button type="button" class="cmd-item" (click)="navTo(item.route); closeCommandPalette()">
                  <div class="cmd-icon-wrap">
                    <lucide-icon [img]="getLucideIcon(item.icon)" [size]="15" class="cmd-icon"></lucide-icon>
                  </div>
                  <div class="cmd-text">
                    <span class="cmd-title">{{ item.title }}</span>
                    <span class="cmd-sub">{{ item.subtitle }}</span>
                  </div>
                  <span class="cmd-group-badge">{{ item.group }}</span>
                </button>
              }
            }
          </div>

          <div class="cmd-footer">
            <div class="footer-hint">
              <span>Navigation & Entity Search</span>
              <span class="cmd-hint-key">↑↓ Navigate</span>
              <span class="cmd-hint-key">↵ Select</span>
              <span class="cmd-hint-key">ESC Close</span>
            </div>
            <span class="footer-count">{{ allCombinedItems().length }} results</span>
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      @use '../../../../styles/variables' as *;

      .shell {
        height: 100vh;
        width: 100%;
        display: grid;
        grid-template-columns: 240px 1fr;
        overflow: hidden;
        background: #f9fafb;
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

      .impersonation-banner-strip {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.45rem 1.25rem;
        background: linear-gradient(90deg, #991b1b 0%, #714b67 100%);
        color: #ffffff;
        font-size: 0.8125rem;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        z-index: 100;
        flex-shrink: 0;

        .impersonation-content {
          display: flex;
          align-items: center;
          gap: 0.6rem;

          .impersonation-icon {
            color: #fef08a;
          }

          .impersonation-text {
            font-weight: 500;
            letter-spacing: 0.01em;

            strong {
              color: #fef08a;
              font-weight: 800;
              letter-spacing: 0.03em;
            }
          }
        }

        .btn-exit-impersonation {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.25rem 0.65rem;
          font-size: 0.75rem;
          font-weight: 700;
          color: #991b1b;
          background: #ffffff;
          border: 1px solid #fecaca;
          border-radius: 0.375rem;
          cursor: pointer;
          transition: all 0.15s ease;

          &:hover {
            background: #fef2f2;
            color: #7f1d1d;
            border-color: #fca5a5;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
          }
        }
      }

      .shell-topbar {
        flex: 0 0 auto;
      }

      .shell-workspace {
        background: #f9fafb;
        overflow: auto;
        min-height: 0;
        padding: 1.5rem;
      }

      /* Left Topbar Content */
      .topbar-left-content {
        display: flex;
        align-items: center;
        gap: 1rem;
      }

      .tenant-pill {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        padding: 0.3rem 0.65rem;
        background: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 0.375rem;

        .tenant-icon {
          display: flex;
          align-items: center;
          color: #714b67;
        }

        .tenant-name {
          font-size: 0.8125rem;
          font-weight: 700;
          color: #111827;
          max-width: 180px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .env-tag {
          font-size: 0.625rem;
          font-weight: 800;
          padding: 0.05rem 0.35rem;
          border-radius: 0.25rem;
          background: #714b67;
          color: #ffffff;
          letter-spacing: 0.04em;
        }
      }

      .header-search-btn {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        width: 340px;
        padding: 0.35rem 0.65rem;
        font-size: 0.775rem;
        border: 1px solid #e5e7eb;
        border-radius: 0.375rem;
        background: #ffffff;
        color: #6b7280;
        cursor: pointer;
        transition: all 0.15s ease;

        &:hover {
          border-color: #714b67;
          background: #ffffff;
          box-shadow: 0 0 0 2px rgba(113, 75, 103, 0.08);
        }

        .search-icon {
          color: #714b67;
        }

        .search-placeholder {
          flex: 1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .search-kbd {
          padding: 0.1rem 0.35rem;
          font-size: 0.6875rem;
          font-family: monospace;
          font-weight: 700;
          color: #6b7280;
          background: #f3f4f6;
          border: 1px solid #d1d5db;
          border-radius: 0.25rem;
        }
      }

      /* Right Topbar Content */
      .topbar-right-content {
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }

      .system-status-pill {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        padding: 0.25rem 0.55rem;
        background: hsl(142 76% 96%);
        border: 1px solid hsl(142 71% 85%);
        border-radius: 9999px;

        .status-pulse-dot {
          width: 0.4rem;
          height: 0.4rem;
          border-radius: 50%;
          background: hsl(142 71% 40%);
          box-shadow: 0 0 0 2px hsl(142 76% 90%);
        }

        .status-txt {
          font-size: 0.725rem;
          font-weight: 700;
          color: hsl(142 71% 30%);
        }
      }

      .quick-create-wrapper {
        position: relative;
      }

      .btn-quick-create {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        height: 2rem;
        padding: 0 0.65rem;
        font-size: 0.75rem;
        font-weight: 700;
        background: #714b67;
        color: #ffffff;
        border: none;
        border-radius: 0.375rem;
        cursor: pointer;
        transition: all 0.15s ease;

        &:hover {
          opacity: 0.92;
        }
      }

      .quick-menu-dropdown {
        position: absolute;
        top: calc(100% + 0.4rem);
        right: 0;
        width: 220px;
        background: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 0.5rem;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        z-index: 1000;
        padding: 0.35rem;
        display: flex;
        flex-direction: column;
        gap: 0.15rem;

        .menu-label {
          font-size: 0.6875rem;
          font-weight: 700;
          color: #9ca3af;
          text-transform: uppercase;
          padding: 0.35rem 0.5rem 0.15rem;
        }

        .menu-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.45rem 0.5rem;
          font-size: 0.775rem;
          font-weight: 600;
          color: #374151;
          border: none;
          background: transparent;
          border-radius: 0.25rem;
          cursor: pointer;
          transition: all 0.12s ease;

          &:hover {
            background: #f3f4f6;
            color: #111827;
          }
        }
      }

      .header-actions {
        display: flex;
        align-items: center;
        gap: 0.25rem;
      }

      .mode-switch-pill-btn {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        padding: 4px 10px;
        background: rgba(113, 75, 103, 0.08);
        border: 1px solid rgba(113, 75, 103, 0.25);
        color: #714b67;
        border-radius: 6px;
        font-size: 0.75rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.15s ease;
        margin-right: 0.25rem;

        &:hover {
          background: #714b67;
          color: #ffffff;
          border-color: #714b67;
        }
      }

      .header-icon-btn {
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 2rem;
        height: 2rem;
        border-radius: 0.375rem;
        border: 1px solid transparent;
        background: transparent;
        color: #4b5563;
        cursor: pointer;
        transition: all 0.15s ease;

        &:hover {
          background: #f3f4f6;
          color: #111827;
        }

        .notification-dot {
          position: absolute;
          top: 0.3rem;
          right: 0.3rem;
          width: 0.4rem;
          height: 0.4rem;
          border-radius: 50%;
          background: #dc2626;
          border: 1.5px solid #ffffff;
        }
      }

      .header-divider {
        width: 1px;
        height: 1.25rem;
        background: #e5e7eb;
      }

      /* User Profile Pill */
      .user-profile-wrapper {
        position: relative;
      }

      .user-profile-btn {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.2rem 0.45rem 0.2rem 0.2rem;
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
          width: 1.75rem;
          height: 1.75rem;
          border-radius: 50%;
          background: #714b67;
          color: #ffffff;
          font-size: 0.725rem;
          font-weight: 700;
        }

        .user-profile-meta {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          line-height: 1.1;

          .user-profile-name {
            font-size: 0.775rem;
            font-weight: 600;
            color: #111827;
          }

          .user-profile-role {
            font-size: 0.65rem;
            color: #6b7280;
          }
        }
      }

      /* Dropdown Card */
      .profile-dropdown-card {
        position: absolute;
        top: calc(100% + 0.4rem);
        right: 0;
        width: 220px;
        background: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 0.5rem;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        z-index: 1000;
        overflow: hidden;
      }

      .dropdown-header {
        display: flex;
        align-items: center;
        gap: 0.65rem;
        padding: 0.75rem;
        background: #f9fafb;
        border-bottom: 1px solid #e5e7eb;

        .dropdown-user-avatar {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 2rem;
          height: 2rem;
          border-radius: 50%;
          background: #714b67;
          color: white;
          font-size: 0.8125rem;
          font-weight: 700;
        }

        .dropdown-user-info {
          display: flex;
          flex-direction: column;

          .dropdown-user-name {
            font-size: 0.8125rem;
            font-weight: 600;
            color: #111827;
          }

          .dropdown-user-tenant {
            font-size: 0.7rem;
            color: #6b7280;
          }
        }
      }

      .dropdown-section {
        padding: 0.25rem;
      }

      .dropdown-item {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        width: 100%;
        padding: 0.45rem 0.65rem;
        font-size: 0.775rem;
        font-weight: 500;
        color: #374151;
        border: none;
        background: transparent;
        border-radius: 0.25rem;
        cursor: pointer;

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

      /* Total Enterprise Command Palette Modal */
      .cmd-overlay {
        position: fixed;
        inset: 0;
        background: rgba(17, 24, 39, 0.45);
        backdrop-filter: blur(4px);
        z-index: 2000;
        display: flex;
        align-items: flex-start;
        justify-content: center;
        padding-top: 8vh;
      }

      .cmd-modal {
        width: 100%;
        max-width: 640px;
        background: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 0.75rem;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
        overflow: hidden;
        animation: cmdSlideDown 0.15s ease;
      }

      @keyframes cmdSlideDown {
        from { opacity: 0; transform: translateY(-10px); }
        to { opacity: 1; transform: translateY(0); }
      }

      .cmd-header {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 1rem 1.25rem;
        border-bottom: 1px solid #e5e7eb;
        background: #ffffff;

        .cmd-search-icon {
          color: #714b67;
        }

        .cmd-input {
          flex: 1;
          border: none;
          font-size: 0.9375rem;
          font-weight: 600;
          color: #111827;

          &:focus {
            outline: none;
          }

          &::placeholder {
            color: #9ca3af;
            font-weight: 400;
          }
        }

        .cmd-esc-kbd {
          padding: 0.15rem 0.45rem;
          font-size: 0.6875rem;
          font-family: monospace;
          font-weight: 700;
          color: #6b7280;
          background: #f3f4f6;
          border: 1px solid #d1d5db;
          border-radius: 0.25rem;
          cursor: pointer;
        }
      }

      .cmd-list {
        padding: 0.5rem;
        max-height: 420px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }

      .cmd-no-results {
        padding: 2rem 1.5rem;
        text-align: center;
      }

      .cmd-item {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.6rem 0.75rem;
        border: 1px solid transparent;
        background: transparent;
        border-radius: 0.375rem;
        text-align: left;
        cursor: pointer;
        transition: all 0.12s ease;

        &:hover {
          background: #f3e8f0;
          border-color: rgba(113, 75, 103, 0.2);

          .cmd-title {
            color: #714b67;
          }

          .cmd-icon-wrap {
            background: #714b67;
            color: #ffffff;
          }
        }

        .cmd-icon-wrap {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 1.875rem;
          height: 1.875rem;
          border-radius: 0.25rem;
          background: #f3f4f6;
          color: #4b5563;
          flex-shrink: 0;
          transition: all 0.12s ease;
        }

        .cmd-text {
          display: flex;
          flex-direction: column;
          flex: 1;

          .cmd-title {
            font-size: 0.8125rem;
            font-weight: 700;
            color: #111827;
          }

          .cmd-sub {
            font-size: 0.725rem;
            color: #6b7280;
          }
        }

        .cmd-group-badge {
          font-size: 0.65rem;
          font-weight: 700;
          padding: 0.15rem 0.5rem;
          border-radius: 9999px;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          color: #6b7280;
        }
      }

      .cmd-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.5rem 1rem;
        background: #f9fafb;
        border-top: 1px solid #e5e7eb;
        font-size: 0.725rem;
        color: #6b7280;
      }

      .footer-hint {
        display: flex;
        align-items: center;
        gap: 0.65rem;

        .cmd-hint-key {
          font-family: monospace;
          background: #ffffff;
          border: 1px solid #d1d5db;
          border-radius: 0.2rem;
          padding: 0.05rem 0.3rem;
          font-size: 0.6875rem;
        }
      }

      .footer-count {
        font-weight: 600;
        color: #111827;
      }

      .text-purple { color: #714b67; }
      .text-emerald { color: hsl(142 71% 33%); }
      .text-blue { color: hsl(217 91% 40%); }
      .text-amber { color: hsl(38 92% 35%); }
    `,
  ],
})
export class AppShellLayoutComponent {
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);

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
  protected quickMenuOpen = false;
  readonly commandPaletteOpen = signal(false);
  readonly cmdSearchText = signal<string>('');

  // Live Backend Database Search Results Signal
  private readonly dbSearchResults = toSignal(
    toObservable(this.cmdSearchText).pipe(
      debounceTime(180),
      distinctUntilChanged(),
      switchMap((query) => {
        const q = query?.trim();
        if (!q || q.length < 2) return of([]);
        return this.http.get<CmdSearchItem[]>(`${API_BASE_URL}/search/global`, { params: { q } }).pipe(
          catchError(() => of([]))
        );
      })
    ),
    { initialValue: [] }
  );

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
    Plus,
    TrendingUp,
    ShoppingBag,
    Truck,
    Package,
    Layers,
    Warehouse,
    X,
    Check,
    Zap,
    DollarSign,
    Trash2,
    ArrowRight,
    Tag,
    Users,
    Smartphone,
  };

  private readonly totalIndexItems: CmdSearchItem[] = [
    // Navigation & General
    { id: 'dashboard', title: 'Executive Operations Dashboard', subtitle: 'Main system operational KPIs, cost summary & quick stats', route: '/home/overview', group: 'Navigation', icon: 'Zap', keywords: ['dash', 'main', 'kpi', 'home', 'overview'] },
    { id: 'reports-dir', title: 'Reports & Analytics Directory', subtitle: 'Master directory of all 10 Landed cost & valuation audit reports', route: '/reports/detail', group: 'Reports', icon: 'TrendingUp', keywords: ['report', 'analytics', 'audit', 'dir'] },

    // Reports Breakdown
    { id: 'rep-yield', title: 'Category Yield Audit & Mass Balance', subtitle: 'Raw intake weight vs sorting output conversion yield %', route: '/reports/detail/yield', group: 'Reports', icon: 'TrendingUp', keywords: ['yield', 'conversion', 'mass', 'balance', 'sort'] },
    { id: 'rep-cogs', title: 'Final Product Landed Cost & COGS Audit', subtitle: 'Unit landed costs, container cost allocations & valuation rates', route: '/reports/detail/final-product-cost', group: 'Reports', icon: 'DollarSign', keywords: ['cost', 'cogs', 'landed', 'final', 'unit'] },
    { id: 'rep-inv', title: 'Finished Goods Stock Valuation & Aging', subtitle: 'Real-time inventory snapshot & stock aging breakdown', route: '/reports/detail/inventory', group: 'Reports', icon: 'Warehouse', keywords: ['inventory', 'stock', 'valuation', 'aging', 'snapshot'] },
    { id: 'rep-proc-sum', title: 'Procurement Summary & Cost Reconciliation', subtitle: 'Purchase orders reconciled against container landed costs', route: '/reports/detail/procurement-summary', group: 'Reports', icon: 'Truck', keywords: ['procurement', 'po', 'reconciliation', 'container'] },
    { id: 'rep-repack', title: 'Repack Production & Batch Summary', subtitle: 'Batch production metrics grouped by repack status & cost', route: '/reports/detail/repack-summary', group: 'Reports', icon: 'Package', keywords: ['repack', 'batch', 'production', 'pack'] },
    { id: 'rep-sort-out', title: 'Sorting Outputs & Grade Breakdown', subtitle: 'Stage 1 Category & Stage 2 Quality Grade output ledgers', route: '/reports/detail/sorting-outputs', group: 'Reports', icon: 'Layers', keywords: ['sorting', 'stage1', 'stage2', 'grade', 'output'] },
    { id: 'rep-waste', title: 'Waste & Material Loss Analysis', subtitle: 'Categorized waste volume and financial cost impact', route: '/reports/detail/waste', group: 'Reports', icon: 'Trash2', keywords: ['waste', 'loss', 'scrap', 'financial'] },
    { id: 'rep-move', title: 'Auditable Inventory Movement Ledger', subtitle: 'Chronological trail of intake, repack, transfer & sales', route: '/reports/detail/inventory-movements', group: 'Reports', icon: 'ArrowRight', keywords: ['movement', 'trail', 'history', 'transfer'] },
    { id: 'rep-vend', title: 'Supplier Vendor Procurement Analysis', subtitle: 'Vendor volume performance, containers & average cost/KG', route: '/reports/detail/procurement', group: 'Reports', icon: 'Users', keywords: ['vendor', 'supplier', 'volume', 'intake'] },

    // Commercial Sales
    { id: 'sales-list', title: 'Wholesale Sales Orders Directory', subtitle: 'Commercial sales orders, inventory allocation & invoicing', route: '/sell/records', group: 'Sales', icon: 'ShoppingBag', keywords: ['sales', 'order', 'so', 'wholesale', 'invoice'] },
    { id: 'sales-new', title: 'Create New Sales Order', subtitle: 'Reserve finished inventory and issue customer invoice', route: '/sell/records/new', group: 'Sales', icon: 'Plus', keywords: ['new sales', 'create order', 'issue'] },
    { id: 'sales-cust', title: 'Wholesale Customers Directory', subtitle: 'Customer Directory, billing addresses & credit terms', route: '/khata', group: 'Sales', icon: 'Users', keywords: ['customer', 'buyer', 'client', 'credit'] },

    // Procurement
    { id: 'proc-pos', title: 'Purchase Orders & Containers', subtitle: 'Supplier purchase order intake, containers & landed cost', route: '/receive/records/pos', group: 'Procurement', icon: 'Truck', keywords: ['purchase', 'po', 'procurement', 'order'] },
    { id: 'proc-containers', title: 'Container Intake & Ocean Shipments', subtitle: 'Container gate arrival, weighbridge & container cost allocations', route: '/receive/records/containers', group: 'Procurement', icon: 'Package', keywords: ['container', 'shipment', 'vessel', 'intake'] },

    // Operations & Warehouse
    { id: 'sort-stage1', title: 'Stage 1 Raw Category Sorting Workstation', subtitle: 'Initial raw container sorting into category bales', route: '/sort', group: 'Inventory & Operations', icon: 'Layers', keywords: ['stage1', 'raw', 'sorting', 'bale'] },
    { id: 'sort-stage2', title: 'Stage 2 Quality Grading Workstation', subtitle: 'Detailed quality grading (Grade A, B, Vintage, Waste)', route: '/sort/grade', group: 'Inventory & Operations', icon: 'Tag', keywords: ['stage2', 'grading', 'vintage', 'quality'] },
    { id: 'pack-repack', title: 'Repack & Packaging Production Workspace', subtitle: 'Bale breakdown, sorting and repacking into retail units', route: '/stock/bale', group: 'Inventory & Operations', icon: 'Package', keywords: ['repack', 'package', 'sku', 'unit'] },
    { id: 'inv-stock', title: 'Finished Goods Warehouse Inventory', subtitle: 'Stock list, warehouse distribution & bin locations', route: '/stock/items', group: 'Inventory & Operations', icon: 'Warehouse', keywords: ['inventory', 'stock', 'warehouse', 'location'] },

    // System Admin
    { id: 'admin-users', title: 'User Management & Permissions', subtitle: 'Manage ERP system users, roles and security permissions', route: '/settings/admin/users', group: 'Navigation', icon: 'Users', keywords: ['user', 'admin', 'permission', 'role', 'security'] },
    { id: 'admin-tenants', title: 'Tenant Organization Settings', subtitle: 'Company profile, currency formatting & facility configuration', route: '/settings/admin/tenant', group: 'Navigation', icon: 'Building2', keywords: ['tenant', 'org', 'setting', 'company', 'facility'] },
  ];

  readonly filteredNavItems = computed(() => {
    const q = (this.cmdSearchText() ?? '').trim().toLowerCase();
    if (!q) return this.totalIndexItems;

    const normQ = q.replace(/[^a-z0-9]/gi, '');

    return this.totalIndexItems.filter((item) => {
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchSub = item.subtitle.toLowerCase().includes(q);
      const matchGroup = item.group.toLowerCase().includes(q);
      const matchKeywords = item.keywords?.some((k) => k.toLowerCase().includes(q));

      const normTitle = item.title.toLowerCase().replace(/[^a-z0-9]/gi, '');
      const normMatch = normQ.length > 0 && normTitle.includes(normQ);

      return matchTitle || matchSub || matchGroup || matchKeywords || normMatch;
    });
  });

  readonly allCombinedItems = computed(() => {
    const navItems = this.filteredNavItems();
    const dbItems = this.dbSearchResults() || [];

    // Prioritize dynamic DB Search Results (PO Numbers, Container Numbers, Customers, Sorting) at the top!
    return [...dbItems, ...navItems];
  });

  @HostListener('window:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent): void {
    if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
      event.preventDefault();
      this.commandPaletteOpen.update((v) => !v);
    } else if (event.key === 'Escape' && this.commandPaletteOpen()) {
      this.commandPaletteOpen.set(false);
    }
  }

  protected get userInitial(): string {
    return (this.userName?.trim()[0] || 'U').toUpperCase();
  }

  getLucideIcon(iconName: string): any {
    switch (iconName) {
      case 'Zap': return this.icons.Zap;
      case 'TrendingUp': return this.icons.TrendingUp;
      case 'DollarSign': return this.icons.DollarSign;
      case 'Warehouse': return this.icons.Warehouse;
      case 'Truck': return this.icons.Truck;
      case 'Package': return this.icons.Package;
      case 'Layers': return this.icons.Layers;
      case 'Trash2': return this.icons.Trash2;
      case 'ArrowRight': return this.icons.ArrowRight;
      case 'Users': return this.icons.Users;
      case 'ShoppingBag': return this.icons.ShoppingBag;
      case 'Plus': return this.icons.Plus;
      case 'Tag': return this.icons.Tag;
      case 'Building2': return this.icons.Building2;
      default: return this.icons.Search;
    }
  }

  openCommandPalette(): void {
    this.commandPaletteOpen.set(true);
  }

  closeCommandPalette(): void {
    this.commandPaletteOpen.set(false);
  }

  toggleQuickMenu(): void {
    this.quickMenuOpen = !this.quickMenuOpen;
  }

  toggleUserMenu(): void {
    this.userMenuOpen = !this.userMenuOpen;
  }

  closeUserMenu(): void {
    this.userMenuOpen = false;
  }

  navTo(route: string): void {
    this.quickMenuOpen = false;
    void this.router.navigate([route]);
  }
}
