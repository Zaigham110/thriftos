/**
 * ===============================
 * UNAUTHORIZED SCREEN - PHASE 0
 * ===============================
 * 
 * Blocking screen for unauthorized access
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

@Component({
  selector: 'app-unauthorized',
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
              title="Access Restricted"
              message="You do not have permission to access this resource. Please contact your administrator if you believe this is an error."
              [action]="true"
            >
              <app-stack direction="horizontal" spacing="md" action>
                <app-button variant="secondary" (clickEvent)="goBack()">
                  Go Back
                </app-button>
                <app-button variant="primary" (clickEvent)="goHome()">
                  Go to Dashboard
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
export class UnauthorizedComponent {
  constructor(private readonly router: Router) {}

  goBack(): void {
    history.back();
  }

  goHome(): void {
    this.router.navigate(['/dashboard']);
  }
}

