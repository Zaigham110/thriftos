import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { checkPassword, shopView } from '../auth/auth.controller';
import { Actor, Me, OwnerOnly } from '../common/auth.guard';
import { PrismaService } from '../common/prisma.service';
import { fail, optText, percent, phoneDigits, pin, text, wholeNumber } from '../common/util';

const STAFF = { id: true, name: true, phone: true, role: true, active: true, branchId: true } as const;

/** The business: details printed on bills, tax, staff, branches and tills. Owner only. */
@OwnerOnly()
@Controller('shop')
export class ShopController {
  constructor(private readonly prisma: PrismaService) {}

  @Patch()
  async update(@Me() me: Actor, @Body() body: Record<string, unknown>) {
    const has = (key: string) => key in body;
    const shop = await this.prisma.shop.update({
      where: { id: me.tenantId },
      data: {
        ...(has('name') ? { name: text(body.name, 'Shop name') } : {}),
        ...(has('phone') ? { phone: optText(body.phone, 'Phone', 30) } : {}),
        ...(has('city') ? { city: optText(body.city, 'City') } : {}),
        ...(has('address') ? { address: optText(body.address, 'Address') } : {}),
        ...(has('billFooter') ? { billFooter: optText(body.billFooter, 'Bill footer') } : {}),
        ...(has('taxName') ? { taxName: text(body.taxName, 'Tax name', 30) } : {}),
        ...(has('taxRate') ? { taxRate: percent(body.taxRate, 'Tax rate') } : {}),
        ...(has('taxInclusive') ? { taxInclusive: body.taxInclusive === true || body.taxInclusive === 'true' } : {}),
        ...(has('ntn') ? { ntn: optText(body.ntn, 'NTN', 30) } : {}),
        ...(has('strn') ? { strn: optText(body.strn, 'STRN', 30) } : {}),
        ...(has('cashierMaxDiscountPct') ? { cashierMaxDiscountPct: Math.min(wholeNumber(body.cashierMaxDiscountPct, 'Cashier discount limit', 0), 100) } : {}),
        ...(has('managerSeesCost') ? { managerSeesCost: body.managerSeesCost === true } : {}),
      },
    });
    return shopView(shop);
  }

  // ---- Staff ----

  @Get('staff')
  staff(@Me() me: Actor) {
    return this.prisma.user.findMany({ where: { tenantId: me.tenantId }, select: STAFF, orderBy: { createdAt: 'asc' } });
  }

  private async branchOf(me: Actor, value: unknown): Promise<string> {
    const branch = await this.prisma.branch.findFirst({ where: { id: String(value ?? ''), tenantId: me.tenantId } });
    if (!branch) fail('NO_BRANCH', 'Choose the branch this person works in.');
    return branch.id;
  }

  @Post('staff')
  async addStaff(@Me() me: Actor, @Body() body: Record<string, unknown>) {
    const phone = phoneDigits(body.phone);
    if (await this.prisma.user.findUnique({ where: { phone } })) fail('PHONE_USED', 'This phone number already has a sign-in.', 409);
    return this.prisma.user.create({
      data: {
        tenantId: me.tenantId,
        branchId: await this.branchOf(me, body.branchId ?? me.branchId),
        name: text(body.name, 'Name'),
        phone,
        passwordHash: await bcrypt.hash(checkPassword(body.password, 4), 10),
        pinHash: body.pin ? await bcrypt.hash(pin(body.pin), 10) : null,
        role: body.role === 'MANAGER' ? UserRole.MANAGER : UserRole.CASHIER,
      },
      select: STAFF,
    });
  }

  /** Stop or allow a sign-in, give a new password or PIN, change role or branch. */
  @Patch('staff/:id')
  async updateStaff(@Me() me: Actor, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    const user = await this.prisma.user.findFirst({ where: { id, tenantId: me.tenantId } });
    if (!user) fail('NOT_FOUND', 'This person was not found.', 404);
    const owner = user.role === UserRole.OWNER;
    if (owner && body.active === false) fail('OWNER_STAYS', 'The owner cannot be stopped.');
    return this.prisma.user.update({
      where: { id: user.id },
      data: {
        ...(typeof body.active === 'boolean' ? { active: body.active } : {}),
        ...(body.name ? { name: text(body.name, 'Name') } : {}),
        ...(body.password ? { passwordHash: await bcrypt.hash(checkPassword(body.password, owner ? 6 : 4), 10) } : {}),
        ...(body.pin ? { pinHash: await bcrypt.hash(pin(body.pin), 10) } : {}),
        ...(!owner && (body.role === 'MANAGER' || body.role === 'CASHIER') ? { role: body.role as UserRole } : {}),
        ...(!owner && body.branchId ? { branchId: await this.branchOf(me, body.branchId) } : {}),
      },
      select: STAFF,
    });
  }

  // ---- Branches and tills ----

  @Get('branches')
  branches(@Me() me: Actor) {
    return this.prisma.branch.findMany({ where: { tenantId: me.tenantId }, include: { tills: { orderBy: { createdAt: 'asc' } } }, orderBy: { createdAt: 'asc' } });
  }

  private branchData(body: Record<string, unknown>) {
    return { name: text(body.name, 'Branch name', 60), phone: optText(body.phone, 'Phone', 30), city: optText(body.city, 'City'), address: optText(body.address, 'Address') };
  }

  private async nextTill(tenantId: string, branchId: string, name: string | null) {
    const shop = await this.prisma.shop.update({ where: { id: tenantId }, data: { tillSeq: { increment: 1 } } });
    const count = await this.prisma.till.count({ where: { tenantId, branchId } });
    return this.prisma.till.create({ data: { tenantId, branchId, code: `T${shop.tillSeq}`, name: name ?? `Counter ${count + 1}` } });
  }

  @Post('branches')
  async addBranch(@Me() me: Actor, @Body() body: Record<string, unknown>) {
    const data = this.branchData(body);
    if (await this.prisma.branch.findFirst({ where: { tenantId: me.tenantId, name: { equals: data.name, mode: 'insensitive' } } })) {
      fail('NAME_USED', 'Another branch already has this name.', 409);
    }
    const branch = await this.prisma.branch.create({ data: { tenantId: me.tenantId, ...data } });
    await this.nextTill(me.tenantId, branch.id, null);
    return this.prisma.branch.findUnique({ where: { id: branch.id }, include: { tills: true } });
  }

  @Patch('branches/:id')
  async updateBranch(@Me() me: Actor, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    const branch = await this.prisma.branch.findFirst({ where: { id, tenantId: me.tenantId } });
    if (!branch) fail('NOT_FOUND', 'This branch was not found.', 404);
    if (body.active === false) {
      if ((await this.prisma.branch.count({ where: { tenantId: me.tenantId, active: true } })) <= 1) fail('LAST_BRANCH', 'A shop needs at least one branch.');
      if (await this.prisma.bale.count({ where: { tenantId: me.tenantId, branchId: id, status: { in: ['IN_STOCK', 'OPENED'] } } })) {
        fail('HAS_STOCK', 'This branch still has stock. Move it to another branch first.', 409);
      }
    }
    return this.prisma.branch.update({
      where: { id },
      data: { ...(body.name ? this.branchData(body) : {}), ...(typeof body.active === 'boolean' ? { active: body.active } : {}) },
      include: { tills: true },
    });
  }

  @Post('branches/:id/tills')
  async addTill(@Me() me: Actor, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    const branch = await this.prisma.branch.findFirst({ where: { id, tenantId: me.tenantId } });
    if (!branch) fail('NOT_FOUND', 'This branch was not found.', 404);
    return this.nextTill(me.tenantId, id, optText(body.name, 'Till name', 40));
  }

  @Patch('tills/:id')
  async updateTill(@Me() me: Actor, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    const till = await this.prisma.till.findFirst({ where: { id, tenantId: me.tenantId } });
    if (!till) fail('NOT_FOUND', 'This till was not found.', 404);
    return this.prisma.till.update({
      where: { id },
      data: { ...(body.name ? { name: text(body.name, 'Till name', 40) } : {}), ...(typeof body.active === 'boolean' ? { active: body.active } : {}) },
    });
  }

  /** The owner's record of sensitive actions. */
  @Get('activity')
  activity(@Me() me: Actor, @Query('take') take?: string) {
    return this.prisma.auditLog.findMany({ where: { tenantId: me.tenantId }, orderBy: { createdAt: 'desc' }, take: Math.min(Number(take) || 100, 500) });
  }
}
