import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { HelpLinkComponent } from '../help/help-link.component';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule, PackagePlus, Printer, ScanLine } from 'lucide-angular';
import { API_BASE_URL } from '../../core/config/api.config';
import { I18nService } from '../../core/i18n/i18n.service';
import { I18N } from '../../core/i18n/t.pipe';
import { ScanSheetComponent } from '../../shared/floor/scan-sheet.component';
import { ToastService } from '../../shared/floor/toast.service';

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
  imports: [HelpLinkComponent, RouterLink, LucideAngularModule, I18N, ScanSheetComponent],
  template: `
    <section class="floor">
      <header class="floor-head">
        <h1>{{ 'stock.title' | t }}</h1>
        @if (baleIds().length) { <a class="icon-btn" routerLink="/stock/labels" [queryParams]="{ ids: baleIds().join(',') }" [attr.aria-label]="'stock.printLabel' | t"><lucide-icon [img]="icons.Printer" [size]="22" /></a> }
        <button type="button" class="icon-btn" [attr.aria-label]="'stock.scan' | t" (click)="scanning.set(true)"><lucide-icon [img]="icons.ScanLine" [size]="24" /></button>
      </header>
      @if (scanning()) { <tos-scan-sheet (scanned)="open($event)" (closed)="scanning.set(false)" /> }
      <ul class="list">
        @for (i of items(); track i.id) {
          <li><a class="row" [routerLink]="i.repackUnitId ? ['/stock/label', i.repackUnitId] : null">
            <span><strong>{{ name(i) }}</strong><small class="ltr">{{ i.unitCode || '' }}</small></span>
            <span class="amount">@if (i.unit === 'KG') { {{ i.remainingQuantity | kg }} } @else { {{ i.remainingQuantity | num }} {{ (i.unit === 'BALE' ? 'unit.bales' : 'unit.pcs') | t }} }</span>
          </a></li>
        } @empty { <li class="empty">{{ 'stock.empty' | t }}<app-help-link topic="stock" /></li> }
      </ul>
      <footer class="action-bar">
        <a class="btn primary" routerLink="/stock/bale"><lucide-icon [img]="icons.PackagePlus" [size]="20" /> {{ 'stock.makeBale' | t }}</a>
      </footer>
    </section>
  `,
})
export class StockHomeComponent implements OnInit {
  private readonly http = inject(HttpClient);
  protected readonly icons = { PackagePlus, Printer, ScanLine };
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  protected readonly scanning = signal(false);
  /** Bales on the list (newest 24) for one A4 sheet of labels. */
  protected baleIds(): string[] {
    return this.items().filter((i) => i.repackUnitId).slice(0, 24).map((i) => i.repackUnitId!);
  }
  protected readonly items = signal<StockRow[]>([]);
  protected readonly name = stockName;

  /** Scan (or type) a bale code → its label page. */
  protected open(code: string): void {
    this.scanning.set(false);
    this.http.get<{ repackUnitId: string | null }>(`${API_BASE_URL}/sales/scan/qr/${encodeURIComponent(code)}`).subscribe({
      next: (item) => (item.repackUnitId ? this.router.navigate(['/stock/label', item.repackUnitId]) : this.toast.error(this.i18n.t('stock.notFound'))),
      error: () => this.toast.error(this.i18n.t('stock.notFound')),
    });
  }

  ngOnInit(): void {
    this.http.get<{ items?: StockRow[] }>(`${API_BASE_URL}/stock/items?status=AVAILABLE&limit=200`).subscribe({
      next: (page) => this.items.set(page.items ?? []),
      error: () => undefined,
    });
  }
}
