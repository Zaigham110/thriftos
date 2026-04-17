import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { API_BASE_URL } from '../../../core/config/api.config';
import type { WasteCategory, CreateWasteCategoryDto, UpdateWasteCategoryDto } from './waste-category.models';

@Injectable({ providedIn: 'root' })
export class WasteCategoryService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${API_BASE_URL}/admin/waste-categories`;

  list() {
    return this.http.get<WasteCategory[]>(this.baseUrl);
  }

  getById(id: string) {
    return this.http.get<WasteCategory>(`${this.baseUrl}/${id}`);
  }

  create(dto: CreateWasteCategoryDto) {
    return this.http.post<WasteCategory>(this.baseUrl, dto);
  }

  update(id: string, dto: UpdateWasteCategoryDto) {
    return this.http.patch<WasteCategory>(`${this.baseUrl}/${id}`, dto);
  }

  deactivate(id: string) {
    return this.http.patch<WasteCategory>(`${this.baseUrl}/${id}`, { isActive: false });
  }

  delete(id: string) {
    return this.http.delete<WasteCategory>(`${this.baseUrl}/${id}`);
  }
}
