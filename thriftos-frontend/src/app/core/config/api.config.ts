/**
 * API Configuration
 * Centralized API base URL configuration
 * 
 * Uses proxy configuration for development (proxy.conf.json)
 * In production, this would be configured via environment variables
 */

import { environment } from '../../../environments/environment';

/**
 * Base URL for all API calls.
 * In development: Uses Angular proxy (/api -> localhost:3000/api)
 * In production: Uses the configured API_URL from environment
 */
export const API_BASE_URL = environment.apiUrl || '/api';

/**
 * Helper to construct full API URLs
 */
export function apiUrl(path: string): string {
  // Remove leading slash from path if present to avoid double slashes
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  return `${API_BASE_URL}/${cleanPath}`;
}

/**
 * Module-specific API base URLs
 */
export const API_ENDPOINTS = {
  auth: `${API_BASE_URL}/auth`,
  me: `${API_BASE_URL}/me`,
  superadmin: `${API_BASE_URL}/superadmin`,
  procurement: `${API_BASE_URL}/procurement`,
  sortingStage1: `${API_BASE_URL}/sorting/stage1`,
  sortingStage2: `${API_BASE_URL}/sorting/stage2`,
  sortingFacadeStage1: `${API_BASE_URL}/sorting/stage-1`,
  sortingFacadeStage2: `${API_BASE_URL}/sorting/stage-2`,
  sortingOutputs: `${API_BASE_URL}/sorting/outputs`,
  grades: `${API_BASE_URL}/sorting/grades`,
  repack: `${API_BASE_URL}/repack`,
  inventory: `${API_BASE_URL}/inventory`,
  reports: `${API_BASE_URL}/reports`,
  tenant: `${API_BASE_URL}/tenant`,
  wasteCategories: `${API_BASE_URL}/tenant/waste-categories`,
} as const;
