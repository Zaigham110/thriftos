import { Component, inject } from '@angular/core';
import { TPipe } from '../../core/i18n/t.pipe';
import { ToastService } from './toast.service';

@Component({
  selector: 'tos-toast',
  standalone: true,
  imports: [TPipe],
  template: `
    @if (toasts.current(); as t) {
      <div class="toast" [class.error]="t.tone === 'error'" role="status" aria-live="polite">
        <span>{{ t.text }}</span>
        @if (t.undo) { <button type="button" (click)="toasts.undo()">{{ 'common.undo' | t }}</button> }
      </div>
    }
  `,
  styles: [`
    .toast { position:fixed; inset-inline:12px; inset-block-end:calc(var(--tos-tabs-h) + var(--tos-bar-h) + 12px + env(safe-area-inset-bottom)); z-index:50; display:flex; align-items:center; gap:12px; max-width:560px; margin:0 auto; padding:12px 12px 12px 16px; border-radius:14px; background:#262024; color:#fff; font-weight:700; box-shadow:0 8px 24px rgb(0 0 0 / .2); }
    .toast span { flex:1; }
    .toast.error { background:var(--tos-warn); }
    button { min-height:44px; padding-inline:14px; border:0; border-radius:10px; background:var(--tos-card); color:#262024; font:inherit; font-weight:800; }
    @media (min-width:600px) { .toast { inset-block-end:24px; } }
  `],
})
export class ToastComponent {
  protected readonly toasts = inject(ToastService);
}
