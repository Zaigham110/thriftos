import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../core/config/api.config';
import type { Customer, Payment, PaymentMethod, PaymentResult, SaleStatus } from './sales.models';

export type Language = 'ur' | 'en';

export interface KhataRow {
  id: string;
  name: string;
  phone?: string | null;
  city?: string | null;
  isActive: boolean;
  /** What they owe now (negative = advance). */
  balance: string;
  overdueDays: number;
}

export interface LedgerLine {
  at: string;
  kind: 'OPENING' | 'SALE' | 'PAYMENT';
  id: string | null;
  /** Sale number, or payment method. */
  ref: string | null;
  debit: string;
  credit: string;
  /** Running balance after this line. */
  balance: string;
  status?: SaleStatus;
  due?: string;
  reference?: string | null;
  hasPhoto?: boolean;
}

export interface Ledger {
  customer: Customer;
  balance: string;
  advance: string;
  overdueDays: number;
  lines: LedgerLine[];
}

export interface WhatsappMessage {
  text: string;
  url: string;
}

export interface PaymentInput {
  customerId: string;
  amount: number;
  method?: PaymentMethod;
  saleId?: string;
  reference?: string;
}

/** Customer accounts: payments received (with an idempotency key, so a retry records once). */
@Injectable({ providedIn: 'root' })
export class KhataService {
  private readonly http = inject(HttpClient);
  private readonly API = `${API_BASE_URL}/khata`;

  list(search?: string): Observable<{ totalOwed: string; customers: KhataRow[] }> {
    const params = search ? new HttpParams().set('search', search) : undefined;
    return this.http.get<{ totalOwed: string; customers: KhataRow[] }>(this.API, { params });
  }

  ledger(customerId: string): Observable<Ledger> {
    return this.http.get<Ledger>(`${this.API}/customers/${customerId}`);
  }

  reminder(customerId: string, lang?: Language): Observable<WhatsappMessage> {
    const params = lang ? new HttpParams().set('lang', lang) : undefined;
    return this.http.get<WhatsappMessage>(`${this.API}/customers/${customerId}/reminder`, { params });
  }

  /** "Share bill on WhatsApp" for a sale. */
  billMessage(saleId: string, lang?: Language): Observable<WhatsappMessage & { billUrl: string }> {
    const params = lang ? new HttpParams().set('lang', lang) : undefined;
    return this.http.get<WhatsappMessage & { billUrl: string }>(`${API_BASE_URL}/sales/${saleId}/whatsapp`, { params });
  }

  recordPayment(body: PaymentInput, idempotencyKey = crypto.randomUUID()): Observable<PaymentResult> {
    return this.http.post<PaymentResult>(`${this.API}/payments`, body, {
      headers: new HttpHeaders({ 'Idempotency-Key': idempotencyKey }),
    });
  }

  addPhoto(paymentId: string, file: File): Observable<Payment> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<Payment>(`${this.API}/payments/${paymentId}/photo`, form);
  }

  /**
   * Opens a WhatsApp message in a new tab. The tab is opened straight away (inside the tap) so
   * phone browsers do not block it, then pointed at the wa.me link once it arrives.
   */
  openWhatsapp(message$: Observable<WhatsappMessage>, onError: (e: unknown) => void): void {
    const tab = window.open('', '_blank');
    message$.subscribe({
      next: (m) => (tab ? (tab.location.href = m.url) : window.location.assign(m.url)),
      error: (e) => {
        tab?.close();
        onError(e);
      },
    });
  }
}
