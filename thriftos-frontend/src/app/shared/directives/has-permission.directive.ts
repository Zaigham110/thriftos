/**
 * Has Permission Directive
 * Phase 8: Tenant Administration
 * 
 * Structural directive for conditionally showing elements based on user permissions.
 * 
 * Usage:
 * - *hasPermission="'user.create'" - Show if user has user.create permission
 * - *hasPermission="['user.create', 'user.update']" - Show if user has any of the permissions
 */

import { Directive, Input, TemplateRef, ViewContainerRef, inject, effect } from '@angular/core';
import { AuthService } from '../../core/auth/auth';

@Directive({
  selector: '[hasPermission]',
  standalone: true,
})
export class HasPermissionDirective {
  private readonly templateRef = inject(TemplateRef<unknown>);
  private readonly viewContainer = inject(ViewContainerRef);
  private readonly authService = inject(AuthService);

  private hasView = false;
  private requiredPermissions: string[] = [];

  @Input()
  set hasPermission(value: string | string[]) {
    this.requiredPermissions = Array.isArray(value) ? value : [value];
    this.updateView();
  }

  constructor() {
    // React to permission changes
    effect(() => {
      // Access the signal to register dependency
      this.authService.user();
      this.updateView();
    });
  }

  private updateView(): void {
    const hasPermission = this.authService.hasAnyPermission(this.requiredPermissions);

    if (hasPermission && !this.hasView) {
      this.viewContainer.createEmbeddedView(this.templateRef);
      this.hasView = true;
    } else if (!hasPermission && this.hasView) {
      this.viewContainer.clear();
      this.hasView = false;
    }
  }
}
