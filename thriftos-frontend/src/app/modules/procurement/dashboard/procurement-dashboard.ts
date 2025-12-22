/**
 * Procurement Dashboard Component
 * Phase 2: Procurement UI
 * 
 * Landing page showing procurement overview stats
 * Route: /app/procurement
 */

import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LucideAngularModule, Plus, FileText, Box, Package, Scale, DollarSign, PlusCircle, PackagePlus, Truck, FolderOpen } from 'lucide-angular';
import { ProcurementService } from '../procurement.service';
import { ProcurementStats } from '../procurement.models';
import { AuthService } from '../../../core/auth/auth';
import {
  CardComponent,
  ButtonComponent,
  AlertComponent,
  BreadcrumbComponent,
  BreadcrumbItem,
  SkeletonComponent,
} from '../../../shared/ui';

@Component({
  selector: 'app-procurement-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    LucideAngularModule,
    CurrencyPipe,
    CardComponent,
    ButtonComponent,
    AlertComponent,
    BreadcrumbComponent,
    SkeletonComponent,
  ],
  templateUrl: './procurement-dashboard.html',
  styleUrl: './procurement-dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProcurementDashboardComponent implements OnInit {
  private readonly procurementService = inject(ProcurementService);
  private readonly authService = inject(AuthService);

  readonly icons = {
    Plus,
    FileText,
    Box,
    Package,
    Scale,
    DollarSign,
    PlusCircle,
    PackagePlus,
    Truck,
    FolderOpen,
  };

  readonly stats = signal<ProcurementStats | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Home', link: '/app/dashboard' },
    { label: 'Procurement' },
  ];

  readonly canCreate = signal(false);

  ngOnInit(): void {
    this.checkPermissions();
    this.loadStats();
  }

  private checkPermissions(): void {
    const permissions = this.authService.permissions();
    this.canCreate.set(
      permissions.includes('po.create') || this.authService.isSuperAdmin()
    );
  }

  loadStats(): void {
    this.loading.set(true);
    this.error.set(null);

    this.procurementService.loadStats().subscribe({
      next: (stats) => {
        this.stats.set(stats);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.message || 'Failed to load procurement stats');
        this.loading.set(false);
      },
    });
  }

  formatWeight(weight: number): string {
    if (weight >= 1000) {
      return `${(weight / 1000).toFixed(2)} T`;
    }
    return `${weight.toFixed(2)} KG`;
  }
}
