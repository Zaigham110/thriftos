/**
 * Grade Management Component
 * Phase 8: Tenant Administration
 * 
 * Manage sorting grades (A, B, C, etc.) for inventory classification.
 */

import { ChangeDetectionStrategy, Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../admin.service';
import { Grade } from '../admin.models';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import {
  AppPageComponent,
  AppPageHeaderComponent,
  AppPageBodyComponent,
  AppSectionComponent,
  AppSectionHeaderComponent,
  AppSectionBodyComponent,
  AppDataTableComponent,
  AppButtonComponent,
  AppLoadingComponent,
  AppEmptyStateComponent,
  AppDialogComponent,
  AppBreadcrumbComponent,
  type DataTableColumn,
} from '../../../shared/ui';

@Component({
  selector: 'app-grade-management',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    AppPageComponent,
    AppPageHeaderComponent,
    AppPageBodyComponent,
    AppSectionComponent,
    AppSectionHeaderComponent,
    AppSectionBodyComponent,
    AppDataTableComponent,
    AppButtonComponent,
    AppLoadingComponent,
    AppEmptyStateComponent,
    AppDialogComponent,
    AppBreadcrumbComponent,
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
    { label: 'Administration', route: '/app/admin' },
    { label: 'Grades' },
  ];

  readonly columns: DataTableColumn[] = [
    { key: 'name', label: 'Grade', sortable: true },
    { key: 'description', label: 'Description' },
    { key: 'rank', label: 'Rank', sortable: true },
    { key: 'status', label: 'Status', sortable: true },
  ];

  readonly searchQuery = signal('');
  readonly loading = signal(true);
  readonly confirmDeleteOpen = signal(false);
  readonly gradeToDelete = signal<Grade | null>(null);

  readonly grades = this.adminService.grades;

  readonly filteredGrades = computed(() => {
    const query = this.searchQuery().toLowerCase();
    if (!query) return this.grades();

    return this.grades().filter(grade =>
      grade.name.toLowerCase().includes(query) ||
      grade.description?.toLowerCase().includes(query)
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

  createGrade(): void {
    this.router.navigate(['/app/admin/grades/new']);
  }

  editGrade(grade: Grade): void {
    this.router.navigate(['/app/admin/grades', grade.id, 'edit']);
  }

  confirmDelete(grade: Grade): void {
    this.gradeToDelete.set(grade);
    this.confirmDeleteOpen.set(true);
  }

  cancelDelete(): void {
    this.confirmDeleteOpen.set(false);
    this.gradeToDelete.set(null);
  }

  deleteGrade(): void {
    const grade = this.gradeToDelete();
    if (!grade) return;

    this.adminService.deleteGrade(grade.id).subscribe({
      next: () => {
        this.cancelDelete();
        this.refresh();
      },
      error: (err) => {
        console.error('Failed to delete grade:', err);
        this.cancelDelete();
      },
    });
  }

  statusLabel(isActive: boolean): string {
    return isActive ? 'Active' : 'Inactive';
  }
}
