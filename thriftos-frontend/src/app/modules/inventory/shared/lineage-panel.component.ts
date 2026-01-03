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
    <div class="rounded-lg border border-border bg-card p-4">
      <div class="mb-4 flex items-center gap-2 border-b pb-3 text-sm font-semibold text-foreground">
        <lucide-icon [img]="icons.Link2" [size]="18" class="text-muted-foreground"></lucide-icon>
        <h3 class="text-sm font-semibold">Source Lineage</h3>
      </div>
      
      @if (!lineage) {
        <div class="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <p class="m-0">Lineage data unavailable. This inventory item may be corrupted.</p>
        </div>
      } @else {
        <div class="flex flex-col">
          <!-- Container (optional - null for loose bale origins) -->
          <div class="flex items-center gap-3 py-2" [class.opacity-60]="!lineage.containerId">
            <div class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <lucide-icon [img]="icons.Box" [size]="16"></lucide-icon>
            </div>
            <div class="flex min-w-0 flex-1 flex-col gap-0.5">
              <span class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Container</span>
              @if (lineage.containerId) {
                <span class="truncate font-mono text-sm font-medium text-foreground">{{ lineage.containerCode || lineage.containerId }}</span>
              } @else {
                <span class="text-sm italic text-muted-foreground">Loose Bale Origin</span>
              }
            </div>
          </div>
          
          <div class="ml-[15px] h-3 w-px bg-border"></div>
          
          <!-- Rag/Bale -->
          <div class="flex items-center gap-3 py-2" [class.opacity-60]="!lineage.ragId">
            <div class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-secondary/10 text-secondary">
              <lucide-icon [img]="icons.Package" [size]="16"></lucide-icon>
            </div>
            <div class="flex min-w-0 flex-1 flex-col gap-0.5">
              <span class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Rag/Bale</span>
              @if (lineage.ragId) {
                <span class="truncate font-mono text-sm font-medium text-foreground">{{ lineage.ragCode || lineage.ragId }}</span>
              } @else {
                <span class="text-sm italic text-muted-foreground">—</span>
              }
            </div>
          </div>
          
          <div class="ml-[15px] h-3 w-px bg-border"></div>
          
          <!-- Stage 1 Session -->
          <div class="flex items-center gap-3 py-2" [class.opacity-60]="!lineage.sortSessionId">
            <div class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
              <lucide-icon [img]="icons.Layers" [size]="16"></lucide-icon>
            </div>
            <div class="flex min-w-0 flex-1 flex-col gap-0.5">
              <span class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Stage 1 Session</span>
              @if (lineage.sortSessionId) {
                <span class="truncate font-mono text-sm font-medium text-foreground">{{ lineage.sortSessionCode || lineage.sortSessionId }}</span>
              } @else {
                <span class="text-sm italic text-muted-foreground">—</span>
              }
            </div>
          </div>
          
          <div class="ml-[15px] h-3 w-px bg-border"></div>
          
          <!-- Stage 2 Session (optional) -->
          <div class="flex items-center gap-3 py-2" [class.opacity-60]="!lineage.gradeSessionId">
            <div class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-muted text-foreground">
              <lucide-icon [img]="icons.Grid3X3" [size]="16"></lucide-icon>
            </div>
            <div class="flex min-w-0 flex-1 flex-col gap-0.5">
              <span class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Stage 2 Session</span>
              @if (lineage.gradeSessionId) {
                <span class="truncate font-mono text-sm font-medium text-foreground">{{ lineage.gradeSessionCode || lineage.gradeSessionId }}</span>
              } @else {
                <span class="text-sm italic text-muted-foreground">Not Graded</span>
              }
            </div>
          </div>
          
          <div class="ml-[15px] h-3 w-px bg-border"></div>
          
          <!-- Repack Unit (REQUIRED) -->
          <div class="flex items-center gap-3 py-2">
            <div class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <lucide-icon [img]="icons.PackageCheck" [size]="16"></lucide-icon>
            </div>
            <div class="flex min-w-0 flex-1 flex-col gap-0.5 rounded-md bg-primary/5 px-2 py-1">
              <span class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Repack Unit</span>
              <span class="truncate font-mono text-sm font-semibold text-primary">{{ lineage.repackUnitCode }}</span>
            </div>
          </div>
        </div>
      }
    </div>
  `,
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
