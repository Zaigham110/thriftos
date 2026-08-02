import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';
import {
  LucideAngularModule,
  Tag,
  CheckCircle2,
  Users,
  Warehouse,
  Container,
  Zap,
  RefreshCw,
  Plus,
  Building2,
} from 'lucide-angular';

import { SuperAdminDataService, type PlanItem } from '../super-admin-data.service';
import {
  AppPageComponent,
  AppPageHeaderComponent,
  AppPageBodyComponent,
  AppSectionComponent,
  AppGridComponent,
  AppLoadingComponent,
  AppErrorStateComponent,
} from '../../../../shared/ui';

@Component({
  selector: 'app-plans-management',
  standalone: true,
  imports: [
    CommonModule,
    CurrencyPipe,
    LucideAngularModule,
    AppPageComponent,
    AppPageHeaderComponent,
    AppPageBodyComponent,
    AppSectionComponent,
    AppGridComponent,
    AppLoadingComponent,
    AppErrorStateComponent,
  ],
  templateUrl: './plans-management.component.html',
  styleUrl: './plans-management.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlansManagementComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly data = inject(SuperAdminDataService);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly plans = signal<PlanItem[]>([]);

  readonly icons = {
    Tag,
    CheckCircle2,
    Users,
    Warehouse,
    Container,
    Zap,
    RefreshCw,
    Plus,
    Building2,
  };

  ngOnInit(): void {
    this.loadPlans();
  }

  loadPlans(): void {
    this.loading.set(true);
    this.error.set(null);

    this.data
      .getPlans()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError((err) => {
          this.error.set(err?.error?.message || err?.message || 'Failed to load subscription plans catalog');
          this.loading.set(false);
          return of(null);
        }),
      )
      .subscribe((res) => {
        if (res) this.plans.set(res.data || []);
        this.loading.set(false);
      });
  }
}
