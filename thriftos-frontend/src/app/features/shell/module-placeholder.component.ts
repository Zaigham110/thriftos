/**
 * ===============================
 * MODULE PLACEHOLDER - PHASE 0
 * ===============================
 * 
 * Empty placeholder for modules during Phase 0
 * NO business UI, NO tables, NO KPIs
 */

import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppLoadingComponent } from '../../shared/ui';

@Component({
  selector: 'app-module-placeholder',
  standalone: true,
  imports: [
    CommonModule,
    AppLoadingComponent,
  ],
  template: `<app-loading message="Module loading…" />`,
  styles: []
})
export class ModulePlaceholderComponent {
}
