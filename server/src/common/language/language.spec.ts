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
    for (const make of [welcomeMessage, newPinMessage]) {
      const texts = LANGUAGES.map((l) => make(l, p));
      expect(new Set(texts).size).toBe(LANGUAGES.length);
      for (const t of texts) expect(t).toContain('123456');
    }
    expect(new Set(LANGUAGES.map((l) => resetEmail(l, 'https://x').text)).size).toBe(LANGUAGES.length);
    expect(welcomeMessage('roman', p)).toContain('aap ka ThriftOS tayyar hai');
  });
});
