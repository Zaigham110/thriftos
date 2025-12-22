/**
 * Incoming Bale List Component
 * Phase 2: Procurement UI
 * 
 * Route: /app/procurement/incoming-bales
 */

import { Component, OnInit, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LucideAngularModule, Plus, Package, Search, Eye } from 'lucide-angular';
import { ProcurementService } from '../../procurement.service';
import { IncomingBale } from '../../procurement.models';
import { AuthService } from '../../../../core/auth/auth';
import {
  CardComponent,
  AlertComponent,
  BreadcrumbComponent,
  BreadcrumbItem,
  BadgeComponent,
  SkeletonComponent,
  EmptyStateComponent,
} from '../../../../shared/ui';

@Component({
  selector: 'app-incoming-bale-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    LucideAngularModule,
    CardComponent,
    AlertComponent,
    BreadcrumbComponent,
    BadgeComponent,
    SkeletonComponent,
    EmptyStateComponent,
  ],
  templateUrl: './incoming-bale-list.html',
  styleUrl: './incoming-bale-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IncomingBaleListComponent implements OnInit {
  private procurementService = inject(ProcurementService);
  private authService = inject(AuthService);

  readonly icons = {
    Plus,
    Package,
    Search,
    Eye,
  };

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Home', link: '/app/dashboard' },
    { label: 'Procurement', link: '/app/procurement' },
    { label: 'Incoming Bales' },
  ];

  readonly incomingBales = this.procurementService.incomingBales;
  readonly loading = this.procurementService.loading;
  readonly error = this.procurementService.error;

  canCreate = false;

  ngOnInit(): void {
    this.checkPermissions();
    this.loadBales();
  }

  private checkPermissions(): void {
    const permissions = this.authService.permissions();
    this.canCreate = permissions.includes('po.create') || this.authService.isSuperAdmin();
  }

  loadBales(): void {
    this.procurementService.loadIncomingBales().subscribe();
  }

  formatWeight(weightKg: number): string {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(weightKg);
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  }

  formatDate(date: string | Date): string {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(date));
  }
}
