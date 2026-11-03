import { Component, input, output } from '@angular/core';
import { AlertTriangle, Inbox, LucideAngularModule } from 'lucide-angular';
import { TPipe } from '../../../core/i18n/t.pipe';

/** Empty, loading and error states in one place, so every screen says the same thing the same way. */
@Component({
  selector: 'ws-state',
  standalone: true,
  imports: [LucideAngularModule, TPipe],
  template: `
    @switch (kind()) {
      @case ('loading') {
        <div class="box" role="status" aria-live="polite"><span class="spinner" aria-hidden="true"></span><p>{{ 'ws.state.loading' | t }}</p></div>
      }
      @case ('error') {
        <div class="box" role="alert">
          <lucide-icon [img]="icons.AlertTriangle" [size]="28" class="bad" aria-hidden="true" />
          <h3>{{ heading() || ('ws.state.error' | t) }}</h3>
          @if (message()) { <p>{{ message() }}</p> }
          <button type="button" class="btn" (click)="retry.emit()">{{ 'ws.state.retry' | t }}</button>
        </div>
      }
      @default {
        <div class="box">
          <lucide-icon [img]="icons.Inbox" [size]="28" aria-hidden="true" />
          <h3>{{ heading() || ('ws.state.empty' | t) }}</h3>
          @if (message()) { <p>{{ message() }}</p> }
          <ng-content />
        </div>
      }
    }
  `,
  styles: [`
    .box { display:grid; justify-items:center; gap:var(--ws-2); padding:var(--ws-8) var(--ws-4); color:var(--ws-ink-2); text-align:center; }
    h3 { margin:0; color:var(--ws-ink); font-size:var(--ws-text-lg); font-weight:600; }
    p { margin:0; max-width:420px; }
    lucide-icon { color:var(--ws-ink-3); }
    .bad { color:var(--ws-bad); }
    .spinner { width:24px; height:24px; border:3px solid var(--ws-line); border-block-start-color:var(--ws-brand); border-radius:50%; animation:spin .8s linear infinite; }
    @keyframes spin { to { transform:rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) { .spinner { animation-duration:3s; } }
    .btn { height:var(--ws-control-h); padding-inline:var(--ws-4); border:1px solid var(--ws-line); border-radius:var(--ws-r-md); background:var(--ws-surface); color:var(--ws-ink); font:inherit; font-weight:500; cursor:pointer; }
  `],
})
export class WsStateComponent {
  readonly kind = input<'empty' | 'loading' | 'error'>('empty');
  readonly heading = input('');
  readonly message = input('');
  readonly retry = output<void>();
  protected readonly icons = { AlertTriangle, Inbox };
}
