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
import { CapturePolicy, ConnectivityPolicy, GuidancePolicy, OperationalModule } from '../admin.models';
import {
  AppPageComponent,
  AppPageHeaderComponent,
  AppPageBodyComponent,
  AppBreadcrumbComponent,
  AppLoadingComponent,
  AppErrorStateComponent,
} from '../../../shared/ui';

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
  readonly operationModeControl = new FormControl<'FULL_ERP' | 'SIMPLIFIED_MOBILE' | 'USER_CHOICE'>('FULL_ERP', { nonNullable: true });
  readonly connectivityPolicyControl = new FormControl<ConnectivityPolicy>('AUTOMATIC', { nonNullable: true });
  readonly capturePolicyControl = new FormControl<CapturePolicy>('ALL', { nonNullable: true });
  readonly guidancePolicyControl = new FormControl<GuidancePolicy>('GUIDED', { nonNullable: true });
  readonly operationalModulesControl = new FormControl<OperationalModule[]>(['WORK', 'INTAKE', 'SORTING', 'REPACK', 'STOCK', 'SALES', 'INSIGHTS', 'ADMINISTRATION'], { nonNullable: true });

  readonly currencyOptions = [
    { value: 'USD', label: 'USD - US Dollar ($)' },
    { value: 'PKR', label: 'PKR - Pakistani Rupee (Rs)' },
  ];

  readonly modeOptions = [
    { value: 'FULL_ERP', label: 'Full Desktop ERP Mode', desc: 'Standard high-density enterprise ERP interface' },
    { value: 'SIMPLIFIED_MOBILE', label: 'Simplified Mobile Mode', desc: 'Touch-optimized mobile interface for warehouse floor operators' },
    { value: 'USER_CHOICE', label: 'User Choice (Allow Switcher)', desc: 'Users can freely toggle between Full ERP and Simplified Mobile Mode' },
  ];

  readonly connectivityOptions = [
    { value: 'AUTOMATIC', label: 'Automatic', desc: 'Use offline drafts whenever the connection is interrupted.' },
    { value: 'ONLINE_ONLY', label: 'Online only', desc: 'Require a live connection before operational changes can be saved.' },
    { value: 'OFFLINE_CAPABLE', label: 'Offline capable', desc: 'Always allow local drafts and queued sync.' },
  ] as const;

  readonly captureOptions = [
    { value: 'ALL', label: 'All capture methods' },
    { value: 'HARDWARE_SCANNER', label: 'Hardware scanner only' },
    { value: 'CAMERA_SCAN', label: 'Camera scan only' },
    { value: 'MANUAL_ENTRY', label: 'Manual entry only' },
  ] as const;

  readonly guidanceOptions = [
    { value: 'GUIDED', label: 'Guided', desc: 'Recommend the next valid action while allowing permitted choices.' },
    { value: 'FLEXIBLE', label: 'Flexible', desc: 'Show all permitted actions without a prescribed sequence.' },
    { value: 'STRICT', label: 'Strict', desc: 'Require the recommended operational sequence.' },
  ] as const;

  readonly operationalModuleOptions: ReadonlyArray<{ value: OperationalModule; label: string; desc: string }> = [
    { value: 'WORK', label: 'My Work', desc: 'Personal queue and exceptions' },
    { value: 'INTAKE', label: 'Intake', desc: 'Material receiving and supplier intake' },
    { value: 'SORTING', label: 'Sorting', desc: 'Category and grade processing' },
    { value: 'REPACK', label: 'Repack', desc: 'Sealed sellable-unit creation' },
    { value: 'STOCK', label: 'Stock', desc: 'Inventory lookup and traceability' },
    { value: 'SALES', label: 'Sales', desc: 'Reservation, sale and fulfillment' },
    { value: 'INSIGHTS', label: 'Insights', desc: 'Operational reports' },
    { value: 'ADMINISTRATION', label: 'Administration', desc: 'Tenant administration' },
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
    { label: 'Administration', route: '/app/admin' },
    { label: 'Tenant Settings' },
  ];

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.adminService.loadTenant().subscribe({
      next: (tenant) => {
        this.currencyCodeControl.setValue(tenant.currencyCode, { emitEvent: false });
        this.operationModeControl.setValue(tenant.operationMode || 'FULL_ERP', { emitEvent: false });
        this.connectivityPolicyControl.setValue(tenant.connectivityPolicy || 'AUTOMATIC', { emitEvent: false });
        this.capturePolicyControl.setValue(tenant.capturePolicy || 'ALL', { emitEvent: false });
        this.guidancePolicyControl.setValue(tenant.guidancePolicy || 'GUIDED', { emitEvent: false });
        this.operationalModulesControl.setValue(tenant.operationalModules?.length ? tenant.operationalModules : this.operationalModuleOptions.map((module) => module.value), { emitEvent: false });
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

  readonly modeChanged = computed(() => {
    const tenant = this.tenant();
    if (!tenant) return false;
    return this.operationModeControl.value !== (tenant.operationMode || 'FULL_ERP');
  });

  readonly operationalProfileChanged = computed(() => {
    const tenant = this.tenant();
    if (!tenant) return false;
    return this.connectivityPolicyControl.value !== (tenant.connectivityPolicy || 'AUTOMATIC')
      || this.capturePolicyControl.value !== (tenant.capturePolicy || 'ALL')
      || this.guidancePolicyControl.value !== (tenant.guidancePolicy || 'GUIDED')
      || !this.sameModules(this.operationalModulesControl.value, tenant.operationalModules);
  });

  isOperationalModuleEnabled(module: OperationalModule): boolean {
    return this.operationalModulesControl.value.includes(module);
  }

  toggleOperationalModule(module: OperationalModule): void {
    if (module === 'WORK') return;
    const current = this.operationalModulesControl.value;
    this.operationalModulesControl.setValue(
      current.includes(module) ? current.filter((value) => value !== module) : [...current, module],
    );
  }

  private sameModules(selected: OperationalModule[], saved?: OperationalModule[]): boolean {
    const baseline = saved?.length ? saved : this.operationalModuleOptions.map((module) => module.value);
    return selected.length === baseline.length && selected.every((module) => baseline.includes(module));
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

  saveOperationMode(): void {
    const tenant = this.tenant();
    if (!tenant) return;

    const operationMode = this.operationModeControl.value;
    this.saving.set(true);

    this.adminService.updateTenantSettings({ operationMode }).subscribe({
      next: (updated) => {
        this.operationModeControl.setValue(updated.operationMode || 'FULL_ERP', { emitEvent: false });
        this.saving.set(false);
      },
      error: () => this.saving.set(false),
    });
  }

  saveOperationalProfile(): void {
    if (!this.tenant()) return;

    this.saving.set(true);
    this.adminService.updateTenantSettings({
      connectivityPolicy: this.connectivityPolicyControl.value,
      capturePolicy: this.capturePolicyControl.value,
      guidancePolicy: this.guidancePolicyControl.value,
      operationalModules: this.operationalModulesControl.value,
    }).subscribe({
      next: (updated) => {
        this.connectivityPolicyControl.setValue(updated.connectivityPolicy || 'AUTOMATIC', { emitEvent: false });
        this.capturePolicyControl.setValue(updated.capturePolicy || 'ALL', { emitEvent: false });
        this.guidancePolicyControl.setValue(updated.guidancePolicy || 'GUIDED', { emitEvent: false });
        this.operationalModulesControl.setValue(updated.operationalModules?.length ? updated.operationalModules : this.operationalModuleOptions.map((module) => module.value), { emitEvent: false });
        this.saving.set(false);
      },
      error: () => this.saving.set(false),
    });
  }
}
