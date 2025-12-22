/**
 * Header Component - Application header with user menu
 * Phase 1: Authentication & Shell
 */

import { ChangeDetectionStrategy, Component, computed, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, Menu, Bell, User, LogOut, ChevronDown } from 'lucide-angular';
import { AuthService } from '../../auth';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './header.html',
  styleUrl: './header.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderComponent {
  readonly toggleSidebar = output<void>();

  protected readonly icons = {
    Menu,
    Bell,
    User,
    LogOut,
    ChevronDown,
  };

  protected readonly showUserMenu = signal(false);
  protected readonly userName = computed(() => this.authService.user()?.name ?? 'User');
  protected readonly userEmail = computed(() => this.authService.user()?.email ?? '');
  protected readonly isSuperAdmin = computed(() => this.authService.isSuperAdmin());

  constructor(private readonly authService: AuthService) {}

  onToggleSidebar(): void {
    this.toggleSidebar.emit();
  }

  toggleUserMenu(): void {
    this.showUserMenu.update((v) => !v);
  }

  closeUserMenu(): void {
    this.showUserMenu.set(false);
  }

  onLogout(): void {
    this.closeUserMenu();
    this.authService.logout().subscribe();
  }
}
