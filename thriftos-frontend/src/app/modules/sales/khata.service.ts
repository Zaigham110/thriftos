import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../core/config/api.config';
import type { Payment, PaymentMethod, PaymentResult } from './sales.models';

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
}
