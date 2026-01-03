/**
 * App Workspace 3-Panel Component
 * ERP Stabilization - Reusable 3-panel workspace layout
 * 
 * Standard layout for all operational workspaces:
 * - Left Panel: Queue/Available items
 * - Center Panel: Active work/allocations
 * - Right Panel: Summary + primary action
 * 
 * Responsive breakpoints:
 * - Desktop (1400px+): 3 columns
 * - Tablet (900px-1399px): 2 columns (left+center, right below)
 * - Mobile (<900px): 1 column stacked
 */

import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-workspace-3panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="workspace-3panel">
      <div class="panel panel-left">
        <ng-content select="[slot='left']"></ng-content>
      </div>
      <div class="panel panel-center">
        <ng-content select="[slot='center']"></ng-content>
      </div>
      <div class="panel panel-right">
        <ng-content select="[slot='right']"></ng-content>
      </div>
    </div>
  `,
  styles: [`
    .workspace-3panel {
      display: grid;
      grid-template-columns: 1fr 1.5fr 400px;
      gap: 1rem;
      height: 100%;

      @media (max-width: 1399px) {
        grid-template-columns: 1fr 1fr;
        grid-template-rows: auto auto;

        .panel-right {
          grid-column: 1 / -1;
        }
      }

      @media (max-width: 899px) {
        grid-template-columns: 1fr;
        grid-template-rows: auto auto auto;

        .panel-left,
        .panel-center,
        .panel-right {
          grid-column: 1;
        }
      }
    }

    .panel {
      display: flex;
      flex-direction: column;
      min-height: 0;
      overflow: hidden;
    }

    .panel-left,
    .panel-center {
      background: hsl(var(--card));
      border: 1px solid hsl(var(--border));
      border-radius: 0.5rem;
      padding: 1rem;
    }

    .panel-right {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppWorkspace3PanelComponent {}
