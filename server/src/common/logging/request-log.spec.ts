import { requestIdOf, requestLogLine, requestLogsEnabled } from './request-log';

describe('request logs', () => {
  it('uses CloudFront\'s id, then the caller\'s, else a new one; rejects odd values', () => {
    expect(requestIdOf({ 'x-amz-cf-id': 'AbC123def456_==', 'x-request-id': 'ignored-12345' })).toBe('AbC123def456_==');
    expect(requestIdOf({ 'x-request-id': 'req-12345678' })).toBe('req-12345678');
    const made = requestIdOf({ 'x-request-id': 'bad id with spaces' });
    expect(made).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('writes one JSON line without the query string or personal data', () => {
    const line = JSON.parse(
      requestLogLine(
        { reqId: 'r1', method: 'GET', url: '/api/customers?search=03001234567', status: 200, ms: 12.6, tenantId: 't1', userId: 'u1' },
        new Date('2026-11-03T10:00:00Z'),
      ),
    );
    expect(line).toEqual({ t: '2026-11-03T10:00:00.000Z', level: 'info', msg: 'request', reqId: 'r1', method: 'GET', path: '/api/customers', status: 200, ms: 13, tenantId: 't1', userId: 'u1' });
    expect(JSON.parse(requestLogLine({ reqId: 'r', method: 'POST', url: '/x', status: 404, ms: 1 })).level).toBe('warn');
    expect(JSON.parse(requestLogLine({ reqId: 'r', method: 'POST', url: '/x', status: 503, ms: 1 })).level).toBe('error');
  });

  it('is on in production and with LOG_REQUESTS=1, off in tests', () => {
    expect(requestLogsEnabled({ NODE_ENV: 'production' })).toBe(true);
    expect(requestLogsEnabled({ NODE_ENV: 'production', LOG_REQUESTS: '0' })).toBe(false);
    expect(requestLogsEnabled({ NODE_ENV: 'test' })).toBe(false);
    expect(requestLogsEnabled({ LOG_REQUESTS: '1' })).toBe(true);
  });
});
