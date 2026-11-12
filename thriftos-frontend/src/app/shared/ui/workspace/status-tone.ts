/**
 * One colour rule for every status in the workspace, so "Paid" is green on every screen. The word always
 * stays; the colour only helps the eye find it.
 */
export type WsTone = 'good' | 'warn' | 'bad' | 'info' | 'muted';

const TONES: Record<string, WsTone> = {
  // Done, in hand
  PAID: 'good', APPROVED: 'good', SORTED: 'good', AVAILABLE: 'good', KEPT: 'good', CONFIRMED: 'good', CLEARED: 'good', RECORDED: 'good', DONE: 'good',
  // Waiting on someone
  ISSUED: 'warn', PENDING: 'warn', NOT_STARTED: 'warn', RESERVED: 'warn', DUE_TODAY: 'warn', ARRIVED: 'warn', OPEN_DAY: 'warn',
  // Moving
  PARTIALLY_PAID: 'info', IN_TRANSIT: 'info', IN_SORTING: 'info', OPEN: 'info',
  // Wrong or stopped
  CANCELLED: 'bad', REJECTED: 'bad', BROKEN: 'bad',
  // Over, nothing to do
  DRAFT: 'muted', CLOSED: 'muted', SOLD: 'muted',
};

/** The colour for a status code; a code nobody listed still gets a plain badge. */
export function statusTone(code: unknown): WsTone {
  return TONES[String(code ?? '')] ?? 'muted';
}

/** Marks cells of a table row as statuses: `tones` is column key → status code. */
export function withTones<T extends object>(row: T, tones: Record<string, unknown>): T & { _tone: Record<string, WsTone> } {
  const out: Record<string, WsTone> = {};
  for (const [key, code] of Object.entries(tones)) if (code !== null && code !== undefined && code !== '') out[key] = statusTone(code);
  return { ...row, _tone: out };
}
