/**
 * Grade Management Component
 * Phase 8: Tenant Administration
 * 
 * Route: /app/admin/grades
 * 
 * Manages Stage-2 grading classifications (A, B, C, Cream, Vintage, Waste, etc.).
 */

import { ChangeDetectionStrategy, Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  LucideAngularModule,
  Award,
  CheckCircle2,
  Sparkles,
  Plus,
  RefreshCw,
  Search,
  Pencil,
  Trash2,
  Power,
  X,
  Layers,
} from 'lucide-angular';

import { AdminService } from '../admin.service';
import type { Grade } from '../admin.models';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import {
  AppPageComponent,
  AppPageHeaderComponent,
  AppPageBodyComponent,
  AppSectionComponent,
  AppBreadcrumbComponent,
  AppLoadingComponent,
  AppErrorStateComponent,
  AppEmptyStateComponent,
  AppDialogComponent,
} from '../../../shared/ui';

@Component({
  selector: 'app-grade-management',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DatePipe,
    LucideAngularModule,
    AppPageComponent,
    AppPageHeaderComponent,
    AppPageBodyComponent,
    AppSectionComponent,
    AppBreadcrumbComponent,
    AppLoadingComponent,
    AppErrorStateComponent,
    AppEmptyStateComponent,
    AppDialogComponent,
    HasPermissionDirective,
  ],
  templateUrl: './grade-management.html',
  styleUrl: './grade-management.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GradeManagementComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly router = inject(Router);

  readonly breadcrumbs = [
    { label: 'Administration', route: '/settings/admin' },
    { label: 'Grades' },
  ];

  readonly searchQuery = signal('');
  readonly loading = signal(true);
  readonly error = this.adminService.error;

  readonly confirmDeleteOpen = signal(false);
  readonly selected = signal<Grade | null>(null);
  readonly actionLoading = signal(false);

  readonly grades = this.adminService.grades;

  readonly icons = {
    Award,
    CheckCircle2,
    Sparkles,
    Plus,
    RefreshCw,
    Search,
    Pencil,
    Trash2,
    Power,
    X,
    Layers,
  };

  // KPI Calculations
  readonly totalGradesCount = computed(() => this.grades().length);
  readonly activeGradesCount = computed(
    () => this.grades().filter((g) => g.isActive).length
  );
  readonly topRankedGrade = computed(() => {
    const sorted = [...this.grades()].sort((a, b) => a.rank - b.rank);
    return sorted.length > 0 ? sorted[0].name : '—';
  });

  readonly filteredGrades = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    if (!query) return this.grades();

    return this.grades().filter(
      (g) =>
        g.name.toLowerCase().includes(query) ||
        (g.description || '').toLowerCase().includes(query)
    );
  });

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    this.adminService.loadGrades().subscribe({
      next: () => this.loading.set(false),
      error: () => this.loading.set(false),
    });
  }

  refresh(): void {
    this.loadData();
  }

  clearSearch(): void {
    this.searchQuery.set('');
  }

  clearError(): void {
    this.adminService.clearError();
  }

  navigateToCreate(): void {
    this.router.navigate(['/settings/admin/grades/new']);
  }

  navigateToEdit(grade: Grade): void {
    this.router.navigate(['/settings/admin/grades', grade.id, 'edit']);
  }

  confirmDelete(grade: Grade): void {
    this.selected.set(grade);
    this.confirmDeleteOpen.set(true);
  }

  cancelDialog(): void {
    this.confirmDeleteOpen.set(false);
    this.selected.set(null);
    this.actionLoading.set(false);
  }

  executeDelete(): void {
    const grade = this.selected();
    if (!grade) return;

    this.actionLoading.set(true);
    this.adminService.deleteGrade(grade.id).subscribe({
      next: () => {
        this.actionLoading.set(false);
        this.cancelDialog();
        this.refresh();
      },
      error: () => {
        this.actionLoading.set(false);
        this.cancelDialog();
      },
    });
  }
}
