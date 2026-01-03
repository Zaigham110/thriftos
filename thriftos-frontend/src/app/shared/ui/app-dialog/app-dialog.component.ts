import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  HostListener,
  Input,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppButtonComponent } from '../button/app-button.component';
import { AppCardComponent } from '../card/app-card.component';
import { AppIconComponent } from '../app-icon/app-icon.component';

export type DialogVariant = 'default' | 'danger';

/**
 * ===============================
 * APP-DIALOG - LOCKED CONFIRMATION DIALOG
 * ===============================
 *
 * ⚠️ DESIGN SYSTEM RULE:
 * - Blocking confirmations ONLY (delete/finalize/archive/etc)
 * - No inline confirmation pages
 * - Explicit confirm/cancel required
 */
@Component({
  selector: 'app-dialog',
  standalone: true,
  imports: [CommonModule, AppCardComponent, AppButtonComponent, AppIconComponent],
  template: `
    @if (open) {
      <div class="app-dialog-backdrop" (click)="onBackdropClick($event)">
        <div class="app-dialog" role="dialog" aria-modal="true" [attr.aria-label]="title">
          <app-card>
            <div class="dialog-header">
              <div class="dialog-title">
                @if (icon) {
                  <app-icon class="dialog-icon" [name]="icon" size="sm" />
                }
                <span>{{ title }}</span>
              </div>
              <app-button variant="secondary" type="button" (click)="cancel()">
                <app-icon name="x" size="sm" />
              </app-button>
            </div>

            @if (message) {
              <div class="dialog-body">{{ message }}</div>
            }

            <div class="dialog-content">
              <ng-content></ng-content>
            </div>

            <div class="dialog-actions">
              <app-button variant="secondary" type="button" (click)="cancel()" [disabled]="loading">
                {{ cancelText }}
              </app-button>
              <app-button
                [variant]="variant === 'danger' ? 'danger' : 'primary'"
                type="button"
                (click)="confirm()"
                [disabled]="loading"
              >
                {{ confirmText }}
              </app-button>
            </div>
          </app-card>
        </div>
      </div>
    }
  `,
  styleUrl: './app-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppDialogComponent {
  @Input({ required: true }) open = false;
  @Input({ required: true }) title = 'Confirm';
  @Input() message: string | null = null;

  /** Optional subtle icon (lucide name via app-icon). */
  @Input() icon: string | null = null;

  @Input() confirmText = 'Confirm';
  @Input() cancelText = 'Cancel';
  @Input() variant: DialogVariant = 'default';

  @Input() closeOnBackdrop = false;
  @Input() closeOnEscape = true;
  @Input() loading = false;

  @Output() confirmed = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (!this.open) return;
    if (!this.closeOnEscape) return;
    this.cancel();
  }

  onBackdropClick(event: MouseEvent): void {
    if (!this.closeOnBackdrop) return;
    if (event.target !== event.currentTarget) return;
    this.cancel();
  }

  confirm(): void {
    if (this.loading) return;
    this.confirmed.emit();
  }

  cancel(): void {
    if (this.loading) return;
    this.cancelled.emit();
  }
}
