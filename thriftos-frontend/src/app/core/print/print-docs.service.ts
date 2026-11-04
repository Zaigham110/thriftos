import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { I18nService } from '../i18n/i18n.service';
import { BillPrint, LabelPrint, ReceiptPrint, billTicket, labelTicket, receiptTicket } from './templates';
import { Ticket } from './ticket';

/** What the print sheet shows: the pictures to print and how to cut the paper. */
export interface PrintJob {
  tickets: Ticket[];
  kind: 'receipt' | 'label';
  title: string;
}

/** Loads a bill, receipt or bale stickers and lays them out for printing (v2 6.3). */
@Injectable({ providedIn: 'root' })
export class PrintDocsService {
  private readonly http = inject(HttpClient);
  private readonly i18n = inject(I18nService);

  bill(saleId: string): Observable<PrintJob> {
    return this.http
      .get<BillPrint>(`${API_BASE_URL}/sales/${encodeURIComponent(saleId)}/print`)
      .pipe(map((b) => ({ tickets: [billTicket(b, this.i18n)], kind: 'receipt' as const, title: this.i18n.t('print.title.bill') })));
  }

  receipt(paymentId: string): Observable<PrintJob> {
    return this.http
      .get<ReceiptPrint>(`${API_BASE_URL}/khata/payments/${encodeURIComponent(paymentId)}/receipt`)
      .pipe(map((r) => ({ tickets: [receiptTicket(r, this.i18n)], kind: 'receipt' as const, title: this.i18n.t('print.title.receipt') })));
  }

  labels(labels: LabelPrint[]): PrintJob {
    return { tickets: labels.map((l) => labelTicket(l, this.i18n)), kind: 'label', title: this.i18n.t('print.title.labels') };
  }
}
