/**
 * Dashboard Component - Main tenant dashboard placeholder
 * Phase 1: Authentication & Shell (placeholder for future phases)
 */

import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, LayoutDashboard, Package, ArrowRightLeft, BarChart3 } from 'lucide-angular';
import { AuthService } from '../../../core/auth';
import { CardComponent } from '../../../shared/ui/card/card';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, CardComponent],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent {
  protected readonly icons = {
    LayoutDashboard,
    Package,
    ArrowRightLeft,
    BarChart3,
  };

  protected readonly userName = computed(() => this.authService.user()?.name ?? 'User');
  protected readonly isImpersonating = computed(() => this.authService.isImpersonating());
  protected readonly tenantId = computed(() => this.authService.user()?.tenantId);

  constructor(private readonly authService: AuthService) {}
}
