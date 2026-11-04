/**
 * Auth Service - Handles authentication, user state, and impersonation
 * Phase 1: Authentication & Shell
 */

import { Injectable, computed, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, catchError, map, tap, throwError, of, BehaviorSubject, switchMap } from 'rxjs';
import { sessionCache } from './session-cache';
import { TokenService } from './token.service';
import {
  AuthState,
  LoginRequest,
  LoginResponse,
  MeResponse,
  User,
  ImpersonationResponse,
} from './auth.models';
import { API_ENDPOINTS } from '../config/api.config';

/** Name of the business open in support view, for the banner. */
export const SUPPORT_NAME_KEY = 'thriftos.support.name';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly _state = signal<AuthState>({
    user: null,
    permissions: [],
    isAuthenticated: false,
    isLoading: true,
    isImpersonating: false,
    authReady: false,
    impersonationReady: false,
  });

  // Public readonly selectors
  readonly state = this._state.asReadonly();
  readonly user = computed(() => this._state().user);
  readonly permissions = computed(() => this._state().permissions);
  readonly isAuthenticated = computed(() => this._state().isAuthenticated);
  readonly isLoading = computed(() => this._state().isLoading);
  readonly isImpersonating = computed(() => this._state().isImpersonating);
  readonly isSuperAdmin = computed(() => this._state().user?.isSuperAdmin ?? false);
  readonly impersonatedTenantId = computed(() => this._state().user?.impersonatedTenantId ?? null);
  readonly authReady = computed(() => this._state().authReady);
  readonly impersonationReady = computed(() => this._state().impersonationReady);

  // Observable for components that need RxJS
  private readonly authReady$ = new BehaviorSubject<boolean>(false);
  private readonly impersonationReady$ = new BehaviorSubject<boolean>(false);

  constructor(
    private readonly http: HttpClient,
    private readonly tokenService: TokenService,
    private readonly router: Router
  ) {
    this.initializeAuth();
  }

  /**
   * Mark authentication resolution state
   */
  private setAuthReady(ready: boolean): void {
    this._state.update((s) => ({ ...s, authReady: ready }));
    this.authReady$.next(ready);
  }

  /**
   * Mark impersonation resolution state
   */
  private setImpersonationReady(ready: boolean): void {
    this._state.update((s) => ({ ...s, impersonationReady: ready }));
    this.impersonationReady$.next(ready);
  }

  /**
   * Initialize auth state from stored tokens
   */
  private initializeAuth(): void {
    const accessToken = this.tokenService.getAccessToken();
    const refreshToken = this.tokenService.getRefreshToken();
    const impersonationContext = this.tokenService.getImpersonationContext();

    const markReady = () => {
      this.setAuthReady(true);
      this.setImpersonationReady(true);
    };

    const hydrateFromToken = (token: string): void => {
      const payload = this.decodeToken(token);
      const isImpersonating = this.tokenService.isImpersonating() || !!impersonationContext.tenantId;

      if (payload?.isSuperAdmin && !isImpersonating && !payload?.tenantId) {
        // Super Admin without impersonation - set state from token payload
        this._state.set({
          user: {
            id: payload.sub,
            email: payload.email,
            name: payload.name || payload.email,
            tenantId: null,
            isSuperAdmin: true,
            impersonatedTenantId: null,
          },
          permissions: [],
          isAuthenticated: true,
          isLoading: false,
          isImpersonating: false,
          authReady: true,
          impersonationReady: true,
        });
        markReady();
      } else if (!isImpersonating && payload?.sub && sessionCache.me(payload.sub)) {
        // Installed app opening: show the person's own last profile at once, refresh it behind.
        this.applyMe(sessionCache.me(payload.sub)!);
        markReady();
        this.loadCurrentUser().subscribe({ error: () => undefined });
      } else {
        // Impersonating Super Admin or tenant user - load full profile
        this.loadCurrentUser().subscribe({
          next: () => {
            if (isImpersonating) {
              this._state.update((s) => ({ ...s, isImpersonating: true }));
            }
            markReady();
          },
          error: () => {
            this.clearAuthState();
            markReady();
          },
        });
      }
    };

    if (accessToken && !this.tokenService.isTokenExpired(accessToken)) {
      hydrateFromToken(accessToken);
    } else if (refreshToken) {
      // Attempt silent refresh to keep session (including impersonation) alive without redirecting
      this.refreshTokenSilently().subscribe({
        next: (newAccessToken) => hydrateFromToken(newAccessToken),
        error: () => markReady(),
      });
    } else {
      this._state.update((s) => ({ ...s, isLoading: false, authReady: true, impersonationReady: true }));
      this.authReady$.next(true);
      this.impersonationReady$.next(true);
    }
  }

  /**
   * Decode JWT token payload
   */
  private decodeToken(token: string): any {
    try {
      const base64Payload = token.split('.')[1];
      const payload = atob(base64Payload);
      return JSON.parse(payload);
    } catch {
      return null;
    }
  }

  /**
   * Wait for auth initialization to complete
   */
  waitForAuth(): Observable<boolean> {
    return this.authReady$.asObservable();
  }

  waitForImpersonation(): Observable<boolean> {
    return this.impersonationReady$.asObservable();
  }

  /**
   * Login with email and password
   */
  login(credentials: LoginRequest): Observable<User> {
    this._state.update((s) => ({ ...s, isLoading: true }));
    return this.startSession(this.http.post<LoginResponse>(`${API_ENDPOINTS.auth}/login`, credentials)).pipe(
      catchError((error) => this.handleAuthError(error))
    );
  }

  /**
   * Munshi sign-in with phone + PIN. Errors are passed on as they come (the screen shows tries left or the
   * lock time from `error.error`).
   */
  loginWithPin(credentials: { phone: string; pin: string }): Observable<User> {
    this._state.update((s) => ({ ...s, isLoading: true }));
    return this.startSession(this.http.post<LoginResponse>(`${API_ENDPOINTS.auth}/login/pin`, credentials)).pipe(
      catchError((error) => {
        this._state.update((s) => ({ ...s, isLoading: false }));
        return throwError(() => error);
      })
    );
  }

  /** Stores the tokens of a successful sign-in and loads the user (and permissions). */
  private startSession(login$: Observable<LoginResponse>): Observable<User> {
    return login$.pipe(
      tap((response) => {
        this.tokenService.setTokens(response.accessToken, response.refreshToken);
      }),
      switchMap((response) => {
        // Super Admin users can't call /api/me without impersonation
        // Use the user data from login response directly
        if (response.user.isSuperAdmin) {
          const user: User = {
            ...response.user,
            impersonatedTenantId: null,
          };
          this._state.set({
            user,
            permissions: [], // Super Admin has all permissions implicitly
            isAuthenticated: true,
            isLoading: false,
            isImpersonating: false,
            authReady: true,
            impersonationReady: true,
          });
          this.setAuthReady(true);
          this.setImpersonationReady(true);
          return of(user);
        }
        // Regular tenant users - load full profile with permissions
        return this.loadCurrentUser().pipe(
          map(() => {
            this.setAuthReady(true);
            return this._state().user!;
          })
        );
      })
    );
  }

  /**
   * Load current user profile and permissions
   */
  loadCurrentUser(retried = false): Observable<MeResponse> {
    return this.http.get<MeResponse>(`${API_ENDPOINTS.me}`).pipe(
      tap((response) => {
        this.applyMe(response);
        if (!this.tokenService.isImpersonating()) sessionCache.saveMe(response);
      }),
      catchError((error) => {
        // If token is stale, try one silent refresh then retry /me once
        if (error.status === 401 && !retried && this.tokenService.getRefreshToken()) {
          return this.refreshTokenSilently().pipe(switchMap(() => this.loadCurrentUser(true)));
        }
        // Signed out only when the server says so; no network keeps the person signed in (offline use).
        if (error.status === 401 || error.status === 403 || !this._state().isAuthenticated) this.clearAuthState();
        return throwError(() => error);
      })
    );
  }

  private applyMe(response: MeResponse): void {
    const isImpersonating =
      this.tokenService.isImpersonating() ||
      !!response.user.impersonatedTenantId ||
      !!this.tokenService.getImpersonationContext().tenantId;
    this._state.set({
      user: response.user,
      permissions: response.permissions,
      isAuthenticated: true,
      isLoading: false,
      isImpersonating,
      authReady: true,
      impersonationReady: true,
    });
    this.authReady$.next(true);
    this.impersonationReady$.next(true);
  }

  /**
   * Logout user
   */
  logout(): Observable<void> {
    const refreshToken = this.tokenService.getRefreshToken();
    
    return this.http.post<void>(`${API_ENDPOINTS.auth}/logout`, { refreshToken }).pipe(
      tap(() => {
        this.clearAuthState();
        this.router.navigate(['/auth/login']);
      }),
      catchError(() => {
        // Clear state even if API call fails
        this.clearAuthState();
        this.router.navigate(['/auth/login']);
        return of(undefined);
      })
    );
  }

  /**
   * Refresh access token
   */
  refreshToken(): Observable<string> {
    const refreshToken = this.tokenService.getRefreshToken();
    if (!refreshToken) {
      return throwError(() => new Error('No refresh token available'));
    }

    return this.http.post<LoginResponse>(`${API_ENDPOINTS.auth}/refresh`, { refreshToken }).pipe(
      tap((response) => {
        this.tokenService.setTokens(response.accessToken, response.refreshToken);
      }),
      map((response) => response.accessToken),
      catchError((error) => {
        this.clearAuthState();
        this.router.navigate(['/auth/login']);
        return throwError(() => error);
      })
    );
  }

  /**
   * Refresh token without side effects (used during app bootstrap to avoid redirecting on transient failures)
   */
  private refreshTokenSilently(): Observable<string> {
    const refreshToken = this.tokenService.getRefreshToken();
    if (!refreshToken) {
      return throwError(() => new Error('No refresh token available'));
    }

    return this.http.post<LoginResponse>(`${API_ENDPOINTS.auth}/refresh`, { refreshToken }).pipe(
      tap((response) => {
        this.tokenService.setTokens(response.accessToken, response.refreshToken);
      }),
      map((response) => response.accessToken)
    );
  }

  /**
   * Start impersonating a tenant (Super Admin only)
   */
  /** Opens the business read-only for support (v2 6.5); `reason` goes to the audit log, `name` to the banner. */
  impersonateTenant(tenantId: string, opts: { reason?: string; name?: string } = {}): Observable<void> {
    try {
      sessionStorage.setItem(SUPPORT_NAME_KEY, opts.name ?? '');
    } catch {
      /* private window */
    }
    // Store current token before impersonation
    const currentToken = this.tokenService.getAccessToken();
    const currentRefreshToken = this.tokenService.getRefreshToken();
    if (currentToken) {
      this.tokenService.setOriginalToken(currentToken);
    }
    if (currentRefreshToken) {
      this.tokenService.setOriginalRefreshToken(currentRefreshToken);
    }

    return this.http
      .post<ImpersonationResponse>(`${API_ENDPOINTS.superadmin}/tenants/${tenantId}/impersonate`, opts.reason ? { reason: opts.reason } : {})
      .pipe(
        tap((response) => {
          const token = response.impersonationToken || response.accessToken;
          if (token) {
            this.tokenService.setAccessToken(token);
          }
          if (response.refreshToken) {
            this.tokenService.setRefreshToken(response.refreshToken);
          }
        }),
        switchMap(() => this.loadCurrentUser()),
        tap(() => {
          const userId = this._state().user?.id ?? '';
          this.tokenService.setImpersonationContext(tenantId, userId);
          this._state.update(s => ({ ...s, isImpersonating: true, impersonationReady: true }));
          this.impersonationReady$.next(true);
          this.router.navigate(['/home']);
        }),
        map(() => void 0),
        catchError((error) => {
          this.tokenService.clearOriginalToken();
          this.tokenService.clearOriginalRefreshToken();
          this.tokenService.clearImpersonationContext();
          return this.handleAuthError(error);
        })
      );
  }

  /**
   * Exit impersonation and restore Super Admin session
   */
  exitImpersonation(): Observable<void> {
    // Tell the server first (with the support token) so leaving is in the audit log; leave even if that fails.
    if (this.tokenService.getOriginalToken()) {
      return this.http.post<void>(`${API_ENDPOINTS.auth}/exit-impersonation`, {}).pipe(
        catchError(() => of(void 0)),
        switchMap(() => this.restoreSuperAdmin()),
      );
    }
    return this.restoreSuperAdmin();
  }

  private restoreSuperAdmin(): Observable<void> {
    try {
      sessionStorage.removeItem(SUPPORT_NAME_KEY);
    } catch {
      /* private window */
    }
    // Restore original tokens first
    const originalToken = this.tokenService.getOriginalToken();
    const originalRefreshToken = this.tokenService.getOriginalRefreshToken();
    
    if (originalToken) {
      this.tokenService.setAccessToken(originalToken);
      this.tokenService.clearOriginalToken();
    }
    if (originalRefreshToken) {
      this.tokenService.setRefreshToken(originalRefreshToken);
      this.tokenService.clearOriginalRefreshToken();
    }
    
    // Decode original token to restore Super Admin state
    const payload = originalToken ? this.decodeToken(originalToken) : null;
    
    if (payload?.isSuperAdmin) {
      this._state.set({
        user: {
          id: payload.sub,
          email: payload.email,
          name: payload.name || payload.email,
          tenantId: null,
          isSuperAdmin: true,
          impersonatedTenantId: null,
        },
        permissions: [],
        isAuthenticated: true,
        isLoading: false,
        isImpersonating: false,
        authReady: true,
        impersonationReady: true,
      });
      this.tokenService.clearImpersonationContext();
      this.router.navigate(['/admin/tenants']);
      return of(void 0);
    }
    
    return this.http.post<void>(`${API_ENDPOINTS.auth}/exit-impersonation`, {}).pipe(
      switchMap(() => this.loadCurrentUser()),
      tap(() => {
        this.tokenService.clearImpersonationContext();
        this._state.update(s => ({ ...s, isImpersonating: false, impersonationReady: true }));
        this.impersonationReady$.next(true);
        this.router.navigate(['/admin/tenants']);
      }),
      map(() => void 0),
      catchError((error) => this.handleAuthError(error))
    );
  }

  /**
   * Check if user has a specific permission
   */
  hasPermission(permission: string): boolean {
    if (this._state().user?.isSuperAdmin) {
      return true; // Super Admin bypasses permission checks
    }
    return this._state().permissions.includes(permission);
  }

  /**
   * Check if user has any of the specified permissions
   */
  hasAnyPermission(permissions: string[]): boolean {
    if (this._state().user?.isSuperAdmin) {
      return true;
    }
    return permissions.some((p) => this._state().permissions.includes(p));
  }

  /**
   * Check if user has all of the specified permissions
   */
  hasAllPermissions(permissions: string[]): boolean {
    if (this._state().user?.isSuperAdmin) {
      return true;
    }
    return permissions.every((p) => this._state().permissions.includes(p));
  }

  /**
   * Clear authentication state
   */
  private clearAuthState(): void {
    sessionCache.clear();
    this.tokenService.clearTokens();
    this.tokenService.clearImpersonationContext();
    this._state.set({
      user: null,
      permissions: [],
      isAuthenticated: false,
      isLoading: false,
      isImpersonating: false,
      authReady: true,
      impersonationReady: true,
    });
    this.authReady$.next(true);
    this.impersonationReady$.next(true);
  }

  /**
   * Handle authentication errors
   */
  private handleAuthError(error: HttpErrorResponse): Observable<never> {
    this._state.update((s) => ({ ...s, isLoading: false }));

    let message = 'An unexpected error occurred';
    
    if (error.status === 401) {
      message = 'Invalid email or password';
    } else if (error.status === 403) {
      message = 'Access denied';
    } else if (error.status === 409) {
      message = error.error?.message || 'Conflict error';
    } else if (error.status === 0) {
      message = 'Unable to connect to server. Please check your connection.';
    } else if (error.error?.message) {
      message = error.error.message;
    }

    return throwError(() => ({ status: error.status, message }));
  }
}
