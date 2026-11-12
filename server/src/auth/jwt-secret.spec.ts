import { jwtSecret } from './jwt-secret';

const config = (env: Record<string, string | undefined>) => ({ get: <T>(k: string) => env[k] as T });

describe('jwtSecret (audit H3: no built-in token secret)', () => {
  it('refuses to start without a secret', () => {
    expect(() => jwtSecret(config({}))).toThrow('JWT_SECRET is not set');
    expect(() => jwtSecret(config({ JWT_SECRET: '   ' }))).toThrow('JWT_SECRET is not set');
  });

  it('in production wants 32+ characters and never the old public value', () => {
    expect(() => jwtSecret(config({ NODE_ENV: 'production', JWT_SECRET: 'thriftOSerp' }))).toThrow('at least 32');
    expect(() => jwtSecret(config({ NODE_ENV: 'production', JWT_SECRET: 'short-secret' }))).toThrow('at least 32');
    const long = 'a'.repeat(48);
    expect(jwtSecret(config({ NODE_ENV: 'production', JWT_SECRET: long }))).toBe(long);
  });

  it('outside production any set secret works', () => {
    expect(jwtSecret(config({ NODE_ENV: 'development', JWT_SECRET: 'local' }))).toBe('local');
  });
});
