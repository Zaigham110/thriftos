import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { API_BASE_URL } from '../../core/config/api.config';

export interface HomeSummary {
  profitPerContainer: { average: string; containers: number };
  udhaar: { owed: string; customers: number };
  stockReady: { kg: string; bales: string; items: number; value: string };
  today: { sales: number; total: string; profit: string };
}
export interface ContainerRow { id: string; containerNumber: string; supplier: string | null; origin: string | null; date: string; kg: string; landedCost: string; revenue: string; profit: string; yieldPercent: number | null; topGradePercent: number | null }
export interface Compare { name: string; containers: number; profit: string; profitPerKg: string; topGradePercent: number | null }
export interface TodaySale { id: string; saleNumber: string; totalAmount: string; totalProfit: string; paymentMode: string; issuedAt: string; customer: { id: string; name: string } }

@Injectable({ providedIn: 'root' })
export class HomeDataService {
  private readonly http = inject(HttpClient);
  summary() {
    return this.http.get<HomeSummary>(`${API_BASE_URL}/home`);
  }
  containers() {
    return this.http.get<{ containers: ContainerRow[]; bySupplier: Compare[]; byOrigin: Compare[] }>(`${API_BASE_URL}/home/containers?limit=10`);
  }
  today() {
    return this.http.get<TodaySale[]>(`${API_BASE_URL}/home/today`);
  }
}
