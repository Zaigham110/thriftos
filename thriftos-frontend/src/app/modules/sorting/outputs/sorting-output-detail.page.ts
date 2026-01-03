import { CommonModule, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import type { GradeOutput } from '../../repack/repack.models';
import { SortingFacadeService } from '../sorting-facade.service';
import {
  AppBadgeComponent,
  AppButtonComponent,
  AppCardComponent,
  AppErrorStateComponent,
  AppLoadingComponent,
  AppPageBodyComponent,
  AppPageComponent,
  AppPageHeaderComponent,
  AppSectionBodyComponent,
  AppSectionComponent,
  AppSectionHeaderComponent,
  AppStackComponent,
} from '../../../shared/ui';

@Component({
  selector: 'app-sorting-output-detail-page',
  standalone: true,
  imports: [
    CommonModule,
    DecimalPipe,
    AppPageComponent,
    AppPageHeaderComponent,
    AppPageBodyComponent,
    AppSectionComponent,
    AppSectionHeaderComponent,
    AppSectionBodyComponent,
    AppStackComponent,
    AppCardComponent,
    AppBadgeComponent,
    AppButtonComponent,
    AppLoadingComponent,
    AppErrorStateComponent,
  ],
  templateUrl: './sorting-output-detail.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SortingOutputDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly facade = inject(SortingFacadeService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly output = signal<GradeOutput | null>(null);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error.set('Missing output id');
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.facade.output(id).subscribe({
      next: (output) => {
        this.output.set(output);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.message || 'Failed to load output');
        this.loading.set(false);
      },
    });
  }

  back(): void {
    this.router.navigate(['/sorting/outputs']);
  }

  outputCode(o: GradeOutput | null): string {
    if (!o?.id) return '—';
    return `OUT-${String(o.id).slice(0, 8).toUpperCase()}`;
  }

  statusText(o: GradeOutput | null): string {
    return String((o as any)?.status ?? 'AVAILABLE');
  }

  totalKg(o: GradeOutput | null): number {
    return Number((o as any)?.totalAmount ?? (o as any)?.weightKg ?? 0);
  }

  usedKg(o: GradeOutput | null): number {
    return Number((o as any)?.usedAmount ?? 0);
  }

  remainingKg(o: GradeOutput | null): number {
    return Number((o as any)?.remainingAmount ?? this.totalKg(o) ?? 0);
  }

  isRepackEligible(o: GradeOutput | null): boolean {
    if (!o) return false;
    return this.remainingKg(o) > 0 && this.statusText(o) !== 'DEPLETED';
  }

  startRepack(): void {
    const o = this.output();
    if (!o) return;
    this.router.navigate(['/packaging/repack/workspace'], {
      queryParams: { fromGradingOutputId: o.id },
    });
  }

  statusVariant(status: string | undefined): 'success' | 'warning' | 'default' {
    switch (status) {
      case 'AVAILABLE':
        return 'success';
      case 'PARTIALLY_USED':
        return 'warning';
      case 'DEPLETED':
      default:
        return 'default';
    }
  }
}
