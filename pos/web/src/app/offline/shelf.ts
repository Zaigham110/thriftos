import { computed, inject, Injectable, signal } from '@angular/core';
import { Api, Bale, billMath, Branch, Customer, dayStart, Method, round2, Sale, Shop, Till, today, uid } from '../core';
import { deviceDb, Waiting } from './db';

export interface Snapshot {
  at: string;
  shop: Shop;
  branch: Omit<Branch, 'tills'>;
  tills: Till[];
  till: Till | null;
  shift: { id: string; openedAt: string; openedByName: string; openingFloat: string } | null;
  bales: Bale[];
  customers: Customer[];
  held: number;
  review: number;
  incoming: number;
  today: { bills: number; total: string };
}

export interface CartLine {
  key: string;
  kind: 'BALE' | 'PIECE' | 'ITEM';
  bale: Bale | null;
  name: string;
  quantity: number;
  price: number;
  discount: number;
}
export interface Tender {
  method: Method;
  amount: number;
  reference?: string;
}
export interface Checkout {
  lines: CartLine[];
  discount: number;
  customer: Customer | null;
  note: string;
  tenders: Tender[];
}

/**
 * The till's own copy of the shelf, the customers and the shop's settings. The till always works from this copy, so
 * searching is instant and selling keeps going when the server cannot be reached. Bills made offline wait on the
 * device and are sent, in order, as soon as the server answers again.
 */
@Injectable({ providedIn: 'root' })
export class Shelf {
  private readonly api = inject(Api);

  readonly snap = signal<Snapshot | null>(null);
  readonly bales = signal<Bale[]>([]);
  readonly customers = signal<Customer[]>([]);
  readonly online = signal(true);
  readonly waiting = signal<Waiting[]>([]);
  readonly loaded = signal(false);
  readonly stuck = computed(() => this.waiting().filter((w) => w.error).length);
  readonly shift = computed(() => this.snap()?.shift ?? null);
  readonly categories = computed(() => [...new Set(this.bales().map((b) => b.category).filter((c): c is string => !!c))].sort());

  private started = false;
  private flushing = false;

  private get slot() {
    return `snapshot:${this.api.branch()?.id ?? ''}`;
  }

  /** Called once the person is signed in: show the device's copy at once, then ask the server. */
  async start() {
    this.waiting.set(await deviceDb.waiting());
    const kept = await deviceDb.get<Snapshot>(this.slot);
    if (kept && !this.snap()) this.use(kept);
    await this.refresh();
    if (this.started) return;
    this.started = true;
    window.addEventListener('online', () => void this.refresh());
    window.addEventListener('offline', () => this.online.set(false));
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && void this.refresh());
    setInterval(() => (this.api.session() && (!this.online() || this.waiting().length) ? void this.refresh() : undefined), 20_000);
    setInterval(() => (this.api.session() && this.online() ? void this.refresh() : undefined), 120_000);
  }

  private use(snap: Snapshot) {
    this.snap.set(snap);
    this.bales.set(snap.bales);
    this.customers.set(snap.customers);
    this.loaded.set(true);
  }

  async refresh(): Promise<boolean> {
    if (!this.api.session()) return false;
    try {
      const params: Record<string, string> = { from: dayStart(today()) };
      const till = this.api.till()?.id;
      if (till) params['tillId'] = till;
      // Send what is waiting first, so the stock that comes back already knows about those bills.
      await this.flush();
      const snap = await this.api.get<Snapshot>('/sync/snapshot', params);
      this.online.set(true);
      // Bills still waiting on this device have not reached the server's stock yet: keep them taken off.
      this.use(snap);
      for (const w of this.waiting()) if (w.type === 'sale' && !w.error) this.takeOff(w.payload as unknown as SalePayload);
      if (snap.till) this.seq(snap.till, snap.till.billSeq ?? 0);
      void deviceDb.set(this.slot, { ...snap, bales: this.bales(), customers: this.customers() });
      return true;
    } catch (e) {
      if (this.api.unreachable(e)) this.online.set(false);
      this.loaded.set(true);
      return false;
    }
  }

  /** The till's own bill counter, kept on the device so it can number bills while offline. */
  private seq(till: Till, atLeast = 0, bump = false): number {
    const key = `thriftos-pos-seq:${till.id}`;
    const next = Math.max(Number(localStorage.getItem(key)) || 0, atLeast) + (bump ? 1 : 0);
    localStorage.setItem(key, String(next));
    return next;
  }

  find(code: string): Bale | undefined {
    const c = code.trim().toLowerCase();
    return this.bales().find((b) => b.code.toLowerCase() === c) ?? this.bales().find((b) => (b.baleNo ?? '').toLowerCase() === c);
  }

  /** Replace one bale in the till's copy (after opening it, or a price change). */
  put(bale: Bale) {
    const shown = bale.status === 'IN_STOCK' || (bale.status === 'OPENED' && bale.piecesLeft > 0);
    this.bales.update((list) => (shown ? (list.some((b) => b.id === bale.id) ? list.map((b) => (b.id === bale.id ? { ...b, ...bale } : b)) : [bale, ...list]) : list.filter((b) => b.id !== bale.id)));
  }

  private takeOff(payload: SalePayload) {
    const sold = new Map(payload.lines.filter((l) => l.baleId).map((l) => [l.baleId!, l]));
    this.bales.update((list) =>
      list.flatMap((b) => {
        const line = sold.get(b.id);
        if (!line) return [b];
        if (line.kind === 'BALE') return [];
        const left = b.piecesLeft - line.quantity;
        return left > 0 ? [{ ...b, piecesLeft: left, piecesSold: b.piecesSold + line.quantity }] : [];
      }),
    );
  }

  /**
   * Completes a bill. Online, the server saves it and gives the number. If the server cannot be reached, the bill is
   * numbered by this till, kept on the device and sent later; the customer gets the same printed bill either way.
   */
  async sell(checkout: Checkout): Promise<Sale> {
    const shop = this.snap()?.shop ?? this.api.shop();
    const till = this.snap()?.till ?? this.api.till();
    const math = billMath(checkout.lines.map((l) => ({ quantity: l.quantity, unitPrice: l.price, discount: l.discount })), checkout.discount, shop);
    const payload: SalePayload = {
      clientKey: uid(),
      tillId: till?.id ?? '',
      lines: checkout.lines.map((l) => ({ baleId: l.bale?.id ?? null, kind: l.kind, description: l.name, quantity: l.quantity, unitPrice: l.price, discount: l.discount })),
      discount: math.discount,
      customerId: checkout.customer?.id ?? null,
      note: checkout.note,
      payments: checkout.tenders.filter((t) => t.amount > 0),
    };
    const tendered = round2(payload.payments.reduce((a, t) => a + t.amount, 0));
    const change = Math.max(0, round2(tendered - math.total));
    const credit = Math.max(0, round2(math.total - tendered));

    let sale: Sale;
    try {
      sale = await this.api.post<Sale>('/sales', payload, 9000);
      this.online.set(true);
      // Keep the till's own counter in step, so the next bill made offline gets a number nobody has used.
      const n = Number(sale.code.split('-').pop());
      if (till && Number.isInteger(n)) this.seq(till, n);
    } catch (e) {
      if (!this.api.unreachable(e)) throw e;
      if (!till) throw new Error('This device has no till yet. Connect to the shop server once, then it can sell offline.');
      this.online.set(false);
      const code = `${till.code}-${String(this.seq(till, 0, true)).padStart(6, '0')}`;
      const soldAt = new Date().toISOString();
      sale = {
        id: `waiting:${payload.clientKey}`,
        code,
        customerId: payload.customerId,
        customerName: checkout.customer?.name ?? null,
        customerPhone: checkout.customer?.phone ?? null,
        subtotal: String(math.subtotal),
        discount: String(math.discount),
        taxName: Number(shop?.taxRate) ? (shop?.taxName ?? null) : null,
        taxRate: shop?.taxRate ?? '0',
        taxInclusive: shop?.taxInclusive ?? true,
        taxAmount: String(math.tax),
        total: String(math.total),
        paidTotal: String(round2(tendered - change)),
        changeGiven: String(change),
        creditAmount: String(credit),
        returnedTotal: '0',
        note: checkout.note || null,
        status: 'COMPLETED',
        cancelReason: null,
        madeOffline: true,
        needsReview: false,
        reviewNote: null,
        soldAt,
        user: { name: this.api.session()?.user.name ?? '' },
        lines: checkout.lines.map((l) => ({
          id: l.key,
          kind: l.kind,
          description: l.name,
          quantity: l.quantity,
          unitPrice: String(l.price),
          discount: String(l.discount),
          lineTotal: String(round2(l.quantity * l.price - l.discount)),
          returnedQty: 0,
          bale: l.bale ? { code: l.bale.code, baleNo: l.bale.baleNo } : null,
        })),
        payments: payload.payments.map((t) => ({ method: t.method, amount: String(t.method === 'CASH' ? round2(t.amount - change) : t.amount), reference: t.reference })),
        waiting: true,
      };
      const item: Waiting = { key: payload.clientKey, type: 'sale', at: Date.now(), payload: { ...payload, offline: { code, soldAt } }, sale };
      await deviceDb.keep(item);
      this.waiting.update((w) => [...w, item]);
    }
    this.takeOff(payload);
    if (checkout.customer && credit > 0) {
      this.customers.update((list) => list.map((c) => (c.id === checkout.customer!.id ? { ...c, balance: String(round2(Number(c.balance) + credit)) } : c)));
    }
    this.snap.update((s) => (s ? { ...s, today: { bills: s.today.bills + 1, total: String(round2(Number(s.today.total) + math.total)) } } : s));
    return sale;
  }

  /** Cash in or out of the drawer; kept on the device when the server cannot be reached. */
  async cash(kind: 'IN' | 'OUT' | 'DROP', amount: number, reason: string): Promise<boolean> {
    const payload = { tillId: this.api.till()?.id, kind, amount, reason, clientKey: uid() };
    try {
      await this.api.post('/shifts/cash', payload, 9000);
      return true;
    } catch (e) {
      if (!this.api.unreachable(e)) throw e;
      this.online.set(false);
      const item: Waiting = { key: payload.clientKey, type: 'cash', at: Date.now(), payload };
      await deviceDb.keep(item);
      this.waiting.update((w) => [...w, item]);
      return false;
    }
  }

  /** Sends what is waiting, oldest first. Stops at the first one the server cannot be reached for. */
  async flush() {
    if (this.flushing) return;
    this.flushing = true;
    try {
      for (const item of await deviceDb.waiting()) {
        if (item.error) continue;
        try {
          await this.api.post(item.type === 'sale' ? '/sales' : '/shifts/cash', item.payload, 15_000);
          await deviceDb.drop(item.key);
        } catch (e) {
          if (this.api.unreachable(e)) break;
          await deviceDb.keep({ ...item, error: this.api.why(e) });
        }
      }
    } finally {
      this.waiting.set(await deviceDb.waiting());
      this.flushing = false;
    }
  }

  async retry(key: string) {
    const item = this.waiting().find((w) => w.key === key);
    if (!item) return;
    await deviceDb.keep({ ...item, error: undefined });
    await this.flush();
  }

  async discard(key: string) {
    await deviceDb.drop(key);
    this.waiting.set(await deviceDb.waiting());
  }
}

interface SalePayload {
  clientKey: string;
  tillId: string;
  lines: { baleId: string | null; kind: 'BALE' | 'PIECE' | 'ITEM'; description: string; quantity: number; unitPrice: number; discount: number }[];
  discount: number;
  customerId: string | null;
  note: string;
  payments: Tender[];
}
