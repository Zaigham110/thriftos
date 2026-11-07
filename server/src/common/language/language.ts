/**
 * The languages ThriftOS speaks, in one place. Every check (forms, settings, messages) uses this list, and every text
 * the server writes (WhatsApp, emails) is a `Texts<…>` with one entry per language, so adding a language here makes
 * the compiler point at each message that still needs its translation. The app has the same list in
 * `thriftos-frontend/src/app/core/i18n/i18n.service.ts` (LANGS); a test keeps the two equal.
 */
export const LANGUAGES = ['en', 'ur', 'roman'] as const;
export type Language = (typeof LANGUAGES)[number];

/** Each language's name in its own language (pickers). */
export const LANGUAGE_NAMES: Record<Language, string> = { en: 'English', ur: 'اردو', roman: 'Roman Urdu' };

/** One text per language. */
export type Texts<T> = Record<Language, T>;

export const isLanguage = (v: unknown): v is Language => typeof v === 'string' && (LANGUAGES as readonly string[]).includes(v);

/** The language asked for, else the fallback (usually the business's default), else English. */
export function toLanguage(value: unknown, fallback?: unknown): Language {
  if (isLanguage(value)) return value;
  if (isLanguage(fallback)) return fallback;
  return 'en';
}

/** Number and date formatting: Urdu script uses ur-PK; English and Roman Urdu use en-PK. */
export const localeOf = (lang: Language): string => (lang === 'ur' ? 'ur-PK' : 'en-PK');

/** Languages written right to left (Urdu script). */
export const isRtl = (lang: Language): boolean => lang === 'ur';
