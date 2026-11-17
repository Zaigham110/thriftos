import { fail } from './util';

/** Currencies a shop or its suppliers are likely to use. `sign` is what goes in front of an amount. */
export const CURRENCIES: { code: string; name: string; sign: string }[] = [
  { code: 'PKR', name: 'Pakistani rupee', sign: 'Rs' },
  { code: 'USD', name: 'US dollar', sign: '$' },
  { code: 'GBP', name: 'British pound', sign: '£' },
  { code: 'EUR', name: 'Euro', sign: '€' },
  { code: 'AED', name: 'UAE dirham', sign: 'AED' },
  { code: 'SAR', name: 'Saudi riyal', sign: 'SAR' },
  { code: 'CAD', name: 'Canadian dollar', sign: 'C$' },
  { code: 'AUD', name: 'Australian dollar', sign: 'A$' },
  { code: 'CNY', name: 'Chinese yuan', sign: '¥' },
  { code: 'JPY', name: 'Japanese yen', sign: 'JPY' },
  { code: 'KRW', name: 'Korean won', sign: '₩' },
  { code: 'INR', name: 'Indian rupee', sign: '₹' },
  { code: 'BDT', name: 'Bangladeshi taka', sign: '৳' },
  { code: 'AFN', name: 'Afghan afghani', sign: 'AFN' },
  { code: 'KES', name: 'Kenyan shilling', sign: 'KSh' },
  { code: 'TZS', name: 'Tanzanian shilling', sign: 'TSh' },
  { code: 'UGX', name: 'Ugandan shilling', sign: 'USh' },
  { code: 'NGN', name: 'Nigerian naira', sign: '₦' },
  { code: 'GHS', name: 'Ghanaian cedi', sign: 'GH₵' },
  { code: 'ZAR', name: 'South African rand', sign: 'R' },
  { code: 'TRY', name: 'Turkish lira', sign: '₺' },
  { code: 'MYR', name: 'Malaysian ringgit', sign: 'RM' },
];

export function sign(code: string): string {
  return CURRENCIES.find((c) => c.code === code)?.sign ?? code;
}

/** A currency typed or sent by a screen: three letters, upper case. */
export function currencyCode(value: unknown, label = 'Currency'): string {
  const code = String(value ?? '').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) fail('BAD_CURRENCY', `${label} must be a three-letter code such as USD.`);
  return code;
}

// What a supplier's list may write instead of the three-letter code.
const WORDS: [RegExp, string][] = [
  [/\bUS\s?\$|\bUSD\b|\bU\.S\. ?DOLLARS?\b|\bUS DOLLARS?\b/i, 'USD'],
  [/£|\bGBP\b|\bPOUNDS?\b|\bSTERLING\b/i, 'GBP'],
  [/€|\bEUR\b|\bEUROS?\b/i, 'EUR'],
  [/\bAED\b|\bDHS?\b|\bDIRHAMS?\b/i, 'AED'],
  [/\bSAR\b|\bRIYALS?\b/i, 'SAR'],
  [/\bCAD\b|\bC\$/i, 'CAD'],
  [/\bAUD\b|\bA\$/i, 'AUD'],
  [/\bCNY\b|\bRMB\b|\bYUAN\b/i, 'CNY'],
  [/\bJPY\b|\bYEN\b/i, 'JPY'],
  [/₩|\bKRW\b|\bWON\b/i, 'KRW'],
  [/₹|\bINR\b/i, 'INR'],
  [/₨|\bPKR\b|\bRS\.?(?=\s|\d|$)/i, 'PKR'],
  [/\$/, 'USD'], // a bare $ last, after C$, A$ and US$
];

/** The currency a piece of text names, if any: "Cost (USD)", "$ 1,250", "£45". */
export function currencyIn(text: string): string | null {
  for (const [pattern, code] of WORDS) if (pattern.test(text)) return code;
  return null;
}
