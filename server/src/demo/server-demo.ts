import { NestFactory } from '@nestjs/core';
import { Prisma, PrismaClient } from '@prisma/client';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { DEMO, seedDemo } from './demo-seed';

/**
 * Demo businesses on a real server, next to the real ones (each business only ever sees its own data):
 *
 *   DEMO_PASSWORD='…' DEMO_PIN='4821' node dist/demo/server-demo.js add
 *   CONFIRM=REMOVE_DEMO node dist/demo/server-demo.js remove
 *
 * `add` creates "Al-Madina Traders (Demo)" and "Lahore Bale House (Demo)" through the app's own services (the
 * same seed as `npm run demo:reset`) with your password and PIN — never the public defaults — and refuses if they
 * already exist. `remove` deletes those two businesses and everything in them, and nothing else.
 */

export const DEMO_CODES = [DEMO.companyCode, DEMO.traderCode];

type Deletable = { count(a: object): Promise<number>; deleteMany(a: object): Promise<{ count: number }> };
const delegateName = (model: string) => model[0].toLowerCase() + model.slice(1);

/**
 * Deletes everything of the two demo businesses (company code AND "(Demo)" name must both match, so a real
 * business never can). Tables link to each other with "restrict" in many directions, so instead of a fixed order
 * it deletes each table's demo rows in passes until none are left; every delete is limited to the demo ids.
 */
export async function removeDemo(prisma: PrismaClient): Promise<{ businesses: string[]; rows: number }> {
  const tenants = await prisma.tenant.findMany({ where: { companyCode: { in: DEMO_CODES }, name: { endsWith: '(Demo)' } }, select: { id: true, name: true } });
  if (!tenants.length) return { businesses: [], rows: 0 };
  const ids = tenants.map((t) => t.id);
  const where = { tenantId: { in: ids } };
  const models = Prisma.dmmf.datamodel.models.filter((m) => m.name !== 'Tenant' && m.fields.some((f) => f.name === 'tenantId')).map((m) => m.name);
  const table = (m: string) => (prisma as unknown as Record<string, Deletable>)[delegateName(m)];
  let rows = 0;
  for (let pass = 0; pass < 25; pass++) {
    let left = 0;
    for (const m of models) {
      if (!(await table(m).count({ where }))) continue;
      try {
        rows += (await table(m).deleteMany({ where })).count;
      } catch (e) {
        if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003')) throw e;
        left += 1; // still referenced by another table's rows; a later pass gets it
      }
    }
    if (!left) break;
  }
  await prisma.tenant.deleteMany({ where: { id: { in: ids } } });
  return { businesses: tenants.map((t) => t.name), rows };
}

async function main(): Promise<void> {
  const mode = process.argv[2];
  if (mode !== 'add' && mode !== 'remove') {
    console.error('Usage: server-demo.js add | remove');
    process.exit(2);
  }
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const prisma = app.get(PrismaService);
  try {
    if (mode === 'remove') {
      if (process.env.CONFIRM !== 'REMOVE_DEMO') throw new Error('Set CONFIRM=REMOVE_DEMO to remove the two demo businesses.');
      const r = await removeDemo(prisma);
      console.log(r.businesses.length ? `Removed ${r.businesses.join(' and ')} (${r.rows} rows besides the businesses themselves).` : 'No demo businesses found; nothing removed.');
      return;
    }
    const password = process.env.DEMO_PASSWORD ?? '';
    const pin = process.env.DEMO_PIN ?? '';
    if (password.length < 10 || password === 'Demo@1234') throw new Error('Set DEMO_PASSWORD to a new password of at least 10 characters (not the public default).');
    if (!/^\d{4}$/.test(pin) || pin === '1234') throw new Error('Set DEMO_PIN to 4 digits (not 1234).');
    if (await prisma.tenant.count({ where: { companyCode: { in: DEMO_CODES } } })) throw new Error('The demo businesses are already here. Remove them first to start again.');
    const started = Date.now();
    const r = await seedDemo(app, { log: (s) => console.log(s) });
    console.log(`Demo added in ${((Date.now() - started) / 1000).toFixed(0)} s: ${r.containers} containers, ${r.bales} bales, ${r.sales} sales, ${r.customers} customers.`);
    if (r.checkRows.costChain || r.checkRows.khata) {
      console.error(`Data checks found problems (cost chain ${r.checkRows.costChain}, khata ${r.checkRows.khata}).`);
      process.exitCode = 1;
    }
    console.log('Logins (your DEMO_PASSWORD / DEMO_PIN):');
    console.log(`  Owner, Al-Madina Traders (Demo):  ${DEMO.owner.email}`);
    console.log(`  Munshi, Al-Madina (phone + PIN):  ${DEMO.munshi.phone}`);
    console.log(`  Owner, Lahore Bale House (Demo):  ${DEMO.trader.email}`);
  } finally {
    await app.close();
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
