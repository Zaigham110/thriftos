import { HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export const D = Prisma.Decimal;
export type Dec = Prisma.Decimal;
export const ZERO = new D(0);

/** Every refusal has a code (for the screens and tests) and words that say what to do. */
export function fail(code: string, message: string, status = 400): never {
  throw new HttpException({ code, message }, status);
}

export function text(value: unknown, label: string, max = 120): string {
  const s = typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
  if (!s) fail('REQUIRED', `${label} is needed.`);
  if (s.length > max) fail('TOO_LONG', `${label} is too long (${max} letters at most).`);
  return s;
}

export function optText(value: unknown, label: string, max = 200): string | null {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  return text(value, label, max);
}

/** Money or weight typed by a person: "1,25,000", "Rs 1250.50". Never negative. */
export function amount(value: unknown, label: string): Dec {
  if (value === undefined || value === null || String(value).trim() === '') return ZERO;
  const cleaned = String(value).replace(/[^0-9.\-]/g, '');
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) fail('BAD_NUMBER', `${label} must be a number.`);
  const d = new D(cleaned);
  if (d.isNegative()) fail('BAD_NUMBER', `${label} cannot be less than zero.`);
  if (d.greaterThan('99999999999')) fail('BAD_NUMBER', `${label} is too large.`);
  return d.toDecimalPlaces(2);
}

export function optAmount(value: unknown, label: string): Dec | null {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  return amount(value, label);
}

export function wholeNumber(value: unknown, label: string, min = 1): number {
  const n = Number(String(value ?? '').trim());
  if (!Number.isInteger(n) || n < min || n > 1_000_000) fail('BAD_NUMBER', `${label} must be a whole number, ${min} or more.`);
  return n;
}

/** A day typed as 2026-11-13. */
export function day(value: unknown, label: string): Date {
  const s = String(value ?? '').trim();
  const d = new Date(`${s}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(d.getTime())) fail('BAD_DATE', `${label} must be a date.`);
  return d;
}

export function optDay(value: unknown, label: string): Date | null {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  return day(value, label);
}

export function phoneDigits(value: unknown, label = 'Phone'): string {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) fail('BAD_PHONE', `${label} must be a phone number, for example 0300 1234567.`);
  return digits;
}

export function pad(n: number, width: number): string {
  return String(n).padStart(width, '0');
}

/**
 * Shares `total` between items in proportion to `weights` (equal shares when a weight is missing or zero).
 * Rounded to paisa; the last item takes what rounding left, so the shares always add up to the total.
 */
export function spread(total: Dec, weights: (Dec | null)[]): Dec[] {
  const n = weights.length;
  if (n === 0) return [];
  const byWeight = weights.every((w) => w !== null && w.greaterThan(0));
  const parts = byWeight ? (weights as Dec[]) : weights.map(() => new D(1));
  const sum = parts.reduce((a, b) => a.plus(b), ZERO);
  let given = ZERO;
  return parts.map((part, i) => {
    if (i === n - 1) return total.minus(given);
    const share = total.times(part).dividedBy(sum).toDecimalPlaces(2, D.ROUND_HALF_UP);
    given = given.plus(share);
    return share;
  });
}

/** A percent typed by a person, 0 to 100. */
export function percent(value: unknown, label: string): Dec {
  const d = amount(value, label);
  if (d.greaterThan(100)) fail('BAD_NUMBER', `${label} cannot be more than 100.`);
  return d;
}

export function pin(value: unknown): string {
  const s = String(value ?? '').trim();
  if (!/^\d{4,6}$/.test(s)) fail('BAD_PIN', 'A PIN is 4 to 6 digits.');
  return s;
}

/** A moment sent by a screen (ISO text); `fallback` when empty or not a date. */
export function moment(value: unknown, fallback: Date): Date {
  const d = value ? new Date(String(value)) : fallback;
  return Number.isNaN(d.getTime()) ? fallback : d;
}

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** `from` / `to` of a list or report; default is today. The screen sends its own local day edges. */
export function range(q: Record<string, string>): { gte: Date; lt: Date } {
  const gte = moment(q.from, startOfDay(new Date()));
  const lt = moment(q.to, new Date(gte.getTime() + 86_400_000));
  return { gte, lt };
}
