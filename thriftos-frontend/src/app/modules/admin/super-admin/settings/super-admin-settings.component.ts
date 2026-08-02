import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';
import {
  LucideAngularModule,
  Settings,
  Save,
  Loader2,
  Shield,
  Database,
  Lock,
  Mail,
  Building2,
  AlertTriangle,
} from 'lucide-angular';

import { SuperAdminDataService, type SystemSettings } from '../super-admin-data.service';
import {
  AppPageComponent,
  AppPageHeaderComponent,
  AppPageBodyComponent,
  AppSectionComponent,
  AppSectionHeaderComponent,
  AppSectionBodyComponent,
  AppLoadingComponent,
  AppErrorStateComponent,
  AlertComponent,
} from '../../../../shared/ui';

@Component({
  selector: 'app-super-admin-settings',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    LucideAngularModule,
    AppPageComponent,
    AppPageHeaderComponent,
    AppPageBodyComponent,
    AppSectionComponent,
    AppSectionHeaderComponent,
    AppSectionBodyComponent,
    AppLoadingComponent,
    AppErrorStateComponent,
    AlertComponent,
  ],
  templateUrl: './super-admin-settings.component.html',
  styleUrl: './super-admin-settings.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SuperAdminSettingsComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly data = inject(SuperAdminDataService);
  private readonly fb = inject(FormBuilder);

  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);

  protected readonly form: FormGroup;

  readonly icons = {
    Settings,
    Save,
    Loader2,
    Shield,
    Database,
    Lock,
    Mail,
    Building2,
    AlertTriangle,
  };

  constructor() {
    this.form = this.fb.group({
      platformName: ['', Validators.required],
      supportEmail: ['', [Validators.required, Validators.email]],
      companyLegalName: ['', Validators.required],
      sessionTimeoutMinutes: [60, [Validators.required, Validators.min(5)]],
      require2FAForAdmins: [true],
      auditLogRetentionDays: [365, Validators.required],
      maintenanceMode: [false],
    });
  }

  ngOnInit(): void {
    this.loadSettings();
  }

  loadSettings(): void {
    this.loading.set(true);
    this.error.set(null);

    this.data
      .getSettings()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError((err) => {
          this.error.set(err?.error?.message || err?.message || 'Failed to load system settings');
          this.loading.set(false);
          return of(null);
        }),
      )
      .subscribe((res) => {
        if (res) {
          this.form.patchValue({
            platformName: res.platformName,
            supportEmail: res.supportEmail,
            companyLegalName: res.companyLegalName,
            sessionTimeoutMinutes: res.sessionTimeoutMinutes,
            require2FAForAdmins: res.require2FAForAdmins,
            auditLogRetentionDays: res.auditLogRetentionDays,
            maintenanceMode: res.maintenanceMode,
          });
        }
        this.loading.set(false);
      });
  }

  onSubmit(): void {
    if (this.form.invalid) return;

    this.saving.set(true);
    this.error.set(null);
    this.successMessage.set(null);

    this.data
      .updateSettings(this.form.value)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.successMessage.set('SuperAdmin system settings updated successfully.');
        },
        error: (err) => {
          this.saving.set(false);
          this.error.set(err?.message || 'Failed to update settings');
        },
      });
  }
}
