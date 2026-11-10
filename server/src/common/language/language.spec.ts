import { readFileSync } from 'fs';
import { join } from 'path';
import { welcomeMessage, newPinMessage } from '../../superadmin/onboarding.service';
import { resetEmail } from '../../auth/password-reset.service';
import { isLanguage, LANGUAGES, localeOf, toLanguage } from './language';

describe('languages', () => {
  it('the app and the server know the same languages', () => {
    const app = readFileSync(join(__dirname, '../../../../thriftos-frontend/src/app/core/i18n/i18n.service.ts'), 'utf8');
    const block = app.slice(app.indexOf('export const LANGS'), app.indexOf('];', app.indexOf('export const LANGS')));
    const ids = [...block.matchAll(/id: '([a-z-]+)'/g)].map((m) => m[1]);
    expect(ids.sort()).toEqual([...LANGUAGES].sort());
    // Every language has its app dictionary.
    for (const l of LANGUAGES) expect(() => readFileSync(join(__dirname, `../../../../thriftos-frontend/public/i18n/${l}.json`))).not.toThrow();
  });

  it('falls back to the business default, then English', () => {
    expect(toLanguage('roman')).toBe('roman');
    expect(toLanguage('fr', 'ur')).toBe('ur');
    expect(toLanguage(undefined, undefined)).toBe('en');
    expect(isLanguage('roman')).toBe(true);
    expect(localeOf('ur')).toBe('ur-PK');
    expect(localeOf('roman')).toBe('en-PK');
  });

  it('every server message exists in every language, each different', () => {
    const p = { owner: 'Rafiq', business: 'Bawa Traders', url: 'https://x', phone: '0335 2010376', pin: '123456' };
    const w = { owner: 'Rafiq', business: 'Bawa Traders', url: 'https://x', email: 'rafiq@bawa.pk', password: 'Kx7-pass-9' };
    const pins = LANGUAGES.map((l) => newPinMessage(l, p));
    expect(new Set(pins).size).toBe(LANGUAGES.length);
    for (const t of pins) expect(t).toContain('123456');
    const welcomes = LANGUAGES.map((l) => welcomeMessage(l, w));
    expect(new Set(welcomes).size).toBe(LANGUAGES.length);
    for (const t of welcomes) {
      expect(t).toContain('rafiq@bawa.pk');
      expect(t).toContain('Kx7-pass-9');
    }
    expect(new Set(LANGUAGES.map((l) => resetEmail(l, 'https://x').text)).size).toBe(LANGUAGES.length);
    expect(welcomeMessage('roman', w)).toContain('aap ka ThriftOS tayyar hai');
  });
});
