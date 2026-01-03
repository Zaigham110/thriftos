import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="app-empty-state">
      @if (icon) {
        <div class="empty-icon">
          <ng-content select="[icon]" />
        </div>
      }
      <h3 class="empty-title">{{ title }}</h3>
      @if (message) {
        <p class="empty-message">{{ message }}</p>
      }
      @if (action) {
        <div class="empty-action">
          <ng-content select="[action]" />
        </div>
      }
    </div>
  `,
  styleUrl: './app-empty-state.component.scss'
})
export class AppEmptyStateComponent {
  @Input() title: string = 'No data';
  @Input() message?: string;
  @Input() icon: boolean = false;
  @Input() action: boolean = false;
}
