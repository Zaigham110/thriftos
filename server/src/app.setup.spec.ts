import { swaggerEnabled, trustProxySetting } from './app.setup';

describe('trustProxySetting', () => {
  it('is off unless TRUST_PROXY is a positive whole number of proxies', () => {
    for (const v of [undefined, '', ' ', '0', '-1', '1.5', 'true', 'yes']) expect(trustProxySetting(v)).toBe(false);
    expect(trustProxySetting('1')).toBe(1);
    expect(trustProxySetting('2')).toBe(2);
  });
});

describe('swaggerEnabled', () => {
  it('serves API docs outside production, and in production only with ENABLE_SWAGGER=1', () => {
    expect(swaggerEnabled({})).toBe(true);
    expect(swaggerEnabled({ NODE_ENV: 'development' })).toBe(true);
    expect(swaggerEnabled({ NODE_ENV: 'production' })).toBe(false);
    expect(swaggerEnabled({ NODE_ENV: 'production', ENABLE_SWAGGER: 'true' })).toBe(false);
    expect(swaggerEnabled({ NODE_ENV: 'production', ENABLE_SWAGGER: '1' })).toBe(true);
  });
});
