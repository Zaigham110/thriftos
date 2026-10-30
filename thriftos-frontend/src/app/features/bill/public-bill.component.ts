import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, input, signal } from '@angular/core';

import { API_BASE_URL } from '../../core/config/api.config';

interface PublicBill {
  business: string;
  saleNumber: string;
  date: string;
  customer: string;
  currency: string;
  lines: { description: string; unit: 'KG' | 'BALE' | 'PIECE'; quantity: string; unitPrice: string; lineTotal: string }[];
  total: string;
  paid: string;
  due: string;
  status: 'ISSUED' | 'PARTIALLY_PAID' | 'PAID';
}

/** The bill link shared on WhatsApp. No login: the token in the link is the key. */
@Component({
  selector: 'app-public-bill',
  standalone: true,
  imports: [CommonModule, DatePipe, DecimalPipe],
  template: `
    <main class="bill">
      @if (bill(); as b) {
        <header><h1>{{ b.business }}</h1><p>Bill {{ b.saleNumber }} · {{ b.date | date: 'd MMM y' }}</p><p>{{ b.customer }}</p></header>
        <table>
          <thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Rate</th><th class="num">Amount</th></tr></thead>
          <tbody>
            @for (line of b.lines; track $index) {
              <tr>
                <td>{{ line.description }}</td>
                <td class="num">{{ +line.quantity | number: '1.0-2' }} {{ unit(line.unit) }}</td>
                <td class="num">{{ +line.unitPrice | number: '1.0-2' }}</td>
                <td class="num">{{ +line.lineTotal | number: '1.0-2' }}</td>
              </tr>
            }
          </tbody>
        </table>
        <dl>
          <div><dt>Total</dt><dd>Rs {{ +b.total | number: '1.0-2' }}</dd></div>
          <div><dt>Paid</dt><dd>Rs {{ +b.paid | number: '1.0-2' }}</dd></div>
          @if (+b.due > 0) { <div class="due"><dt>Due</dt><dd>Rs {{ +b.due | number: '1.0-2' }}</dd></div> }
        </dl>
        <button type="button" (click)="print()">Print / save PDF</button>
      } @else if (missing()) {
        <p class="missing">This bill link is not valid.</p>
      } @else {
        <p class="missing">Loading…</p>
      }
    </main>
  `,
  styles: [`
    :host { display:block; min-height:100vh; background:#f4f6f5; color:#18252a; font-family:var(--font-family, system-ui); }
    .bill { max-width:560px; margin:0 auto; padding:24px 16px; background:#fff; min-height:100vh; box-sizing:border-box; }
    header { text-align:center; margin-bottom:20px; }
    h1 { margin:0 0 6px; font-size:22px; }
    header p { margin:2px 0; color:#56666b; }
    table { width:100%; border-collapse:collapse; font-size:15px; }
    th, td { padding:10px 4px; border-bottom:1px solid #e3e8e6; text-align:left; }
    th { font-size:12px; color:#56666b; text-transform:uppercase; }
    .num { text-align:right; white-space:nowrap; }
    dl { margin:16px 0; display:grid; gap:6px; }
    dl div { display:flex; justify-content:space-between; font-size:17px; }
    dt { color:#56666b; }
    dd { margin:0; font-weight:800; }
    .due dd { color:#b54a2c; }
    button { width:100%; min-height:48px; border:1px solid #d6dedb; border-radius:12px; background:#fff; font:inherit; font-weight:700; }
    .missing { text-align:center; padding:48px 0; color:#56666b; }
    @media print { button { display:none; } :host { background:#fff; } }
  `],
})
export class PublicBillComponent implements OnInit {
  readonly token = input.required<string>();
  private readonly http = inject(HttpClient);
  protected readonly bill = signal<PublicBill | null>(null);
  protected readonly missing = signal(false);

  ngOnInit(): void {
    this.http.get<PublicBill>(`${API_BASE_URL}/public/bills/${encodeURIComponent(this.token())}`).subscribe({
      next: (bill) => this.bill.set(bill),
      error: () => this.missing.set(true),
    });
  }

  protected unit(unit: string): string {
    return { KG: 'kg', BALE: 'bale', PIECE: 'pcs' }[unit] ?? '';
  }

  protected print(): void {
    window.print();
  }
}
