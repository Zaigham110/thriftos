/**
 * Lineage Panel Component
 * Phase 6: Inventory Management
 * 
 * Displays full source chain from Container → Inventory Item.
 * MANDATORY on every inventory detail view.
 * READ-ONLY - no edits allowed.
 */

import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, Link2, Package, Box, Layers, Grid3X3, PackageCheck } from 'lucide-angular';
import { InventoryLineage } from '../inventory.models';

@Component({
  selector: 'app-lineage-panel',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <div class="lineage-panel">
      <div class="lineage-header">
        <lucide-icon [img]="icons.Link2" [size]="18"></lucide-icon>
        <h3>Source Lineage</h3>
      </div>
      
      @if (!lineage) {
        <div class="lineage-error">
          <p>⚠️ Lineage data unavailable. This inventory item may be corrupted.</p>
        </div>
      } @else {
        <div class="lineage-chain">
          <!-- Container (optional - null for loose bale origins) -->
          <div class="lineage-item" [class.lineage-item--optional]="!lineage.containerId">
            <div class="lineage-icon lineage-icon--container">
              <lucide-icon [img]="icons.Box" [size]="16"></lucide-icon>
            </div>
            <div class="lineage-content">
              <span class="lineage-label">Container</span>
              @if (lineage.containerId) {
                <span class="lineage-value">{{ lineage.containerCode || lineage.containerId }}</span>
              } @else {
                <span class="lineage-value lineage-value--na">Loose Bale Origin</span>
              }
            </div>
          </div>
          
          <div class="lineage-connector"></div>
          
          <!-- Rag/Bale -->
          <div class="lineage-item" [class.lineage-item--optional]="!lineage.ragId">
            <div class="lineage-icon lineage-icon--rag">
              <lucide-icon [img]="icons.Package" [size]="16"></lucide-icon>
            </div>
            <div class="lineage-content">
              <span class="lineage-label">Rag/Bale</span>
              @if (lineage.ragId) {
                <span class="lineage-value">{{ lineage.ragCode || lineage.ragId }}</span>
              } @else {
                <span class="lineage-value lineage-value--na">—</span>
              }
            </div>
          </div>
          
          <div class="lineage-connector"></div>
          
          <!-- Stage 1 Session -->
          <div class="lineage-item" [class.lineage-item--optional]="!lineage.sortSessionId">
            <div class="lineage-icon lineage-icon--stage1">
              <lucide-icon [img]="icons.Layers" [size]="16"></lucide-icon>
            </div>
            <div class="lineage-content">
              <span class="lineage-label">Stage 1 Session</span>
              @if (lineage.sortSessionId) {
                <span class="lineage-value">{{ lineage.sortSessionCode || lineage.sortSessionId }}</span>
              } @else {
                <span class="lineage-value lineage-value--na">—</span>
              }
            </div>
          </div>
          
          <div class="lineage-connector"></div>
          
          <!-- Stage 2 Session (optional) -->
          <div class="lineage-item" [class.lineage-item--optional]="!lineage.gradeSessionId">
            <div class="lineage-icon lineage-icon--stage2">
              <lucide-icon [img]="icons.Grid3X3" [size]="16"></lucide-icon>
            </div>
            <div class="lineage-content">
              <span class="lineage-label">Stage 2 Session</span>
              @if (lineage.gradeSessionId) {
                <span class="lineage-value">{{ lineage.gradeSessionCode || lineage.gradeSessionId }}</span>
              } @else {
                <span class="lineage-value lineage-value--na">Not Graded</span>
              }
            </div>
          </div>
          
          <div class="lineage-connector"></div>
          
          <!-- Repack Unit (REQUIRED) -->
          <div class="lineage-item lineage-item--required">
            <div class="lineage-icon lineage-icon--repack">
              <lucide-icon [img]="icons.PackageCheck" [size]="16"></lucide-icon>
            </div>
            <div class="lineage-content">
              <span class="lineage-label">Repack Unit</span>
              <span class="lineage-value lineage-value--primary">{{ lineage.repackUnitCode }}</span>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .lineage-panel {
      background: var(--bg-card, #fff);
      border: 1px solid var(--border-color, #e2e8f0);
      border-radius: 0.5rem;
      padding: 1rem;
    }

    .lineage-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 1rem;
      padding-bottom: 0.75rem;
      border-bottom: 1px solid var(--border-color, #e2e8f0);
      color: var(--text-secondary, #475569);

      h3 {
        margin: 0;
        font-size: 0.875rem;
        font-weight: 600;
        color: var(--text-primary, #0f172a);
      }
    }

    .lineage-error {
      padding: 0.75rem;
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 0.375rem;
      color: #dc2626;
      font-size: 0.8125rem;

      p {
        margin: 0;
      }
    }

    .lineage-chain {
      display: flex;
      flex-direction: column;
      gap: 0;
    }

    .lineage-connector {
      width: 2px;
      height: 12px;
      background: var(--border-color, #e2e8f0);
      margin-left: 15px;
    }

    .lineage-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.5rem 0;

      &--optional {
        opacity: 0.6;
      }

      &--required {
        .lineage-content {
          background: rgba(37, 99, 235, 0.05);
          padding: 0.375rem 0.5rem;
          border-radius: 0.375rem;
          margin: -0.375rem -0.5rem;
        }
      }
    }

    .lineage-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: 0.375rem;
      flex-shrink: 0;

      &--container {
        background: #dbeafe;
        color: #2563eb;
      }

      &--rag {
        background: #dcfce7;
        color: #16a34a;
      }

      &--stage1 {
        background: #fef3c7;
        color: #d97706;
      }

      &--stage2 {
        background: #f3e8ff;
        color: #9333ea;
      }

      &--repack {
        background: #dbeafe;
        color: #2563eb;
      }
    }

    .lineage-content {
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
      min-width: 0;
      flex: 1;
    }

    .lineage-label {
      font-size: 0.6875rem;
      text-transform: uppercase;
      letter-spacing: 0.025em;
      color: var(--text-muted, #64748b);
    }

    .lineage-value {
      font-size: 0.8125rem;
      font-weight: 500;
      color: var(--text-primary, #0f172a);
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;

      &--na {
        font-style: italic;
        color: var(--text-muted, #64748b);
        font-family: inherit;
      }

      &--primary {
        color: #2563eb;
        font-weight: 600;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LineagePanelComponent {
  @Input() lineage: InventoryLineage | null = null;

  readonly icons = {
    Link2,
    Package,
    Box,
    Layers,
    Grid3X3,
    PackageCheck,
  };
}
