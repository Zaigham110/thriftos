import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppIconComponent } from '../app-icon/app-icon.component';

@Component({
  selector: 'app-error-state',
  standalone: true,
  imports: [CommonModule, AppIconComponent],
  template: `
    <div class="app-error-state">
      <div class="error-icon"><app-icon name="alert-triangle" size="lg" /></div>
      <h3 class="error-title">{{ title }}</h3>
      @if (message) {
        <p class="error-message">{{ message }}</p>
      }
      @if (action) {
        <div class="error-action">
          <ng-content select="[action]" />
        </div>
      }
    </div>
  `,
  styleUrl: './app-error-state.component.scss'
})
export class AppErrorStateComponent {
  @Input() title: string = 'Something went wrong';
  @Input() message?: string;
  @Input() action: boolean = false;
}
