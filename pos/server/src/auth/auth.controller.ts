import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Shop, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { Actor, Me, Public } from '../common/auth.guard';
import { PrismaService } from '../common/prisma.service';
import { fail, optText, phoneDigits, pin, text } from '../common/util';

export function checkPassword(value: unknown, min: number): string {
  const s = typeof value === 'string' ? value : '';
  if (s.length < min || s.length > 72) fail('WEAK_PASSWORD', `The password needs ${min} letters or numbers at least.`);
  return s;
}

/** What every screen may know about the shop (bill header, tax, limits). */
export function shopView(shop: Shop) {
  const { id, name, phone, city, address, currency, billFooter, taxName, taxRate, taxInclusive, ntn, strn, cashierMaxDiscountPct, managerSeesCost } = shop;
  return { id, name, phone, city, address, currency, billFooter, taxName, taxRate, taxInclusive, ntn, strn, cashierMaxDiscountPct, managerSeesCost };
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  /** A fresh install has no shop yet: the first person to open it sets the shop up and becomes its owner. */
  @Public()
  @Get('status')
  async status() {
    return { needsSetup: (await this.prisma.shop.count()) === 0 };
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('setup')
  async setup(@Body() body: Record<string, unknown>) {
    const shopName = text(body.shopName, 'Shop name');
    const ownerName = text(body.ownerName, 'Your name');
    const phone = phoneDigits(body.phone, 'Your phone');
    const password = checkPassword(body.password, 6);
    const passwordHash = await bcrypt.hash(password, 10);
    const city = optText(body.city, 'City');

    const user = await this.prisma.$transaction(async (tx) => {
      // One business per install; the lock stops two people setting up at the same moment.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(7461001)`;
      if ((await tx.shop.count()) > 0) fail('ALREADY_SET_UP', 'This shop is already set up. Sign in instead.', 409);
      const shop = await tx.shop.create({ data: { name: shopName, city, phone: optText(body.shopPhone, 'Shop phone', 30), tillSeq: 1 } });
      // Every shop starts with one branch and one till, so it can sell at once.
      const branch = await tx.branch.create({ data: { tenantId: shop.id, name: 'Main shop', city } });
      await tx.till.create({ data: { tenantId: shop.id, branchId: branch.id, code: 'T1', name: 'Counter 1' } });
      return tx.user.create({ data: { tenantId: shop.id, name: ownerName, phone, passwordHash, role: UserRole.OWNER } });
    });
    return this.session(user.id);
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  async login(@Body() body: Record<string, unknown>) {
    const phone = String(body.phone ?? '').replace(/\D/g, '');
    const user = phone ? await this.prisma.user.findUnique({ where: { phone } }) : null;
    const ok = user && user.active && (await bcrypt.compare(String(body.password ?? ''), user.passwordHash));
    if (!ok) fail('WRONG_LOGIN', 'The phone number or password is not right.', 401);
    return this.session(user.id);
  }

  @Get('me')
  me(@Me() actor: Actor) {
    return this.profile(actor.id);
  }

  /** A person sets their own till PIN (needs their password once). */
  @Patch('me')
  async setPin(@Me() actor: Actor, @Body() body: Record<string, unknown>) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: actor.id } });
    if (!(await bcrypt.compare(String(body.password ?? ''), user.passwordHash))) fail('WRONG_LOGIN', 'The password is not right.', 401);
    await this.prisma.user.update({ where: { id: user.id }, data: { pinHash: await bcrypt.hash(pin(body.pin), 10) } });
    return this.profile(user.id);
  }

  /** Who can take over this till with a PIN: people of this branch (and the owner) who have one. */
  @Get('people')
  async people(@Me() me: Actor) {
    const users = await this.prisma.user.findMany({
      where: { tenantId: me.tenantId, active: true, pinHash: { not: null }, OR: [{ branchId: me.branchId }, { branchId: null }] },
      select: { id: true, name: true, role: true },
      orderBy: { name: 'asc' },
    });
    return users;
  }

  /** The till is already signed in; another person takes over (or unlocks it) with their PIN. */
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 12, ttl: 60_000 } })
  @Post('pin')
  async byPin(@Me() me: Actor, @Body() body: Record<string, unknown>) {
    const user = await this.prisma.user.findFirst({
      where: { id: String(body.userId ?? ''), tenantId: me.tenantId, active: true, OR: [{ branchId: me.branchId }, { branchId: null }] },
    });
    const ok = user?.pinHash && (await bcrypt.compare(String(body.pin ?? ''), user.pinHash));
    if (!ok) fail('WRONG_PIN', 'That PIN is not right.', 401);
    return this.session(user.id);
  }

  private async session(userId: string) {
    return { token: await this.jwt.signAsync({ sub: userId }), ...(await this.profile(userId)) };
  }

  private async profile(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, include: { shop: true } });
    const branches = await this.prisma.branch.findMany({
      where: { tenantId: user.tenantId, active: true, ...(user.role !== UserRole.OWNER && user.branchId ? { id: user.branchId } : {}) },
      select: { id: true, name: true, phone: true, city: true, address: true, tills: { where: { active: true }, select: { id: true, code: true, name: true }, orderBy: { createdAt: 'asc' } } },
      orderBy: { createdAt: 'asc' },
    });
    return {
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        branchId: user.branchId,
        hasPin: !!user.pinHash,
        seesCost: user.role === UserRole.OWNER || (user.role === UserRole.MANAGER && user.shop.managerSeesCost),
      },
      shop: shopView(user.shop),
      branches,
    };
  }
}
