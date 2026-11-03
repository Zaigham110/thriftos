import { Component, ElementRef, computed, effect, inject, input, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CornerDownLeft, LucideAngularModule, Search } from 'lucide-angular';
import { I18nService } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import type { Icon } from './workspace-nav';

export interface PaletteCommand {
  id: string;
  /** Dictionary key. */
  label: string;
  group: 'pages' | 'create' | 'actions';
  icon: Icon;
  keywords?: string;
  path?: string;
  run?: () => void;
}

/** Lower-case, accents and spaces folded, so "khata" matches "Khata" and "Receivables (Khata)". */
const fold = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

/** Every word typed must appear in the label (either language) or the keywords. */
export function matches(query: string, haystack: string): boolean {
  const h = fold(haystack);
  return fold(query).split(' ').filter(Boolean).every((w) => h.includes(w));
}

/**
 * Ctrl/⌘ K: jump to any screen, create something, or change a setting, from the keyboard.
 * ↑ ↓ move, Enter runs, Esc closes. Record search (containers, bales, customers…) joins in E2.5.
 */
@Component({
  selector: 'ws-command-palette',
  standalone: true,
  imports: [FormsModule, LucideAngularModule, TPipe],
  template: `
    <div class="backdrop" (click)="close.emit()">
      <section class="palette" role="dialog" aria-modal="true" [attr.aria-label]="'ws.search' | t" (click)="$event.stopPropagation()" (keydown)="onKey($event)">
        <label class="search">
          <lucide-icon [img]="icons.Search" [size]="18" aria-hidden="true" />
          <input #box type="text" [ngModel]="query()" (ngModelChange)="query.set($event); active.set(0)" [placeholder]="'ws.search' | t" [attr.aria-label]="'ws.search' | t" autocomplete="off" role="combobox" aria-expanded="true" aria-controls="ws-palette-list" [attr.aria-activedescendant]="activeId()" />
          <kbd>Esc</kbd>
        </label>
        <ul id="ws-palette-list" role="listbox">
          @for (c of results(); track c.id; let i = $index) {
            @if (i === 0 || results()[i - 1].group !== c.group) { <li class="group" role="presentation">{{ 'ws.palette.' + c.group | t }}</li> }
            <li [id]="'ws-cmd-' + c.id" role="option" [attr.aria-selected]="i === active()" [class.active]="i === active()" (mouseenter)="active.set(i)" (click)="run(c)">
              <lucide-icon [img]="c.icon" [size]="17" aria-hidden="true" /><span>{{ c.label | t }}</span>
              @if (i === active()) { <lucide-icon class="enter" [img]="icons.CornerDownLeft" [size]="15" aria-hidden="true" /> }
            </li>
          } @empty {
            <li class="empty" role="presentation">{{ 'ws.palette.noResults' | t }}</li>
          }
        </ul>
      </section>
    </div>
  `,
  styles: [`
    .backdrop { position:fixed; inset:0; z-index:50; display:flex; justify-content:center; align-items:flex-start; padding-block-start:12vh; background:var(--ws-overlay); }
    .palette { width:min(640px, calc(100vw - 32px)); max-height:70vh; display:flex; flex-direction:column; overflow:hidden; border:1px solid var(--ws-line); border-radius:var(--ws-r-lg); background:var(--ws-surface); box-shadow:var(--ws-shadow-pop); color:var(--ws-ink); font-family:var(--ws-font); }
    .search { display:flex; align-items:center; gap:var(--ws-3); padding:var(--ws-3) var(--ws-4); border-block-end:1px solid var(--ws-line); color:var(--ws-ink-3); }
    .search input { flex:1; min-width:0; border:0; outline:0; background:transparent; color:var(--ws-ink); font:inherit; font-size:var(--ws-text-lg); }
    kbd { padding:2px 6px; border:1px solid var(--ws-line); border-radius:var(--ws-r-sm); background:var(--ws-surface-2); color:var(--ws-ink-3); font:inherit; font-size:var(--ws-text-xs); }
    ul { margin:0; padding:var(--ws-2); list-style:none; overflow-y:auto; }
    li[role='option'] { display:flex; align-items:center; gap:var(--ws-3); min-height:40px; padding-inline:var(--ws-3); border-radius:var(--ws-r-md); color:var(--ws-ink); font-size:var(--ws-text-md); cursor:pointer; }
    li[role='option'] lucide-icon { color:var(--ws-ink-3); }
    li.active { background:var(--ws-brand-soft); }
    li.active lucide-icon { color:var(--ws-brand); }
    .enter { margin-inline-start:auto; }
    .group { padding:var(--ws-3) var(--ws-3) var(--ws-1); color:var(--ws-ink-3); font-size:var(--ws-text-xs); font-weight:600; text-transform:uppercase; letter-spacing:.06em; }
    .empty { padding:var(--ws-6); color:var(--ws-ink-3); text-align:center; }
  `],
})
export class CommandPaletteComponent {
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  readonly commands = input.required<PaletteCommand[]>();
  readonly close = output<void>();
  protected readonly icons = { CornerDownLeft, Search };
  protected readonly query = signal('');
  protected readonly active = signal(0);
  private readonly box = viewChild.required<ElementRef<HTMLInputElement>>('box');

  protected readonly results = computed(() => {
    const q = this.query();
    const order = { pages: 0, create: 1, actions: 2 } as const;
    return this.commands()
      .filter((c) => !q.trim() || matches(q, `${this.i18n.t(c.label)} ${c.keywords ?? ''}`))
      .sort((a, b) => order[a.group] - order[b.group]);
  });
  protected readonly activeId = computed(() => {
    const c = this.results()[this.active()];
    return c ? `ws-cmd-${c.id}` : null;
  });

  constructor() {
    effect(() => this.box().nativeElement.focus());
  }

  protected onKey(e: KeyboardEvent): void {
    const n = this.results().length;
    if (e.key === 'Escape') { e.preventDefault(); this.close.emit(); }
    else if (e.key === 'ArrowDown' && n) { e.preventDefault(); this.active.set((this.active() + 1) % n); }
    else if (e.key === 'ArrowUp' && n) { e.preventDefault(); this.active.set((this.active() - 1 + n) % n); }
    else if (e.key === 'Enter') {
      const c = this.results()[this.active()];
      if (c) { e.preventDefault(); this.run(c); }
    }
  }

  protected run(c: PaletteCommand): void {
    this.close.emit();
    if (c.path) void this.router.navigateByUrl(c.path);
    c.run?.();
  }
}
