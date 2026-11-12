import { isStaleFile, reloadOnceForNewVersion } from './report-errors.handler';

describe('a page left open across a release', () => {
  beforeEach(() => sessionStorage.removeItem('thriftos.stale-reload'));

  it('knows a missing app file from other errors', () => {
    expect(isStaleFile(new TypeError('Failed to fetch dynamically imported module: http://x/chunk-AB.js'))).toBeTrue();
    expect(isStaleFile({ rejection: new TypeError('Importing a module script failed.') })).toBeTrue();
    expect(isStaleFile(new Error('Cannot read properties of undefined'))).toBeFalse();
  });

  it('reloads once, not again within a minute', () => {
    let reloads = 0;
    expect(reloadOnceForNewVersion(1_000_000, () => reloads++)).toBeTrue();
    expect(reloadOnceForNewVersion(1_030_000, () => reloads++)).toBeFalse();
    expect(reloadOnceForNewVersion(1_070_000, () => reloads++)).toBeTrue();
    expect(reloads).toBe(2);
  });
});
