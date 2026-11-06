import { HttpClient, HttpParams } from '@angular/common/http';
import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { Observable, catchError, map, of, switchMap } from 'rxjs';

type Page = { rows: Array<{ id: string }> };

/**
 * "Sort next lot" (v2 review): the lot already being sorted, else the oldest one waiting; nothing to sort
 * opens the list filtered to waiting lots (which then says so).
 */
export const nextLotGuard: CanActivateFn = (): Observable<UrlTree> => {
  const http = inject(HttpClient);
  const router = inject(Router);
  const first = (status: string) =>
    http
      .get<Page>('/api/lists/lots', { params: new HttpParams().set('page', 1).set('pageSize', 1).set('sort', 'date:asc').append('f', `status:eq:${status}`) })
      .pipe(map((p) => p.rows[0]?.id ?? null));
  return first('IN_SORTING').pipe(
    switchMap((id) => (id ? of(id) : first('NOT_STARTED'))),
    map((id) => (id ? router.createUrlTree(['/sort', id]) : router.createUrlTree(['/sort/records'], { queryParams: { v: JSON.stringify({ filters: [{ field: 'status', op: 'eq', value: 'NOT_STARTED' }] }) } }))),
    catchError(() => of(router.createUrlTree(['/sort/records']))),
  );
};
