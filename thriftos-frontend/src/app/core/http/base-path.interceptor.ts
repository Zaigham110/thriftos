import { HttpInterceptorFn } from '@angular/common/http';

/**
 * The app can be served under a path (e.g. `/thriftos/`, set with `--base-href`). Requests written as
 * root paths (`/api/...`, `/i18n/...`, also ones saved earlier in the offline queue) are made relative,
 * so the browser resolves them against `<base href>`. At `/` nothing changes.
 */
export const basePathInterceptor: HttpInterceptorFn = (req, next) => {
  const url = req.url;
  if (url === '/api' || url.startsWith('/api/') || url.startsWith('/i18n/')) {
    return next(req.clone({ url: url.slice(1) }));
  }
  return next(req);
};
