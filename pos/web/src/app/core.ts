import { HttpClient, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { computed, inject, Injectable, Pipe, PipeTransform, signal } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, firstValueFrom, throwError, timeout } from 'rxjs';

// ---- What the server sends ----

export interface Shop {
  id: string;
  name: string;
  phone: string | null;
  city: string | null;
  address: string | null;
  currency: string;
  billFooter: string | null;
  taxName: string;
  taxRate: string;
  taxInclusive: boolean;
  ntn: string | null;
  strn: string | null;
  cashierMaxDiscountPct: number;
  managerSeesCost: boolean;
}
export interface Till {
  id: string;
  code: string;
  name: string;
  billSeq?: number;
  active?: boolean;
}
export interface Branch {
  id: string;
  name: string;
  phone: string | null;
  city: string | null;
  address: string | null;
  active?: boolean;
  tills: Till[];
}
export type Role = 'OWNER' | 'MANAGER' | 'CASHIER';
export interface Session {
  token: string;
  user: { id: string; name: string; phone: string; role: Role; branchId: string | null; hasPin: boolean; seesCost: boolean };
  shop: Shop;
  branches: Branch[];
}

export type BaleStatus = 'IN_STOCK' | 'OPENED' | 'SOLD' | 'FINISHED' | 'IN_TRANSIT' | 'WRITTEN_OFF';
export interface Bale {
  id: string;
  code: string;
  baleNo: string | null;
  item: string;
  category: string | null;
  grade: string | null;
  brand: string | null;
  weightKg: string | null;
  pieces: number | null;
  piecesSold: number;
  piecesLeft: number;
  cost?: string;
  landedCost?: string;
  pieceCost?: string | null;
  salePrice: string | null;
  piecePrice: string | null;
  status: BaleStatus;
  notes?: string | null;
  writeOffReason?: string | null;
  shipmentId?: string;
  shipment?: { code: string; arrivedOn: string; supplier?: { name: string } };
}
export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  address?: string | null;
  balance: string;
  creditLimit: string | null;
  notes?: string | null;
}

export type Method = 'CASH' | 'BANK' | 'WALLET';
export interface SaleLine {
  id: string;
  kind: 'BALE' | 'PIECE' | 'ITEM';
  description: string;
  quantity: number;
  unitPrice: string;
  discount: string;
  lineTotal: string;
  returnedQty: number;
  conflict?: boolean;
  bale: { code: string; baleNo: string | null } | null;
}
export interface Sale {
  id: string;
  code: string;
  customerId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  customer?: { id: string; name: string; phone: string | null; balance: string } | null;
  subtotal: string;
  discount: string;
  taxName: string | null;
  taxRate: string;
  taxInclusive: boolean;
  taxAmount: string;
  total: string;
  paidTotal: string;
  changeGiven: string;
  creditAmount: string;
  returnedTotal: string;
  profit?: string;
  note: string | null;
  status: 'COMPLETED' | 'CANCELLED';
  cancelReason: string | null;
  madeOffline: boolean;
  needsReview: boolean;
  reviewNote: string | null;
  soldAt: string;
  user?: { name: string };
  lines?: SaleLine[];
  payments?: { method: Method; amount: string; reference?: string | null }[];
  returns?: { id: string; code: string; total: string; refundTo: string; reason: string | null; createdAt: string }[];
  _count?: { lines: number };
  /** Made on this device while the server could not be reached; not sent yet. */
  waiting?: boolean;
}

export const METHODS: { key: Method; label: string; short: string }[] = [
  { key: 'CASH', label: 'Cash', short: 'Cash' },
  { key: 'BANK', label: 'Bank / card', short: 'Bank' },
  { key: 'WALLET', label: 'Easypaisa / JazzCash', short: 'Wallet' },
];
export const methodLabel = (m: string) => (m === 'KHATA' ? 'Khata' : (METHODS.find((x) => x.key === m)?.label ?? m));

export const STATUS_LABEL: Record<BaleStatus, string> = { IN_STOCK: 'Closed bale', OPENED: 'Opened', SOLD: 'Sold', FINISHED: 'Finished', IN_TRANSIT: 'On the way', WRITTEN_OFF: 'Written off' };
export const STATUS_TONE: Record<BaleStatus, string> = {
  IN_STOCK: 'bg-emerald-50 text-emerald-800',
  OPENED: 'bg-amber-50 text-amber-800',
  SOLD: 'bg-stone-100 text-stone-600',
  FINISHED: 'bg-stone-100 text-stone-600',
  IN_TRANSIT: 'bg-sky-50 text-sky-800',
  WRITTEN_OFF: 'bg-red-50 text-red-800',
};
export const ROLE_LABEL: Record<Role, string> = { OWNER: 'Owner', MANAGER: 'Manager', CASHIER: 'Cashier' };

// ---- The server, the signed-in person, this device's branch and till ----

const KEY = 'thriftos-pos-session';
const BRANCH = 'thriftos-pos-branch';
const TILL = 'thriftos-pos-till';

function stored(key: string): string {
  try {
    return localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}

@Injectable({ providedIn: 'root' })
export class Api {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  readonly session = signal<Session | null>(this.load());
  readonly role = computed<Role>(() => this.session()?.user.role ?? 'CASHIER');
  readonly isOwner = computed(() => this.role() === 'OWNER');
  readonly isManager = computed(() => this.role() !== 'CASHIER');
  readonly seesCost = computed(() => !!this.session()?.user.seesCost);
  readonly shop = computed(() => this.session()?.shop ?? null);

  private readonly branchPick = signal(stored(BRANCH));
  private readonly tillPick = signal(stored(TILL));
  /** The branch this device works in: staff have one; the owner picks. */
  readonly branch = computed<Branch | null>(() => {
    const list = this.session()?.branches ?? [];
    return list.find((b) => b.id === this.branchPick()) ?? list[0] ?? null;
  });
  /** The till this device is. */
  readonly till = computed<Till | null>(() => {
    const tills = this.branch()?.tills ?? [];
    return tills.find((t) => t.id === this.tillPick()) ?? tills[0] ?? null;
  });

  /** A newer version of the app is waiting; the till reloads when the bill in hand is done. */
  updateReady = false;

  readonly toast = signal<{ text: string; bad: boolean } | null>(null);
  private toastTimer: ReturnType<typeof setTimeout> | undefined;

  private load(): Session | null {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Session | null;
      return s && Array.isArray(s.branches) ? s : null; // a session saved by the older app is not enough
    } catch {
      return null;
    }
  }

  signIn(session: Session) {
    localStorage.setItem(KEY, JSON.stringify(session));
    this.session.set(session);
  }

  /** Fresh shop settings, branches and tills after the owner changed them. */
  async reloadSession() {
    const s = this.session();
    if (!s) return;
    const fresh = await this.get<Omit<Session, 'token'>>('/auth/me');
    this.signIn({ token: s.token, ...fresh });
  }

  setBranch(id: string) {
    localStorage.setItem(BRANCH, id);
    this.branchPick.set(id);
  }
  setTill(id: string) {
    localStorage.setItem(TILL, id);
    this.tillPick.set(id);
  }

  signOut() {
    localStorage.removeItem(KEY);
    this.session.set(null);
    void this.router.navigateByUrl('/login');
  }

  say(text: string, bad = false) {
    clearTimeout(this.toastTimer);
    this.toast.set({ text, bad });
    this.toastTimer = setTimeout(() => this.toast.set(null), bad ? 6000 : 2600);
  }

  /** True when the server could not be reached at all (as opposed to the server saying no). */
  unreachable(error: unknown): boolean {
    const e = error as { name?: string; status?: number };
    return e?.name === 'TimeoutError' || e?.status === 0 || e?.status === 502 || e?.status === 503 || e?.status === 504;
  }

  /** The server's own words when it refused; otherwise that it could not be reached. */
  why(error: unknown): string {
    const e = error as HttpErrorResponse;
    const message = e?.error?.message;
    if (typeof message === 'string') return message;
    if (error instanceof Error && !(error instanceof HttpErrorResponse) && error.name !== 'TimeoutError') return error.message;
    if (e?.status === 413) return 'The file is too big (5 MB at most).';
    if (e?.status === 429) return 'Too many tries. Wait a minute and try again.';
    return 'Could not reach the shop server. Check the connection and try again.';
  }

  get<T>(path: string, params: Record<string, string> = {}) {
    return firstValueFrom(this.http.get<T>(`/api${path}`, { params }));
  }
  post<T>(path: string, body: unknown = {}, waitMs = 0) {
    const call = this.http.post<T>(`/api${path}`, body);
    return firstValueFrom(waitMs ? call.pipe(timeout(waitMs)) : call);
  }
  patch<T>(path: string, body: unknown) {
    return firstValueFrom(this.http.patch<T>(`/api${path}`, body));
  }
  delete<T>(path: string) {
    return firstValueFrom(this.http.delete<T>(`/api${path}`));
  }
  blob(path: string) {
    return firstValueFrom(this.http.get(`/api${path}`, { responseType: 'blob' }));
  }
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const api = inject(Api);
  const token = api.session()?.token;
  const branch = api.branch()?.id;
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (branch) headers['X-Branch'] = branch;
  return next(req.clone({ setHeaders: headers })).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && token && !/\/auth\/(login|pin|me)/.test(req.url)) api.signOut();
      return throwError(() => error);
    }),
  );
};

export const signedIn: CanActivateFn = () => (inject(Api).session() ? true : inject(Router).parseUrl('/login'));
export const ownerOnly: CanActivateFn = () => (inject(Api).isOwner() ? true : inject(Router).parseUrl('/'));
export const managerUp: CanActivateFn = () => (inject(Api).isManager() ? true : inject(Router).parseUrl('/'));

// ---- Money, numbers, dates ----

/** Rs 125,000, with paisa only when there is some. */
export function money(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = Number(value);
  return `${n < 0 ? '-' : ''}Rs ${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`;
}

@Pipe({ name: 'money' })
export class MoneyPipe implements PipeTransform {
  transform = money;
}

/** What a person typed in a money box, as a number (0 when empty or not a number). */
export function typed(value: string | number | null | undefined): number {
  const n = Number(String(value ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Start of a local day (2026-11-13) as the moment the server understands. */
export function dayStart(day: string, addDays = 0): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d + addDays).toISOString();
}

/** The same sums the server does, so the till shows the right total before the bill is saved (and while offline). */
export function billMath(lines: { quantity: number; unitPrice: number; discount: number }[], billDiscount: number, shop: Pick<Shop, 'taxRate' | 'taxInclusive'> | null) {
  const gross = round2(lines.reduce((a, l) => a + l.quantity * l.unitPrice, 0));
  const subtotal = round2(lines.reduce((a, l) => a + l.quantity * l.unitPrice - l.discount, 0));
  const discount = Math.min(billDiscount, subtotal);
  const net = round2(subtotal - discount);
  const rate = Number(shop?.taxRate ?? 0);
  const inclusive = shop?.taxInclusive ?? true;
  const tax = rate ? round2(inclusive ? net - (net * 100) / (100 + rate) : (net * rate) / 100) : 0;
  return { gross, subtotal, discount, net, tax, total: round2(inclusive ? net : net + tax) };
}

/** Saves rows as a CSV file the owner can open in Excel. */
export function downloadCsv(name: string, rows: (string | number | null | undefined)[][]) {
  const cell = (v: string | number | null | undefined) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const blob = new Blob(['﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/** A wa.me link with the text ready, to a Pakistani mobile when the number looks like one. */
export function whatsapp(phone: string | null | undefined, text: string): string {
  let digits = (phone ?? '').replace(/\D/g, '');
  if (digits.startsWith('0')) digits = `92${digits.slice(1)}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export function uid(): string {
  return typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
