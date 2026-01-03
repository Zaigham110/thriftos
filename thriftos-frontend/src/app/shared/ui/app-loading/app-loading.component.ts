import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

type LoadingSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'app-loading',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="app-loading" [class]="'loading-' + size">
      <div class="spinner"></div>
      @if (message) {
        <p class="loading-message">{{ message }}</p>
      }
    </div>
  `,
  styleUrl: './app-loading.component.scss'
})
export class AppLoadingComponent {
  @Input() size: LoadingSize = 'md';
  @Input() message?: string;
}
