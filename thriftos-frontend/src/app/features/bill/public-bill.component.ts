import { CommonModule, DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, input, signal } from '@angular/core';

import { API_BASE_URL } from '../../core/config/api.config';
import { I18nService } from '../../core/i18n/i18n.service';
import { I18N } from '../../core/i18n/t.pipe';

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
  imports: [CommonModule, DatePipe, I18N],
  template: `
    <main class="bill">
      <button type="button" class="lang" (click)="toggleLang()">{{ 'nav.language' | t }}</button>
      @if (bill(); as b) {
        <header>
          <h1>{{ b.business }}</h1>
          <p>{{ 'bill.no' | t: { no: b.saleNumber } }} · <span class="ltr">{{ b.date | date: 'd MMM y' : undefined : 'en' }}</span></p>
          <p>{{ 'bill.to' | t }}: {{ b.customer }}</p>
          <p class="status" [class.due]="b.status !== 'PAID'">{{ 'bill.status.' + b.status | t }}</p>
        </header>
        <table>
          <thead><tr><th>{{ 'bill.item' | t }}</th><th class="num">{{ 'bill.qty' | t }}</th><th class="num">{{ 'bill.rate' | t }}</th><th class="num">{{ 'bill.amount' | t }}</th></tr></thead>
          <tbody>
            @for (line of b.lines; track $index) {
              <tr>
                <td>{{ line.description }}</td>
                <td class="num">{{ line.quantity | num }} {{ unit(line.unit) | t }}</td>
                <td class="num">{{ line.unitPrice | num }}</td>
                <td class="num">{{ line.lineTotal | num }}</td>
              </tr>
            }
          </tbody>
        </table>
        <dl>
          <div><dt>{{ 'bill.total' | t }}</dt><dd>{{ b.total | rs }}</dd></div>
          <div><dt>{{ 'bill.paid' | t }}</dt><dd>{{ b.paid | rs }}</dd></div>
          @if (+b.due > 0) { <div class="due"><dt>{{ 'bill.due' | t }}</dt><dd>{{ b.due | rs }}</dd></div> }
        </dl>
        <button type="button" (click)="print()">{{ 'bill.print' | t }}</button>
      } @else if (missing()) {
        <p class="missing">{{ 'bill.notFound' | t }}</p>
      } @else {
        <p class="missing">{{ 'common.loading' | t }}</p>
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
    th, td { padding:10px 4px; border-bottom:1px solid #e3e8e6; text-align:start; }
    th { font-size:12px; color:#56666b; text-transform:uppercase; }
    .num { text-align:end; white-space:nowrap; }
    .lang { width:auto; min-height:40px; float:inline-end; padding:0 14px; }
    .status { font-weight:800; color:#2f7d5b; }
    .status.due { color:#b54a2c; }
    dl { margin:16px 0; display:grid; gap:6px; }
    dl div { display:flex; justify-content:space-between; font-size:17px; }
    dt { color:#56666b; }
    dd { margin:0; font-weight:800; }
    .due dd { color:#b54a2c; }
    button { width:100%; min-height:48px; border:1px solid #d6dedb; border-radius:12px; background:#fff; font:inherit; font-weight:700; }
    .missing { text-align:center; padding:48px 0; color:#56666b; }
    @media print { button, .lang { display:none; } :host { background:#fff; } }
  `],
})
export class PublicBillComponent implements OnInit {
  readonly token = input.required<string>();
  private readonly http = inject(HttpClient);
  private readonly i18n = inject(I18nService);
  protected readonly bill = signal<PublicBill | null>(null);
  protected readonly missing = signal(false);

  ngOnInit(): void {
    this.http.get<PublicBill>(`${API_BASE_URL}/public/bills/${encodeURIComponent(this.token())}`).subscribe({
      next: (bill) => this.bill.set(bill),
      error: () => this.missing.set(true),
    });
  }

  protected unit(unit: string): string {
    return { KG: 'unit.kgShort', BALE: 'unit.bale', PIECE: 'unit.pcs' }[unit] ?? '';
  }

  protected toggleLang(): void {
    this.i18n.use(this.i18n.lang() === 'ur' ? 'en' : 'ur');
  }

  protected print(): void {
    window.print();
  }
}
