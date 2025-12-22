/**
 * Sorting Session List Component
 * Phase 3: Category Sorting UI
 * 
 * Dense ERP table displaying all sorting sessions
 */

import { Component, OnInit, ChangeDetectionStrategy, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, Plus, Eye, Play, FileText, Package, Box, Filter, ClipboardList } from 'lucide-angular';

import {
  CardComponent,
  ButtonComponent,
  SelectComponent,
  BadgeComponent,
  BreadcrumbComponent,
  SkeletonComponent,
  AlertComponent,
  EmptyStateComponent,
  SelectOption,
  BreadcrumbItem,
} from '../../../../shared/ui';
import { AuthService } from '../../../../core/auth/auth';
import { SortingStage1Service } from '../../sorting-stage1.service';
import { SortSession, SortStatus } from '../../sorting-stage1.models';

@Component({
  selector: 'app-sorting-session-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    LucideAngularModule,
    CardComponent,
    ButtonComponent,
    SelectComponent,
    BadgeComponent,
    BreadcrumbComponent,
    SkeletonComponent,
    AlertComponent,
    EmptyStateComponent,
  ],
  templateUrl: './sorting-session-list.html',
  styleUrl: './sorting-session-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SortingSessionListComponent implements OnInit {
  private readonly sortingService = inject(SortingStage1Service);
  private readonly authService = inject(AuthService);

  // Icons
  readonly icons = {
    Plus,
    Eye,
    Play,
    FileText,
    Package,
    Box,
    Filter,
    ClipboardList,
  };

  // Breadcrumbs
  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Home', link: '/app/dashboard' },
    { label: 'Sorting Stage 1' },
  ];

  // State
  readonly loading = this.sortingService.loading;
  readonly error = this.sortingService.error;
  readonly sessions = this.sortingService.sessions;
  readonly totalCount = this.sortingService.totalCount;
  readonly currentPage = this.sortingService.currentPage;
  readonly totalPages = this.sortingService.totalPages;

  // Filters
  readonly statusFilter = signal<SortStatus | ''>('');

  // Status options
  readonly statusOptions: SelectOption[] = [
    { value: '', label: 'All Statuses' },
    { value: 'OPEN', label: 'Open' },
    { value: 'CLOSED', label: 'Closed' },
  ];

  // Permission checks
  readonly canCreate = computed(() => {
    const user = this.authService.user();
    const permissions = this.authService.permissions();
    return (
      user?.isSuperAdmin ||
      permissions.includes('SORTING_STAGE1_CREATE')
    );
  });

  ngOnInit(): void {
    this.loadSessions();
  }

  loadSessions(page = 1): void {
    const status = this.statusFilter() || undefined;
    this.sortingService.loadSessions({ status, page, limit: 20 }).subscribe();
  }

  onStatusFilterChange(status: string): void {
    this.statusFilter.set(status as SortStatus | '');
    this.loadSessions(1);
  }

  onPageChange(page: number): void {
    this.loadSessions(page);
  }

  getStatusBadgeVariant(status: SortStatus): 'primary' | 'success' | 'default' {
    switch (status) {
      case 'OPEN':
        return 'primary';
      case 'CLOSED':
        return 'success';
      default:
        return 'default';
    }
  }

  getSourceDisplay(session: SortSession): string {
    if (session.rag) {
      return `RAG: ${session.rag.ragCode}`;
    }
    if (session.incomingBale) {
      return `Bale: ${session.incomingBale.baleCode}`;
    }
    return 'Unknown';
  }

  getSourceType(session: SortSession): 'rag' | 'bale' {
    return session.rag ? 'rag' : 'bale';
  }

  formatWeight(weight: number | string): string {
    const num = typeof weight === 'string' ? parseFloat(weight) : weight;
    return `${(num || 0).toFixed(2)} kg`;
  }

  formatPercentage(value: number, total: number): string {
    if (total === 0) return '0%';
    return `${((value / total) * 100).toFixed(1)}%`;
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  dismissError(): void {
    this.sortingService.clearError();
  }
}
