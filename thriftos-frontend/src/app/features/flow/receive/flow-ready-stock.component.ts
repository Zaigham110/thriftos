import { CommonModule, DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ArrowLeft, CheckCircle2, LucideAngularModule, PackageOpen, Plus, Trash2 } from 'lucide-angular';

import { API_BASE_URL } from '../../../core/config/api.config';
import { InventoryItem, StockUnit } from '../../../modules/inventory/inventory.models';
import { InventoryService } from '../../../modules/inventory/inventory.service';

interface Supplier { id: string; name: string; }
interface Tier { price: number | null; pieces: number | null; }

const UNITS: { value: StockUnit; label: string; hint: string }[] = [
  { value: 'BALE', label: 'Bales', hint: 'count bales' },
  { value: 'KG', label: 'Kg', hint: 'weigh it' },
  { value: 'PIECE', label: 'Pieces', hint: 'count pieces' },
];

/**
 * Journey 5: stock bought ready to sell. Four things: what it is, how it is counted, how many,
 * what it cost. Bought bales can then be opened into pieces by price tier.
 */
@Component({
  selector: 'app-flow-ready-stock',
  standalone: true,
  imports: [CommonModule, DecimalPipe, FormsModule, RouterLink, LucideAngularModule],
  template: `
    <section class="ready">
      <header><a routerLink="/receive" aria-label="Back to receive"><lucide-icon [img]="icons.ArrowLeft" [size]="20" /></a><h1>Ready stock</h1></header>
      @if (message(); as text) { <p class="notice" [class.error]="error()">{{ text }}</p> }

      @if (saved(); as item) {
        <section class="done">
          <lucide-icon [img]="icons.CheckCircle2" [size]="28" />
          <h2>{{ item.name || item.category?.name }} — {{ +item.quantity | number: '1.0-2' }} {{ unitLabel(item.unit) }}</h2>
          <p>Ready to sell. Cost {{ +item.unitCost | number: '1.0-2' }} per {{ unitLabel(item.unit, 1) }}.</p>
          <a routerLink="/sell/new" class="primary">Sell now</a>
          <button type="button" (click)="reset()">Add more stock</button>
        </section>
      } @else {
        <form (ngSubmit)="save()">
          <label>What is it?<input name="name" [(ngModel)]="name" placeholder="e.g. Jeans A grade, Ladies tops" required maxlength="120" /></label>
          <fieldset><legend>Counted in</legend>
            <div class="tiles">
              @for (u of units; track u.value) {
                <button type="button" [class.on]="unit() === u.value" (click)="unit.set(u.value)"><strong>{{ u.label }}</strong><small>{{ u.hint }}</small></button>
              }
            </div>
          </fieldset>
          <label>How many {{ unitLabel(unit()) }}?<input name="quantity" type="number" inputmode="decimal" min="0" [(ngModel)]="quantity" required /></label>
          <label>Total cost (Rs)<input name="totalCost" type="number" inputmode="decimal" min="0" [(ngModel)]="totalCost" required /></label>
          @if (perUnit() !== null) { <p class="hint">= Rs {{ perUnit() | number: '1.0-2' }} per {{ unitLabel(unit(), 1) }}</p> }
          <details>
            <summary>More (supplier, sale price)</summary>
            <label>Supplier<select name="vendorId" [(ngModel)]="vendorId"><option value="">—</option>@for (s of suppliers(); track s.id) { <option [value]="s.id">{{ s.name }}</option> }</select></label>
            @if (unit() === 'BALE') { <label>Total weight kg<input name="weightKg" type="number" inputmode="decimal" min="0" [(ngModel)]="weightKg" /></label> }
            <label>Sale price per {{ unitLabel(unit(), 1) }} (Rs)<input name="salePrice" type="number" inputmode="decimal" min="0" [(ngModel)]="salePrice" /></label>
          </details>
          <button type="submit" class="primary save" [disabled]="!canSave() || saving()">{{ saving() ? 'Saving…' : 'Save stock' }}</button>
        </form>
      }

      <section class="bales">
        <h2>Open a bale into pieces</h2>
        @for (bale of bales(); track bale.id) {
          <article>
            <div><strong>{{ bale.name || bale.category?.name }}</strong><small>{{ +(bale.remainingQuantity ?? 0) | number: '1.0-0' }} bale(s) left · Rs {{ +bale.unitCost | number: '1.0-0' }} each</small></div>
            <button type="button" (click)="startOpen(bale)"><lucide-icon [img]="icons.PackageOpen" [size]="18" /> Open</button>
          </article>
          @if (opening()?.id === bale.id) {
            <div class="tiers">
              @for (tier of tiers(); track $index) {
                <div class="tier">
                  <label>Price Rs<input type="number" inputmode="decimal" min="0" [(ngModel)]="tier.price" [name]="'price' + $index" /></label>
                  <label>Pieces<input type="number" inputmode="numeric" min="1" [(ngModel)]="tier.pieces" [name]="'pieces' + $index" /></label>
                  <button type="button" aria-label="Remove price" (click)="removeTier($index)"><lucide-icon [img]="icons.Trash2" [size]="18" /></button>
                </div>
              }
              <button type="button" class="add" (click)="addTier()"><lucide-icon [img]="icons.Plus" [size]="18" /> Add price</button>
              <button type="button" class="primary" [disabled]="!canOpen() || saving()" (click)="open(bale)">Open 1 bale</button>
            </div>
          }
        } @empty { <p class="hint">Bought bales show here.</p> }
      </section>
    </section>
  `,
  styles: [`
    .ready { display:grid; gap:16px; max-width:560px; margin:0 auto; }
    header { display:flex; align-items:center; gap:8px; }
    header a { width:48px; height:48px; display:grid; place-items:center; color:var(--flow-ink); }
    h1 { margin:0; font-size:24px; }
    h2 { margin:0; font-size:17px; }
    form, .done, .bales { display:grid; gap:14px; padding:16px; border:1px solid var(--flow-line); border-radius:var(--flow-radius); background:#fff; }
    label { display:grid; gap:6px; font-size:14px; font-weight:700; }
    input, select { min-height:48px; box-sizing:border-box; padding:0 12px; border:1px solid var(--flow-line); border-radius:10px; font:inherit; font-size:18px; }
    fieldset { margin:0; padding:0; border:0; display:grid; gap:6px; }
    legend { font-size:14px; font-weight:700; margin-bottom:6px; }
    .tiles { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; }
    .tiles button { min-height:64px; display:grid; align-content:center; gap:2px; border:1px solid var(--flow-line); border-radius:12px; background:#fff; color:var(--flow-ink); font:inherit; }
    .tiles button.on { border:2px solid var(--flow-teal); background:var(--flow-teal-soft); color:var(--flow-teal); }
    .tiles strong { font-size:17px; }
    .tiles small { font-size:12px; color:var(--flow-ink-soft); }
    .hint { margin:0; color:var(--flow-ink-soft); font-size:14px; }
    details { display:grid; gap:12px; }
    summary { min-height:44px; display:flex; align-items:center; font-weight:700; color:var(--flow-teal); cursor:pointer; }
    details[open] label { margin-top:12px; }
    .primary { min-height:52px; display:flex; align-items:center; justify-content:center; border:0; border-radius:12px; background:var(--flow-teal); color:#fff; font:inherit; font-size:17px; font-weight:800; text-decoration:none; }
    .primary:disabled { opacity:.5; }
    .done { justify-items:center; text-align:center; }
    .done lucide-icon { color:var(--flow-teal); }
    .done p { margin:0; color:var(--flow-ink-soft); }
    .done .primary { width:100%; }
    .done button:not(.primary), .add { min-height:48px; border:1px solid var(--flow-line); border-radius:12px; background:#fff; color:var(--flow-ink); font:inherit; font-weight:700; }
    .done button:not(.primary) { width:100%; }
    .notice { margin:0; padding:12px; border-radius:10px; background:var(--flow-teal-soft); color:var(--flow-teal); }
    .notice.error { background:var(--flow-clay-soft); color:var(--flow-clay); }
    .bales article { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:10px 0; border-top:1px solid var(--flow-line); }
    .bales article small { display:block; color:var(--flow-ink-soft); font-size:13px; }
    .bales article button { min-height:48px; display:flex; align-items:center; gap:6px; padding:0 14px; border:1px solid var(--flow-line); border-radius:10px; background:#fff; font:inherit; font-weight:700; }
    .tiers { display:grid; gap:10px; padding:12px; border-radius:12px; background:var(--flow-canvas); }
    .tier { display:grid; grid-template-columns:1fr 1fr 48px; gap:8px; align-items:end; }
    .tier > button { width:48px; height:48px; border:0; background:transparent; color:var(--flow-clay); }
    .add { display:flex; align-items:center; justify-content:center; gap:6px; }
  `],
})
export class FlowReadyStockComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly stock = inject(InventoryService);
  protected readonly icons = { ArrowLeft, CheckCircle2, PackageOpen, Plus, Trash2 };
  protected readonly units = UNITS;
  protected readonly unit = signal<StockUnit>('BALE');
  protected readonly suppliers = signal<Supplier[]>([]);
  protected readonly bales = signal<InventoryItem[]>([]);
  protected readonly saved = signal<InventoryItem | null>(null);
  protected readonly opening = signal<InventoryItem | null>(null);
  protected readonly tiers = signal<Tier[]>([]);
  protected readonly saving = signal(false);
  protected readonly message = signal('');
  protected readonly error = signal(false);
  protected name = '';
  protected quantity: number | null = null;
  protected totalCost: number | null = null;
  protected vendorId = '';
  protected weightKg: number | null = null;
  protected salePrice: number | null = null;

  ngOnInit(): void {
    this.http.get<Supplier[] | { data?: Supplier[] }>(`${API_BASE_URL}/procurement/vendors`).subscribe({
      next: (result) => this.suppliers.set(Array.isArray(result) ? result : result.data || []),
    });
    this.loadBales();
  }

  protected unitLabel(unit: StockUnit, count = 2): string {
    const one = { KG: 'kg', BALE: 'bale', PIECE: 'piece' }[unit];
    return count === 1 || unit === 'KG' ? one : `${one}s`;
  }

  protected perUnit(): number | null {
    return this.quantity && this.totalCost !== null ? this.totalCost / this.quantity : null;
  }

  protected canSave(): boolean {
    return !!this.name.trim() && (this.quantity ?? 0) > 0 && (this.totalCost ?? -1) >= 0;
  }

  protected save(): void {
    if (!this.canSave()) return;
    this.saving.set(true);
    this.message.set('');
    this.stock
      .receiveReadyStock({
        name: this.name.trim(),
        unit: this.unit(),
        quantity: this.quantity!,
        totalCost: this.totalCost!,
        ...(this.vendorId ? { vendorId: this.vendorId } : {}),
        ...(this.unit() === 'BALE' && this.weightKg ? { weightKg: this.weightKg } : {}),
        ...(this.salePrice !== null ? { salePrice: this.salePrice } : {}),
      })
      .subscribe({
        next: (item) => {
          this.saving.set(false);
          this.saved.set(item);
          this.loadBales();
        },
        error: (e) => this.fail(e),
      });
  }

  protected reset(): void {
    this.saved.set(null);
    this.name = '';
    this.quantity = null;
    this.totalCost = null;
    this.weightKg = null;
    this.salePrice = null;
  }

  protected startOpen(bale: InventoryItem): void {
    this.opening.set(this.opening()?.id === bale.id ? null : bale);
    this.tiers.set([{ price: null, pieces: null }]);
  }

  protected addTier(): void {
    this.tiers.update((t) => [...t, { price: null, pieces: null }]);
  }

  protected removeTier(index: number): void {
    this.tiers.update((t) => t.filter((_, i) => i !== index));
  }

  protected canOpen(): boolean {
    const tiers = this.tiers();
    return tiers.length > 0 && tiers.every((t) => (t.price ?? -1) >= 0 && (t.pieces ?? 0) >= 1 && Number.isInteger(t.pieces));
  }

  protected open(bale: InventoryItem): void {
    if (!this.canOpen()) return;
    this.saving.set(true);
    this.stock.openBale(bale.id, { tiers: this.tiers().map((t) => ({ price: t.price!, pieces: t.pieces! })) }).subscribe({
      next: (result) => {
        this.saving.set(false);
        this.opening.set(null);
        this.error.set(false);
        const count = result.pieces.reduce((n, p) => n + Number(p.quantity), 0);
        this.message.set(`Opened: ${count} pieces ready to sell.`);
        this.loadBales();
      },
      error: (e) => this.fail(e),
    });
  }

  private loadBales(): void {
    this.stock.getAll({ source: 'PURCHASED', status: 'AVAILABLE', limit: 50 }).subscribe({
      next: (page) => this.bales.set(page.items.filter((i) => i.unit === 'BALE')),
    });
  }

  private fail(e: any): void {
    this.saving.set(false);
    this.error.set(true);
    this.message.set(e?.error?.message || 'Could not save. Please try again.');
  }
}
