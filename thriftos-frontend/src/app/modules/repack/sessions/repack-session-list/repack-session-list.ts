/**
 * Repack Session List Component
 * Phase 5: Repack & QR Code Generation
 * 
 * Displays list of repack sessions with status filtering.
 * Sessions are created from Stage 2 graded outputs, not from this page.
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
  Package,
  QrCode,
  Lock,
} from 'lucide-angular';

import { CardComponent } from '../../../../shared/ui/card/card';
import { ButtonComponent } from '../../../../shared/ui/button/button';
import { BadgeComponent } from '../../../../shared/ui/badge/badge';
import { RepackService } from '../../repack.service';
import { RepackSession, RepackSessionStatus } from '../../repack.models';

@Component({
  selector: 'app-repack-session-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    LucideAngularModule,
    CardComponent,
    ButtonComponent,
    BadgeComponent,
  ],
  templateUrl: './repack-session-list.html',
  styleUrl: './repack-session-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RepackSessionListComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly repackService = inject(RepackService);

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
    package: Package,
    qrCode: QrCode,
    lock: Lock,
  };

  // Service state
  readonly loading = this.repackService.loading;
  readonly sessions = this.repackService.sessions;
  readonly totalCount = this.repackService.totalCount;
  readonly currentPage = this.repackService.currentPage;
  readonly totalPages = this.repackService.totalPages;

  // Local state
  readonly error = signal<string | null>(null);
  readonly searchQuery = signal('');
  readonly statusFilter = signal<RepackSessionStatus | ''>('');

  // Status options for filter
  readonly statusOptions = [
    { value: '', label: 'All Status' },
    { value: 'OPEN', label: 'Open' },
    { value: 'CLOSED', label: 'Closed' },
  ];

  // Computed: Filtered sessions (client-side search on top of server filter)
  readonly filteredSessions = computed(() => {
    const sessions = this.sessions();
    const query = this.searchQuery().toLowerCase().trim();

    if (!query) return sessions;

    return sessions.filter((s) =>
      s.id.toLowerCase().includes(query) ||
      s.worker?.name?.toLowerCase().includes(query) ||
      s.supervisor?.name?.toLowerCase().includes(query)
    );
  });

  ngOnInit(): void {
    this.loadData();
  }

  private loadData(): void {
    const filters: any = {
      page: this.currentPage(),
      limit: 20,
    };

    const status = this.statusFilter();
    if (status) {
      filters.status = status;
    }

    this.repackService.getSessions(filters).subscribe({
      error: (err: any) => {
        this.error.set(err.message || 'Failed to load repack sessions');
      },
    });
  }

  onStatusChange(): void {
    this.loadData();
  }

  onPageChange(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.repackService.getSessions({
        status: this.statusFilter() || undefined,
        page,
        limit: 20,
      }).subscribe();
    }
  }

  navigateToSession(session: RepackSession): void {
    this.router.navigate(['/app/repack', session.id]);
  }

  // Helper methods
  truncateId(id: string): string {
    return id.length > 8 ? `${id.slice(0, 8)}...` : id;
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  getStatusBadgeVariant(status: RepackSessionStatus): 'warning' | 'success' | 'default' {
    switch (status) {
      case 'OPEN':
        return 'warning';
      case 'CLOSED':
        return 'success';
      default:
        return 'default';
    }
  }

  getWorkerName(session: RepackSession): string {
    return session.worker?.name || 'Unknown';
  }

  getUnitCount(session: RepackSession): number {
    return session._count?.repackUnits || session.repackUnits?.length || 0;
  }
}
