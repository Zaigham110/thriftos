import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import type { Icon } from '../../../shell/workspace/workspace-nav';

/** A count or amount of related records on a record page ("Bales 22", "Profit Rs 3,12,400") that opens them. */
@Component({
  selector: 'ws-smart-button',
  standalone: true,
  imports: [RouterLink, LucideAngularModule],
  template: `
    <a [routerLink]="link()" [queryParams]="query()">
      @if (icon(); as i) { <lucide-icon [img]="i" [size]="18" aria-hidden="true" /> }
      <span class="text"><span class="label">{{ label() }}</span><strong class="ws-num" [class.good]="tone() === 'good'" [class.bad]="tone() === 'bad'">{{ value() }}</strong></span>
    </a>
  `,
  styles: [`
    a { display:flex; align-items:center; gap:var(--ws-3); min-height:52px; padding:var(--ws-2) var(--ws-3); border:1px solid var(--ws-line); border-radius:var(--ws-r-md); background:var(--ws-surface); color:var(--ws-ink); text-decoration:none; }
    a:hover { border-color:var(--ws-brand); background:var(--ws-brand-soft); }
    lucide-icon { color:var(--ws-brand); }
    .text { display:grid; min-width:0; }
    .label { color:var(--ws-ink-2); font-size:var(--ws-text-xs); }
    strong { font-size:var(--ws-text-lg); font-weight:600; }
    .good { color:var(--ws-good); }
    .bad { color:var(--ws-bad); }
  `],
})
export class WsSmartButtonComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string>();
  readonly link = input<string | unknown[]>('.');
  readonly query = input<Record<string, string> | null>(null);
  readonly icon = input<Icon | null>(null);
  readonly tone = input<'plain' | 'good' | 'bad'>('plain');
}
