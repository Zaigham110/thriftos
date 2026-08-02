import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL } from './api.config';

export type OperationMode = 'FULL_ERP' | 'SIMPLIFIED_MOBILE' | 'LITE';
export type TenantOperationMode = 'FULL_ERP' | 'SIMPLIFIED_MOBILE' | 'LITE' | 'USER_CHOICE';

const MODE_STORAGE_KEY = 'thriftos_operation_mode';

@Injectable({
  providedIn: 'root',
})
export class OperationModeService {
  private readonly _activeMode = signal<OperationMode>('FULL_ERP');
  private readonly _tenantMode = signal<TenantOperationMode>('FULL_ERP');

  readonly activeMode = computed(() => this._activeMode());
  readonly tenantMode = computed(() => this._tenantMode());
  readonly isSimplifiedMobile = computed(() => this._activeMode() === 'SIMPLIFIED_MOBILE' || this._activeMode() === 'LITE');
  readonly isLite = computed(() => this.isSimplifiedMobile());
  readonly isFullErp = computed(() => this._activeMode() === 'FULL_ERP');

  constructor(private readonly http: HttpClient) {
    const saved = localStorage.getItem(MODE_STORAGE_KEY) as OperationMode | null;
    if (saved === 'FULL_ERP' || saved === 'SIMPLIFIED_MOBILE' || saved === 'LITE') {
      this._activeMode.set(saved);
    }
  }

  setMode(mode: OperationMode, syncWithBackend = true): void {
    this._activeMode.set(mode);
    localStorage.setItem(MODE_STORAGE_KEY, mode);

    if (syncWithBackend) {
      this.http
        .patch(`${API_BASE_URL}/me/preferences`, {
          // "LITE" is a UI label. Persist the matching database/API enum value.
          preferredOperationMode: mode === 'LITE' ? 'SIMPLIFIED_MOBILE' : mode,
        })
        .subscribe({
          next: () => {},
          error: (err) => console.warn('Failed to sync mode preference with backend', err),
        });
    }
  }

  toggleMode(): void {
    const next = this._activeMode() === 'FULL_ERP' ? 'LITE' : 'FULL_ERP';
    this.setMode(next);
  }

  initFromMeResponse(userPayload: any): void {
    if (!userPayload) return;

    const tenantOpMode = (userPayload.tenantOperationMode as TenantOperationMode) || 'FULL_ERP';
    this._tenantMode.set(tenantOpMode);

    const userPref = userPayload.preferredOperationMode as OperationMode | null;

    if (tenantOpMode === 'SIMPLIFIED_MOBILE' || tenantOpMode === 'LITE') {
      this._activeMode.set('LITE');
    } else if (tenantOpMode === 'FULL_ERP') {
      this._activeMode.set('FULL_ERP');
    } else if (tenantOpMode === 'USER_CHOICE' || !tenantOpMode) {
      if (userPref === 'SIMPLIFIED_MOBILE' || userPref === 'LITE' || userPref === 'FULL_ERP') {
        this._activeMode.set(userPref === 'SIMPLIFIED_MOBILE' ? 'LITE' : userPref);
      } else {
        const saved = localStorage.getItem(MODE_STORAGE_KEY) as OperationMode | null;
        if (saved) {
          this._activeMode.set(saved === 'SIMPLIFIED_MOBILE' ? 'LITE' : saved);
        }
      }
    }
  }
}
