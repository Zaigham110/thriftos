import { Component, ElementRef, input, model, viewChildren } from '@angular/core';

export interface WsTab {
  id: string;
  label: string;
  /** Optional count shown beside the label. */
  count?: number;
}

/** Record tabs. ← → (mirrored in Urdu), Home and End move between them, as the ARIA tabs pattern asks. */
@Component({
  selector: 'ws-tabs',
  standalone: true,
  template: `
    <div role="tablist" [attr.aria-label]="label()" (keydown)="onKey($event)">
      @for (t of tabs(); track t.id) {
        <button #tab type="button" role="tab" [id]="'ws-tab-' + t.id" [attr.aria-selected]="t.id === active()" [attr.aria-controls]="'ws-panel-' + t.id" [tabindex]="t.id === active() ? 0 : -1" (click)="active.set(t.id)">
          {{ t.label }} @if (t.count !== undefined) { <span class="count ws-num">{{ t.count }}</span> }
        </button>
      }
    </div>
  `,
  styles: [`
    [role='tablist'] { display:flex; gap:var(--ws-1); border-block-end:1px solid var(--ws-line); overflow-x:auto; }
    button { min-height:40px; display:inline-flex; align-items:center; gap:var(--ws-2); padding-inline:var(--ws-3); border:0; border-block-end:2px solid transparent; margin-block-end:-1px; background:transparent; color:var(--ws-ink-2); font:inherit; font-weight:500; white-space:nowrap; cursor:pointer; }
    button:hover { color:var(--ws-ink); }
    button[aria-selected='true'] { border-block-end-color:var(--ws-brand); color:var(--ws-brand); font-weight:600; }
    .count { padding:0 6px; border-radius:10px; background:var(--ws-surface-2); color:var(--ws-ink-2); font-size:var(--ws-text-xs); }
  `],
})
export class WsTabsComponent {
  readonly tabs = input.required<WsTab[]>();
  readonly active = model.required<string>();
  readonly label = input('');
  private readonly buttons = viewChildren<ElementRef<HTMLButtonElement>>('tab');

  protected onKey(e: KeyboardEvent): void {
    const ids = this.tabs().map((t) => t.id);
    const i = ids.indexOf(this.active());
    const rtl = document.documentElement.dir === 'rtl';
    const next = { ArrowRight: rtl ? -1 : 1, ArrowLeft: rtl ? 1 : -1 }[e.key];
    let to = i;
    if (next) to = (i + next + ids.length) % ids.length;
    else if (e.key === 'Home') to = 0;
    else if (e.key === 'End') to = ids.length - 1;
    else return;
    e.preventDefault();
    this.active.set(ids[to]);
    this.buttons()[to]?.nativeElement.focus();
  }
}
