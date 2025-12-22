/**
 * Grading Session List Component
 * Phase 4: Sorting Stage 2 - Grading
 * 
 * Shows two sections:
 * 1. Available for Grading - Category outputs from Stage 1 ready to grade
 * 2. Grading Sessions - Existing sessions (OPEN/CLOSED)
 */

import {
  Component,
  OnInit,
  signal,
  computed,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  LucideAngularModule,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Eye,
  Play,
  CheckCircle2,
  Clock,
  AlertCircle,
  Layers,
  Package,
  ArrowRight,
  Inbox,
  Star,
  PackagePlus,
} from 'lucide-angular';

import { CardComponent } from '../../../../shared/ui/card/card';
import { ButtonComponent } from '../../../../shared/ui/button/button';
import { BadgeComponent } from '../../../../shared/ui/badge/badge';
import { SortingStage2Service } from '../../sorting-stage2.service';
import { GradeSession, GradeStatus, AvailableForGrading } from '../../sorting-stage2.models';

@Component({
  selector: 'app-grading-session-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    LucideAngularModule,
    CardComponent,
    ButtonComponent,
    BadgeComponent,
  ],
  templateUrl: './grading-session-list.html',
  styleUrl: './grading-session-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GradingSessionListComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);
  private readonly gradingService = inject(SortingStage2Service);

  // Icons
  readonly icons = {
    search: Search,
    filter: Filter,
    chevronLeft: ChevronLeft,
    chevronRight: ChevronRight,
    eye: Eye,
    play: Play,
    checkCircle: CheckCircle2,
    clock: Clock,
    alert: AlertCircle,
    layers: Layers,
    package: Package,
    arrowRight: ArrowRight,
    inbox: Inbox,
    star: Star,
    packagePlus: PackagePlus,
  };

  // Local state
  readonly searchQuery = signal('');
  readonly statusFilter = signal<GradeStatus | ''>('');
  readonly pageSize = signal(20);
  readonly startingGrading = signal<string | null>(null);
  readonly startingRepack = signal<string | null>(null);

  // Service state
  readonly loading = this.gradingService.loading;
  readonly error = this.gradingService.error;
  readonly sessions = this.gradingService.sessions;
  readonly totalCount = this.gradingService.totalCount;
  readonly currentPage = this.gradingService.currentPage;
  readonly totalPages = this.gradingService.totalPages;
  
  // Available for grading
  readonly availableForGrading = this.gradingService.availableForGrading;
  readonly availableTotal = this.gradingService.availableTotal;

  // Filtered sessions (client-side search)
  readonly filteredSessions = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const sessions = this.sessions();

    if (!query) return sessions;

    return sessions.filter((s) => {
      const sessionId = s.id?.toLowerCase() || '';
      const categoryName = s.categoryOutput?.category?.name?.toLowerCase() || '';
      return sessionId.includes(query) || categoryName.includes(query);
    });
  });

  // Status options
  readonly statusOptions: { value: GradeStatus | ''; label: string }[] = [
    { value: '', label: 'All Status' },
    { value: 'OPEN', label: 'Open' },
    { value: 'CLOSED', label: 'Closed' },
  ];

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    // Load both available items and existing sessions
    this.gradingService.getAvailableForGrading({ limit: 10 }).subscribe();
    this.loadSessions();
  }

  loadSessions(): void {
    const filters: any = {
      page: this.currentPage(),
      limit: this.pageSize(),
    };
    if (this.statusFilter()) {
      filters.status = this.statusFilter();
    }
    this.gradingService.getSessions(filters).subscribe();
  }

  onStatusChange(): void {
    this.loadSessions();
  }

  onPageChange(page: number): void {
    if (page < 1 || page > this.totalPages()) return;
    this.gradingService.getSessions({
      page,
      limit: this.pageSize(),
      status: this.statusFilter() || undefined,
    }).subscribe();
  }

  /**
   * Start grading for a category output from Stage 1
   */
  startGrading(item: AvailableForGrading): void {
    this.startingGrading.set(item.id);
    
    this.gradingService.createSession({ categoryOutputId: item.id }).subscribe({
      next: (session) => {
        this.startingGrading.set(null);
        this.router.navigate(['/app/sorting/stage2', session.id]);
      },
      error: (err) => {
        console.error('Failed to start grading:', err);
        this.startingGrading.set(null);
      },
    });
  }

  navigateToSession(session: GradeSession): void {
    this.router.navigate(['/app/sorting/stage2', session.id]);
  }

  // Helpers
  getStatusBadgeVariant(status: GradeStatus): 'success' | 'warning' | 'default' {
    return status === 'CLOSED' ? 'success' : 'warning';
  }

  formatDate(dateStr: string | null | undefined): string {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  formatWeight(weight: number | string | null | undefined): string {
    if (weight === null || weight === undefined) return '-';
    const num = typeof weight === 'string' ? parseFloat(weight) : weight;
    return num.toFixed(2);
  }

  getCategoryName(session: GradeSession): string {
    return session.categoryOutput?.category?.name || 'Unknown Category';
  }

  getInputWeight(session: GradeSession): string {
    return this.formatWeight(session.categoryOutput?.weightKg);
  }

  truncateId(id: string): string {
    if (!id) return '-';
    return id.length > 12 ? `${id.substring(0, 8)}...` : id;
  }

  // Available item helpers
  getAvailableCategoryName(item: AvailableForGrading): string {
    return item.category?.name || 'Unknown Category';
  }

  getAvailableContainerRef(item: AvailableForGrading): string {
    return item.container?.containerNumber || 'N/A';
  }

  getAvailableRagCode(item: AvailableForGrading): string {
    return item.rag?.ragCode || 'N/A';
  }

  getAvailableSessionId(item: AvailableForGrading): string {
    const sessionId = item.sortCategoryBucket?.sortSession?.id;
    return sessionId ? this.truncateId(sessionId) : '-';
  }

  // Start Repack from closed grading session
  startRepack(session: GradeSession): void {
    if (session.status !== 'CLOSED') return;

    this.startingRepack.set(session.id);

    this.http.post<{ id: string }>('/api/repack/sessions', {}).subscribe({
      next: (repackSession) => {
        this.startingRepack.set(null);
        // Navigate to repack with the source gradeSessionId as query param
        this.router.navigate(['/app/repack', repackSession.id], {
          queryParams: { gradeSessionId: session.id }
        });
      },
      error: (err: any) => {
        console.error('Failed to create repack session:', err);
        this.startingRepack.set(null);
      },
    });
  }
}
