import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Download, LucideAngularModule, Printer } from 'lucide-angular';
import { I18nService } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { ToastService } from '../../shared/floor/toast.service';

type Shipment = Record<(typeof FIELDS)[number], string | null>;
interface PackRow { code: string | null; item: string | null; unit: 'KG' | 'BALE' | 'PIECE'; quantity: string; kg: string | null; pieces: number | null; unitPrice: string; total: string }
interface FromRow { lot: string | null; container: string | null; supplier: string | null; origin: string | null; category: string | null; grade: string | null; sortedAt: string | null; gradedAt: string | null; sortedBy: string | null }
interface BaleRecord { code: string; item: string | null; madeAt: string; kg: string | null; pieces: number | null; from: FromRow[] }
interface Pack {
  sale: { id: string; number: string; date: string; currency: string; total: string };
  seller: { name: string; phone: string | null; address: string | null; city: string | null };
  buyer: { name: string; phone: string | null; city: string | null };
  shipment: Shipment;
  packing: PackRow[];
  totals: { lines: number; bales: number; kg: string; pieces: number; amount: string };
  records: BaleRecord[];
}
type Doc = 'packing' | 'invoice' | 'records';

const FIELDS = ['destinationCountry', 'portOfLoading', 'portOfDischarge', 'vesselName', 'billOfLadingNumber', 'containerSealNumber', 'freightForwarder'] as const;

/**
 * Phase 9.2: an export sale's pack, made from what ThriftOS already has: the shipment (editable), the packing list,
 * the commercial invoice and each bale's sorting record ("fit for reuse": where it came from, sorted and graded
 * when, by whom), each printable or saved as PDF; the packing list also as CSV. Certificates (fumigation…) are
 * attached in the sale's Activity.
 */
@Component({
  selector: 'app-export-pack',
  standalone: true,
  imports: [FormsModule, LucideAngularModule, TPipe],
  template: `
    @if (local()) {
      <!-- A local sale: fill in the shipment and make it an export sale; then the pack appears. -->
      <form class="ship" (ngSubmit)="makeExport()">
        <h3>{{ 'xp.makeTitle' | t }}</h3>
        <p class="hint">{{ 'xp.makeHint' | t }}</p>
        <div class="grid">
          @for (f of fields; track f) {
            <label>{{ ('xp.f.' + f) | t }}<input [name]="f" maxlength="120" [(ngModel)]="edit[f]" /></label>
          }
        </div>
        <div class="row"><button type="submit" class="ws-btn ws-btn-primary" [disabled]="busy()">{{ 'xp.makeExport' | t }}</button></div>
      </form>
    } @else if (pack(); as p) {
      <form class="ship" (ngSubmit)="saveShipment()">
        <h3>{{ 'xp.shipment' | t }}</h3>
        <div class="grid">
          @for (f of fields; track f) {
            <label>{{ ('xp.f.' + f) | t }}<input [name]="f" maxlength="120" [(ngModel)]="edit[f]" /></label>
          }
        </div>
        <div class="row"><button type="submit" class="ws-btn" [disabled]="busy()">{{ 'xp.saveShipment' | t }}</button></div>
      </form>

      <h3>{{ 'xp.documents' | t }}</h3>
      <div class="docs">
        <button type="button" class="ws-btn" (click)="open('packing')"><lucide-icon [img]="icons.Printer" [size]="16" /> {{ 'xp.packingList' | t }}</button>
        <button type="button" class="ws-btn" (click)="open('invoice')"><lucide-icon [img]="icons.Printer" [size]="16" /> {{ 'xp.invoice' | t }}</button>
        <button type="button" class="ws-btn" (click)="open('records')"><lucide-icon [img]="icons.Printer" [size]="16" /> {{ 'xp.records' | t }}</button>
        <button type="button" class="ws-btn" (click)="csv(p)"><lucide-icon [img]="icons.Download" [size]="16" /> {{ 'xp.csv' | t }}</button>
      </div>
      <p class="hint">{{ 'xp.attachHint' | t }}</p>

      @if (doc(); as d) {
        <div class="backdrop no-print" (click)="doc.set(null)"></div>
        <section class="paper" role="dialog" aria-modal="true" [attr.aria-label]="('xp.' + docKey(d)) | t">
          <header class="top">
            <div><strong>{{ p.seller.name }}</strong><small>{{ [p.seller.address, p.seller.city].filter(isText).join(', ') }}@if (p.seller.phone) { · {{ p.seller.phone }} }</small></div>
            <div class="right"><h2>{{ ('xp.' + docKey(d)) | t }}</h2><small>{{ p.sale.number }} · {{ day(p.sale.date) }}</small></div>
          </header>
          <div class="parties">
            <div><small>{{ 'xp.buyer' | t }}</small><strong>{{ p.buyer.name }}</strong><small>{{ [p.buyer.city, p.shipment.destinationCountry].filter(isText).join(', ') }}</small></div>
            <div><small>{{ 'xp.shipment' | t }}</small>
              @for (f of fields; track f) { @if (p.shipment[f]) { <span>{{ ('xp.f.' + f) | t }}: {{ p.shipment[f] }}</span> } }
            </div>
          </div>

          @if (d === 'packing') {
            <table>
              <thead><tr><th scope="col">#</th><th scope="col">{{ 'xp.code' | t }}</th><th scope="col">{{ 'xp.item' | t }}</th><th scope="col" class="num">{{ 'xp.kg' | t }}</th><th scope="col" class="num">{{ 'xp.pieces' | t }}</th></tr></thead>
              <tbody>
                @for (r of p.packing; track $index) { <tr><td>{{ $index + 1 }}</td><td class="ltr">{{ r.code ?? '—' }}</td><td>{{ r.item ?? '—' }}</td><td class="num">{{ r.kg ? i18n.kg(r.kg) : '—' }}</td><td class="num">{{ r.pieces ?? '—' }}</td></tr> }
              </tbody>
              <tfoot><tr><td colspan="3">{{ 'xp.totalBales' | t: { n: p.totals.bales } }}</td><td class="num">{{ i18n.kg(p.totals.kg) }}</td><td class="num">{{ p.totals.pieces || '—' }}</td></tr></tfoot>
            </table>
          } @else if (d === 'invoice') {
            <table>
              <thead><tr><th scope="col">{{ 'xp.item' | t }}</th><th scope="col" class="num">{{ 'xp.qty' | t }}</th><th scope="col" class="num">{{ 'xp.kg' | t }}</th><th scope="col" class="num">{{ 'xp.price' | t }}</th><th scope="col" class="num">{{ 'xp.amount' | t }}</th></tr></thead>
              <tbody>
                @for (r of p.packing; track $index) { <tr><td>{{ r.item ?? '—' }}@if (r.code) { <small class="ltr"> {{ r.code }}</small> }</td><td class="num">{{ i18n.num(r.quantity) }} {{ ('xp.unit.' + r.unit) | t }}</td><td class="num">{{ r.kg ? i18n.kg(r.kg) : '—' }}</td><td class="num">{{ i18n.money(r.unitPrice) }}</td><td class="num">{{ i18n.money(r.total) }}</td></tr> }
              </tbody>
              <tfoot><tr><td colspan="4">{{ 'xp.totalAmount' | t: { currency: p.sale.currency } }}</td><td class="num">{{ i18n.money(p.totals.amount) }}</td></tr></tfoot>
            </table>
            <p class="small">{{ 'xp.invoiceNote' | t }}</p>
          } @else {
            <p class="small">{{ 'xp.recordsNote' | t }}</p>
            @for (b of p.records; track b.code) {
              <div class="rec">
                <strong class="ltr">{{ b.code }}</strong> · {{ b.item ?? '—' }}@if (b.kg) { · {{ i18n.kg(b.kg) }} }@if (b.pieces) { · {{ 'ws.lf.piecesN' | t: { n: b.pieces } }} } · {{ 'xp.baled' | t: { date: day(b.madeAt) } }}
                @for (f of b.from; track $index) {
                  <small>{{ 'xp.from' | t: { lot: f.lot ?? '—', origin: f.origin ?? '—', supplier: f.supplier ?? '—' } }}@if (f.container) { · {{ 'xp.container' | t: { n: f.container } }} } · {{ [f.category, f.grade].filter(isText).join(' · ') }}@if (f.sortedAt) { · {{ 'xp.sorted' | t: { date: day(f.sortedAt) } }} }@if (f.gradedAt) { · {{ 'xp.graded' | t: { date: day(f.gradedAt) } }} }@if (f.sortedBy) { · {{ 'xp.by' | t: { name: f.sortedBy } }} }</small>
                }
              </div>
            }
          }
          <div class="actions no-print">
            <button type="button" class="ws-btn primary" (click)="print()"><lucide-icon [img]="icons.Printer" [size]="16" /> {{ 'billing.print' | t }}</button>
            <button type="button" class="ws-btn" (click)="doc.set(null)">{{ 'billing.close' | t }}</button>
          </div>
        </section>
      }
    } @else if (error()) {
      <p class="hint" role="alert">{{ error() }}</p>
    }
  `,
  styles: [`
    :host { display:grid; gap:var(--ws-3, 12px); }
    h3 { margin:0; font-size:15px; }
    .ship { display:grid; gap:10px; }
    .grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(200px, 1fr)); gap:10px; }
    .grid label { display:grid; gap:4px; font-size:13px; font-weight:600; }
    .grid input { min-height:38px; padding:6px 10px; border:1px solid var(--ws-line); border-radius:8px; font:inherit; font-weight:400; }
    .row, .docs, .actions { display:flex; gap:8px; flex-wrap:wrap; }
    .hint, .small { color:var(--ws-muted); font-size:13px; }
    .backdrop { position:fixed; inset:0; background:rgba(0,0,0,.35); z-index:40; }
    .paper { position:fixed; inset-inline:16px; inset-block:5vh; max-width:820px; margin-inline:auto; overflow:auto; z-index:50; background:#fff; color:#111; border-radius:12px; padding:24px; display:grid; gap:14px; align-content:start; }
    .top { display:flex; justify-content:space-between; gap:12px; border-block-end:2px solid #111; padding-block-end:10px; }
    .top div { display:grid; } .top .right { text-align:end; } .top h2 { margin:0; font-size:20px; }
    .parties { display:grid; grid-template-columns:1fr 1fr; gap:16px; font-size:13px; }
    .parties div { display:grid; gap:2px; } .parties small { color:#555; }
    table { width:100%; border-collapse:collapse; font-size:13px; }
    th, td { padding:6px; border-block-end:1px solid #ccc; text-align:start; }
    .num { text-align:end; } tfoot td { font-weight:800; border-block-start:2px solid #111; }
    .rec { display:grid; gap:2px; padding-block:6px; border-block-end:1px solid #ddd; font-size:13px; }
    .rec small { color:#333; }
    @media print {
      :host ::ng-deep body * { visibility:hidden; }
      .paper, .paper * { visibility:visible; }
      .paper { position:absolute; inset:0; max-width:none; border-radius:0; overflow:visible; }
      .no-print { display:none !important; }
    }
  `],
})
export class ExportPackComponent {
  private readonly http = inject(HttpClient);
  protected readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);
  readonly saleId = input.required<string>();
  /** A local sale: offer to make it an export sale instead of showing the pack. */
  readonly local = input(false);
  readonly madeExport = output<void>();
  protected readonly icons = { Download, Printer };
  protected readonly fields = FIELDS;
  protected readonly pack = signal<Pack | null>(null);
  protected readonly doc = signal<Doc | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected edit: Record<string, string> = {};
  protected readonly isText = (x: string | null | undefined): x is string => !!x;

  constructor() {
    effect(() => {
      if (!this.local()) this.load(this.saleId());
    });
  }

  private load(id: string): void {
    this.http.get<Pack>(`/api/sales/${id}/export-pack`).subscribe({
      next: (p) => {
        this.pack.set(p);
        this.edit = Object.fromEntries(FIELDS.map((f) => [f, p.shipment[f] ?? '']));
      },
      error: (e: HttpErrorResponse) => this.error.set(e.error?.message ?? this.i18n.t('common.couldNotLoad')),
    });
  }

  protected docKey(d: Doc): string {
    return d === 'packing' ? 'packingList' : d === 'invoice' ? 'invoice' : 'records';
  }

  protected day(v: string | null): string {
    return v ? new Date(v).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  }

  protected open(d: Doc): void {
    this.doc.set(d);
  }

  protected print(): void {
    window.print();
  }

  protected saveShipment(): void {
    this.busy.set(true);
    this.http.patch(`/api/sales/${this.saleId()}/shipment`, this.edit).subscribe({
      next: () => { this.busy.set(false); this.toast.show(this.i18n.t('xp.saved')); this.load(this.saleId()); },
      error: (e: HttpErrorResponse) => { this.busy.set(false); this.toast.error(e.error?.message ?? this.i18n.t('common.couldNotSave')); },
    });
  }

  /** A local sale becomes an export sale with this shipment; the page then shows its pack. */
  protected makeExport(): void {
    this.busy.set(true);
    this.http.patch(`/api/sales/${this.saleId()}/shipment`, { ...this.edit, makeExport: true }).subscribe({
      next: () => { this.busy.set(false); this.toast.show(this.i18n.t('xp.made')); this.madeExport.emit(); },
      error: (e: HttpErrorResponse) => { this.busy.set(false); this.toast.error(e.error?.message ?? this.i18n.t('common.couldNotSave')); },
    });
  }

  /** The packing list as CSV (opens in Excel). */
  protected csv(p: Pack): void {
    const q = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [['No', 'Bale code', 'Item', 'Kg', 'Pieces'], ...p.packing.map((r, i) => [i + 1, r.code, r.item, r.kg, r.pieces])];
    const blob = new Blob([rows.map((r) => r.map(q).join(',')).join('\r\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `packing-list-${p.sale.number}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}
