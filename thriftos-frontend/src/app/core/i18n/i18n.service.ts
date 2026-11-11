import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

/** English, Urdu (Urdu script, right to left) and Roman Urdu (Urdu words in Latin letters, left to right). */
export type Lang = 'en' | 'ur' | 'roman';
/**
 * The language picker, each name in its own language. The one list of languages in the app; the server has the same
 * list in `server/src/common/language/language.ts` and a test keeps them equal.
 */
export const LANGS: { id: Lang; name: string }[] = [
  { id: 'en', name: 'English' },
  { id: 'ur', name: 'اردو' },
  { id: 'roman', name: 'Roman Urdu' },
];

export const isLang = (v: unknown): v is Lang => LANGS.some((l) => l.id === v);
/** The language's name in its own language. */
export const langName = (v: unknown): string => LANGS.find((l) => l.id === v)?.name ?? String(v ?? '');
type Dict = { [key: string]: string | Dict };

const LANG_KEY = 'thriftos.lang';

function readLang(): Lang | null {
  try {
    const v = localStorage.getItem(LANG_KEY);
    return isLang(v) ? v : null;
  } catch {
    return null;
  }
}

/**
 * Every visible word comes from `public/i18n/en.json`, `ur.json` or `roman.json`. Urdu switches the page to RTL and
 * the Urdu fonts; Roman Urdu stays left to right in Latin letters, and any key it lacks falls back to English. Numbers always use Western digits (Intl with `-u-nu-latn`), in both languages.
 * Language: the person's own choice on this phone, else the tenant default, else English.
 */
@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly http = inject(HttpClient);
  private readonly dicts = signal<Partial<Record<Lang, Dict>>>({});
  private chosen = readLang();

  readonly lang = signal<Lang>(this.chosen ?? 'en');
  readonly dir = computed(() => (this.lang() === 'ur' ? 'rtl' : 'ltr'));
  private readonly numbers = computed(() => new Intl.NumberFormat('en-PK-u-nu-latn', { maximumFractionDigits: 2 }));

  /**
   * Loads the dictionary of the language in use before the first screen (one small file; the other language
   * loads when someone switches). Both are cached by the service worker for offline use.
   */
  async init(): Promise<void> {
    await this.load(this.lang());
    this.apply();
  }

  private async load(lang: Lang): Promise<void> {
    if (this.dicts()[lang]) return;
    const dict = await firstValueFrom(this.http.get<Dict>(`/i18n/${lang}.json`)).catch(() => ({}) as Dict);
    this.dicts.update((d) => ({ ...d, [lang]: dict }));
  }

  /** The person picked a language on this phone: it wins over the tenant default from now on. */
  use(lang: Lang): void {
    this.chosen = lang;
    try {
      localStorage.setItem(LANG_KEY, lang);
    } catch {
      /* private mode */
    }
    void this.load(lang).then(() => {
      this.lang.set(lang);
      this.apply();
    });
  }

  /** Tenant default language, used until the person picks one. */
  useDefault(lang: string | null | undefined): void {
    if (this.chosen || !isLang(lang)) return;
    void this.load(lang).then(() => {
      this.lang.set(lang);
      this.apply();
    });
  }

  /** `t('sell.save')`, `t('khata.owes', { amount: 'Rs 1,500' })`. A missing key shows the key, never blank. */
  t(key: string, params?: Record<string, string | number>): string {
    const lang = this.lang();
    const raw = lookup(this.dicts()[lang], key) ?? lookup(this.dicts().en, key) ?? key;
    if (!raw.includes('{')) return raw;
    // Words every screen may use: {topGrade} is this business's best grade ("Cream", "A"), or "Top grade" when none.
    const all: Record<string, string | number> = { topGrade: this.globals()['topGrade'] ?? lookup(this.dicts()[lang], 'common.topGrade') ?? 'Top grade', ...params };
    return raw.replace(/\{(\w+)\}/g, (m, k) => (k in all ? String(all[k]) : m));
  }

  private readonly globals = signal<Record<string, string>>({});
  /** Sets (or clears, with null) a word every string may use, e.g. the business's best grade. */
  setGlobal(name: string, value: string | null): void {
    this.globals.update((g) => {
      const next = { ...g };
      if (value) next[name] = value;
      else delete next[name];
      return next;
    });
  }

  /** 12,500 (Western digits, up to 2 decimals). */
  num(value: number | string | null | undefined, digits?: number): string {
    const n = typeof value === 'string' ? Number(value) : value;
    if (n === null || n === undefined || Number.isNaN(n)) return '';
    if (digits === undefined) return this.numbers().format(n);
    return new Intl.NumberFormat('en-PK-u-nu-latn', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
  }

  /**
   * "Rs 12,500" or "Rs 11,947.30": whole rupees without decimals, otherwise always two (paisa), kept
   * left-to-right inside Urdu text (Unicode isolate), so it never reads "12,500 Rs".
   */
  money(value: number | string | null | undefined): string {
    const n = typeof value === 'string' ? Number(value) : value;
    const s = n === null || n === undefined || Number.isNaN(n) ? '' : this.num(n, Number.isInteger(Math.round(n * 100) / 100) ? 0 : 2);
    return s === '' ? '' : ltr(this.t('unit.rs', { n: s }));
  }

  /** "12.5 kg" (1 decimal, as the owner reads weight), left-to-right inside Urdu text. */
  kg(value: number | string | null | undefined): string {
    const s = this.num(value, 1);
    return s === '' ? '' : ltr(this.t('unit.kg', { n: s }));
  }

  private apply(): void {
    const root = document.documentElement;
    root.lang = this.lang() === 'roman' ? 'ur-Latn' : this.lang();
    root.dir = this.dir();
  }
}

/** Left-to-right isolate (U+2066 … U+2069): numbers with units read the same in Urdu and English. */
function ltr(s: string): string {
  return `\u2066${s}\u2069`;
}

function lookup(dict: Dict | undefined, key: string): string | undefined {
  const v = key.split('.').reduce<string | Dict | undefined>((d, k) => (d && typeof d === 'object' ? d[k] : undefined), dict);
  return typeof v === 'string' ? v : undefined;
}
