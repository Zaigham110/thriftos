import { ChangeDetectionStrategy, Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule, DatePipe, CurrencyPipe, DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ProcurementService } from '../../procurement.service';
import { IncomingBale } from '../../procurement.models';
import { AuthService } from '../../../../core/auth/auth';
import { TenantService } from '../../../../core/tenant/tenant.service';
import {
  AppBadgeComponent,
  AppBreadcrumbComponent,
  AppButtonComponent,
  AppCardComponent,
  AppDialogComponent,
  AppErrorStateComponent,
  AppLinkComponent,
  AppLoadingComponent,
  AppPageBodyComponent,
  AppPageComponent,
  AppPageHeaderComponent,
  AppSectionBodyComponent,
  AppSectionComponent,
  AppSectionHeaderComponent,
  AppSplitAsideComponent,
  AppSplitComponent,
  AppSplitMainComponent,
  AppStackComponent,
  type BreadcrumbItem,
} from '../../../../shared/ui';

@Component({
  selector: 'app-incoming-bale-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    AppPageComponent,
    AppPageHeaderComponent,
    AppPageBodyComponent,
    AppSectionComponent,
    AppSectionHeaderComponent,
    AppSectionBodyComponent,
    AppStackComponent,
    AppBreadcrumbComponent,
    AppButtonComponent,
    AppCardComponent,
    AppBadgeComponent,
    AppLoadingComponent,
    AppErrorStateComponent,
    AppDialogComponent,
    AppLinkComponent,
    AppSplitComponent,
    AppSplitMainComponent,
    AppSplitAsideComponent,
    DatePipe,
    CurrencyPipe,
    DecimalPipe,
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
  
  readonly breadcrumbs = computed<BreadcrumbItem[]>(() => {
    const b = this.bale();
    return [
      { label: 'Home', route: '/dashboard' },
      { label: 'Procurement', route: '/procurement/dashboard' },
      { label: 'Loose Bales', route: '/procurement/loose-bales' },
      { label: b ? b.baleCode : 'Loading...' },
    ];
  });

  readonly currencyCode = computed(() => 
    this.bale()?.purchaseOrder?.currency || 
    this.tenantService.tenant()?.currencyCode || 
    '—'
  );

  readonly costPerKg = computed(() => {
    const b = this.bale();
    if (!b || b.weightKg === 0) return 0;
    return b.cost / b.weightKg;
  });

  readonly canEdit = computed(() => {
    const b = this.bale();
    if (!b) return false;
    // Check permissions
    const permissions = this.authService.permissions();
    const isSuperAdmin = this.authService.isSuperAdmin();
    const hasPermission = permissions.includes('po.update') || isSuperAdmin;
    if (!hasPermission) return false;
    // Cannot edit if bale has been sorted
    if (b.sortSessions && b.sortSessions.length > 0) return false;
    // Cannot edit if PO is closed
    if (b.purchaseOrder?.status === 'CLOSED') return false;
    return true;
  });

  canDelete = false;

  ngOnInit(): void {
    this.checkPermissions();
    this.loadBale();
    this.tenantService.loadTenant().subscribe();
  }

  private checkPermissions(): void {
    const permissions = this.authService.permissions();
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
        console.log('Bale data received:', bale);
        console.log('Purchase Order:', bale.purchaseOrder);
        console.log('Purchase Order ID:', bale.purchaseOrderId);
        this.bale.set(bale);
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
        this.router.navigate(['/procurement/loose-bales']);
      },
      error: (err) => {
        this.deleting.set(false);
        this.error.set(err.error?.message || 'Failed to delete bale');
        this.showDeleteDialog.set(false);
      },
    });
  }
}
