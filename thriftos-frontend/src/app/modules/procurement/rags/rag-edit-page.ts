import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';

import { RagService } from './rag.service';
import { Rag } from './rag.models';

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

import { RagEditDrawerComponent } from './rag-edit-drawer';

@Component({
  selector: 'app-rag-edit-page',
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
    RagEditDrawerComponent,
  ],
  templateUrl: './rag-edit-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RagEditPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly ragService = inject(RagService);

  readonly rag = signal<Rag | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly breadcrumbs = computed<BreadcrumbItem[]>(() => {
    const rag = this.rag();
    const containerId = rag?.containerId;
    const containerLabel = rag?.container?.containerNumber || 'Container';
    return [
      { label: 'Home', route: '/dashboard' },
      { label: 'Procurement', route: '/procurement/dashboard' },
      { label: 'Containers', route: '/procurement/containers' },
      { label: containerLabel, route: containerId ? `/procurement/containers/${containerId}` : '/procurement/containers' },
      { label: 'Edit rag', route: '' },
    ];
  });

  ngOnInit(): void {
    this.loadRag();
  }

  private loadRag(): void {
    const ragId = this.route.snapshot.paramMap.get('ragId');
    if (!ragId) {
      this.error.set('Invalid rag ID');
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.ragService.getRag(ragId).subscribe({
      next: (rag) => {
        this.rag.set(rag);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.message || 'Failed to load rag');
        this.loading.set(false);
      },
    });
  }

  onUpdated(): void {
    const rag = this.rag();
    if (rag?.containerId) {
      this.router.navigate(['/procurement/containers', rag.containerId]);
      return;
    }
    this.router.navigate(['/procurement/containers']);
  }

  onCancel(): void {
    this.onUpdated();
  }
}
