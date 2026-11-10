/**
 * Command line: fills the demo database with the demo businesses (run by `npm run demo:reset`, which first
 * recreates thriftos_demo). Refuses any database that is not thriftos_demo or a *_test database.
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { DEMO, seedDemo } from './demo-seed';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { assertSafeToMigrate } = require('../../../scripts/db-guard.js');

async function main(): Promise<void> {
  assertSafeToMigrate('fill the demo database');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const started = Date.now();
    const r = await seedDemo(app, { log: (s) => console.log(s) });
    console.log(`Demo seeded in ${((Date.now() - started) / 1000).toFixed(0)} s: ${r.containers} containers, ${r.bales} bales, ${r.sales} sales, ${r.customers} customers.`);
    if (r.checkRows.costChain || r.checkRows.khata) {
      console.error(`Data checks found problems (cost chain ${r.checkRows.costChain}, khata ${r.checkRows.khata}).`);
      process.exitCode = 1;
      return;
    }
    console.log('Logins:');
    console.log(`  Owner (Al-Madina Traders):  ${DEMO.owner.email} / ${DEMO.owner.password}`);
    console.log(`  Staff, Sorter (phone + PIN): ${DEMO.munshi.phone} / ${DEMO.munshi.pin}`);
    console.log(`  Trader (Lahore Bale House): ${DEMO.trader.email} / ${DEMO.trader.password}`);
    console.log('  Super admin:                superadmin@thriftos.com / SuperAdmin@123');
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
