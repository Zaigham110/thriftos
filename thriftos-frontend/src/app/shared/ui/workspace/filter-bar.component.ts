import { Component, input, model, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, Search, X } from 'lucide-angular';
import { TPipe } from '../../../core/i18n/t.pipe';

export interface WsFilterChip {
  id: string;
  /** Shown as "label: value". */
  label: string;
  value: string;
}

/** Search box, the active filters as removable chips, and room for "add filter" controls ([add]). */
@Component({
  selector: 'ws-filter-bar',
  standalone: true,
  imports: [FormsModule, LucideAngularModule, TPipe],
  template: `
    <div class="bar">
      <label class="search">
        <lucide-icon [img]="icons.Search" [size]="16" aria-hidden="true" />
        <input type="search" [ngModel]="query()" (ngModelChange)="query.set($event)" [placeholder]="placeholder() || ('ws.filter.search' | t)" [attr.aria-label]="placeholder() || ('ws.filter.search' | t)" />
      </label>
      <ng-content select="[add]" />
      @for (c of chips(); track c.id) {
        <span class="chip">{{ c.label }}: <strong>{{ c.value }}</strong>
          <button type="button" (click)="remove.emit(c.id)" [attr.aria-label]="('ws.filter.remove' | t) + ' ' + c.label"><lucide-icon [img]="icons.X" [size]="14" aria-hidden="true" /></button>
        </span>
      }
      @if (chips().length) { <button type="button" class="clear" (click)="clearAll.emit()">{{ 'ws.filter.clear' | t }}</button> }
    </div>
  `,
  styles: [`
    .bar { display:flex; flex-wrap:wrap; align-items:center; gap:var(--ws-2); }
    .search { flex:1 1 260px; max-width:420px; height:var(--ws-control-h); display:flex; align-items:center; gap:var(--ws-2); padding-inline:var(--ws-3); border:1px solid var(--ws-line); border-radius:var(--ws-r-md); background:var(--ws-surface); color:var(--ws-ink-3); }
    .search:focus-within { border-color:var(--ws-brand); box-shadow:var(--ws-focus); }
    input { flex:1; min-width:0; border:0; outline:0; background:transparent; color:var(--ws-ink); font:inherit; }
    .chip { display:inline-flex; align-items:center; gap:var(--ws-1); height:28px; padding-inline:var(--ws-3) var(--ws-1); border-radius:14px; background:var(--ws-brand-soft); color:var(--ws-brand); font-size:var(--ws-text-sm); }
    .chip button { width:22px; height:22px; display:grid; place-items:center; border:0; border-radius:50%; background:transparent; color:inherit; cursor:pointer; }
    .chip button:hover { background:var(--ws-surface); }
    .clear { border:0; background:transparent; color:var(--ws-ink-2); font:inherit; text-decoration:underline; cursor:pointer; }
  `],
})
export class WsFilterBarComponent {
  readonly query = model('');
  readonly placeholder = input('');
  readonly chips = input<WsFilterChip[]>([]);
  readonly remove = output<string>();
  readonly clearAll = output<void>();
  protected readonly icons = { Search, X };
}
