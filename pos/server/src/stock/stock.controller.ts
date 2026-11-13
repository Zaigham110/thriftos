import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { BaleStatus, TransferStatus } from '@prisma/client';
import { audit } from '../common/audit';
import { Actor, ManagerUp, Me } from '../common/auth.guard';
import { PrismaService } from '../common/prisma.service';
import { fail, optText, pad, text } from '../common/util';

const ON_SHELF: BaleStatus[] = [BaleStatus.IN_STOCK, BaleStatus.OPENED];
const BALE = { id: true, code: true, baleNo: true, item: true, category: true, grade: true, weightKg: true, status: true, pieces: true, piecesSold: true } as const;

/** Moving bales between branches, and counting the shelf. */
@Controller()
export class StockController {
  constructor(private readonly prisma: PrismaService) {}

  // ---- Transfers ----

  private async names(tenantId: string) {
    const branches = await this.prisma.branch.findMany({ where: { tenantId }, select: { id: true, name: true } });
    return (id: string) => branches.find((b) => b.id === id)?.name ?? '';
  }

  @Get('transfers')
  async transfers(@Me() me: Actor) {
    const name = await this.names(me.tenantId);
    const list = await this.prisma.stockTransfer.findMany({
      where: { tenantId: me.tenantId, OR: [{ fromBranchId: me.branchId }, { toBranchId: me.branchId }] },
      include: { _count: { select: { lines: true } } },
      orderBy: { sentAt: 'desc' },
      take: 100,
    });
    return list.map((t) => ({ ...t, fromName: name(t.fromBranchId), toName: name(t.toBranchId), incoming: t.toBranchId === me.branchId }));
  }

  @Get('transfers/:id')
  async transfer(@Me() me: Actor, @Param('id') id: string) {
    const t = await this.prisma.stockTransfer.findFirst({ where: { id, tenantId: me.tenantId, OR: [{ fromBranchId: me.branchId }, { toBranchId: me.branchId }] }, include: { lines: true } });
    if (!t) fail('NOT_FOUND', 'This transfer was not found.', 404);
    const name = await this.names(me.tenantId);
    const bales = await this.prisma.bale.findMany({ where: { tenantId: me.tenantId, id: { in: t.lines.map((l) => l.baleId) } }, select: BALE, orderBy: { code: 'asc' } });
    return { ...t, fromName: name(t.fromBranchId), toName: name(t.toBranchId), incoming: t.toBranchId === me.branchId, bales };
  }

  /** Bales leave this branch's shelf at once and wait "on the way" until the other branch receives them. */
  @ManagerUp()
  @Post('transfers')
  async send(@Me() me: Actor, @Body() body: Record<string, unknown>) {
    const tenantId = me.tenantId;
    const to = await this.prisma.branch.findFirst({ where: { id: String(body.toBranchId ?? ''), tenantId, active: true } });
    if (!to || to.id === me.branchId) fail('BAD_BRANCH', 'Choose the branch the bales are going to.');
    const ids = [...new Set(Array.isArray(body.baleIds) ? body.baleIds.map(String) : [])];
    if (!ids.length) fail('NO_BALES', 'Choose the bales to send.');
    if (ids.length > 2000) fail('TOO_MANY', 'Send 2,000 bales at most in one transfer.');
    return this.prisma.$transaction(async (tx) => {
      const bales = await tx.bale.findMany({ where: { id: { in: ids }, tenantId, branchId: me.branchId, status: { in: ON_SHELF } } });
      if (bales.length !== ids.length) fail('NOT_ON_SHELF', 'Some of these bales are not on this branch\'s shelf any more.', 409);
      const moved = await tx.bale.updateMany({ where: { id: { in: ids }, tenantId, branchId: me.branchId, status: { in: ON_SHELF } }, data: { status: BaleStatus.IN_TRANSIT } });
      if (moved.count !== ids.length) fail('NOT_ON_SHELF', 'Some of these bales were just sold. Try again.', 409);
      const shop = await tx.shop.update({ where: { id: tenantId }, data: { transferSeq: { increment: 1 } } });
      const t = await tx.stockTransfer.create({
        data: {
          tenantId,
          code: `TR-${pad(shop.transferSeq, 4)}`,
          fromBranchId: me.branchId,
          toBranchId: to.id,
          note: optText(body.note, 'Note', 200),
          sentByName: me.name,
          lines: { createMany: { data: bales.map((b) => ({ tenantId, baleId: b.id, wasOpened: b.status === BaleStatus.OPENED })) } },
        },
      });
      await audit(tx, me, 'Stock sent', `${t.code}: ${bales.length} bales to ${to.name}`);
      return { id: t.id, code: t.code, bales: bales.length };
    });
  }

  private async finish(me: Actor, id: string, received: boolean) {
    const tenantId = me.tenantId;
    return this.prisma.$transaction(async (tx) => {
      const t = await tx.stockTransfer.findFirst({ where: { id, tenantId, ...(received ? { toBranchId: me.branchId } : { fromBranchId: me.branchId }) }, include: { lines: true } });
      if (!t) fail('NOT_FOUND', received ? 'This transfer is not coming to this branch.' : 'This transfer was not sent from this branch.', 404);
      const done = await tx.stockTransfer.updateMany({
        where: { id, status: TransferStatus.SENT },
        data: received ? { status: TransferStatus.RECEIVED, receivedByName: me.name, receivedAt: new Date() } : { status: TransferStatus.CANCELLED },
      });
      if (done.count !== 1) fail('NOT_OPEN', 'This transfer is already received or cancelled.', 409);
      const branchId = received ? t.toBranchId : t.fromBranchId;
      for (const opened of [true, false]) {
        const ids = t.lines.filter((l) => l.wasOpened === opened).map((l) => l.baleId);
        if (ids.length) await tx.bale.updateMany({ where: { id: { in: ids }, tenantId, status: BaleStatus.IN_TRANSIT }, data: { branchId, status: opened ? BaleStatus.OPENED : BaleStatus.IN_STOCK } });
      }
      await audit(tx, me, received ? 'Stock received' : 'Transfer cancelled', `${t.code}: ${t.lines.length} bales`);
      return { id: t.id, code: t.code, status: received ? TransferStatus.RECEIVED : TransferStatus.CANCELLED };
    });
  }

  @Post('transfers/:id/receive')
  receive(@Me() me: Actor, @Param('id') id: string) {
    return this.finish(me, id, true);
  }

  @ManagerUp()
  @Post('transfers/:id/cancel')
  cancel(@Me() me: Actor, @Param('id') id: string) {
    return this.finish(me, id, false);
  }

  // ---- Stock check ----

  private async report(me: Actor, id: string) {
    const check = await this.prisma.stockCheck.findFirst({ where: { id, tenantId: me.tenantId, branchId: me.branchId }, include: { scans: { select: { baleId: true } } } });
    if (!check) fail('NOT_FOUND', 'This stock check was not found.', 404);
    const seen = check.scans.map((s) => s.baleId);
    const missing = await this.prisma.bale.findMany({ where: { tenantId: me.tenantId, branchId: me.branchId, status: { in: ON_SHELF }, id: { notIn: seen } }, select: BALE, orderBy: { code: 'asc' }, take: 2000 });
    const { scans: _s, ...rest } = check;
    return { ...rest, found: seen.length, missing };
  }

  @Get('stock-checks/current')
  async currentCheck(@Me() me: Actor) {
    const check = await this.prisma.stockCheck.findFirst({ where: { tenantId: me.tenantId, branchId: me.branchId, finishedAt: null }, orderBy: { startedAt: 'desc' } });
    const last = await this.prisma.stockCheck.findFirst({ where: { tenantId: me.tenantId, branchId: me.branchId, finishedAt: { not: null } }, orderBy: { finishedAt: 'desc' } });
    return { current: check ? await this.report(me, check.id) : null, last };
  }

  @ManagerUp()
  @Post('stock-checks')
  async startCheck(@Me() me: Actor) {
    if (await this.prisma.stockCheck.findFirst({ where: { tenantId: me.tenantId, branchId: me.branchId, finishedAt: null } })) fail('ALREADY_OPEN', 'A stock check is already going on.', 409);
    const expected = await this.prisma.bale.count({ where: { tenantId: me.tenantId, branchId: me.branchId, status: { in: ON_SHELF } } });
    const check = await this.prisma.stockCheck.create({ data: { tenantId: me.tenantId, branchId: me.branchId, startedByName: me.name, expected } });
    return this.report(me, check.id);
  }

  /** One sticker scanned on the shelf. */
  @Post('stock-checks/:id/scan')
  async scan(@Me() me: Actor, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    const check = await this.prisma.stockCheck.findFirst({ where: { id, tenantId: me.tenantId, branchId: me.branchId, finishedAt: null } });
    if (!check) fail('NOT_FOUND', 'This stock check is finished.', 404);
    const code = text(body.code, 'Bale number', 40);
    const bale =
      (await this.prisma.bale.findFirst({ where: { tenantId: me.tenantId, code: { equals: code, mode: 'insensitive' } }, select: { ...BALE, branchId: true } })) ??
      (await this.prisma.bale.findFirst({ where: { tenantId: me.tenantId, branchId: me.branchId, baleNo: { equals: code, mode: 'insensitive' }, status: { in: ON_SHELF } }, select: { ...BALE, branchId: true } }));
    if (!bale) fail('NOT_FOUND', `No bale has the number ${code}.`, 404);
    if (bale.branchId !== me.branchId) fail('OTHER_BRANCH', `Bale ${bale.code} belongs to another branch.`, 409);
    if (!ON_SHELF.includes(bale.status)) fail('NOT_ON_SHELF', `Bale ${bale.code} is on the shelf but the system says it is ${bale.status.toLowerCase().replace('_', ' ')}. Tell the owner.`, 409);
    const again = await this.prisma.stockCheckScan.findFirst({ where: { checkId: id, baleId: bale.id } });
    if (!again) await this.prisma.stockCheckScan.create({ data: { tenantId: me.tenantId, checkId: id, baleId: bale.id } });
    return { bale, again: !!again, found: await this.prisma.stockCheckScan.count({ where: { checkId: id } }), expected: check.expected };
  }

  @ManagerUp()
  @Post('stock-checks/:id/finish')
  async finishCheck(@Me() me: Actor, @Param('id') id: string) {
    const found = await this.prisma.stockCheckScan.count({ where: { checkId: id, tenantId: me.tenantId } });
    const done = await this.prisma.stockCheck.updateMany({ where: { id, tenantId: me.tenantId, branchId: me.branchId, finishedAt: null }, data: { finishedAt: new Date(), found } });
    if (done.count !== 1) fail('NOT_FOUND', 'This stock check is already finished.', 404);
    return this.report(me, id);
  }

  @Get('stock-checks/:id')
  check(@Me() me: Actor, @Param('id') id: string) {
    return this.report(me, id);
  }
}
