import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../../core/config/api.config';
import type { CreateSaleRequest, LastPrice, SaleDetail, SaleListItem, StockUnit } from './sales.models';

@Injectable({
  providedIn: 'root',
})
export class SalesService {
  private readonly API = API_ENDPOINTS.sales;

  constructor(private readonly http: HttpClient) {}

  list(): Observable<SaleListItem[]> {
    return this.http.get<SaleListItem[]>(this.API);
  }

  getById(id: string): Observable<SaleDetail> {
    return this.http.get<SaleDetail>(`${this.API}/${id}`);
  }

  /** Saves a whole sale. The idempotency key makes a retry create one sale. */
  create(body: CreateSaleRequest, idempotencyKey = crypto.randomUUID()): Observable<SaleDetail> {
    return this.http.post<SaleDetail>(this.API, body, { headers: new HttpHeaders({ 'Idempotency-Key': idempotencyKey }) });
  }

  lastPrice(customerId: string, inventoryItemId: string, unit?: StockUnit): Observable<LastPrice> {
    let params = new HttpParams().set('customerId', customerId).set('inventoryItemId', inventoryItemId);
    if (unit) params = params.set('unit', unit);
    return this.http.get<LastPrice>(`${this.API}/last-price`, { params });
  }

  fulfill(saleId: string, fulfillmentReference?: string): Observable<SaleDetail> {
    return this.http.post<SaleDetail>(`${this.API}/${saleId}/fulfill`, { fulfillmentReference });
  }

  listAvailableInventory(params?: { page?: number; limit?: number }): Observable<any> {
    const base = API_ENDPOINTS.stockItems;
    let httpParams = new HttpParams();
    httpParams = httpParams.set('status', 'AVAILABLE');
    if (params?.page) httpParams = httpParams.set('page', String(params.page));
    if (params?.limit) httpParams = httpParams.set('limit', String(params.limit));
    return this.http.get<any>(base, { params: httpParams });
  }
}
