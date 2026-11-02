import { Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, Plus, Search } from 'lucide-angular';
import { TPipe } from '../../core/i18n/t.pipe';

export interface Tile {
  id: string;
  label: string;
  /** Second line: kg left, phone, country… */
  sub?: string;
  /** Extra words to match in search (phone, city). */
  keywords?: string;
  tone?: 'waste';
}

/**
 * Big tap tiles instead of dropdowns (docs/v1/05 rule 4): min 64×64, most-used first (the caller orders them).
 * A search box appears only when there are more than 8; "+ new" is an optional last tile.
 */
@Component({
  selector: 'tos-tiles',
  standalone: true,
  imports: [FormsModule, LucideAngularModule, TPipe],
  template: `
    @if (items().length > limit()) {
      <label class="search">
        <lucide-icon [img]="icons.Search" [size]="18" />
        <input type="search" [attr.aria-label]="'common.search' | t" [placeholder]="searchPlaceholder() | t" [ngModel]="query()" (ngModelChange)="query.set($event)" />
      </label>
    }
    <div class="tiles" [class.two]="columns() === 2" role="list">
      @for (tile of shown(); track tile.id) {
        <button type="button" role="listitem" class="tile" [class.on]="tile.id === selected()" [class.waste]="tile.tone === 'waste'" [attr.aria-pressed]="tile.id === selected()" (click)="choose(tile)">
          <strong>{{ tile.label }}</strong>
          @if (tile.sub) { <small>{{ tile.sub }}</small> }
        </button>
      }
      @if (newLabel(); as label) {
        <button type="button" role="listitem" class="tile add" (click)="addNew.emit(query())"><lucide-icon [img]="icons.Plus" [size]="20" /><strong>{{ label | t }}</strong></button>
      }
    </div>
    @if (!shown().length && !newLabel()) { <p class="empty">{{ emptyText() | t }}</p> }
  `,
  styles: [`
    :host { display:grid; gap:10px; }
    .search { display:flex; align-items:center; gap:8px; padding-inline-start:12px; border:1px solid var(--tos-line); border-radius:12px; background:#fff; }
    .search input { flex:1; min-width:0; min-height:52px; border:0; background:transparent; font:inherit; font-size:17px; }
    .tiles { display:grid; grid-template-columns:repeat(auto-fill, minmax(min(100%, 140px), 1fr)); gap:10px; }
    .tiles.two { grid-template-columns:repeat(2, minmax(0,1fr)); }
    .tile { min-height:72px; display:grid; align-content:center; justify-items:start; gap:2px; padding:10px 14px; border:1px solid var(--tos-line); border-radius:14px; background:#fff; color:var(--tos-ink); font:inherit; text-align:start; cursor:pointer; overflow-wrap:anywhere; }
    .tile strong { font-size:17px; line-height:1.25; }
    .tile small { color:var(--tos-ink-soft); font-size:13px; font-weight:600; }
    .tile.on { border:2px solid var(--tos-primary); background:var(--tos-primary-soft); }
    .tile.waste { background:#f6f3ee; }
    .tile.add { justify-items:center; text-align:center; border-style:dashed; color:var(--tos-primary); }
    .tile:active { transform:scale(.98); }
    .empty { margin:0; padding:16px; color:var(--tos-ink-soft); text-align:center; }
  `],
})
export class TilesComponent {
  readonly items = input.required<Tile[]>();
  readonly selected = input<string | null>(null);
  readonly newLabel = input<string | null>(null);
  readonly columns = input<'auto' | 2>('auto');
  /** Tiles shown before searching (8 for suppliers/customers; sorting shows every category). */
  readonly limit = input(8);
  readonly searchPlaceholder = input('common.search');
  readonly emptyText = input('common.empty');
  readonly pick = output<Tile>();
  readonly addNew = output<string>();
  protected readonly icons = { Plus, Search };
  protected readonly query = signal('');
  protected choose(tile: Tile): void {
    this.query.set('');
    this.pick.emit(tile);
  }

  protected readonly shown = computed(() => {
    const q = this.query().trim().toLowerCase();
    const list = q ? this.items().filter((t) => `${t.label} ${t.sub ?? ''} ${t.keywords ?? ''}`.toLowerCase().includes(q)) : this.items();
    return q ? list : list.slice(0, this.limit());
  });
}
