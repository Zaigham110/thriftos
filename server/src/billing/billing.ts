/**
 * Phase 7 billing rules, as plain functions (no database): where a business stands with its plan, and which modules
 * that gives it. The service stores the result in `Tenant.enabledModules`, which every screen and guard already reads.
 */

export const TRIAL_DAYS = 14;
export const GRACE_DAYS = 7;
export const TRIAL_PLAN = 'WORKSHOP';
export const FREE_PLAN = 'FREE';

/**
 * - CUSTOM: no plan (a business set up by hand before plans): its modules stay as they are and it never expires.
 * - FREE: on the Free plan.
 * - TRIAL: trying a plan until `trialEndsAt`.
 * - TRIAL_OVER: the trial ended and nothing was paid: the Free plan's modules, data kept, nothing read-only.
 * - ACTIVE: paid until `paidUntil`.
 * - GRACE: the paid period ended less than GRACE_DAYS ago: everything works, with a banner.
 * - READ_ONLY: the grace ended: everything can be seen and exported, nothing changed until it is paid.
 */
export type BillingState = 'CUSTOM' | 'FREE' | 'TRIAL' | 'TRIAL_OVER' | 'ACTIVE' | 'GRACE' | 'READ_ONLY';

export interface BillingFacts {
  planCode: string | null;
  trialEndsAt: Date | null;
  paidUntil: Date | null;
}

const DAY = 24 * 60 * 60 * 1000;

export function billingState(t: BillingFacts, now = new Date()): BillingState {
  if (!t.planCode) return 'CUSTOM';
  if (t.planCode === FREE_PLAN) return 'FREE';
  if (t.paidUntil && t.paidUntil > now) return 'ACTIVE';
  if (t.trialEndsAt && t.trialEndsAt > now) return 'TRIAL';
  if (!t.paidUntil) return 'TRIAL_OVER';
  return now.getTime() - t.paidUntil.getTime() < GRACE_DAYS * DAY ? 'GRACE' : 'READ_ONLY';
}

/** Whole days until a date (rounded up; 0 when passed). */
export function daysUntil(when: Date | null, now = new Date()): number | null {
  if (!when) return null;
  return Math.max(0, Math.ceil((when.getTime() - now.getTime()) / DAY));
}

/** The day the grace ends for a business whose paid period ended. */
export function graceEndsAt(paidUntil: Date | null): Date | null {
  return paidUntil ? new Date(paidUntil.getTime() + GRACE_DAYS * DAY) : null;
}

/**
 * The modules a business with a plan gets: its plan's (the Free plan's once a trial is over unpaid), plus what the
 * super admin added for it. SORT only when the business sorts. Read-only keeps the modules: it only blocks changes.
 */
export function planModules(state: BillingState, plan: readonly string[], free: readonly string[], extra: readonly string[]): string[] {
  const base = state === 'TRIAL_OVER' ? free : plan;
  return [...new Set([...base, ...extra])];
}

/** The end of a paid period that starts at `from`: one month or one year later (same day of the month). */
export function periodEnd(from: Date, period: 'MONTH' | 'YEAR'): Date {
  const end = new Date(from);
  if (period === 'YEAR') end.setUTCFullYear(end.getUTCFullYear() + 1);
  else end.setUTCMonth(end.getUTCMonth() + 1);
  return end;
}
