import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { BillingPeriod, Prisma, SubscriptionPaymentStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { MODULE_KEYS, storedModules } from '../common/modules/modules';
import { FileStorageService } from '../common/storage/file-storage.service';
import { PrismaService } from '../prisma/prisma.service';
import { BillingState, FREE_PLAN, TRIAL_DAYS, TRIAL_PLAN, billingState, daysUntil, graceEndsAt, periodEnd, planModules } from './billing';

export const PAY_METHODS = ['JAZZCASH', 'EASYPAISA', 'BANK'] as const;
export type PayMethod = (typeof PAY_METHODS)[number];

/** Where customers send money (the owner's own accounts), shown on the billing page; edited in the console. */
export interface PayTo {
  accountTitle: string;
  jazzcash: string;
  easypaisa: string;
  bank: string;
  note: string;
}
const PAY_TO_KEY = 'billing.payTo';
const EMPTY_PAY_TO: PayTo = { accountTitle: '', jazzcash: '', easypaisa: '', bank: '', note: '' };

/** A screenshot of the payment: an image or a PDF, up to 5 MB. */
const SHOT_MAX = 5 * 1024 * 1024;
const SHOT_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' };

export interface UploadedShot { buffer: Buffer; mimetype: string; size: number; originalname?: string }

type TenantForBilling = { id: string; sortingStages: number; enabledModules: string[]; extraModules: string[]; trialEndsAt: Date | null; paidUntil: Date | null; plan: { code: string; modules: string[] } | null };

/**
 * Phase 7: plans, the 14-day trial, manual payments (JazzCash / Easypaisa / bank with a screenshot, confirmed by the
 * super admin in one tap, with an invoice), the grace period and read-only. A business's modules follow its plan;
 * `Tenant.enabledModules` is kept up to date here (on every change, when the business opens the app, and hourly for
 * trials and paid periods that run out).
 */
@Injectable()
export class BillingService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(BillingService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly files: FileStorageService,
  ) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test') return;
    // Trials and paid periods run out on their own: the modules follow within the hour.
    this.timer = setInterval(() => void this.sweep().catch((e) => this.log.warn(`billing sweep: ${e}`)), 60 * 60 * 1000);
    // Never keeps the process alive on its own (tests, shutdown).
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  // ── State ─────────────────────────────────────────────────────────────────────────────────────────

  private tenantSelect = { id: true, sortingStages: true, enabledModules: true, extraModules: true, trialEndsAt: true, paidUntil: true, plan: { select: { code: true, modules: true } } } as const;

  stateOf(t: { trialEndsAt: Date | null; paidUntil: Date | null; plan: { code: string } | null }, now = new Date()): BillingState {
    return billingState({ planCode: t.plan?.code ?? null, trialEndsAt: t.trialEndsAt, paidUntil: t.paidUntil }, now);
  }

  /** The business's state, as cheap as possible (the read-only check runs on every change). */
  async state(tenantId: string, now = new Date()): Promise<BillingState> {
    const t = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { trialEndsAt: true, paidUntil: true, plan: { select: { code: true } } } });
    return t ? this.stateOf(t, now) : 'CUSTOM';
  }

  /** Stores the modules a business's plan gives it now; a business without a plan is left alone. */
  async apply(tenantId: string, now = new Date(), db: Prisma.TransactionClient | PrismaService = this.prisma): Promise<string[] | null> {
    const t = (await db.tenant.findUnique({ where: { id: tenantId }, select: this.tenantSelect })) as TenantForBilling | null;
    if (!t?.plan) return null;
    const next = await this.modulesFor(t, now, db);
    const same = next.length === t.enabledModules.length && next.every((m) => t.enabledModules.includes(m));
    if (!same) await db.tenant.update({ where: { id: tenantId }, data: { enabledModules: next } });
    return next;
  }

  private async modulesFor(t: TenantForBilling, now: Date, db: Prisma.TransactionClient | PrismaService): Promise<string[]> {
    const state = this.stateOf(t, now);
    const free = state === 'TRIAL_OVER' ? (await db.plan.findUnique({ where: { code: FREE_PLAN }, select: { modules: true } }))?.modules ?? [] : [];
    const chosen = planModules(state, t.plan!.modules, free, t.extraModules);
    // Sorting needs the plan (or an extra) to allow it and the business to sort.
    return storedModules(chosen.includes('SORT') ? t.sortingStages : 0, chosen, t.enabledModules);
  }

  /** Every business with a plan, once an hour. */
  async sweep(now = new Date()): Promise<number> {
    const ids = await this.prisma.tenant.findMany({ where: { planId: { not: null } }, select: { id: true } });
    let changed = 0;
    for (const { id } of ids) {
      const before = await this.prisma.tenant.findUnique({ where: { id }, select: { enabledModules: true } });
      const after = await this.apply(id, now);
      if (after && before && after.join() !== before.enabledModules.join()) changed++;
    }
    return changed;
  }

  /** A new business tries the Workshop plan for 14 days (then Free unless paid). */
  async startTrial(tenantId: string, db: Prisma.TransactionClient | PrismaService = this.prisma, now = new Date()): Promise<void> {
    const plan = await db.plan.findUnique({ where: { code: TRIAL_PLAN }, select: { id: true } });
    if (!plan) return;
    await db.tenant.update({ where: { id: tenantId }, data: { planId: plan.id, trialEndsAt: new Date(now.getTime() + TRIAL_DAYS * 86_400_000), paidUntil: null } });
    await this.apply(tenantId, now, db);
  }

  /** Logins left on the plan; throws when adding one more would go over (owner and staff count). */
  async assertCanAddUser(tenantId: string, db: Prisma.TransactionClient | PrismaService = this.prisma, now = new Date()): Promise<void> {
    const t = await db.tenant.findUnique({ where: { id: tenantId }, select: { trialEndsAt: true, paidUntil: true, plan: { select: { code: true, maxUsers: true, name: true } } } });
    if (!t?.plan) return;
    const state = this.stateOf(t, now);
    const limit = state === 'TRIAL_OVER' ? (await db.plan.findUnique({ where: { code: FREE_PLAN }, select: { maxUsers: true } }))?.maxUsers ?? null : t.plan.maxUsers;
    if (limit === null || limit === undefined) return;
    const used = await db.user.count({ where: { tenantId, isActive: true } });
    if (used >= limit) {
      throw new BadRequestException({ code: 'PLAN_USER_LIMIT', limit, message: `Your plan allows ${limit} login${limit === 1 ? '' : 's'}. Choose a bigger plan in Settings → Plan and billing.` });
    }
  }

  /** What every screen's banner needs (staff too): the state, the plan's name and the days left. */
  async banner(tenantId: string, now = new Date()) {
    const t = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { trialEndsAt: true, paidUntil: true, plan: { select: { code: true, name: true } } } });
    if (!t) return null;
    const state = this.stateOf(t, now);
    const graceEnd = graceEndsAt(t.paidUntil);
    return {
      state,
      plan: t.plan?.name ?? null,
      daysLeft: state === 'TRIAL' ? daysUntil(t.trialEndsAt, now) : state === 'ACTIVE' ? daysUntil(t.paidUntil, now) : state === 'GRACE' ? daysUntil(graceEnd, now) : null,
    };
  }

  // ── The owner's page ──────────────────────────────────────────────────────────────────────────────

  async status(tenantId: string, now = new Date()) {
    await this.apply(tenantId, now);
    const t = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { trialEndsAt: true, paidUntil: true, plan: { select: { id: true, code: true, name: true, monthlyPrice: true, yearlyPrice: true, modules: true, maxUsers: true } } },
    });
    const state = this.stateOf(t, now);
    const [plans, payments, payTo, users] = await Promise.all([
      this.plans(true),
      this.prisma.subscriptionPayment.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { id: true, period: true, amount: true, method: true, reference: true, status: true, rejectReason: true, invoiceNumber: true, periodStart: true, periodEnd: true, createdAt: true, confirmedAt: true, plan: { select: { name: true } } },
      }),
      this.payTo(),
      this.prisma.user.count({ where: { tenantId, isActive: true } }),
    ]);
    const graceEnd = graceEndsAt(t.paidUntil);
    return {
      state,
      plan: t.plan,
      trialEndsAt: t.trialEndsAt,
      paidUntil: t.paidUntil,
      graceEndsAt: state === 'GRACE' ? graceEnd : null,
      // Days left on the trial, the paid period or the grace (the banner's "N days").
      daysLeft: state === 'TRIAL' ? daysUntil(t.trialEndsAt, now) : state === 'ACTIVE' ? daysUntil(t.paidUntil, now) : state === 'GRACE' ? daysUntil(graceEnd, now) : null,
      users,
      plans,
      payments,
      pending: payments.some((p) => p.status === SubscriptionPaymentStatus.PENDING),
      payTo,
    };
  }

  async submitPayment(tenantId: string, userId: string, dto: { planId: string; period: BillingPeriod; method: string; reference?: string }, shot?: UploadedShot) {
    const plan = await this.prisma.plan.findFirst({ where: { id: dto.planId, isActive: true } });
    if (!plan || plan.code === FREE_PLAN) throw new BadRequestException('Choose a plan to pay for');
    if (!PAY_METHODS.includes(dto.method as PayMethod)) throw new BadRequestException('Choose JazzCash, Easypaisa or bank');
    if (!shot && !dto.reference?.trim()) throw new BadRequestException('Attach the payment screenshot or type its reference number');
    if (await this.prisma.subscriptionPayment.findFirst({ where: { tenantId, status: SubscriptionPaymentStatus.PENDING }, select: { id: true } })) {
      throw new ConflictException('A payment is already waiting to be confirmed');
    }
    let screenshotKey: string | null = null;
    if (shot) {
      const ext = SHOT_TYPES[shot.mimetype];
      if (!ext) throw new BadRequestException('Attach a photo (JPG, PNG) or a PDF');
      if (shot.size > SHOT_MAX) throw new BadRequestException('The screenshot is larger than 5 MB');
      screenshotKey = await this.files.save(`billing/${tenantId}/${Date.now()}.${ext}`, shot.buffer);
    }
    const amount = dto.period === BillingPeriod.YEAR ? plan.yearlyPrice : plan.monthlyPrice;
    const payment = await this.prisma.subscriptionPayment.create({
      data: { tenantId, planId: plan.id, period: dto.period, amount, method: dto.method, reference: dto.reference?.trim() || null, screenshotKey, submittedBy: userId },
    });
    await this.audit.log({ tenantId, userId, action: 'SUBSCRIPTION_PAYMENT_SUBMITTED', entityType: 'SubscriptionPayment', entityId: payment.id, metadataJson: { plan: plan.code, period: dto.period, amount: amount.toString(), method: dto.method } });
    return payment;
  }

  /** The screenshot, for its own business or the super admin. */
  async screenshot(id: string, tenantId: string | null) {
    const p = await this.prisma.subscriptionPayment.findFirst({ where: { id, ...(tenantId ? { tenantId } : {}) }, select: { screenshotKey: true } });
    if (!p?.screenshotKey) throw new NotFoundException('No screenshot');
    const ext = p.screenshotKey.split('.').pop() ?? '';
    const type = Object.entries(SHOT_TYPES).find(([, e]) => e === ext)?.[0] ?? 'application/octet-stream';
    return { data: await this.files.read(p.screenshotKey), type };
  }

  /** What an invoice shows (printed as a PDF by the app), for its own business or the super admin. */
  async invoice(id: string, tenantId: string | null) {
    const p = await this.prisma.subscriptionPayment.findFirst({
      where: { id, status: SubscriptionPaymentStatus.CONFIRMED, ...(tenantId ? { tenantId } : {}) },
      include: { plan: { select: { name: true } }, tenant: { select: { name: true, phone: true, address: true, city: true, companyCode: true } } },
    });
    if (!p) throw new NotFoundException('Invoice not found');
    return {
      number: p.invoiceNumber, date: p.confirmedAt, business: p.tenant, plan: p.plan.name, period: p.period,
      periodStart: p.periodStart, periodEnd: p.periodEnd, amount: p.amount, method: p.method, reference: p.reference,
    };
  }

  // ── The super admin ───────────────────────────────────────────────────────────────────────────────

  plans(activeOnly = false) {
    return this.prisma.plan.findMany({
      where: activeOnly ? { isActive: true } : {},
      orderBy: { sortOrder: 'asc' },
      select: { id: true, code: true, name: true, monthlyPrice: true, yearlyPrice: true, modules: true, maxUsers: true, isActive: true, sortOrder: true },
    });
  }

  async updatePlan(id: string, dto: { name?: string; monthlyPrice?: number; yearlyPrice?: number; modules?: string[]; maxUsers?: number | null; isActive?: boolean }, userId: string) {
    const plan = await this.prisma.plan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException('Plan not found');
    if (dto.modules && dto.modules.some((m) => !(MODULE_KEYS as readonly string[]).includes(m))) throw new BadRequestException('Unknown module');
    if (plan.code === FREE_PLAN && dto.isActive === false) throw new BadRequestException('The Free plan cannot be switched off');
    const updated = await this.prisma.plan.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.monthlyPrice !== undefined && { monthlyPrice: new Prisma.Decimal(dto.monthlyPrice) }),
        ...(dto.yearlyPrice !== undefined && { yearlyPrice: new Prisma.Decimal(dto.yearlyPrice) }),
        ...(dto.modules !== undefined && { modules: dto.modules }),
        ...(dto.maxUsers !== undefined && { maxUsers: dto.maxUsers }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
    await this.audit.log({ userId, action: 'PLAN_UPDATED', entityType: 'Plan', entityId: id, metadataJson: { code: plan.code, ...dto } as Record<string, unknown> });
    // Businesses on this plan get its new modules now.
    if (dto.modules) for (const t of await this.prisma.tenant.findMany({ where: { planId: id }, select: { id: true } })) await this.apply(t.id);
    return updated;
  }

  /** The super admin sets a business's plan by hand: plan, trial end, paid until, extra modules. */
  async setTenantPlan(tenantId: string, dto: { planId?: string | null; trialEndsAt?: string | null; paidUntil?: string | null; extraModules?: string[] }, userId: string) {
    const t = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true, companyCode: true } });
    if (!t) throw new NotFoundException('Business not found');
    if (dto.planId && !(await this.prisma.plan.findUnique({ where: { id: dto.planId }, select: { id: true } }))) throw new BadRequestException('Plan not found');
    if (dto.extraModules?.some((m) => !(MODULE_KEYS as readonly string[]).includes(m))) throw new BadRequestException('Unknown module');
    const day = (v: string | null | undefined) => (v === undefined ? undefined : v === null ? null : new Date(v));
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        ...(dto.planId !== undefined && { planId: dto.planId }),
        ...(dto.trialEndsAt !== undefined && { trialEndsAt: day(dto.trialEndsAt) }),
        ...(dto.paidUntil !== undefined && { paidUntil: day(dto.paidUntil) }),
        ...(dto.extraModules !== undefined && { extraModules: dto.extraModules }),
      },
    });
    await this.apply(tenantId);
    await this.audit.log({ tenantId, userId, action: 'TENANT_PLAN_SET', entityType: 'Tenant', entityId: tenantId, metadataJson: { ...dto } as Record<string, unknown> });
    return this.tenantBilling(tenantId);
  }

  async tenantBilling(tenantId: string, now = new Date()) {
    const t = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { id: true, name: true, trialEndsAt: true, paidUntil: true, extraModules: true, enabledModules: true, plan: { select: { id: true, code: true, name: true } } } });
    return { ...t, state: this.stateOf(t, now) };
  }

  payments(status?: SubscriptionPaymentStatus) {
    return this.prisma.subscriptionPayment.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true, period: true, amount: true, method: true, reference: true, status: true, rejectReason: true, invoiceNumber: true,
        periodStart: true, periodEnd: true, createdAt: true, confirmedAt: true, screenshotKey: true,
        plan: { select: { id: true, name: true } }, tenant: { select: { id: true, name: true, companyCode: true } },
      },
    }).then((rows) => rows.map(({ screenshotKey, ...r }) => ({ ...r, hasScreenshot: !!screenshotKey })));
  }

  /**
   * One tap: the payment is confirmed, the business moves to the plan it paid for, its paid period runs from today
   * (or from the end of the period it already has) for a month or a year, and it gets an invoice number.
   */
  async confirm(id: string, userId: string, now = new Date()) {
    const result = await this.prisma.$transaction(async (tx) => {
      const p = await tx.subscriptionPayment.findUnique({ where: { id }, include: { tenant: { select: { paidUntil: true } } } });
      if (!p) throw new NotFoundException('Payment not found');
      if (p.status !== SubscriptionPaymentStatus.PENDING) throw new ConflictException('This payment was already handled');
      const start = p.tenant.paidUntil && p.tenant.paidUntil > now ? p.tenant.paidUntil : now;
      const end = periodEnd(start, p.period);
      const year = now.getUTCFullYear();
      const count = await tx.subscriptionPayment.count({ where: { invoiceNumber: { startsWith: `INV-${year}-` } } });
      const invoiceNumber = `INV-${year}-${String(count + 1).padStart(4, '0')}`;
      const updated = await tx.subscriptionPayment.updateMany({
        where: { id, status: SubscriptionPaymentStatus.PENDING },
        data: { status: SubscriptionPaymentStatus.CONFIRMED, confirmedBy: userId, confirmedAt: now, periodStart: start, periodEnd: end, invoiceNumber },
      });
      if (updated.count !== 1) throw new ConflictException('This payment was already handled');
      await tx.tenant.update({ where: { id: p.tenantId }, data: { planId: p.planId, paidUntil: end } });
      await this.apply(p.tenantId, now, tx);
      return { tenantId: p.tenantId, invoiceNumber, periodEnd: end };
    });
    await this.audit.log({ tenantId: result.tenantId, userId, action: 'SUBSCRIPTION_PAYMENT_CONFIRMED', entityType: 'SubscriptionPayment', entityId: id, metadataJson: { invoiceNumber: result.invoiceNumber, paidUntil: result.periodEnd.toISOString() } });
    return result;
  }

  async reject(id: string, reason: string, userId: string) {
    const p = await this.prisma.subscriptionPayment.findUnique({ where: { id }, select: { tenantId: true, status: true } });
    if (!p) throw new NotFoundException('Payment not found');
    if (p.status !== SubscriptionPaymentStatus.PENDING) throw new ConflictException('This payment was already handled');
    if (!reason?.trim()) throw new BadRequestException('Say why, so the business can fix it');
    await this.prisma.subscriptionPayment.update({ where: { id }, data: { status: SubscriptionPaymentStatus.REJECTED, rejectReason: reason.trim(), confirmedBy: userId, confirmedAt: new Date() } });
    await this.audit.log({ tenantId: p.tenantId, userId, action: 'SUBSCRIPTION_PAYMENT_REJECTED', entityType: 'SubscriptionPayment', entityId: id, metadataJson: { reason: reason.trim() } });
    return { ok: true };
  }

  /**
   * The revenue view: every business with a plan, where it stands, paid until, and MRR in PKR (each paying business's
   * last confirmed payment as a month: a year's price over 12).
   */
  async revenue(now = new Date()) {
    const tenants = await this.prisma.tenant.findMany({
      where: { planId: { not: null }, companyCode: { not: 'SYSTEM' } },
      orderBy: { name: 'asc' },
      select: {
        id: true, name: true, trialEndsAt: true, paidUntil: true, plan: { select: { code: true, name: true } },
        subscriptionPayments: { where: { status: SubscriptionPaymentStatus.CONFIRMED }, orderBy: { confirmedAt: 'desc' }, take: 1, select: { amount: true, period: true } },
      },
    });
    let mrr = new Prisma.Decimal(0);
    const counts: Record<BillingState, number> = { CUSTOM: 0, FREE: 0, TRIAL: 0, TRIAL_OVER: 0, ACTIVE: 0, GRACE: 0, READ_ONLY: 0 };
    const rows = tenants.map((t) => {
      const state = this.stateOf(t, now);
      counts[state]++;
      const last = t.subscriptionPayments[0];
      const monthly = last && (state === 'ACTIVE' || state === 'GRACE') ? (last.period === BillingPeriod.YEAR ? last.amount.div(12) : last.amount).toDecimalPlaces(2) : new Prisma.Decimal(0);
      mrr = mrr.add(monthly);
      return { id: t.id, name: t.name, plan: t.plan?.name ?? null, state, trialEndsAt: t.trialEndsAt, paidUntil: t.paidUntil, monthly };
    });
    const pending = await this.prisma.subscriptionPayment.count({ where: { status: SubscriptionPaymentStatus.PENDING } });
    return { mrr: mrr.toDecimalPlaces(2), counts, pending, businesses: rows };
  }

  async payTo(): Promise<PayTo> {
    const row = await this.prisma.globalConfig.findUnique({ where: { key: PAY_TO_KEY } });
    return { ...EMPTY_PAY_TO, ...((row?.valueJson as Partial<PayTo> | null) ?? {}) };
  }

  async setPayTo(dto: Partial<PayTo>, userId: string): Promise<PayTo> {
    const next = { ...(await this.payTo()) };
    for (const k of Object.keys(EMPTY_PAY_TO) as (keyof PayTo)[]) if (typeof dto[k] === 'string') next[k] = dto[k]!.trim().slice(0, 300);
    await this.prisma.globalConfig.upsert({ where: { key: PAY_TO_KEY }, update: { valueJson: next as unknown as Prisma.InputJsonValue }, create: { key: PAY_TO_KEY, valueJson: next as unknown as Prisma.InputJsonValue } });
    await this.audit.log({ userId, action: 'BILLING_PAY_TO_SET', entityType: 'GlobalConfig', entityId: PAY_TO_KEY, metadataJson: { ...next } as Record<string, unknown> });
    return next;
  }
}
