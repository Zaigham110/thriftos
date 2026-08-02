import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';
import {
  LucideAngularModule,
  Shield,
  Search,
  RefreshCw,
  Building2,
  FileText,
  Eye,
  X,
  Filter,
} from 'lucide-angular';

import { SuperAdminDataService, type GlobalAuditRow } from '../super-admin-data.service';
import {
  AppPageComponent,
  AppPageHeaderComponent,
  AppPageBodyComponent,
  AppSectionComponent,
  AppLoadingComponent,
  AppErrorStateComponent,
  AppDialogComponent,
} from '../../../../shared/ui';

@Component({
  selector: 'app-global-audit',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    FormsModule,
    LucideAngularModule,
    AppPageComponent,
    AppPageHeaderComponent,
    AppPageBodyComponent,
    AppSectionComponent,
    AppLoadingComponent,
    AppErrorStateComponent,
    AppDialogComponent,
  ],
  templateUrl: './global-audit.component.html',
  styleUrl: './global-audit.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GlobalAuditComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly data = inject(SuperAdminDataService);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly logs = signal<GlobalAuditRow[]>([]);
  protected readonly totalCount = signal(0);
  protected readonly page = signal(1);

  // Inspector Modal
  protected readonly selectedLog = signal<GlobalAuditRow | null>(null);

  readonly icons = {
    Shield,
    Search,
    RefreshCw,
    Building2,
    FileText,
    Eye,
    X,
    Filter,
  };

  ngOnInit(): void {
    this.loadLogs();
  }

  loadLogs(): void {
    this.loading.set(true);
    this.error.set(null);

    this.data
      .getGlobalAuditLogs(this.page(), 20)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError((err) => {
          this.error.set(err?.error?.message || err?.message || 'Failed to load security audit logs');
          this.loading.set(false);
          return of(null);
        }),
      )
      .subscribe((res) => {
        if (res) {
          this.logs.set(res.data || []);
          this.totalCount.set(res.total || 0);
        }
        this.loading.set(false);
      });
  }

  inspectLog(log: GlobalAuditRow): void {
    this.selectedLog.set(log);
  }

  closeInspector(): void {
    this.selectedLog.set(null);
  }

  formatJson(obj: any): string {
    if (!obj) return '{}';
    return JSON.stringify(obj, null, 2);
  }
}
