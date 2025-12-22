/**
 * Auth Interceptor - Attaches JWT token to requests and handles 401 responses
 * Phase 1: Authentication & Shell
 */

import { HttpInterceptorFn, HttpErrorResponse, HttpRequest, HttpBackend, HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { TokenService } from './token.service';
import { API_ENDPOINTS } from '../config/api.config';
import { LoginResponse } from './auth.models';

let isRefreshing = false;

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
      if (error.status === 401 && token && !isRefreshing) {
        isRefreshing = true;

        return bareHttp
          .post<LoginResponse>(`${API_ENDPOINTS.auth}/refresh`, { refreshToken: tokenService.getRefreshToken() })
          .pipe(
            switchMap((response) => {
              isRefreshing = false;
              tokenService.setTokens(response.accessToken, response.refreshToken);
              return next(addTokenToRequest(req, response.accessToken));
            }),
            catchError((refreshError) => {
              isRefreshing = false;
              tokenService.clearTokens();
              tokenService.clearImpersonationContext();
              router.navigate(['/login']);
              return throwError(() => refreshError);
            })
          );
      }

      return throwError(() => error);
    })
  );
};

function addTokenToRequest(req: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return req.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`,
    },
  });
}
