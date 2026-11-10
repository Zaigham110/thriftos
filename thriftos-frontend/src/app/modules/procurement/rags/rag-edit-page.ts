/**
 * Rag Edit Page Component
 * Phase 2: Procurement & Intake UI
 * 
 * Route: /app/procurement/rags/:ragId/edit
 * 
 * Page wrapper to update weight or notes for an existing intake rag or bale.
 */

import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { LucideAngularModule, ArrowLeft } from 'lucide-angular';

import { RagService } from './rag.service';
import { Rag } from './rag.models';

import {
  AppPageComponent,
  AppPageHeaderComponent,
  AppPageBodyComponent,
  AppBreadcrumbComponent,
  AppLoadingComponent,
  AppErrorStateComponent,
} from '../../../shared/ui';

import { RagEditDrawerComponent } from './rag-edit-drawer';

@Component({
  selector: 'app-rag-edit-page',
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

  readonly icons = {
    ArrowLeft,
  };

  readonly breadcrumbs = computed(() => {
    const rag = this.rag();
    const containerId = rag?.containerId;
    const containerLabel = rag?.container?.containerNumber || 'Container';
    return [
      { label: 'Procurement', route: '/receive/records' },
      ...(containerId
        ? [{ label: 'Containers', route: '/receive/records/containers' }, { label: containerLabel, route: `/receive/records/containers/${containerId}` }]
        : [{ label: 'Loose lots', route: '/receive/records/lots' }]),
      { label: 'Edit Intake Item' },
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
        this.error.set(err.message || 'Failed to load rag item');
        this.loading.set(false);
      },
    });
  }

  onUpdated(): void {
    const rag = this.rag();
    if (rag?.containerId) {
      this.router.navigate(['/receive/records/containers', rag.containerId]);
      return;
    }
    this.router.navigate(['/receive/records/lots']);
  }

  onCancel(): void {
    this.onUpdated();
  }
}
