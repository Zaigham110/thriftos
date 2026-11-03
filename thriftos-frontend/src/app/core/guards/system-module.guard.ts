import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { Observable, catchError, map, of, shareReplay, tap } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { TenantModule } from '../tenant/tenant.service';

/** The modules turned on for the platform itself (the SYSTEM business) — what the super admin console may show. */
@Injectable({ providedIn: 'root' })
export class SystemModulesService {
  private readonly http = inject(HttpClient);
  private readonly _modules = signal<TenantModule[]>([]);
  private request$?: Observable<TenantModule[]>;
  readonly modules = this._modules.asReadonly();

  load(): Observable<TenantModule[]> {
    this.request$ ??= this.http.get<{ enabledModules: TenantModule[] }>(`${API_BASE_URL}/superadmin/modules`).pipe(
      map((r) => r.enabledModules ?? []),
      tap((m) => this._modules.set(m)),
      catchError(() => of<TenantModule[]>([])),
      shareReplay(1),
    );
    return this.request$;
  }
}

/** Super admin screens that are off unless the SYSTEM business has the module (the server refuses them too). */
export const systemModuleGuard: CanActivateFn = (route): Observable<boolean | UrlTree> => {
  const router = inject(Router);
  const required = route.data?.['module'] as TenantModule | undefined;
  if (!required) return of(true);
  return inject(SystemModulesService)
    .load()
    .pipe(map((m) => (m.includes(required) ? true : router.createUrlTree(['/admin/dashboard']))));
};
