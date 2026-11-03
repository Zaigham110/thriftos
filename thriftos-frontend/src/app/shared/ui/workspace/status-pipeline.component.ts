import { Component, computed, input } from '@angular/core';

/** Where a record is in its life (Received → Sorting → … → Closed). Steps before the current one are done. */
@Component({
  selector: 'ws-status-pipeline',
  standalone: true,
  template: `
    <ol [attr.aria-label]="label()">
      @for (s of steps(); track s; let i = $index) {
        <li [class.done]="i < safe()" [class.current]="i === safe()" [attr.aria-current]="i === safe() ? 'step' : null">{{ s }}</li>
      }
    </ol>
  `,
  styles: [`
    ol { display:flex; margin:0; padding:0; list-style:none; overflow-x:auto; }
    li { position:relative; flex:1 0 auto; display:flex; align-items:center; justify-content:center; min-height:32px; padding-inline:var(--ws-4) var(--ws-3); border:1px solid var(--ws-line); margin-inline-start:-1px; background:var(--ws-surface); color:var(--ws-ink-3); font-size:var(--ws-text-sm); font-weight:500; white-space:nowrap; }
    li:first-child { border-start-start-radius:var(--ws-r-md); border-end-start-radius:var(--ws-r-md); }
    li:last-child { border-start-end-radius:var(--ws-r-md); border-end-end-radius:var(--ws-r-md); }
    li.done { color:var(--ws-ink-2); background:var(--ws-surface-2); }
    li.current { z-index:1; border-color:var(--ws-brand); background:var(--ws-brand-soft); color:var(--ws-brand); font-weight:600; }
  `],
})
export class WsStatusPipelineComponent {
  readonly steps = input.required<string[]>();
  /** Index of the current step. */
  readonly current = input(0);
  readonly label = input('');
  protected readonly safe = computed(() => Math.max(0, Math.min(this.current(), this.steps().length - 1)));
}
