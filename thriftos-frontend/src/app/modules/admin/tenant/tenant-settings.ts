/**
 * Tenant Settings Component
 * Phase 8: Tenant Administration
 * 
 * Route: /app/admin/tenant
 * 
 * Displays tenant profile, system resource statistics, and currency settings.
 */

import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import {
  LucideAngularModule,
  Building2,
  Users,
  Shield,
  Layers,
  Package,
  Warehouse,
  RefreshCw,
  Info,
  Lock,
  Globe,
  DollarSign,
  Save,
  Loader2,
} from 'lucide-angular';

import { AdminService } from '../admin.service';
import { Lang, LANGS } from '../../../core/i18n/i18n.service';
import { TenantModule } from '../admin.models';
import {
  AppPageComponent,
  AppPageHeaderComponent,
  AppPageBodyComponent,
  AppBreadcrumbComponent,
  AppLoadingComponent,
  AppErrorStateComponent,
} from '../../../shared/ui';

const DEFAULT_MODULES: TenantModule[] = ['RECEIVE', 'SORT', 'STOCK', 'SELL', 'KHATA'];

@Component({
  selector: 'app-tenant-settings',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    ReactiveFormsModule,
    LucideAngularModule,
    AppPageComponent,
    AppPageHeaderComponent,
    AppPageBodyComponent,
    AppBreadcrumbComponent,
    AppLoadingComponent,
    AppErrorStateComponent,
  ],
  templateUrl: './tenant-settings.html',
  styleUrl: './tenant-settings.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TenantSettingsComponent implements OnInit {
  private readonly adminService = inject(AdminService);

  readonly saving = signal(false);
  readonly currencyCodeControl = new FormControl<string>('USD', { nonNullable: true });
  readonly sortingStagesControl = new FormControl<number>(2, { nonNullable: true });
  readonly langs = LANGS;
  readonly defaultLanguageControl = new FormControl<Lang>('ur', { nonNullable: true });
  readonly modulesControl = new FormControl<TenantModule[]>(DEFAULT_MODULES, { nonNullable: true });

  readonly currencyOptions = [
    { value: 'USD', label: 'USD - US Dollar ($)' },
    { value: 'PKR', label: 'PKR - Pakistani Rupee (Rs)' },
  ];

  readonly sortingStageOptions = [
    { value: 0, label: 'No sorting (buy and sell ready stock)' },
    { value: 1, label: 'Sort into categories' },
    { value: 2, label: 'Sort into categories, then grades' },
  ];

  readonly moduleOptions: ReadonlyArray<{ value: TenantModule; label: string; desc: string }> = [
    { value: 'RECEIVE', label: 'Maal aya (Receive)', desc: 'Containers, lots and ready stock' },
    { value: 'SORT', label: 'Chhantai (Sort)', desc: 'Sort lots into categories and grades' },
    { value: 'STOCK', label: 'Stock', desc: 'Bales, QR labels and stock' },
    { value: 'SELL', label: 'Becho (Sell)', desc: 'Sales and bills' },
    { value: 'KHATA', label: 'Khata', desc: 'Customer balances and payments' },
    { value: 'REPORTS', label: 'Reports', desc: 'Detailed reports (advanced)' },
    { value: 'EXPORT', label: 'Export', desc: 'Export sales (advanced)' },
    { value: 'WAREHOUSES', label: 'Warehouses', desc: 'More than one store (advanced)' },
    { value: 'PURCHASE_ORDERS', label: 'Purchase orders', desc: 'Orders to suppliers before the container ships (advanced)' },
    { value: 'PAYROLL', label: 'Payroll', desc: 'Piece-rate pay (later)' },
  ];

  readonly icons = {
    Building2,
    Users,
    Shield,
    Layers,
    Package,
    Warehouse,
    RefreshCw,
    Info,
    Lock,
    Globe,
    DollarSign,
    Save,
    Loader2,
  };

  readonly tenant = this.adminService.tenant;
  readonly tenantStats = this.adminService.tenantStats;
  readonly loading = this.adminService.loading;
  readonly error = this.adminService.error;

  readonly breadcrumbs = [
    { label: 'Administration', route: '/settings/admin' },
    { label: 'Tenant Settings' },
  ];

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.adminService.loadTenant().subscribe({
      next: (tenant) => {
        this.currencyCodeControl.setValue(tenant.currencyCode, { emitEvent: false });
        this.syncWorkSettings(tenant);
      },
    });
    this.adminService.loadTenantStats().subscribe();
  }

  clearError(): void {
    this.adminService.clearError();
  }

  refresh(): void {
    this.loadData();
  }

  readonly currencyLocked = computed(() => !!this.tenant()?.currencyLocked);

  readonly currencyChanged = computed(() => {
    const tenant = this.tenant();
    if (!tenant) return false;
    return this.currencyCodeControl.value !== tenant.currencyCode;
  });

  /** A method, not computed(): FormControl values are not signals. */
  workSettingsChanged(): boolean {
    const tenant = this.tenant();
    if (!tenant) return false;
    const saved = tenant.enabledModules ?? DEFAULT_MODULES;
    const selected = this.modulesControl.value;
    return this.sortingStagesControl.value !== (tenant.sortingStages ?? 2)
      || this.defaultLanguageControl.value !== (tenant.defaultLanguage ?? 'ur')
      || selected.length !== saved.length
      || selected.some((module) => !saved.includes(module));
  }

  isModuleEnabled(module: TenantModule): boolean {
    return this.modulesControl.value.includes(module);
  }

  toggleModule(module: TenantModule): void {
    const current = this.modulesControl.value;
    this.modulesControl.setValue(current.includes(module) ? current.filter((value) => value !== module) : [...current, module]);
  }

  saveCurrency(): void {
    const tenant = this.tenant();
    if (!tenant) return;
    if (this.currencyLocked()) return;

    const currencyCode = this.currencyCodeControl.value;
    if (currencyCode === tenant.currencyCode) return;

    this.saving.set(true);
    this.adminService.updateTenantSettings({ currencyCode }).subscribe({
      next: (updated) => {
        this.currencyCodeControl.setValue(updated.currencyCode, { emitEvent: false });
        this.saving.set(false);
      },
      error: () => this.saving.set(false),
    });
  }

  saveWorkSettings(): void {
    if (!this.tenant()) return;
    this.saving.set(true);
    this.adminService.updateTenantSettings({
      sortingStages: this.sortingStagesControl.value,
      defaultLanguage: this.defaultLanguageControl.value,
      enabledModules: this.modulesControl.value,
    }).subscribe({
      next: (updated) => {
        this.syncWorkSettings(updated);
        this.saving.set(false);
      },
      error: () => this.saving.set(false),
    });
  }

  private syncWorkSettings(tenant: { sortingStages?: number; defaultLanguage?: Lang; enabledModules?: TenantModule[] }): void {
    this.sortingStagesControl.setValue(tenant.sortingStages ?? 2, { emitEvent: false });
    this.defaultLanguageControl.setValue(tenant.defaultLanguage ?? 'ur', { emitEvent: false });
    this.modulesControl.setValue(tenant.enabledModules ?? DEFAULT_MODULES, { emitEvent: false });
  }
}
