import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';

import {
  AppPageComponent,
  AppPageHeaderComponent,
  AppPageBodyComponent,
  AppSectionComponent,
  AppSectionBodyComponent,
  AppCardComponent,
  AppEmptyStateComponent,
} from '../../shared/ui';

@Component({
  selector: 'app-admin-placeholder',
  standalone: true,
  imports: [
    CommonModule,
    AppPageComponent,
    AppPageHeaderComponent,
    AppPageBodyComponent,
    AppSectionComponent,
    AppSectionBodyComponent,
    AppCardComponent,
    AppEmptyStateComponent,
  ],
  template: `
    <app-page>
      <app-page-header>
        <div>
          <h1 class="page-title">{{ title() }}</h1>
          <p class="page-subtitle">{{ subtitle() }}</p>
        </div>
      </app-page-header>

      <app-page-body>
        <app-section>
          <app-section-body>
            <app-card variant="info">
              <app-empty-state
                title="Not configured"
                [message]="message()"
              />
            </app-card>
          </app-section-body>
        </app-section>
      </app-page-body>
    </app-page>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminPlaceholderComponent {
  private readonly data = computed(() => this.route.snapshot.data as Record<string, unknown>);

  protected readonly title = computed(() => String(this.data()['title'] ?? 'Admin'));
  protected readonly subtitle = computed(() => String(this.data()['subtitle'] ?? 'SuperAdmin'));
  protected readonly message = computed(() =>
    String(
      this.data()['message'] ??
        'This section is present in the SuperAdmin menu, but has not been implemented in this workspace yet.'
    )
  );

  constructor(private readonly route: ActivatedRoute) {}
}
