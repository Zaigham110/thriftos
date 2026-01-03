/**
 * ===============================
 * NO TENANT SCREEN - PHASE 0
 * ===============================
 * 
 * Blocking screen when user has no tenant assigned
 * Uses app-* primitives ONLY
 */

import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  AppPageComponent,
  AppPageBodyComponent,
  AppSectionComponent,
  AppCardComponent,
  AppButtonComponent,
  AppErrorStateComponent,
  AppStackComponent,
} from '../../../shared/ui';
import { AuthService } from '../../../core/auth';

@Component({
  selector: 'app-no-tenant',
  standalone: true,
  imports: [
    CommonModule,
    AppPageComponent,
    AppPageBodyComponent,
    AppSectionComponent,
    AppCardComponent,
    AppButtonComponent,
    AppErrorStateComponent,
    AppStackComponent,
  ],
  template: `
    <app-page>
      <app-page-body>
        <app-section>
          <app-card variant="data">
            <app-error-state
              title="No Tenant Assigned"
              message="Your account is not associated with any organization. Please contact your administrator to get access."
              [action]="true"
            >
              <app-stack direction="horizontal" spacing="md" action>
                <app-button variant="primary" (clickEvent)="signOut()">
                  Sign Out
                </app-button>
              </app-stack>
            </app-error-state>
          </app-card>
        </app-section>
      </app-page-body>
    </app-page>
  `,
  styles: []
})
export class NoTenantComponent {
  constructor(
    private readonly authService: AuthService,
    private readonly router: Router
  ) {}

  signOut(): void {
    this.authService.logout().subscribe(() => {
      this.router.navigate(['/auth/login']);
    });
  }
}

