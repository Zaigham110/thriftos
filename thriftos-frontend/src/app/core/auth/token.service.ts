/**
 * Token Service - Handles secure token storage and retrieval
 * Phase 1: Authentication & Shell
 */

import { Injectable } from '@angular/core';

const ACCESS_TOKEN_KEY = 'thriftos_access_token';
const REFRESH_TOKEN_KEY = 'thriftos_refresh_token';
const ORIGINAL_TOKEN_KEY = 'thriftos_original_token';
const ORIGINAL_REFRESH_TOKEN_KEY = 'thriftos_original_refresh_token';
const IMPERSONATION_TENANT_KEY = 'thriftos_impersonation_tenant';
const IMPERSONATION_USER_KEY = 'thriftos_impersonation_user';

@Injectable({
  providedIn: 'root',
})
export class TokenService {
  private readonly memoryStore = new Map<string, string>();

  // Cookie fallback for storage-disabled environments (e.g., iframes/Safari private mode)
  private setCookie(key: string, value: string): void {
    const encodedKey = encodeURIComponent(key);
    const encodedValue = encodeURIComponent(value);
    // 7-day expiry; aligns roughly with common refresh token TTLs
    document.cookie = `${encodedKey}=${encodedValue}; path=/; max-age=604800; SameSite=Lax`;
  }

  private getCookie(key: string): string | null {
    const encodedKey = encodeURIComponent(key) + '=';
    const cookies = document.cookie ? document.cookie.split(';') : [];
    for (const raw of cookies) {
      const c = raw.trim();
      if (c.startsWith(encodedKey)) {
        return decodeURIComponent(c.substring(encodedKey.length));
      }
    }
    return null;
  }

  private removeCookie(key: string): void {
    const encodedKey = encodeURIComponent(key);
    document.cookie = `${encodedKey}=; path=/; max-age=0; SameSite=Lax`;
  }

  /**
   * Safe storage getter with in-memory fallback to avoid browsers that block storage (e.g., Safari ITP, iframes)
   */
  private get storage(): Storage | null {
    try {
      const testKey = '__thriftos_storage_check__';
      localStorage.setItem(testKey, '1');
      localStorage.removeItem(testKey);
      return localStorage;
    } catch {
      return null;
    }
  }

  private get session(): Storage | null {
    try {
      const testKey = '__thriftos_session_check__';
      sessionStorage.setItem(testKey, '1');
      sessionStorage.removeItem(testKey);
      return sessionStorage;
    } catch {
      return null;
    }
  }

  private setItem(key: string, value: string): void {
    const store = this.storage;
    const sessionStore = this.session;

    let stored = false;

    if (store) {
      try {
        store.setItem(key, value);
        stored = true;
      } catch {
        // fall through
      }
    }

    if (!stored && sessionStore) {
      try {
        sessionStore.setItem(key, value);
        stored = true;
      } catch {
        // fall through
      }
    }

    // Always persist to cookie and memory as last resorts
    this.setCookie(key, value);
    this.memoryStore.set(key, value);
  }

  private getItem(key: string): string | null {
    const store = this.storage;
    const sessionStore = this.session;

    if (store) {
      try {
        const val = store.getItem(key);
        if (val) return val;
      } catch {
        // fall through
      }
    }

    if (sessionStore) {
      try {
        const val = sessionStore.getItem(key);
        if (val) return val;
      } catch {
        // fall through
      }
    }

    const cookieVal = this.getCookie(key);
    if (cookieVal) return cookieVal;

    return this.memoryStore.get(key) ?? null;
  }

  private removeItem(key: string): void {
    const store = this.storage;
    const sessionStore = this.session;

    if (store) {
      try {
        store.removeItem(key);
      } catch {
        // ignore
      }
    }

    if (sessionStore) {
      try {
        sessionStore.removeItem(key);
      } catch {
        // ignore
      }
    }

    this.memoryStore.delete(key);
    this.removeCookie(key);
  }

  /**
   * Store access token
   */
  setAccessToken(token: string): void {
    this.setItem(ACCESS_TOKEN_KEY, token);
  }

  /**
   * Get access token
   */
  getAccessToken(): string | null {
    return this.getItem(ACCESS_TOKEN_KEY);
  }

  /**
   * Store refresh token
   */
  setRefreshToken(token: string): void {
    this.setItem(REFRESH_TOKEN_KEY, token);
  }

  /**
   * Get refresh token
   */
  getRefreshToken(): string | null {
    return this.getItem(REFRESH_TOKEN_KEY);
  }

  /**
   * Store tokens from login response
   */
  setTokens(accessToken: string, refreshToken: string): void {
    this.setAccessToken(accessToken);
    this.setRefreshToken(refreshToken);
  }

  /**
   * Clear all tokens
   */
  clearTokens(): void {
    this.removeItem(ACCESS_TOKEN_KEY);
    this.removeItem(REFRESH_TOKEN_KEY);
    this.removeItem(ORIGINAL_TOKEN_KEY);
    this.removeItem(ORIGINAL_REFRESH_TOKEN_KEY);
  }

  /**
   * Check if user has tokens stored
   */
  hasTokens(): boolean {
    return !!this.getAccessToken();
  }

  /**
   * Store original token before impersonation
   */
  setOriginalToken(token: string): void {
    this.setItem(ORIGINAL_TOKEN_KEY, token);
  }

  /**
   * Get original token (for exiting impersonation)
   */
  getOriginalToken(): string | null {
    return this.getItem(ORIGINAL_TOKEN_KEY);
  }

  /**
   * Clear original token
   */
  clearOriginalToken(): void {
    this.removeItem(ORIGINAL_TOKEN_KEY);
  }

  /**
   * Store original refresh token before impersonation
   */
  setOriginalRefreshToken(token: string): void {
    this.setItem(ORIGINAL_REFRESH_TOKEN_KEY, token);
  }

  /**
   * Get original refresh token (for exiting impersonation)
   */
  getOriginalRefreshToken(): string | null {
    return this.getItem(ORIGINAL_REFRESH_TOKEN_KEY);
  }

  /**
   * Clear original refresh token
   */
  clearOriginalRefreshToken(): void {
    this.removeItem(ORIGINAL_REFRESH_TOKEN_KEY);
  }

  /**
   * Persist impersonation context
   */
  setImpersonationContext(tenantId: string, userId: string): void {
    this.setItem(IMPERSONATION_TENANT_KEY, tenantId);
    this.setItem(IMPERSONATION_USER_KEY, userId);
  }

  getImpersonationContext(): { tenantId: string | null; userId: string | null } {
    return {
      tenantId: this.getItem(IMPERSONATION_TENANT_KEY),
      userId: this.getItem(IMPERSONATION_USER_KEY),
    };
  }

  clearImpersonationContext(): void {
    this.removeItem(IMPERSONATION_TENANT_KEY);
    this.removeItem(IMPERSONATION_USER_KEY);
  }

  /**
   * Check if currently impersonating (has original token stored)
   */
  isImpersonating(): boolean {
    return !!this.getOriginalToken();
  }

  /**
   * Parse JWT token to get payload
   */
  parseToken(token: string): Record<string, unknown> | null {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch {
      return null;
    }
  }

  /**
   * Check if token is expired
   */
  isTokenExpired(token: string): boolean {
    const payload = this.parseToken(token);
    if (!payload || typeof payload['exp'] !== 'number') {
      return true;
    }
    const exp = payload['exp'] * 1000;
    return Date.now() >= exp;
  }
}
