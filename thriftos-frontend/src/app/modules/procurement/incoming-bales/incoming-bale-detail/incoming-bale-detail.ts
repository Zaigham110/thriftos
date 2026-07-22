/**
 * Incoming Loose Bale Detail Component
 * Phase 2: Procurement UI
 * 
 * Overview of loose bale details, weight specs, linked purchase order, container, and timeline audit logs.
 */

import { ChangeDetectionStrategy, Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  LucideAngularModule,
  ArrowLeft,
  Pencil,
  Trash2,
  Package,
  Scale,
  DollarSign,
  Calendar,
  Truck,
  Layers,
  Building2,
} from 'lucide-angular';

import { ProcurementService } from '../../procurement.service';
import { IncomingBale } from '../../procurement.models';
import { AuthService } from '../../../../core/auth/auth';
import { TenantService } from '../../../../core/tenant/tenant.service';
import { MoneyPipe } from '../../../../core/money/money.pipe';
import {
  AppBreadcrumbComponent,
  AppDialogComponent,
  AppErrorStateComponent,
  AppLoadingComponent,
  AppPageBodyComponent,
  AppPageComponent,
  AppPageHeaderComponent,
  type BreadcrumbItem,
} from '../../../../shared/ui';

@Component({
  selector: 'app-incoming-bale-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    DatePipe,
    DecimalPipe,
    MoneyPipe,
    LucideAngularModule,
    AppPageComponent,
    AppPageHeaderComponent,
    AppPageBodyComponent,
    AppBreadcrumbComponent,
    AppLoadingComponent,
    AppErrorStateComponent,
    AppDialogComponent,
  ],
  templateUrl: './incoming-bale-detail.html',
  styleUrl: './incoming-bale-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IncomingBaleDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly procurementService = inject(ProcurementService);
  private readonly authService = inject(AuthService);
  private readonly tenantService = inject(TenantService);

  readonly bale = signal<IncomingBale | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly deleting = signal(false);
  readonly showDeleteDialog = signal(false);

  readonly icons = {
    ArrowLeft,
    Pencil,
    Trash2,
    Package,
    Scale,
    DollarSign,
    Calendar,
    Truck,
    Layers,
    Building2,
  };

  readonly breadcrumbs = computed<BreadcrumbItem[]>(() => {
    const b = this.bale();
    return [
      { label: 'Procurement', route: '/app/procurement' },
      { label: 'Loose Bales', route: '/app/procurement/loose-bales' },
      { label: b ? b.baleCode : 'Loading...' },
    ];
  });

  readonly costPerKg = computed(() => {
    const b = this.bale();
    if (!b || !b.weightKg || b.weightKg === 0) return 0;
    return (b.cost || 0) / b.weightKg;
  });

  readonly canEdit = computed(() => {
    const b = this.bale();
    if (!b) return false;
    const permissions = this.authService.permissions();
    const isSuperAdmin = this.authService.isSuperAdmin();
    const hasPermission = permissions.includes('po.update') || isSuperAdmin;
    if (!hasPermission) return false;
    if (b.sortSessions && b.sortSessions.length > 0) return false;
    if (b.purchaseOrder?.status === 'CLOSED') return false;
    return true;
  });

  canDelete = false;

  ngOnInit(): void {
    this.checkPermissions();
    this.loadBale();
  }

  private checkPermissions(): void {
    const isSuperAdmin = this.authService.isSuperAdmin();
    this.canDelete = isSuperAdmin;
  }

  loadBale(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error.set('Bale ID not found');
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.procurementService.getIncomingBale(id).subscribe({
      next: (bale: IncomingBale) => {
        this.bale.set(bale);
        this.loading.set(false);
      },
      error: (err: any) => {
        this.error.set(err.message || 'Failed to load bale');
        this.loading.set(false);
      },
    });
  }

  openDeleteDialog(): void {
    this.showDeleteDialog.set(true);
  }

  closeDeleteDialog(): void {
    this.showDeleteDialog.set(false);
  }

  confirmDelete(): void {
    const bale = this.bale();
    if (!bale) return;

    this.deleting.set(true);
    this.procurementService.deleteIncomingBale(bale.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.showDeleteDialog.set(false);
        this.router.navigate(['/app/procurement/loose-bales']);
      },
      error: (err: any) => {
        this.deleting.set(false);
        this.error.set(err.message || 'Failed to delete bale');
        this.showDeleteDialog.set(false);
      },
    });
  }
}
