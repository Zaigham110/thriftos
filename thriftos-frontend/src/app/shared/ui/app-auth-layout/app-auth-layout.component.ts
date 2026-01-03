import { Component } from '@angular/core';

/**
 * app-auth-layout
 * 2-column authentication layout: Branding panel | Form panel
 * Phase-0 locked: full viewport height, no scrolling, neutral surfaces.
 */
@Component({
  selector: 'app-auth-layout',
  standalone: true,
  template: `
    <div class="auth-layout">
      <div class="auth-left">
        <div class="auth-left-inner">
          <ng-content select="app-brand-panel[slot='brand']" />
        </div>
      </div>

      <div class="auth-right">
        <div class="auth-right-center">
          <ng-content select="[slot='form']" />
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .auth-layout {
        height: 100vh;
        width: 100%;
        display: grid;
        grid-template-columns: 1fr 1fr;
        background: var(--app-bg-page);
        overflow: hidden;
      }

      .auth-left {
        background: var(--app-primary-light);
        border-right: 1px solid var(--app-border-subtle);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: var(--space-2xl);
        overflow: hidden;
      }

      .auth-left-inner {
        width: 100%;
        max-width: 520px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .auth-right {
        background: var(--app-bg-page);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: var(--space-2xl);
        overflow: hidden;
      }

      .auth-right-center {
        width: 100%;
        max-width: 460px;
      }

      @media (max-width: 920px) {
        .auth-layout {
          grid-template-columns: 1fr;
        }

        .auth-left {
          border-right: none;
          border-bottom: 1px solid var(--app-border-subtle);
          padding: var(--space-xl);
        }

        .auth-right {
          padding: var(--space-xl);
        }
      }
    `,
  ],
})
export class AppAuthLayoutComponent {}
