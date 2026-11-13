import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { BaleStatus, SaleStatus, UserRole } from '@prisma/client';
import { Socket } from 'node:net';
import { shopView } from '../auth/auth.controller';
import { openShift } from '../common/audit';
import { Actor, isManager, Me, Public } from '../common/auth.guard';
import { PrismaService } from '../common/prisma.service';
import { fail, moment, startOfDay, ZERO } from '../common/util';

/** Printer addresses a till may ask the server to print to: only the shop's own network, never the internet. */
export function privateHost(host: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return false;
  const [a, b, c, d] = m.slice(1).map(Number);
  if ([a, b, c, d].some((n) => n > 255)) return false;
  if (a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31)) return true;
  return a === 127 && process.env.POS_PRINT_LOOPBACK === '1';
}

@Controller()
export class DeviceController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get('health')
  async health() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { ok: true };
  }

  /**
   * Everything a till needs to keep selling when it cannot reach the server: the shop's settings, this branch's shelf
   * and customers, the till's bill counter and its open drawer. The till keeps a copy on the device.
   */
  @Get('sync/snapshot')
  async snapshot(@Me() me: Actor, @Query('tillId') tillId?: string, @Query('from') from?: string) {
    const tenantId = me.tenantId;
    const [shop, branch, tills] = await Promise.all([
      this.prisma.shop.findUniqueOrThrow({ where: { id: tenantId } }),
      this.prisma.branch.findUniqueOrThrow({ where: { id: me.branchId }, select: { id: true, name: true, phone: true, city: true, address: true } }),
      this.prisma.till.findMany({ where: { tenantId, branchId: me.branchId, active: true }, select: { id: true, code: true, name: true, billSeq: true }, orderBy: { createdAt: 'asc' } }),
    ]);
    const till = tills.find((t) => t.id === tillId) ?? tills[0] ?? null;
    const dayBegan = moment(from, startOfDay(new Date()));
    const mine = me.role === UserRole.CASHIER ? { userId: me.id } : {};
    const [bales, customers, shift, held, review, today, incoming] = await Promise.all([
      this.prisma.bale.findMany({
        where: { tenantId, branchId: me.branchId, status: { in: [BaleStatus.IN_STOCK, BaleStatus.OPENED] } },
        select: { id: true, code: true, baleNo: true, item: true, category: true, grade: true, brand: true, weightKg: true, pieces: true, piecesSold: true, salePrice: true, piecePrice: true, status: true },
        orderBy: [{ status: 'desc' }, { code: 'desc' }],
        take: 20_000,
      }),
      this.prisma.customer.findMany({ where: { tenantId, active: true }, select: { id: true, name: true, phone: true, balance: true, creditLimit: true }, orderBy: { name: 'asc' }, take: 20_000 }),
      till ? openShift(this.prisma, tenantId, till.id) : null,
      this.prisma.heldBill.count({ where: { tenantId, branchId: me.branchId } }),
      isManager(me) ? this.prisma.sale.count({ where: { tenantId, branchId: me.branchId, needsReview: true } }) : 0,
      this.prisma.sale.aggregate({ where: { tenantId, branchId: me.branchId, status: SaleStatus.COMPLETED, soldAt: { gte: dayBegan }, ...mine }, _sum: { total: true }, _count: { _all: true } }),
      this.prisma.stockTransfer.count({ where: { tenantId, toBranchId: me.branchId, status: 'SENT' } }),
    ]);
    return {
      at: new Date(),
      shop: shopView(shop),
      branch,
      tills,
      till,
      shift: shift ? { id: shift.id, openedAt: shift.openedAt, openedByName: shift.openedByName, openingFloat: shift.openingFloat } : null,
      bales: bales.map((b) => ({ ...b, piecesLeft: b.status === BaleStatus.OPENED ? (b.pieces ?? 0) - b.piecesSold : 0 })),
      customers,
      held,
      review,
      incoming,
      today: { bills: today._count._all, total: today._sum.total ?? ZERO },
    };
  }

  /**
   * A network receipt or label printer (port 9100) cannot be reached from a web page, so the till hands the bytes to
   * the shop server and the server sends them. Works from every device, including iPhone and iPad.
   */
  @Post('print/network')
  async print(@Body() body: Record<string, unknown>) {
    const host = String(body.host ?? '').trim();
    const port = Number(body.port) || 9100;
    if (!privateHost(host)) fail('BAD_PRINTER', 'The printer address must be on the shop network, for example 192.168.1.50.');
    if (port < 9100 || port > 9109) fail('BAD_PRINTER', 'The printer port must be 9100 to 9109.');
    const data = Buffer.from(String(body.data ?? ''), 'base64');
    if (!data.length || data.length > 512 * 1024) fail('BAD_PRINT', 'There is nothing to print, or it is too big.');
    await new Promise<void>((resolve, reject) => {
      const socket = new Socket();
      const stop = (error?: Error) => {
        socket.destroy();
        if (error) reject(error);
        else resolve();
      };
      socket.setTimeout(5000, () => stop(new Error('timeout')));
      socket.once('error', stop);
      socket.connect(port, host, () => socket.end(data, () => stop()));
    }).catch(() => fail('PRINTER_OFF', `The printer at ${host} did not answer. Check that it is on and on the shop network.`, 502));
    return { ok: true, bytes: data.length };
  }
}
