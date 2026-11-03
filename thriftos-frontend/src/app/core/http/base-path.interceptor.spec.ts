import { HttpRequest, HttpResponse } from '@angular/common/http';
import { of } from 'rxjs';
import { basePathInterceptor } from './base-path.interceptor';

function urlAfter(url: string): string {
  let seen = '';
  basePathInterceptor(new HttpRequest('GET', url), (req) => {
    seen = req.url;
    return of(new HttpResponse({ status: 200 }));
  }).subscribe();
  return seen;
}

describe('basePathInterceptor', () => {
  it('makes API and dictionary root paths relative to <base href>', () => {
    expect(urlAfter('/api/sales')).toBe('api/sales');
    expect(urlAfter('/api')).toBe('api');
    expect(urlAfter('/i18n/ur.json')).toBe('i18n/ur.json');
  });

  it('leaves other URLs alone', () => {
    expect(urlAfter('api/sales')).toBe('api/sales');
    expect(urlAfter('/apix/thing')).toBe('/apix/thing');
    expect(urlAfter('https://example.com/api/x')).toBe('https://example.com/api/x');
  });
});
