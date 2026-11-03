import { Component, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Bookmark, Check, ChevronDown, LucideAngularModule, Star, Trash2 } from 'lucide-angular';
import type { SavedView } from '../../../core/list/list-client';
import { TPipe } from '../../../core/i18n/t.pipe';

/** Saved views for a list: pick one, save the current filters as a new one, make one the default, delete. */
@Component({
  selector: 'ws-view-menu',
  standalone: true,
  imports: [FormsModule, LucideAngularModule, TPipe],
  template: `
    <div class="wrap">
      <button type="button" class="ws-btn" (click)="open.set(!open())" [attr.aria-expanded]="open()" aria-haspopup="menu">
        <lucide-icon [img]="icons.Bookmark" [size]="16" aria-hidden="true" />{{ current()?.name || ('ws.views.all' | t) }}<lucide-icon [img]="icons.ChevronDown" [size]="14" aria-hidden="true" />
      </button>
      @if (open()) {
        <div class="menu" role="menu">
          <button type="button" role="menuitemradio" [attr.aria-checked]="!current()" (click)="choose.emit(null); open.set(false)">
            <span class="tick">@if (!current()) { <lucide-icon [img]="icons.Check" [size]="14" aria-hidden="true" /> }</span>{{ 'ws.views.all' | t }}
          </button>
          @for (v of views(); track v.id) {
            <div class="row">
              <button type="button" role="menuitemradio" [attr.aria-checked]="v.id === current()?.id" (click)="choose.emit(v); open.set(false)">
                <span class="tick">@if (v.id === current()?.id) { <lucide-icon [img]="icons.Check" [size]="14" aria-hidden="true" /> }</span>{{ v.name }}
              </button>
              <button type="button" class="icon" [class.on]="v.isDefault" (click)="makeDefault.emit(v)" [attr.aria-label]="('ws.views.default' | t) + ': ' + v.name" [attr.aria-pressed]="v.isDefault"><lucide-icon [img]="icons.Star" [size]="14" aria-hidden="true" /></button>
              <button type="button" class="icon" (click)="remove.emit(v)" [attr.aria-label]="('ws.views.delete' | t) + ': ' + v.name"><lucide-icon [img]="icons.Trash2" [size]="14" aria-hidden="true" /></button>
            </div>
          }
          <form class="save" (ngSubmit)="submit()">
            <label class="ws-visually-hidden" for="ws-view-name">{{ 'ws.views.name' | t }}</label>
            <input id="ws-view-name" name="name" [(ngModel)]="name" maxlength="60" [placeholder]="'ws.views.name' | t" />
            <button type="submit" class="ws-btn" [disabled]="!name.trim()">{{ 'ws.views.save' | t }}</button>
          </form>
        </div>
      }
    </div>
  `,
  styles: [`
    .wrap { position:relative; }
    .ws-btn { height:var(--ws-control-h); display:inline-flex; align-items:center; gap:6px; padding-inline:var(--ws-3); border:1px solid var(--ws-line); border-radius:var(--ws-r-md); background:var(--ws-surface); color:var(--ws-ink); font:inherit; font-weight:500; cursor:pointer; }
    .ws-btn:disabled { opacity:.55; }
    .menu { position:absolute; inset-block-start:calc(100% + 6px); inset-inline-start:0; z-index:30; width:280px; display:grid; gap:2px; padding:var(--ws-1); border:1px solid var(--ws-line); border-radius:var(--ws-r-lg); background:var(--ws-surface); box-shadow:var(--ws-shadow-pop); }
    .row { display:flex; align-items:center; }
    [role='menuitemradio'] { flex:1; display:flex; align-items:center; gap:var(--ws-2); min-height:34px; padding-inline:var(--ws-2); border:0; border-radius:var(--ws-r-md); background:transparent; color:var(--ws-ink); font:inherit; text-align:start; cursor:pointer; }
    [role='menuitemradio']:hover, .icon:hover { background:var(--ws-surface-hover); }
    .tick { width:16px; display:inline-grid; place-items:center; color:var(--ws-brand); }
    .icon { width:30px; height:30px; display:grid; place-items:center; border:0; border-radius:var(--ws-r-md); background:transparent; color:var(--ws-ink-3); cursor:pointer; }
    .icon.on { color:var(--ws-warn); }
    .save { display:flex; gap:var(--ws-2); padding:var(--ws-2); margin-block-start:var(--ws-1); border-block-start:1px solid var(--ws-line); }
    .save input { flex:1; min-width:0; height:32px; padding-inline:var(--ws-2); border:1px solid var(--ws-line); border-radius:var(--ws-r-md); background:var(--ws-surface-2); color:var(--ws-ink); font:inherit; }
  `],
})
export class WsViewMenuComponent {
  readonly views = input<SavedView[]>([]);
  readonly current = input<SavedView | null>(null);
  readonly choose = output<SavedView | null>();
  readonly save = output<string>();
  readonly makeDefault = output<SavedView>();
  readonly remove = output<SavedView>();
  protected readonly open = signal(false);
  protected readonly icons = { Bookmark, Check, ChevronDown, Star, Trash2 };
  protected name = '';

  protected submit(): void {
    const n = this.name.trim();
    if (!n) return;
    this.save.emit(n);
    this.name = '';
    this.open.set(false);
  }
}
