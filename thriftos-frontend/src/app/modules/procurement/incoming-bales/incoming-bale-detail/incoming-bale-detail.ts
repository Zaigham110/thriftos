/**
 * Incoming Bale Detail Component
 * Phase 2: Procurement UI
 * 
 * Route: /app/procurement/incoming-bales/:id
 */

import { Component, OnInit, inject, signal, ChangeDetectionStrategy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LucideAngularModule, ArrowLeft, Edit, Trash2, Package, Calendar, Scale, DollarSign } from 'lucide-angular';
import { ProcurementService } from '../../procurement.service';
import { IncomingBale } from '../../procurement.models';
import { AuthService } from '../../../../core/auth/auth';
import { TenantService } from '../../../../core/tenant/tenant.service';
import {
  CardComponent,
  ButtonComponent,
  AlertComponent,
  BreadcrumbComponent,
  BreadcrumbItem,
  BadgeComponent,
  SkeletonComponent,
  ModalComponent,
} from '../../../../shared/ui';

@Component({
  selector: 'app-incoming-bale-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    LucideAngularModule,
    CardComponent,
    ButtonComponent,
    AlertComponent,
    BreadcrumbComponent,
    BadgeComponent,
    SkeletonComponent,
    ModalComponent,
  ],
  templateUrl: './incoming-bale-detail.html',
  styleUrl: './incoming-bale-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IncomingBaleDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private procurementService = inject(ProcurementService);
  private authService = inject(AuthService);
  private tenantService = inject(TenantService);

  readonly icons = {
    ArrowLeft,
    Edit,
    Trash2,
    Package,
    Calendar,
    Scale,
    DollarSign,
  };

  breadcrumbs: BreadcrumbItem[] = [
    { label: 'Home', link: '/app/dashboard' },
    { label: 'Procurement', link: '/app/procurement' },
    { label: 'Incoming Bales', link: '/app/procurement/incoming-bales' },
    { label: 'Loading...' },
  ];

  bale = signal<IncomingBale | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);
  deleting = signal(false);
  showDeleteDialog = signal(false);
  readonly currencyCode = computed(() => this.bale()?.purchaseOrder?.currency || this.tenantService.tenant()?.currency || 'USD');

  canEdit = false;
  canDelete = false;

  ngOnInit(): void {
    this.checkPermissions();
    this.loadBale();
    this.tenantService.loadTenant().subscribe();
  }

  private checkPermissions(): void {
    const permissions = this.authService.permissions();
    const isSuperAdmin = this.authService.isSuperAdmin();
    this.canEdit = permissions.includes('po.update') || isSuperAdmin;
    this.canDelete = isSuperAdmin;
  }

  private loadBale(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error.set('Bale ID not found');
      this.loading.set(false);
      return;
    }

    this.procurementService.getIncomingBale(id).subscribe({
      next: (bale: IncomingBale) => {
        this.bale.set(bale);
        this.breadcrumbs = [
          ...this.breadcrumbs.slice(0, -1),
          { label: bale.baleCode },
        ];
        this.loading.set(false);
      },
      error: (err: { error?: { message?: string } }) => {
        this.error.set(err.error?.message || 'Failed to load bale');
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
        this.router.navigate(['/app/procurement/incoming-bales']);
      },
      error: (err) => {
        this.deleting.set(false);
        this.error.set(err.error?.message || 'Failed to delete bale');
        this.showDeleteDialog.set(false);
      },
    });
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
      currency: this.currencyCode(),
    }).format(amount);
  }

  formatDate(date: string | Date): string {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));
  }

  get costPerKg(): number {
    const bale = this.bale();
    if (!bale || bale.weightKg === 0) return 0;
    return bale.cost / bale.weightKg;
  }
}
