import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';
import {
  LucideAngularModule,
  Users,
  Search,
  RefreshCw,
  Building2,
  Shield,
  CheckCircle2,
  XCircle,
  KeyRound,
  Filter,
} from 'lucide-angular';

import { SuperAdminDataService, type GlobalUserRow } from '../super-admin-data.service';
import { AdminService } from '../../admin.service';
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
  selector: 'app-global-users',
  standalone: true,
  imports: [
    CommonModule,
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
  templateUrl: './global-users.component.html',
  styleUrl: './global-users.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GlobalUsersComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly data = inject(SuperAdminDataService);
  private readonly adminService = inject(AdminService);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly users = signal<GlobalUserRow[]>([]);
  protected readonly totalCount = signal(0);
  protected readonly searchQuery = signal('');
  protected readonly page = signal(1);

  // Reset Password Dialog
  protected readonly resetDialogOpen = signal(false);
  protected readonly resetUser = signal<GlobalUserRow | null>(null);
  protected readonly tempPassword = signal<string | null>(null);
  protected readonly resetMessage = signal<string | null>(null);
  protected readonly resetting = signal(false);

  readonly icons = {
    Users,
    Search,
    RefreshCw,
    Building2,
    Shield,
    CheckCircle2,
    XCircle,
    KeyRound,
    Filter,
  };

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.loading.set(true);
    this.error.set(null);

    this.data
      .getGlobalUsers(this.page(), 20, this.searchQuery())
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError((err) => {
          this.error.set(err?.error?.message || err?.message || 'Failed to load global users directory');
          this.loading.set(false);
          return of(null);
        }),
      )
      .subscribe((res) => {
        if (res) {
          this.users.set(res.data || []);
          this.totalCount.set(res.total || 0);
        }
        this.loading.set(false);
      });
  }

  onSearch(query: string): void {
    this.searchQuery.set(query);
    this.page.set(1);
    this.loadUsers();
  }

  promptResetPassword(user: GlobalUserRow): void {
    this.resetUser.set(user);
    this.tempPassword.set(null);
    this.resetMessage.set(null);
    this.resetDialogOpen.set(true);
  }

  executeResetPassword(): void {
    const user = this.resetUser();
    if (!user) return;

    this.resetting.set(true);
    this.adminService
      .resetUserPassword(user.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res: any) => {
          this.resetting.set(false);
          this.tempPassword.set(res.temporaryPassword || 'Password reset successfully');
          this.resetMessage.set(res.message);
        },
        error: (err) => {
          this.resetting.set(false);
          this.error.set(err?.message || 'Failed to reset password');
        },
      });
  }

  closeResetDialog(): void {
    this.resetDialogOpen.set(false);
    this.resetUser.set(null);
    this.tempPassword.set(null);
    this.resetMessage.set(null);
  }
}
