import { Controller, Get, Query } from '@nestjs/common';
import { Actor, Me, OwnerOnly } from '../common/auth.guard';
import { CURRENCIES, currencyCode } from '../common/currency';
import { PrismaService } from '../common/prisma.service';
import { D, fail } from '../common/util';

interface Sheet {
  at: number;
  updated: string | null;
  rates: Record<string, number>;
}
const KEEP_MS = 60 * 60_000;
const sheets = new Map<string, Sheet>();

/**
 * Today's exchange rate, for turning a supplier's list into the shop's own currency. The rate comes from a public
 * rate service (only the currency code is sent, nothing about the shop) and is kept for an hour. When the service
 * cannot be reached the owner types the rate by hand.
 */
@OwnerOnly()
@Controller('rates')
export class RatesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('currencies')
  currencies() {
    return CURRENCIES;
  }

  /** One unit of `from` in the shop's currency (or in `to`). */
  @Get()
  async rate(@Me() me: Actor, @Query('from') fromRaw: string, @Query('to') toRaw?: string) {
    const from = currencyCode(fromRaw, 'The list currency');
    const to = toRaw ? currencyCode(toRaw) : (await this.prisma.shop.findUniqueOrThrow({ where: { id: me.tenantId }, select: { currency: true } })).currency;
    if (from === to) return { from, to, rate: '1', at: new Date().toISOString(), source: 'same currency' };
    let sheet = sheets.get(from);
    if (!sheet || Date.now() - sheet.at > KEEP_MS) {
      const base = (process.env.POS_RATES_URL || 'https://open.er-api.com/v6/latest').replace(/\/$/, '');
      try {
        const res = await fetch(`${base}/${from}`, { signal: AbortSignal.timeout(7000) });
        const body = (await res.json()) as { result?: string; rates?: Record<string, number>; time_last_update_utc?: string };
        if (!res.ok || body.result !== 'success' || !body.rates) throw new Error('no rates');
        const updated = body.time_last_update_utc ? new Date(body.time_last_update_utc) : null;
        sheet = { at: Date.now(), updated: updated && !Number.isNaN(updated.getTime()) ? updated.toISOString() : null, rates: body.rates };
        sheets.set(from, sheet);
      } catch {
        if (!sheet) fail('RATE_OFF', `Today's ${from} rate could not be fetched. Type the rate by hand.`, 502);
      }
    }
    const rate = sheet!.rates[to];
    if (!rate || rate <= 0) fail('RATE_OFF', `There is no live rate from ${from} to ${to}. Type the rate by hand.`, 502);
    return { from, to, rate: new D(rate).toDecimalPlaces(6).toString(), at: sheet!.updated ?? new Date(sheet!.at).toISOString(), source: 'open.er-api.com' };
  }
}
