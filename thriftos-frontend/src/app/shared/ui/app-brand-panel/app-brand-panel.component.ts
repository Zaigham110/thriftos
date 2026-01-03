import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type BrandPanelVariant = 'product' | 'tenant';
export type BrandPanelSize = 'lg' | 'md' | 'sm';

/**
 * app-brand-panel
 * Branding block used in Login, Sidebar, and Topbar.
 * Phase-0 locked: calm, neutral, typography-first.
 */
@Component({
  selector: 'app-brand-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="brand" [attr.data-variant]="variant" [attr.data-size]="size">
      @if (!failed && logoUrl) {
        <img
          class="brand-logo"
          [src]="logoUrl"
          [alt]="altText"
          (error)="onLogoError()"
        />
      }

      <div class="brand-text">
        <div class="brand-name">{{ name }}</div>
        @if (subtitle) {
          <div class="brand-subtitle">{{ subtitle }}</div>
        }
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        min-width: 0;
      }

      .brand {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
        color: var(--app-text-primary);
        width: 100%;
        min-width: 0;
      }

      .brand-logo {
        width: 32px;
        height: 32px;
        border-radius: var(--border-radius-sm);
        border: 1px solid var(--app-border-subtle);
        background: var(--app-bg-surface);
        flex: 0 0 auto;
      }

      .brand-text {
        display: flex;
        flex-direction: column;
        gap: var(--space-xs);
        line-height: 1.2;
        min-width: 0;
        flex: 1 1 auto;
      }

      .brand-name {
        font-size: var(--font-size-body);
        font-weight: var(--font-weight-section-title);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 100%;
      }

      .brand-subtitle {
        font-size: var(--font-size-meta);
        color: var(--app-text-muted);
        font-weight: var(--font-weight-meta);
        overflow: hidden;
        max-width: 100%;
      }

      /* Sidebar branding: allow subtitle to wrap, but never overflow */
      .brand[data-size='md'] .brand-subtitle {
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
      }

      .brand[data-size='lg'] .brand-logo {
        width: 56px;
        height: 56px;
      }

      .brand[data-size='lg'] .brand-name {
        font-size: var(--font-size-page-title);
      }

      .brand[data-size='lg'] .brand-subtitle {
        font-size: var(--font-size-body);
      }

      /* Login / product panel: center + stack for stronger brand presence */
      .brand[data-variant='product'][data-size='lg'] {
        flex-direction: column;
        align-items: center;
        gap: var(--space-md);
        text-align: center;
      }

      .brand[data-variant='product'][data-size='lg'] .brand-text {
        align-items: center;
      }

      .brand[data-size='sm'] .brand-logo {
        width: 24px;
        height: 24px;
      }

      .brand[data-size='sm'] .brand-name {
        font-size: var(--font-size-table-header);
        font-weight: var(--font-weight-table-header);
      }

      .brand[data-size='sm'] .brand-subtitle {
        display: none;
      }

      .brand[data-variant='tenant'] .brand-subtitle {
        display: none;
      }
    `,
  ],
})
export class AppBrandPanelComponent {
  @Input() variant: BrandPanelVariant = 'product';
  @Input() size: BrandPanelSize = 'md';

  @Input() name = 'ThriftOS';
  @Input() subtitle: string | null = 'Operations & Inventory Platform';

  /**
   * Logo URL.
   * Phase-0: uses public/favicon.ico as the canonical logo asset.
   */
  @Input() logoUrl = '/favicon.ico';

  protected failed = false;

  get altText(): string {
    return this.variant === 'tenant' ? `${this.name} logo` : 'ThriftOS logo';
  }

  onLogoError(): void {
    // If the favicon is missing for any reason, gracefully hide the image.
    this.failed = true;
    this.logoUrl = '';
  }
}
