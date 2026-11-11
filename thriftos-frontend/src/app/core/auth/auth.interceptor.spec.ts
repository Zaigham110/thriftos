import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { appUrl, authInterceptor } from './auth.interceptor';
import { TokenService } from './token.service';

/** Owner, 2026-11-12: "the software keeps signing me out" on the live site, served under /thriftos/. */
describe('authInterceptor: renewing an expired token', () => {
  let http: HttpClient;
  let ctl: HttpTestingController;
  let tokens: TokenService;
  const navigate = jasmine.createSpy('navigate');

  beforeEach(() => {
    navigate.calls.reset();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: Router, useValue: { navigate } },
      ],
    });
    http = TestBed.inject(HttpClient);
    ctl = TestBed.inject(HttpTestingController);
    tokens = TestBed.inject(TokenService);
    tokens.setTokens('old-access', 'old-refresh');
  });

  afterEach(() => {
    ctl.verify();
    tokens.clearTokens();
  });

  it('renews at a relative address, so an app served under /thriftos/ reaches its own API', () => {
    expect(appUrl('/api/auth/refresh')).toBe('api/auth/refresh');
    expect(appUrl('https://x.test/api/auth/refresh')).toBe('https://x.test/api/auth/refresh');
  });

  it('two requests meeting an expired token share one renewal and are both sent again', () => {
    const got: unknown[] = [];
    http.get('/api/a').subscribe((r) => got.push(r));
    http.get('/api/b').subscribe((r) => got.push(r));
    ctl.expectOne('/api/a').flush({}, { status: 401, statusText: 'Unauthorized' });
    ctl.expectOne('/api/b').flush({}, { status: 401, statusText: 'Unauthorized' });

    const renew = ctl.match((r) => r.url.endsWith('auth/refresh'));
    expect(renew.length).toBe(1);
    expect(renew[0].request.url.startsWith('/')).toBeFalse();
    expect(renew[0].request.body).toEqual({ refreshToken: 'old-refresh' });
    renew[0].flush({ accessToken: 'new-access', refreshToken: 'new-refresh' });

    const a = ctl.expectOne('/api/a');
    const b = ctl.expectOne('/api/b');
    expect(a.request.headers.get('Authorization')).toBe('Bearer new-access');
    expect(b.request.headers.get('Authorization')).toBe('Bearer new-access');
    a.flush({ ok: 'a' });
    b.flush({ ok: 'b' });
    expect(got).toEqual([{ ok: 'a' }, { ok: 'b' }]);
    expect(tokens.getRefreshToken()).toBe('new-refresh');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('uses a newer token another tab saved, without renewing', () => {
    http.get('/api/a').subscribe();
    tokens.setTokens('tab-two-access', 'tab-two-refresh');
    ctl.expectOne('/api/a').flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(ctl.match((r) => r.url.endsWith('auth/refresh')).length).toBe(0);
    const again = ctl.expectOne('/api/a');
    expect(again.request.headers.get('Authorization')).toBe('Bearer tab-two-access');
    again.flush({});
    expect(navigate).not.toHaveBeenCalled();
  });

  it('signs out only when the renewal itself is refused', () => {
    let failed = false;
    http.get('/api/a').subscribe({ error: () => (failed = true) });
    ctl.expectOne('/api/a').flush({}, { status: 401, statusText: 'Unauthorized' });
    ctl.expectOne((r) => r.url.endsWith('auth/refresh')).flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(failed).toBeTrue();
    expect(tokens.getAccessToken()).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/auth/login']);
  });
});
