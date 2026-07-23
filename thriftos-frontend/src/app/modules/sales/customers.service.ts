import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../../core/config/api.config';
import type { Customer } from './sales.models';

@Injectable({
  providedIn: 'root',
})
export class CustomersService {
  private readonly API = API_ENDPOINTS.customers;

  constructor(private readonly http: HttpClient) {}

  list(filters?: { isActive?: boolean }): Observable<Customer[]> {
    let params = new HttpParams();
    if (filters?.isActive === true) params = params.set('isActive', 'true');
    if (filters?.isActive === false) params = params.set('isActive', 'false');

    return this.http.get<Customer[]>(this.API, { params });
  }

  getById(id: string): Observable<Customer> {
    return this.http.get<Customer>(`${this.API}/${id}`);
  }

  create(dto: {
    name: string;
    companyName: string;
    billingAddress: string;
    shippingAddress: string;
    contactEmail: string;
    contactPhone: string;
    taxId?: string | null;
    creditLimit?: number | null;
    paymentTerms?: string | null;
  }): Observable<Customer> {
    return this.http.post<Customer>(this.API, dto);
  }

  update(
    id: string,
    dto: Partial<{
      name: string;
      companyName: string;
      billingAddress: string;
      shippingAddress: string;
      contactEmail: string;
      contactPhone: string;
      taxId: string | null;
      creditLimit: number | null;
      paymentTerms: string | null;
      isActive: boolean;
    }>,
  ): Observable<Customer> {
    return this.http.patch<Customer>(`${this.API}/${id}`, dto);
  }
}
