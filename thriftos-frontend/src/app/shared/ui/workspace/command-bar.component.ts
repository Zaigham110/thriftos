import { Component } from '@angular/core';

/** The row of commands above a list or record: [start] for main actions, [end] for view controls. */
@Component({
  selector: 'ws-command-bar',
  standalone: true,
  host: { role: 'toolbar' },
  template: `<div class="start"><ng-content select="[start]" /></div><div class="end"><ng-content select="[end]" /></div>`,
  styles: [`
    :host { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:var(--ws-2); padding:var(--ws-2); border:1px solid var(--ws-line); border-radius:var(--ws-r-lg); background:var(--ws-surface); }
    .start, .end { display:flex; flex-wrap:wrap; align-items:center; gap:var(--ws-2); }
  `],
})
export class WsCommandBarComponent {}
