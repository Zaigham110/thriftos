import { Component, computed, input, output } from '@angular/core';

/** Where a record is in its life (Received → Sorting → … → Closed). Steps before the current one are done. */
@Component({
  selector: 'ws-status-pipeline',
  standalone: true,
  template: `
    <ol [attr.aria-label]="label()">
      @for (s of steps(); track s; let i = $index) {
        <li [class.done]="i < safe()" [class.current]="i === safe()" [class.can]="allowed().includes(i)" [attr.aria-current]="i === safe() ? 'step' : null">
          @if (allowed().includes(i)) { <button type="button" (click)="pick.emit(i)" [attr.aria-label]="moveLabel() ? moveLabel() + ' ' + s : s">{{ s }}</button> } @else { {{ s }} }
        </li>
      }
    </ol>
  `,
  styles: [`
    ol { display:flex; margin:0; padding:0; list-style:none; overflow-x:auto; }
    li { position:relative; flex:1 0 auto; display:flex; align-items:center; justify-content:center; min-height:32px; padding-inline:var(--ws-4) var(--ws-3); border:1px solid var(--ws-line); margin-inline-start:-1px; background:var(--ws-surface); color:var(--ws-ink-3); font-size:var(--ws-text-sm); font-weight:500; white-space:nowrap; }
    li:first-child { border-start-start-radius:var(--ws-r-md); border-end-start-radius:var(--ws-r-md); }
    li:last-child { border-start-end-radius:var(--ws-r-md); border-end-end-radius:var(--ws-r-md); }
    li.done { color:var(--ws-ink-2); background:var(--ws-surface-2); }
    li.can { padding:0; }
    li button { flex:1; align-self:stretch; padding-inline:var(--ws-4) var(--ws-3); border:0; background:transparent; color:var(--ws-ink-2); font:inherit; font-weight:500; cursor:pointer; text-decoration:underline dotted; text-underline-offset:3px; }
    li button:hover { background:var(--ws-surface-hover); color:var(--ws-ink); }
    li button:focus-visible { outline:2px solid var(--ws-focus, var(--ws-brand)); outline-offset:-2px; }
    li.current { z-index:1; border-color:var(--ws-brand); background:var(--ws-brand-soft); color:var(--ws-brand); font-weight:600; }
  `],
})
export class WsStatusPipelineComponent {
  readonly steps = input.required<string[]>();
  /** Index of the current step. */
  readonly current = input(0);
  readonly label = input('');
  /** Steps that can be picked from here (each becomes a button); empty: the bar only shows where the record is. */
  readonly allowed = input<number[]>([]);
  /** Read out before a step's name on its button ("Move to"). */
  readonly moveLabel = input('');
  readonly pick = output<number>();
  protected readonly safe = computed(() => Math.max(0, Math.min(this.current(), this.steps().length - 1)));
}
