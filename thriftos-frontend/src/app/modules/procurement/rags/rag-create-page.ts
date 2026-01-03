import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';

import { ProcurementService } from '../procurement.service';
import { Container } from '../procurement.models';
import { RagService } from './rag.service';

import {
  AppBreadcrumbComponent,
  AppButtonComponent,
  AppErrorStateComponent,
  AppLoadingComponent,
  AppPageBodyComponent,
  AppPageComponent,
  AppPageHeaderComponent,
  AppStackComponent,
  type BreadcrumbItem,
} from '../../../shared/ui';

import { RagCreateDrawerComponent } from './rag-create-drawer';

@Component({
  selector: 'app-rag-create-page',
  standalone: true,
  imports: [
    CommonModule,
    AppPageComponent,
    AppPageHeaderComponent,
    AppPageBodyComponent,
    AppBreadcrumbComponent,
    AppStackComponent,
    AppButtonComponent,
    AppLoadingComponent,
    AppErrorStateComponent,
    RagCreateDrawerComponent,
  ],
  templateUrl: './rag-create-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RagCreatePageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly procurementService = inject(ProcurementService);
  private readonly ragService = inject(RagService);

  readonly container = signal<Container | null>(null);
  readonly ragsWeightTotal = signal<number>(0);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly breadcrumbs = computed<BreadcrumbItem[]>(() => {
    const cont = this.container();
    const label = cont?.containerNumber || 'Container';
    const id = cont?.id;
    return [
      { label: 'Home', route: '/dashboard' },
      { label: 'Procurement', route: '/procurement/dashboard' },
      { label: 'Containers', route: '/procurement/containers' },
      { label, route: id ? `/procurement/containers/${id}` : '/procurement/containers' },
      { label: 'Add rag / bale', route: '' },
    ];
  });

  ngOnInit(): void {
    this.loadContext();
  }

  private loadContext(): void {
    const containerId = this.route.snapshot.paramMap.get('id');
    if (!containerId) {
      this.error.set('Invalid container ID');
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.procurementService.getContainer(containerId).subscribe({
      next: (container) => {
        this.container.set(container);

        this.ragService.getRagsForContainer(containerId, { limit: 200 }).subscribe({
          next: (resp) => {
            const total = resp.data.reduce((sum, r) => sum + Number(r.weightKg), 0);
            this.ragsWeightTotal.set(total);
            this.loading.set(false);
          },
          error: () => {
            this.ragsWeightTotal.set(0);
            this.loading.set(false);
          },
        });
      },
      error: (err) => {
        this.error.set(err.message || 'Failed to load container');
        this.loading.set(false);
      },
    });
  }

  onCreated(): void {
    const cont = this.container();
    if (!cont) return;
    this.router.navigate(['/procurement/containers', cont.id]);
  }

  onCancel(): void {
    const cont = this.container();
    if (cont) {
      this.router.navigate(['/procurement/containers', cont.id]);
      return;
    }
    this.router.navigate(['/procurement/containers']);
  }
}
