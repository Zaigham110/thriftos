import { HttpClient } from '@angular/common/http';
import { Component, DestroyRef, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, forkJoin, map, of } from 'rxjs';
import { I18nService } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { ListClient, ListState } from '../../core/list/list-client';
import { ToastService } from '../../shared/floor/toast.service';
import type { ListConfig } from './list-config';

interface Card {
  id: string;
  title: string;
  lines: string[];
}
interface Column {
  value: string;
  total: number;
  cards: Card[];
}

const PER_COLUMN = 50;

/**
 * Board (kanban) for a list: one column per status, cards for the records. Drag a card to another column,
 * or use its "Move to" picker (keyboard), to change its status; the server decides which moves are allowed.
 */
@Component({
  selector: 'app-board',
  standalone: true,
  imports: [TPipe],
  template: `
    @let b = config().board!;
    <div class="board" [attr.aria-busy]="loading()">
      @for (col of columns(); track col.value) {
        <section class="col" [class.over]="over() === col.value" [attr.aria-label]="b.prefix + col.value | t"
          (dragover)="$event.preventDefault(); over.set(col.value)" (dragleave)="over.set(null)" (drop)="drop($event, col.value)">
          <header><h2>{{ b.prefix + col.value | t }}</h2><span class="count">{{ i18n.num(col.total) }}</span></header>
          <div class="cards">
            @for (card of col.cards; track card.id) {
              <article class="bcard" [attr.draggable]="b.move ? 'true' : null" (dragstart)="drag($event, card.id)" [class.moving]="moving() === card.id" [class.locked]="!b.move">
                <button type="button" class="open" (click)="open.emit(card.id)">{{ card.title }}</button>
                @for (l of card.lines; track $index) { @if (l) { <p>{{ l }}</p> } }
                @if (b.move) {
                <label class="move">{{ 'ws.board.moveTo' | t }}
                  <select (change)="move(card.id, $any($event.target).value, col.value)">
                    @for (v of b.values; track v) { <option [value]="v" [selected]="v === col.value">{{ b.prefix + v | t }}</option> }
                  </select>
                </label>
                }
              </article>
            } @empty {
              <p class="empty">{{ 'ws.board.empty' | t }}</p>
            }
            @if (col.total > col.cards.length) { <p class="more">{{ 'ws.board.more' | t: { n: i18n.num(col.total - col.cards.length) } }}</p> }
          </div>
        </section>
      }
    </div>
  `,
  styles: [`
    .board { display:grid; grid-auto-flow:column; grid-auto-columns:minmax(240px, 1fr); gap:var(--ws-3); overflow-x:auto; padding-block-end:var(--ws-2); }
    .col { display:grid; grid-template-rows:auto 1fr; min-height:320px; border:1px solid var(--ws-line); border-radius:var(--ws-r-lg); background:var(--ws-surface-2, var(--ws-bg)); }
    .col.over { border-color:var(--ws-brand); box-shadow:0 0 0 2px var(--ws-brand-soft); }
    header { display:flex; align-items:center; justify-content:space-between; padding:var(--ws-3); border-block-end:1px solid var(--ws-line); }
    h2 { margin:0; font-size:var(--ws-text-sm); font-weight:600; color:var(--ws-ink); }
    .count { min-width:24px; padding:2px 8px; border-radius:999px; background:var(--ws-surface); color:var(--ws-ink-2); font-size:var(--ws-text-xs); text-align:center; }
    .cards { display:grid; align-content:start; gap:var(--ws-2); padding:var(--ws-2); }
    .bcard { display:grid; gap:4px; padding:var(--ws-3); border:1px solid var(--ws-line); border-radius:var(--ws-r-md); background:var(--ws-surface); box-shadow:var(--ws-shadow-sm, none); cursor:grab; }
    .bcard.moving { opacity:.5; }
    .bcard.locked { cursor:default; }
    .open { padding:0; border:0; background:none; color:var(--ws-brand); font:inherit; font-weight:600; text-align:start; cursor:pointer; }
    .open:hover { text-decoration:underline; }
    p { margin:0; color:var(--ws-ink-2); font-size:var(--ws-text-sm); }
    .move { display:flex; align-items:center; gap:var(--ws-2); margin-block-start:4px; color:var(--ws-ink-3, var(--ws-ink-2)); font-size:var(--ws-text-xs); }
    .move select { height:28px; padding-inline:4px; border:1px solid var(--ws-line); border-radius:var(--ws-r-sm, 6px); background:var(--ws-surface); color:var(--ws-ink); font:inherit; }
    .empty, .more { padding:var(--ws-2); text-align:center; font-size:var(--ws-text-xs); }
  `],
})
export class BoardComponent {
  protected readonly i18n = inject(I18nService);
  private readonly lists = inject(ListClient);
  private readonly http = inject(HttpClient);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  readonly config = input.required<ListConfig>();
  readonly state = input.required<ListState>();
  readonly open = output<string>();
  readonly moved = output<void>();

  protected readonly columns = signal<Column[]>([]);
  protected readonly loading = signal(true);
  protected readonly over = signal<string | null>(null);
  protected readonly moving = signal<string | null>(null);
  private readonly reloads = signal(0);

  private readonly request = computed(() => ({ config: this.config(), state: this.state(), n: this.reloads() }));

  constructor() {
    effect(() => {
      const { config, state } = this.request();
      untracked(() => this.load(config, state));
    });
  }

  private load(config: ListConfig, state: ListState): void {
    const b = config.board!;
    const filters = state.filters.filter((f) => f.field !== b.field);
    this.loading.set(true);
    forkJoin(
      b.values.map((value) =>
        this.lists
          .page(config.resource, { ...state, page: 1, pageSize: PER_COLUMN, groupBy: null, filters: [...filters, { field: b.field, op: 'eq', value }] })
          .pipe(
            map((r) => ({ value, total: r.total, cards: r.rows.map((row) => this.card(config, row)) })),
            catchError(() => of({ value, total: 0, cards: [] as Card[] })),
          ),
      ),
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((cols) => {
        this.columns.set(cols);
        this.loading.set(false);
      });
  }

  private card(config: ListConfig, row: Record<string, unknown> & { id: string }): Card {
    const b = config.board!;
    const line = (key: string) => {
      const v = row[key];
      if (v === null || v === undefined || v === '') return '';
      const col = config.columns.find((c) => c.key === key);
      const label = col ? this.i18n.t(col.label) : key;
      switch (col?.format) {
        case 'money': return `${label}: ${this.i18n.money(v as string)}`;
        case 'kg': return this.i18n.kg(v as string);
        case 'percent': return `${label}: ${this.i18n.num(v as number, 0)}%`;
        case 'date': return new Date(v as string).toLocaleDateString(this.i18n.lang() === 'ur' ? 'ur-PK' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', numberingSystem: 'latn' });
        default: return String(v);
      }
    };
    return { id: row.id, title: String(row[b.title] ?? '—'), lines: b.lines.map(line) };
  }

  protected drag(e: DragEvent, id: string): void {
    e.dataTransfer?.setData('text/plain', id);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
  }

  protected drop(e: DragEvent, value: string): void {
    e.preventDefault();
    if (!this.config().board?.move) return;
    this.over.set(null);
    const id = e.dataTransfer?.getData('text/plain');
    const from = this.columns().find((c) => c.cards.some((x) => x.id === id))?.value;
    if (id && from) this.move(id, value, from);
  }

  protected move(id: string, value: string, from: string): void {
    const move = this.config().board!.move;
    if (value === from || !move) return;
    const { url, body } = move(id, value);
    this.moving.set(id);
    this.http.patch(url, body).subscribe({
      next: () => {
        this.moving.set(null);
        this.toast.show(this.i18n.t('ws.board.moved', { to: this.i18n.t(this.config().board!.prefix + value) }));
        this.reloads.set(this.reloads() + 1);
        this.moved.emit();
      },
      error: (err: { status?: number }) => {
        this.moving.set(null);
        this.toast.show(this.i18n.t(err.status === 409 ? 'ws.board.notAllowed' : 'common.couldNotSave'));
        this.reloads.set(this.reloads() + 1);
      },
    });
  }
}
