import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { API_ENDPOINTS } from '../../../core/config/api.config';
import type { WasteCategory, CreateWasteCategoryDto, UpdateWasteCategoryDto } from './waste-category.models';

@Injectable({ providedIn: 'root' })
export class WasteCategoryService {
  private readonly http = inject(HttpClient);

  list() {
    return this.http.get<WasteCategory[]>(`${API_ENDPOINTS.wasteCategories}/all`);
  }

  getById(id: string) {
    return this.http.get<WasteCategory>(`${API_ENDPOINTS.wasteCategories}/${id}`);
  }

  create(dto: CreateWasteCategoryDto) {
    return this.http.post<WasteCategory>(API_ENDPOINTS.wasteCategories, dto);
  }

  update(id: string, dto: UpdateWasteCategoryDto) {
    return this.http.patch<WasteCategory>(`${API_ENDPOINTS.wasteCategories}/${id}`, dto);
  }

  deactivate(id: string) {
    return this.http.patch<WasteCategory>(`${API_ENDPOINTS.wasteCategories}/${id}`, { isActive: false });
  }

  delete(id: string) {
    return this.http.delete<WasteCategory>(`${API_ENDPOINTS.wasteCategories}/${id}`);
  }
}
