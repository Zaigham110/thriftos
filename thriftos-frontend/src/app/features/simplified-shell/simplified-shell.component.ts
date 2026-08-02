import { Component, computed, DestroyRef, HostListener, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { AuthService } from '../../core/auth';
import { OperationalModule, TenantService } from '../../core/tenant/tenant.service';
import { OperationModeService } from '../../core/config/operation-mode.service';
import { OfflineDraftService } from '../../core/operations/offline-draft.service';

@Component({
  selector: 'app-simplified-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="nextgen-lite-container">
      @if (layoutMode() === 'desktop') {
      <!-- Glassmorphic Header Command Center -->
      <header class="nextgen-header">
        <div class="header-left">
          <div class="brand-logo-area">
            <span class="logo-text">ThriftOS</span>
            <span class="pro-badge">LITE ERP PRO</span>
          </div>
          <div class="tenant-pill">
            <span class="tenant-dot"></span>
            <span class="tenant-name">{{ tenantName() }}</span>
          </div>
        </div>

        <!-- Desktop Navigation Tabs (≥ 1024px) -->
        <nav class="desktop-nav-tabs">
          <a routerLink="/app/lite/home" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }" class="nav-tab" [hidden]="!isModuleEnabled('WORK')">
            <span class="tab-icon">⌂</span>
            <span class="tab-label">My Work</span>
          </a>
          <a routerLink="/app/lite/buying" routerLinkActive="active" class="nav-tab" [hidden]="!isModuleEnabled('INTAKE')">
            <span class="tab-icon">🛍️</span>
            <span class="tab-label">Raw Buying</span>
          </a>
          <a routerLink="/app/lite/sorting" routerLinkActive="active" class="nav-tab" [hidden]="!isModuleEnabled('SORTING')">
            <span class="tab-icon">⚡</span>
            <span class="tab-label">Sorting Hub</span>
          </a>
          <a routerLink="/app/lite/repack" routerLinkActive="active" class="nav-tab" [hidden]="!isModuleEnabled('REPACK')">
            <span class="tab-icon">📦</span>
            <span class="tab-label">Repack & QR</span>
          </a>
          <a routerLink="/app/lite/quick-sale" routerLinkActive="active" class="nav-tab" [hidden]="!isModuleEnabled('SALES')">
            <span class="tab-icon">🛒</span>
            <span class="tab-label">POS Sales</span>
          </a>
          <a routerLink="/app/lite/lookup" routerLinkActive="active" class="nav-tab" [hidden]="!isModuleEnabled('STOCK')">
            <span class="tab-icon">🔍</span>
            <span class="tab-label">Stock Scanner</span>
          </a>
          <a routerLink="/app/reports" class="nav-tab" [hidden]="!isModuleEnabled('INSIGHTS')">
            <span class="tab-icon">▥</span>
            <span class="tab-label">Insights</span>
          </a>
          <a routerLink="/app/admin" class="nav-tab" [hidden]="!isModuleEnabled('ADMINISTRATION')">
            <span class="tab-icon">⚙</span>
            <span class="tab-label">Administration</span>
          </a>
        </nav>

        <!-- Right User Actions -->
        <div class="header-right">
          <span class="sync-chip" [class.offline]="!offlineDrafts.isOnline()">
            {{ offlineDrafts.isOnline() ? (offlineDrafts.pendingCount() ? offlineDrafts.pendingCount() + ' queued' : 'Synced') : offlineDrafts.pendingCount() + ' queued · offline' }}
          </span>
          @if (canSwitchModes()) {
          <button
            type="button"
            class="erp-switcher-btn"
            (click)="switchToFullErp()"
            title="Switch to Full Enterprise ERP Mode"
          >
            <span>🖥️ Full ERP</span>
          </button>
          }

          <div class="user-avatar-chip">
            <span class="avatar-letter">{{ userName().charAt(0).toUpperCase() }}</span>
            <span class="user-name">{{ userName() }}</span>
          </div>

          <button
            type="button"
            class="logout-icon-btn"
            (click)="onSignOut()"
            title="Sign Out"
          >
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      <!-- VISUAL OPERATIONAL PIPELINE STEPPER BAR -->
      <div class="pipeline-bar-wrapper">
        <div class="pipeline-bar-container">
          <div class="pipeline-title-label">
            <span>OPERATIONAL LINEAGE FLOW</span>
          </div>

          <div class="pipeline-steps">
            <!-- Step 1: Raw Buying Intake -->
            <a
              routerLink="/app/lite/buying"
              class="pipeline-step-item"
              [hidden]="!isModuleEnabled('INTAKE')"
              [class.active]="currentStep() === 1"
              [class.completed]="currentStep() > 1"
            >
              <div class="step-badge">1</div>
              <div class="step-info">
                <span class="step-name">🛍️ Raw Buying</span>
                <span class="step-desc">Bale Intake & Auto PO</span>
              </div>
            </a>

            <div class="pipeline-flow-arrow">➔</div>

            <!-- Step 2: Stage 1 Category Sort -->
            <a
              routerLink="/app/lite/sorting"
              [queryParams]="{ stage: 1 }"
              class="pipeline-step-item"
              [hidden]="!isModuleEnabled('SORTING')"
              [class.active]="currentStep() === 2"
              [class.completed]="currentStep() > 2"
            >
              <div class="step-badge">2</div>
              <div class="step-info">
                <span class="step-name">⚡ Category Sort</span>
                <span class="step-desc">Stage 1 Sorting</span>
              </div>
            </a>

            <div class="pipeline-flow-arrow">➔</div>

            <!-- Step 3: Stage 2 Quality Grading -->
            <a
              routerLink="/app/lite/sorting"
              [queryParams]="{ stage: 2 }"
              class="pipeline-step-item"
              [hidden]="!isModuleEnabled('SORTING')"
              [class.active]="currentStep() === 3"
              [class.completed]="currentStep() > 3"
            >
              <div class="step-badge">3</div>
              <div class="step-info">
                <span class="step-name">🏷️ Quality Grade</span>
                <span class="step-desc">Stage 2 Grading</span>
              </div>
            </a>

            <div class="pipeline-flow-arrow">➔</div>

            <!-- Step 4: Repack & Bundling -->
            <a
              routerLink="/app/lite/repack"
              class="pipeline-step-item"
              [hidden]="!isModuleEnabled('REPACK')"
              [class.active]="currentStep() === 4"
              [class.completed]="currentStep() > 4"
            >
              <div class="step-badge">4</div>
              <div class="step-info">
                <span class="step-name">📦 Repack & QR</span>
                <span class="step-desc">40kg Bales & Label</span>
              </div>
            </a>

            <div class="pipeline-flow-arrow">➔</div>

            <!-- Step 5: POS Quick Sale -->
            <a
              routerLink="/app/lite/quick-sale"
              class="pipeline-step-item"
              [hidden]="!isModuleEnabled('SALES')"
              [class.active]="currentStep() === 5"
              [class.completed]="currentStep() > 5"
            >
              <div class="step-badge">5</div>
              <div class="step-info">
                <span class="step-name">🛒 POS Checkout</span>
                <span class="step-desc">Floor Sales & Cash</span>
              </div>
            </a>
          </div>
        </div>
      </div>

      <!-- Main Fluid Workspace (1400px Max Width) -->
      <main class="nextgen-main-body">
        <router-outlet></router-outlet>
      </main>

      <!-- Touch Bottom Navigation (< 1024px) -->
      <nav class="mobile-bottom-bar">
        <a routerLink="/app/lite/buying" routerLinkActive="active" class="m-bar-item" [hidden]="!isModuleEnabled('INTAKE')">
          <span class="m-icon">🛍️</span>
          <span class="m-text">Buying</span>
        </a>
        <a routerLink="/app/lite/sorting" routerLinkActive="active" class="m-bar-item" [hidden]="!isModuleEnabled('SORTING')">
          <span class="m-icon">⚡</span>
          <span class="m-text">Sorting</span>
        </a>
        <a routerLink="/app/lite/repack" routerLinkActive="active" class="m-bar-item" [hidden]="!isModuleEnabled('REPACK')">
          <span class="m-icon">📦</span>
          <span class="m-text">Repack</span>
        </a>
        <a routerLink="/app/lite/quick-sale" routerLinkActive="active" class="m-bar-item" [hidden]="!isModuleEnabled('SALES')">
          <span class="m-icon">🛒</span>
          <span class="m-text">Sales</span>
        </a>
        <a routerLink="/app/lite/lookup" routerLinkActive="active" class="m-bar-item" [hidden]="!isModuleEnabled('STOCK')">
          <span class="m-icon">🔍</span>
          <span class="m-text">Lookup</span>
        </a>
      </nav>
      } @else if (layoutMode() === 'tablet') {
        <div class="tablet-shell">
          <aside class="tablet-rail" aria-label="Operational navigation">
            <a routerLink="/app/lite/home" routerLinkActive="active" class="rail-brand">T</a>
            <a routerLink="/app/lite/home" routerLinkActive="active" class="rail-item" [hidden]="!isModuleEnabled('WORK')"><span>⌂</span><small>Work</small></a>
            <a routerLink="/app/lite/buying" routerLinkActive="active" class="rail-item" [hidden]="!isModuleEnabled('INTAKE')"><span>↓</span><small>Intake</small></a>
            <a routerLink="/app/lite/sorting" routerLinkActive="active" class="rail-item" [hidden]="!isModuleEnabled('SORTING')"><span>↯</span><small>Sort</small></a>
            <a routerLink="/app/lite/repack" routerLinkActive="active" class="rail-item" [hidden]="!isModuleEnabled('REPACK')"><span>□</span><small>Repack</small></a>
            <a routerLink="/app/lite/lookup" routerLinkActive="active" class="rail-item" [hidden]="!isModuleEnabled('STOCK')"><span>⌕</span><small>Stock</small></a>
            <a routerLink="/app/lite/quick-sale" routerLinkActive="active" class="rail-item" [hidden]="!isModuleEnabled('SALES')"><span>¤</span><small>Sales</small></a>
            <a routerLink="/app/reports" class="rail-item"><span>▥</span><small>Insights</small></a>
            <a routerLink="/app/admin" class="rail-item"><span>⚙</span><small>Admin</small></a>
            <button type="button" class="rail-signout" (click)="onSignOut()">⇥</button>
          </aside>
          <div class="tablet-workspace">
            <header class="tablet-header">
              <div><strong>My Work</strong><span>{{ tenantName() }}</span></div>
              <div class="tablet-header-actions">
                <span class="sync-chip" [class.offline]="!offlineDrafts.isOnline()">{{ offlineDrafts.isOnline() ? (offlineDrafts.pendingCount() ? offlineDrafts.pendingCount() + ' queued' : 'Synced') : 'Offline' }}</span>
                @if (canSwitchModes()) {
                  <button type="button" (click)="switchToFullErp()">Desktop control centre</button>
                }
              </div>
            </header>
            <div class="tablet-context" aria-label="Material lifecycle">
              <span [class.active]="currentStep() === 1">Intake</span><i>→</i>
              <span [class.active]="currentStep() === 2">Sort</span><i>→</i>
              <span [class.active]="currentStep() === 3">Grade</span><i>→</i>
              <span [class.active]="currentStep() === 4">Repack</span><i>→</i>
              <span [class.active]="currentStep() === 5">Sell</span>
            </div>
            <main class="tablet-main"><router-outlet></router-outlet></main>
          </div>
        </div>
      } @else {
        <div class="mobile-shell">
          <header class="mobile-header"><strong>ThriftOS</strong><span>{{ offlineDrafts.isOnline() ? (offlineDrafts.pendingCount() ? offlineDrafts.pendingCount() + ' queued' : 'Synced') : 'Offline' }}</span><button type="button" (click)="onSignOut()">Sign out</button></header>
          <main class="mobile-main"><router-outlet></router-outlet></main>
          <nav class="mobile-task-nav" aria-label="Primary tasks">
            <a routerLink="/app/lite/home" routerLinkActive="active" [hidden]="!isModuleEnabled('WORK')"><span>⌂</span>Work</a>
            <a routerLink="/app/lite/buying" routerLinkActive="active" [hidden]="!isModuleEnabled('INTAKE')"><span>↓</span>Intake</a>
            <a routerLink="/app/lite/sorting" routerLinkActive="active" [hidden]="!isModuleEnabled('SORTING')"><span>↯</span>Sort</a>
            <a routerLink="/app/lite/repack" routerLinkActive="active" [hidden]="!isModuleEnabled('REPACK')"><span>□</span>Repack</a>
            <a routerLink="/app/lite/lookup" routerLinkActive="active" [hidden]="!isModuleEnabled('STOCK')"><span>⌕</span>Stock</a>
            <a routerLink="/app/lite/more" routerLinkActive="active" [hidden]="!hasMoreModules()"><span>•••</span>More</a>
          </nav>
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
      background-color: #f9fafb;
      font-family: Inter, system-ui, -apple-system, sans-serif;
      color: #111827;
    }

    .nextgen-lite-container {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }

    /* Glassmorphic Header Bar */
    .nextgen-header {
      position: sticky;
      top: 0;
      z-index: 100;
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 64px;
      padding: 0 1.75rem;
      background: rgba(113, 75, 103, 0.96);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      color: #ffffff;
      box-shadow: 0 4px 20px rgba(113, 75, 103, 0.25);
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .brand-logo-area {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .logo-text {
      font-weight: 900;
      font-size: 1.3rem;
      letter-spacing: -0.03em;
      color: #ffffff;
    }

    .pro-badge {
      background: linear-gradient(135deg, #f59e0b, #d97706);
      color: #ffffff;
      font-size: 0.65rem;
      font-weight: 900;
      padding: 2px 7px;
      border-radius: 4px;
      letter-spacing: 0.06em;
      box-shadow: 0 2px 6px rgba(245, 158, 11, 0.3);
    }

    .tenant-pill {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      background: rgba(255, 255, 255, 0.15);
      border: 1px solid rgba(255, 255, 255, 0.25);
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 0.8rem;
    }

    .tenant-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background-color: #10b981;
      box-shadow: 0 0 6px #10b981;
    }

    .tenant-name {
      font-weight: 600;
      max-width: 140px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* Desktop Navigation Tabs */
    .desktop-nav-tabs {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      background: rgba(0, 0, 0, 0.15);
      padding: 4px;
      border-radius: 12px;
    }

    .nav-tab {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      padding: 0.5rem 0.95rem;
      color: rgba(255, 255, 255, 0.85);
      text-decoration: none;
      font-size: 0.88rem;
      font-weight: 600;
      border-radius: 8px;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

      &:hover {
        background: rgba(255, 255, 255, 0.15);
        color: #ffffff;
      }

      &.active {
        background: #ffffff;
        color: #714b67;
        font-weight: 800;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
      }

      .tab-icon { font-size: 1.05rem; }
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .sync-chip { padding: .28rem .5rem; border: 1px solid rgba(255,255,255,.35); border-radius: 999px; color: #fff; font-size: .68rem; font-weight: 750; white-space: nowrap; }
    .sync-chip.offline { color: #fef3c7; border-color: #f59e0b; }

    .erp-switcher-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      background: #ffffff;
      color: #714b67;
      border: none;
      padding: 7px 14px;
      border-radius: 8px;
      font-size: 0.8rem;
      font-weight: 800;
      cursor: pointer;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
      transition: transform 0.15s;

      &:hover {
        transform: translateY(-1px);
      }
    }

    .user-avatar-chip {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      background: rgba(255, 255, 255, 0.15);
      padding: 4px 10px 4px 4px;
      border-radius: 999px;
    }

    .avatar-letter {
      width: 26px;
      height: 26px;
      border-radius: 50%;
      background: #ffffff;
      color: #714b67;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 900;
      font-size: 0.8rem;
    }

    .user-name { font-size: 0.82rem; font-weight: 600; }

    .logout-icon-btn {
      background: transparent;
      border: 1px solid rgba(255, 255, 255, 0.3);
      color: #ffffff;
      padding: 6px 12px;
      border-radius: 8px;
      font-size: 0.78rem;
      font-weight: 600;
      cursor: pointer;
      &:hover { background: rgba(255, 255, 255, 0.2); }
    }

    /* Visual Operational Pipeline Bar */
    .pipeline-bar-wrapper {
      background: #ffffff;
      border-bottom: 1px solid #e5e7eb;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02);
      padding: 0.65rem 1.75rem;
    }

    .pipeline-bar-container {
      max-width: 1400px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1.5rem;
    }

    .pipeline-title-label {
      font-size: 0.68rem;
      font-weight: 900;
      color: #714b67;
      letter-spacing: 0.08em;
      white-space: nowrap;
      background: rgba(113, 75, 103, 0.08);
      padding: 4px 8px;
      border-radius: 4px;
    }

    .pipeline-steps {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex: 1;
      overflow-x: auto;
      padding-bottom: 2px;

      &::-webkit-scrollbar { height: 3px; }
      &::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 999px; }
    }

    .pipeline-step-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.4rem 0.75rem;
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      text-decoration: none;
      color: #4b5563;
      transition: all 0.15s ease;
      white-space: nowrap;

      &:hover {
        border-color: #714b67;
        background: rgba(113, 75, 103, 0.04);
      }

      &.completed {
        background: #ecfdf5;
        border-color: #a7f3d0;
        color: #065f46;

        .step-badge {
          background: #10b981;
          color: #ffffff;
        }
      }

      &.active {
        background: #714b67;
        border-color: #714b67;
        color: #ffffff;
        box-shadow: 0 4px 12px rgba(113, 75, 103, 0.3);

        .step-badge {
          background: #ffffff;
          color: #714b67;
        }

        .step-name { color: #ffffff; font-weight: 800; }
        .step-desc { color: rgba(255, 255, 255, 0.85); }
      }
    }

    .step-badge {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: #e5e7eb;
      color: #374151;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 900;
      font-size: 0.7rem;
    }

    .step-info {
      display: flex;
      flex-direction: column;
    }

    .step-name {
      font-size: 0.8rem;
      font-weight: 700;
      line-height: 1.1;
    }

    .step-desc {
      font-size: 0.66rem;
      opacity: 0.75;
    }

    .pipeline-flow-arrow {
      color: #9ca3af;
      font-size: 0.85rem;
      font-weight: 700;
    }

    /* Main Responsive Container */
    .nextgen-main-body {
      flex: 1;
      width: 100%;
      max-width: 1400px;
      margin: 0 auto;
      padding: 1.5rem 1.75rem;
      box-sizing: border-box;
    }

    /* Mobile Bottom Touch Bar (< 1024px) */
    .mobile-bottom-bar {
      display: none;
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 100;
      height: 64px;
      background: #ffffff;
      border-top: 1px solid #e5e7eb;
      grid-template-columns: repeat(5, 1fr);
      box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.05);
    }

    .m-bar-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-decoration: none;
      color: #6b7280;
      font-size: 0.7rem;
      font-weight: 500;
      gap: 2px;

      &.active {
        color: #714b67;
        font-weight: 800;
      }
    }

    .m-icon { font-size: 1.15rem; }

    /* Expanded windows can be narrow (split view); keep commands reachable without header overlap. */
    @media (min-width: 1024px) and (max-width: 1279px) {
      .nextgen-header { padding: 0 1rem; gap: .5rem; }
      .desktop-nav-tabs { gap: .2rem; }
      .nav-tab { min-width: 38px; justify-content: center; padding: .5rem; }
      .nav-tab .tab-label { display: none; }
      .header-right { gap: .35rem; }
      .erp-switcher-btn { padding: 7px 9px; }
      .user-avatar-chip { padding-right: 4px; }
      .user-name, .logout-icon-btn { display: none; }
    }

    /* A 1280–1535px desktop is still an expanded window, but the full command
       labels compete with tenant identity and session controls. Keep the
       desktop command surface dense rather than allowing the header to scroll. */
    @media (min-width: 1280px) and (max-width: 1535px) {
      .nextgen-header { padding: 0 1rem; gap: .5rem; }
      .desktop-nav-tabs { gap: .2rem; flex: 1 1 auto; justify-content: center; min-width: 0; }
      .nav-tab { min-width: 38px; justify-content: center; padding: .5rem; }
      .nav-tab .tab-label { display: none; }
      .header-right { flex: 0 0 auto; gap: .5rem; }
      .tenant-pill { max-width: 135px; }
    }

    /* Tablet is deliberately a queue-and-context workstation, not a scaled phone. */
    .tablet-shell { display: grid; grid-template-columns: 84px minmax(0, 1fr); min-height: 100vh; background: #f6f7f8; }
    .tablet-rail { position: sticky; top: 0; height: 100vh; display: flex; flex-direction: column; align-items: center; gap: .6rem; padding: 1rem .65rem; background: #382635; color: #fff; box-sizing: border-box; }
    .rail-brand { width: 42px; height: 42px; display: grid; place-items: center; margin-bottom: .7rem; border-radius: 12px; color: #382635; background: #fff; font-weight: 900; text-decoration: none; }
    .rail-item { width: 100%; min-height: 58px; display: grid; place-items: center; gap: 2px; border-radius: 10px; color: #dacfd8; text-decoration: none; font-size: 1.15rem; }
    .rail-item small { font-size: .63rem; font-weight: 700; }
    .rail-item.active { color: #fff; background: #714b67; }
    .rail-signout { margin-top: auto; width: 42px; height: 42px; border: 1px solid #856e7f; border-radius: 9px; background: transparent; color: #fff; font-size: 1.1rem; }
    .tablet-workspace { min-width: 0; }
    .tablet-header { min-height: 72px; display: flex; align-items: center; justify-content: space-between; padding: 0 1.5rem; background: #fff; border-bottom: 1px solid #e5e7eb; }
    .tablet-header div { display: grid; gap: .15rem; }
    .tablet-header strong { color: #271c25; font-size: 1.15rem; }
    .tablet-header span { color: #6b7280; font-size: .78rem; }
    .tablet-header button { min-height: 40px; border: 1px solid #714b67; border-radius: 8px; background: #fff; color: #714b67; font-weight: 700; }
    .tablet-header-actions { display: flex; align-items: center; gap: .6rem; }
    .tablet-header .sync-chip { border-color: #b8a6b3; color: #714b67; }
    .tablet-header .sync-chip.offline { color: #92400e; border-color: #f59e0b; }
    .tablet-context { display: flex; align-items: center; gap: .55rem; padding: .9rem 1.5rem; overflow-x: auto; background: #fbfafb; color: #6b7280; font-size: .78rem; font-weight: 700; }
    .tablet-context span { white-space: nowrap; padding: .42rem .65rem; border-radius: 999px; }
    .tablet-context span.active { color: #fff; background: #714b67; }
    .tablet-context i { font-style: normal; color: #aaa; }
    .tablet-main { padding: 1.25rem 1.5rem; }

    /* Mobile is a one-task-at-a-time surface with a thumb-reachable nav. */
    .mobile-shell { min-height: 100vh; background: #f8f8f8; }
    .mobile-header { min-height: 56px; display: flex; align-items: center; gap: .5rem; padding: 0 .9rem; background: #714b67; color: #fff; }
    .mobile-header strong { font-size: 1rem; }
    .mobile-header span { min-width: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: .73rem; opacity: .82; }
    .mobile-header button { min-height: 40px; border: 0; background: transparent; color: #fff; font-size: .72rem; font-weight: 700; }
    .mobile-main { padding: .9rem; padding-bottom: 84px; }
    .mobile-task-nav { position: fixed; z-index: 100; right: 0; bottom: 0; left: 0; height: 68px; display: grid; grid-template-columns: repeat(6, 1fr); background: #fff; border-top: 1px solid #e5e7eb; box-shadow: 0 -5px 18px rgba(35, 25, 33, .08); }
    .mobile-task-nav a { min-width: 48px; display: grid; place-content: center; gap: 2px; color: #6b7280; text-align: center; text-decoration: none; font-size: .64rem; font-weight: 700; }
    .mobile-task-nav span { font-size: 1.25rem; line-height: 1; }
    .mobile-task-nav a.active { color: #714b67; }

    @media (max-width: 1023px) {
      .desktop-nav-tabs, .pipeline-bar-wrapper { display: none; }
      .mobile-bottom-bar { display: grid; }
      .nextgen-main-body { padding: 1rem; padding-bottom: 80px; }
      .tenant-pill, .user-name { display: none; }
    }
  `],
})
export class SimplifiedShellComponent {
  private readonly destroyRef = inject(DestroyRef);
  protected readonly user = computed(() => this.authService.user());
  protected readonly tenant = computed(() => this.tenantService.tenant());
  protected readonly currentStep = signal<number>(1);
  protected readonly offlineDrafts = inject(OfflineDraftService);
  protected readonly layoutMode = signal<'mobile' | 'tablet' | 'desktop'>(this.getLayoutMode());
  protected readonly canSwitchModes = computed(() => this.modeService.tenantMode() === 'USER_CHOICE');

  protected readonly tenantName = computed(() => {
    return this.tenant()?.name || 'ThriftOS';
  });

  protected isModuleEnabled(module: OperationalModule): boolean {
    const enabledModules = this.tenant()?.operationalModules;
    return !enabledModules?.length || enabledModules.includes(module);
  }

  protected readonly hasMoreModules = computed(() => (
    this.isModuleEnabled('SALES') || this.isModuleEnabled('INSIGHTS') || this.isModuleEnabled('ADMINISTRATION')
  ));

  protected readonly userName = computed(() => {
    return this.user()?.name || 'Operator';
  });

  constructor(
    private readonly authService: AuthService,
    private readonly tenantService: TenantService,
    private readonly modeService: OperationModeService,
    private readonly router: Router
  ) {
    this.updateActiveStep(this.router.url);
    this.tenantService.loadTenant().subscribe({ error: () => undefined });

    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event: NavigationEnd) => {
        this.updateActiveStep(event.urlAfterRedirects || event.url);
      });
  }

  @HostListener('window:resize')
  protected onViewportResize(): void {
    this.layoutMode.set(this.getLayoutMode());
  }

  private getLayoutMode(): 'mobile' | 'tablet' | 'desktop' {
    const width = window.innerWidth;
    return width < 600 ? 'mobile' : width < 1024 ? 'tablet' : 'desktop';
  }

  private updateActiveStep(url: string): void {
    if (url.includes('/app/lite/buying')) {
      this.currentStep.set(1);
    } else if (url.includes('/app/lite/sorting')) {
      if (url.includes('stage=2')) {
        this.currentStep.set(3);
      } else {
        this.currentStep.set(2);
      }
    } else if (url.includes('/app/lite/repack')) {
      this.currentStep.set(4);
    } else if (url.includes('/app/lite/quick-sale')) {
      this.currentStep.set(5);
    } else {
      this.currentStep.set(1);
    }
  }

  switchToFullErp(): void {
    if (!this.canSwitchModes()) return;
    this.modeService.setMode('FULL_ERP');
    this.router.navigate(['/app/dashboard']);
  }

  onSignOut(): void {
    this.authService.logout().subscribe(() => {
      this.router.navigate(['/auth/login']);
    });
  }
}
