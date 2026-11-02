import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export type Lang = 'en' | 'ur';
type Dict = { [key: string]: string | Dict };

const LANG_KEY = 'thriftos.lang';

function readLang(): Lang | null {
  try {
    const v = localStorage.getItem(LANG_KEY);
    return v === 'ur' || v === 'en' ? v : null;
  } catch {
    return null;
  }
}

/**
 * Every visible word comes from `public/i18n/en.json` or `ur.json`. Urdu switches the page to RTL and
 * the Urdu fonts. Numbers always use Western digits (Intl with `-u-nu-latn`), in both languages.
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

  /** Loads both dictionaries (cached by the service worker) before the app shows anything. */
  async init(): Promise<void> {
    const [en, ur] = await Promise.all(
      (['en', 'ur'] as const).map((l) => firstValueFrom(this.http.get<Dict>(`/i18n/${l}.json`)).catch(() => ({}) as Dict)),
    );
    this.dicts.set({ en, ur });
    this.apply();
  }

  /** The person picked a language on this phone: it wins over the tenant default from now on. */
  use(lang: Lang): void {
    this.chosen = lang;
    try {
      localStorage.setItem(LANG_KEY, lang);
    } catch {
      /* private mode */
    }
    this.lang.set(lang);
    this.apply();
  }

  /** Tenant default language, used until the person picks one. */
  useDefault(lang: string | null | undefined): void {
    if (this.chosen || (lang !== 'ur' && lang !== 'en')) return;
    this.lang.set(lang);
    this.apply();
  }

  /** `t('sell.save')`, `t('khata.owes', { amount: 'Rs 1,500' })`. A missing key shows the key, never blank. */
  t(key: string, params?: Record<string, string | number>): string {
    const lang = this.lang();
    const raw = lookup(this.dicts()[lang], key) ?? lookup(this.dicts().en, key) ?? key;
    return params ? raw.replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m)) : raw;
  }

  /** 12,500 (Western digits, up to 2 decimals). */
  num(value: number | string | null | undefined, digits?: number): string {
    const n = typeof value === 'string' ? Number(value) : value;
    if (n === null || n === undefined || Number.isNaN(n)) return '';
    if (digits === undefined) return this.numbers().format(n);
    return new Intl.NumberFormat('en-PK-u-nu-latn', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
  }

  /** "Rs 12,500" — kept left-to-right inside Urdu text (Unicode isolate), so it never reads "12,500 Rs". */
  money(value: number | string | null | undefined): string {
    const s = this.num(value);
    return s === '' ? '' : ltr(this.t('unit.rs', { n: s }));
  }

  /** "12.5 kg" (1 decimal, as the owner reads weight), left-to-right inside Urdu text. */
  kg(value: number | string | null | undefined): string {
    const s = this.num(value, 1);
    return s === '' ? '' : ltr(this.t('unit.kg', { n: s }));
  }

  private apply(): void {
    const root = document.documentElement;
    root.lang = this.lang();
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
