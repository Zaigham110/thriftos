import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../../core/config/api.config';
import type {
  InventoryScanResult,
  SaleDetail,
  SaleLine,
  SaleListItem,
  SaleType,
} from './sales.models';

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

  create(dto: { customerId: string; type: SaleType }): Observable<SaleDetail> {
    return this.http.post<SaleDetail>(this.API, dto);
  }

  update(
    id: string,
    dto: Partial<{
      customerId: string;
      type: SaleType;
      billOfLadingNumber: string;
      containerSealNumber: string;
      vesselName: string;
      portOfLoading: string;
      portOfDischarge: string;
      freightForwarder: string;
      destinationCountry: string;
    }>,
  ): Observable<SaleDetail> {
    return this.http.patch<SaleDetail>(`${this.API}/${id}`, dto);
  }

  addLine(
    saleId: string,
    dto: {
      inventoryItemId: string;
      measurementType: 'WEIGHT' | 'QUANTITY';
      quantity: number;
      unitPrice: number;
    },
  ): Observable<SaleDetail> {
    return this.http.post<SaleDetail>(`${this.API}/${saleId}/lines`, dto);
  }

  deleteLine(saleId: string, lineId: string): Observable<SaleDetail> {
    return this.http.delete<SaleDetail>(`${this.API}/${saleId}/lines/${lineId}`);
  }

  issue(saleId: string): Observable<SaleDetail> {
    return this.http.post<SaleDetail>(`${this.API}/${saleId}/issue`, {});
  }

  cancel(saleId: string): Observable<SaleDetail> {
    return this.http.post<SaleDetail>(`${this.API}/${saleId}/cancel`, {});
  }

  addPayment(
    saleId: string,
    dto: {
      amount: number;
      method: string;
    },
  ): Observable<SaleDetail> {
    return this.http.post<SaleDetail>(`${this.API}/${saleId}/payments`, dto);
  }

  scanQr(code: string): Observable<InventoryScanResult> {
    const clean = String(code ?? '').trim();
    return this.http.get<InventoryScanResult>(`${this.API}/scan/qr/${encodeURIComponent(clean)}`);
  }

  listAvailableInventory(params?: { page?: number; limit?: number }): Observable<any> {
    const base = API_ENDPOINTS.inventory;
    let httpParams = new HttpParams();
    httpParams = httpParams.set('status', 'AVAILABLE');
    if (params?.page) httpParams = httpParams.set('page', String(params.page));
    if (params?.limit) httpParams = httpParams.set('limit', String(params.limit));
    return this.http.get<any>(base, { params: httpParams });
  }
}
