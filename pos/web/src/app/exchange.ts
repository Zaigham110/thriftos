/**
 * An exchange in the making: goods of an earlier bill that come back and pay for the new bill on the till. It is
 * chosen on the bill's page, carried to the till on this device, and saved by the server together with the new
 * bill (all or nothing), so nothing is taken back until the new bill is completed.
 */
export interface PendingExchange {
  saleId: string;
  saleCode: string;
  /** What comes back, as the bill's return sheet chose it. */
  lines: { saleLineId: string; quantity: number; restock: boolean }[];
  reason: string;
  /** What those goods are worth, as shown on the return sheet. The server works it out again. */
  worth: number;
  what: string;
}

const KEY = 'thriftos-pos-exchange';

export function readExchange(): PendingExchange | null {
  try {
    const e = JSON.parse(localStorage.getItem(KEY) ?? 'null') as PendingExchange | null;
    return e && e.saleId && Array.isArray(e.lines) ? e : null;
  } catch {
    return null;
  }
}

export function keepExchange(e: PendingExchange | null) {
  if (e) localStorage.setItem(KEY, JSON.stringify(e));
  else localStorage.removeItem(KEY);
}
