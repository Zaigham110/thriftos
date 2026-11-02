import { Component, inject } from '@angular/core';
import { OfflineQueueService } from '../../core/offline/offline-queue.service';

/**
 * Home → "Needs attention": entries saved on the phone that the server refused when they synced
 * (for example stock already sold). Each shows why, with Try again and Remove.
 */
@Component({
  selector: 'app-needs-attention',
  standalone: true,
  template: `
    @if (queue.failed().length) {
      <section class="attention" aria-label="Needs attention">
        <h2>Needs attention</h2>
        @for (w of queue.failed(); track w.id) {
          <article>
            <div>
              <strong>{{ w.label }}</strong>
              <small>{{ w.error }}</small>
            </div>
            <button type="button" (click)="queue.retry(w.id)">Try again</button>
            <button type="button" class="ghost" (click)="queue.discard(w.id)">Remove</button>
          </article>
        }
      </section>
    }
  `,
  styles: [`
    .attention { display:grid; gap:8px; padding:12px; border:1px solid #e9beb6; border-radius:14px; background:#fdf3f1; }
    h2 { margin:0; font-size:16px; color:#84352a; }
    article { display:grid; grid-template-columns:minmax(0,1fr) auto auto; align-items:center; gap:8px; }
    strong, small { display:block; }
    small { color:#84352a; font-size:13px; }
    button { min-height:48px; padding:0 12px; border:0; border-radius:10px; background:#714b67; color:#fff; font:inherit; font-weight:700; }
    button.ghost { background:transparent; color:#84352a; }
  `],
})
export class NeedsAttentionComponent {
  protected readonly queue = inject(OfflineQueueService);
}
