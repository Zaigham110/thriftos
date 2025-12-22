/**
 * Grade Management Component
 * Phase 8: Tenant Administration
 * 
 * Manage sorting grades (A, B, C, etc.) for inventory classification.
 */

import { ChangeDetectionStrategy, Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, Star, Plus, Pencil, Trash2, Search, RefreshCw } from 'lucide-angular';
import { AdminService } from '../admin.service';
import { Grade } from '../admin.models';
import {
  CardComponent,
  BreadcrumbComponent,
  EmptyStateComponent,
  SkeletonComponent,
  ConfirmDialogComponent,
} from '../../../shared/ui';
import { GradeFormDrawerComponent } from './grade-form-drawer';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';

@Component({
  selector: 'app-grade-management',
  standalone: true,
  imports: [
    CommonModule,
    LucideAngularModule,
    CardComponent,
    BreadcrumbComponent,
    EmptyStateComponent,
    SkeletonComponent,
    ConfirmDialogComponent,
    GradeFormDrawerComponent,
    HasPermissionDirective,
  ],
  templateUrl: './grade-management.html',
  styleUrl: './grade-management.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GradeManagementComponent implements OnInit {
  private readonly adminService = inject(AdminService);

  readonly icons = {
    Star,
    Plus,
    Pencil,
    Trash2,
    Search,
    RefreshCw,
  };

  readonly breadcrumbs = [
    { label: 'Administration', route: '/app/admin' },
    { label: 'Grades' },
  ];

  readonly searchQuery = signal('');
  readonly loading = signal(true);
  readonly drawerOpen = signal(false);
  readonly selectedGrade = signal<Grade | null>(null);
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

  openAddDrawer(): void {
    this.selectedGrade.set(null);
    this.drawerOpen.set(true);
  }

  openEditDrawer(grade: Grade): void {
    this.selectedGrade.set(grade);
    this.drawerOpen.set(true);
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
    this.selectedGrade.set(null);
  }

  onSaved(): void {
    this.closeDrawer();
    this.refresh();
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

  getGradeBadgeClass(grade: Grade): string {
    // Map grade names to colors
    const name = grade.name.toUpperCase();
    if (name.includes('A') || name.includes('PREMIUM')) return 'badge-green';
    if (name.includes('B') || name.includes('GOOD')) return 'badge-blue';
    if (name.includes('C') || name.includes('FAIR')) return 'badge-yellow';
    if (name.includes('D') || name.includes('POOR')) return 'badge-orange';
    if (name.includes('REJECT') || name.includes('WASTE')) return 'badge-red';
    return 'badge-gray';
  }
}
