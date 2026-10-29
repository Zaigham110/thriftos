/**
 * Rag Create Page Component
 * Phase 2: Procurement & Intake UI
 * 
 * Route: /app/procurement/containers/:id/rags/create
 * 
 * Wrapper page to register a new intake rag or bale.
 */

import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { LucideAngularModule, ArrowLeft } from 'lucide-angular';

import { ProcurementService } from '../procurement.service';
import { Container } from '../procurement.models';
import { RagService } from './rag.service';
import {
  AppPageComponent,
  AppPageHeaderComponent,
  AppPageBodyComponent,
  AppBreadcrumbComponent,
  AppLoadingComponent,
  AppErrorStateComponent,
} from '../../../shared/ui';

import { RagCreateDrawerComponent } from './rag-create-drawer';

@Component({
  selector: 'app-rag-create-page',
  standalone: true,
  imports: [
    CommonModule,
    LucideAngularModule,
    AppPageComponent,
    AppPageHeaderComponent,
    AppPageBodyComponent,
    AppBreadcrumbComponent,
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

  readonly icons = {
    ArrowLeft,
  };

  readonly breadcrumbs = computed(() => {
    const cont = this.container();
    const label = cont?.containerNumber || 'Container';
    const id = cont?.id;
    return [
      { label: 'Procurement', route: '/receive/records' },
      { label: 'Containers', route: '/receive/records/containers' },
      { label, route: id ? `/receive/records/containers/${id}` : '/receive/records/containers' },
      { label: 'Register Intake Item' },
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
    this.router.navigate(['/receive/records/containers', cont.id]);
  }

  onCancel(): void {
    const cont = this.container();
    if (cont) {
      this.router.navigate(['/receive/records/containers', cont.id]);
      return;
    }
    this.router.navigate(['/receive/records/containers']);
  }
}
