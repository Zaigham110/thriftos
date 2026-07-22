import { Component } from '@angular/core';

/**
 * app-topbar - Professional SaaS Topbar Primitive
 */
@Component({
  selector: 'app-topbar',
  standalone: true,
  template: `
    <header class="topbar">
      <div class="topbar-left">
        <ng-content select="[slot='left']" />
      </div>
      <div class="topbar-right">
        <ng-content select="[slot='right']" />
      </div>
    </header>
  `,
  styles: [`
    .topbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;
      height: 56px;
      padding: 0 1.5rem;
      background: #ffffff;
      border-bottom: 1px solid #e5e7eb;
      position: relative;
      z-index: 20;
    }

    .topbar-left {
      display: flex;
      align-items: center;
      gap: 1rem;
      min-width: 0;
    }

    .topbar-right {
      display: flex;
      align-items: center;
      gap: 1rem;
    }
  `]
})
export class AppTopbarComponent {}
