import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule, PackagePlus } from 'lucide-angular';
import { API_BASE_URL } from '../../core/config/api.config';
import { I18N } from '../../core/i18n/t.pipe';

export interface StockRow {
  id: string;
  name: string | null;
  unitCode: string | null;
  unit: 'KG' | 'BALE' | 'PIECE';
  remainingQuantity: string;
  weightKg: string | null;
  priceTier: string | null;
  category?: { name: string } | null;
  grade?: { name: string } | null;
  repackUnitId?: string | null;
}

export function stockName(i: StockRow): string {
  const kind = i.name || [i.category?.name, i.grade?.name].filter(Boolean).join(' ') || '—';
  return i.priceTier ? `${kind} (${i.priceTier})` : kind;
}

/** Stock: what is ready to sell. "Make bale" is the one primary action. */
@Component({
  selector: 'app-stock-home',
  standalone: true,
  imports: [RouterLink, LucideAngularModule, I18N],
  template: `
    <section class="floor">
      <header class="floor-head"><h1>{{ 'stock.title' | t }}</h1></header>
      <ul class="list">
        @for (i of items(); track i.id) {
          <li><a class="row" [routerLink]="i.repackUnitId ? ['/stock/label', i.repackUnitId] : null">
            <span><strong>{{ name(i) }}</strong><small class="ltr">{{ i.unitCode || '' }}</small></span>
            <span class="amount">@if (i.unit === 'KG') { {{ i.remainingQuantity | kg }} } @else { {{ i.remainingQuantity | num }} {{ (i.unit === 'BALE' ? 'unit.bales' : 'unit.pcs') | t }} }</span>
          </a></li>
        } @empty { <li class="empty">{{ 'stock.empty' | t }}</li> }
      </ul>
      <footer class="action-bar">
        <a class="btn primary" routerLink="/stock/bale"><lucide-icon [img]="icons.PackagePlus" [size]="20" /> {{ 'stock.makeBale' | t }}</a>
      </footer>
    </section>
  `,
})
export class StockHomeComponent implements OnInit {
  private readonly http = inject(HttpClient);
  protected readonly icons = { PackagePlus };
  protected readonly items = signal<StockRow[]>([]);
  protected readonly name = stockName;

  ngOnInit(): void {
    this.http.get<{ items?: StockRow[] }>(`${API_BASE_URL}/stock/items?status=AVAILABLE&limit=200`).subscribe({
      next: (page) => this.items.set(page.items ?? []),
      error: () => undefined,
    });
  }
}
