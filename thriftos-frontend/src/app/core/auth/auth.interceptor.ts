/**
 * Auth Interceptor - Attaches JWT token to requests and handles 401 responses
 * Phase 1: Authentication & Shell
 *
 * An expired access token (every 15 minutes) is renewed once, and every request that met it waits for that one
 * renewal and is sent again; nobody is signed out because several requests or tabs noticed at the same time.
 */

import { HttpInterceptorFn, HttpErrorResponse, HttpRequest, HttpBackend, HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, map, shareReplay, switchMap, throwError } from 'rxjs';
import { TokenService } from './token.service';
import { API_ENDPOINTS } from '../config/api.config';
import { LoginResponse } from './auth.models';

/** The renewal in flight, shared by every request that needs it. */
let renewing: Observable<string> | null = null;

/**
 * The renewal goes around the interceptors (no DI cycle), so it must make its own URL relative like
 * basePathInterceptor does: the app served under /thriftos/ calls thriftos/api/auth/refresh, not /api/… at the
 * domain root (which is not the API, so every renewal failed and signed people out — owner, 2026-11-12).
 */
export function appUrl(url: string): string {
  return url === '/api' || url.startsWith('/api/') ? url.slice(1) : url;
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const tokenService = inject(TokenService);
  const router = inject(Router);
  const httpBackend = inject(HttpBackend);
  const bareHttp = new HttpClient(httpBackend); // bypass interceptors to avoid DI cycles

  // Skip auth header for auth endpoints
  const skipUrls = [`${API_ENDPOINTS.auth}/login`, `${API_ENDPOINTS.auth}/refresh`];
  if (skipUrls.some((url) => req.url.includes(url))) {
    return next(req);
  }

  const token = tokenService.getAccessToken();

  if (token) {
    req = addTokenToRequest(req, token);
  }

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status !== 401 || !token) return throwError(() => error);

      // Another tab (or an earlier renewal here) already has a newer token: just use it.
      const current = tokenService.getAccessToken();
      if (current && current !== token) return next(addTokenToRequest(req, current));

      renewing ??= renew(bareHttp, tokenService).pipe(
        finalize(() => (renewing = null)),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
      return renewing.pipe(
        catchError((refreshError) => {
          // The renewal lost a race with another tab, which saved new tokens meanwhile: carry on with those.
          const after = tokenService.getAccessToken();
          if (after && after !== token) return [after];
          tokenService.clearTokens();
          tokenService.clearImpersonationContext();
          router.navigate(['/auth/login']);
          return throwError(() => refreshError);
        }),
        switchMap((fresh) => next(addTokenToRequest(req, fresh))),
      );
    }),
  );
};

function renew(http: HttpClient, tokens: TokenService): Observable<string> {
  return http.post<LoginResponse>(appUrl(`${API_ENDPOINTS.auth}/refresh`), { refreshToken: tokens.getRefreshToken() }).pipe(
    map((response) => {
      tokens.setTokens(response.accessToken, response.refreshToken);
      return response.accessToken;
    }),
  );
}

function addTokenToRequest(req: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return req.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`,
    },
  });
}
