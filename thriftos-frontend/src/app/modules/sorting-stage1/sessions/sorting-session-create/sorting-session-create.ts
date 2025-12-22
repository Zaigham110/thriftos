/**
 * Sorting Session Create Component
 * Phase 3: Category Sorting UI
 * 
 * Create new sorting session by selecting a procurement source
 */

import { Component, OnInit, ChangeDetectionStrategy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, ArrowLeft, Package, Box, CheckCircle, AlertCircle } from 'lucide-angular';

import {
  CardComponent,
  ButtonComponent,
  BadgeComponent,
  BreadcrumbComponent,
  AlertComponent,
  SkeletonComponent,
  BreadcrumbItem,
} from '../../../../shared/ui';
import { SortingStage1Service } from '../../sorting-stage1.service';
import { SortableSource, CreateSortSessionRequest } from '../../sorting-stage1.models';

@Component({
  selector: 'app-sorting-session-create',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    LucideAngularModule,
    CardComponent,
    ButtonComponent,
    BadgeComponent,
    BreadcrumbComponent,
    AlertComponent,
    SkeletonComponent,
  ],
  templateUrl: './sorting-session-create.html',
  styleUrl: './sorting-session-create.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SortingSessionCreateComponent implements OnInit {
  private readonly sortingService = inject(SortingStage1Service);
  private readonly router = inject(Router);

  // Icons
  readonly icons = {
    ArrowLeft,
    Package,
    Box,
    CheckCircle,
    AlertCircle,
  };

  // Breadcrumbs
  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Home', link: '/app/dashboard' },
    { label: 'Sorting Stage 1', link: '/app/sorting/stage1' },
    { label: 'Create Session' },
  ];

  // State
  readonly loading = this.sortingService.loading;
  readonly error = this.sortingService.error;
  readonly sortableSources = this.sortingService.sortableSources;

  // Form state
  readonly selectedSourceId = signal<string | null>(null);
  readonly isSubmitting = signal(false);

  // Computed selected source
  get selectedSource(): SortableSource | null {
    const id = this.selectedSourceId();
    if (!id) return null;
    return this.sortableSources().find((s) => s.id === id) || null;
  }

  ngOnInit(): void {
    this.loadSources();
  }

  loadSources(): void {
    this.sortingService.loadSortableSources().subscribe();
  }

  onSourceSelect(sourceId: string): void {
    this.selectedSourceId.set(sourceId);
  }

  onSubmit(): void {
    const source = this.selectedSource;
    if (!source) return;

    this.isSubmitting.set(true);

    const request: CreateSortSessionRequest = {};
    if (source.type === 'rag') {
      request.ragId = source.id;
    } else {
      request.incomingBaleId = source.id;
    }

    this.sortingService.createSession(request).subscribe({
      next: (session) => {
        this.isSubmitting.set(false);
        // Navigate to the workspace
        this.router.navigate(['/app/sorting/stage1', session.id]);
      },
      error: () => {
        this.isSubmitting.set(false);
      },
    });
  }

  onCancel(): void {
    this.router.navigate(['/app/sorting/stage1']);
  }

  formatWeight(weight: number): string {
    return `${weight.toFixed(2)} kg`;
  }

  dismissError(): void {
    this.sortingService.clearError();
  }
}
