/**
 * Forbidden Page - 403 Access Denied
 * Phase 1: Authentication & Shell
 */

import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { LucideAngularModule, ShieldX, ArrowLeft } from 'lucide-angular';
import { ButtonComponent } from '../../../shared/ui/button/button';

@Component({
  selector: 'app-forbidden',
  standalone: true,
  imports: [CommonModule, RouterModule, LucideAngularModule, ButtonComponent],
  templateUrl: './forbidden.html',
  styleUrl: './forbidden.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForbiddenComponent {
  protected readonly icons = {
    ShieldX,
    ArrowLeft,
  };
}
