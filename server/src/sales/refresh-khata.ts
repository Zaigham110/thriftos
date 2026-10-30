import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { IdempotencyModule } from '../common/idempotency/idempotency.module';
import { FileStorageService } from '../common/storage/file-storage.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { KhataService } from './khata.service';

/**
 * Re-applies every customer's payments (opening balance first, then oldest sales) and stores
 * each sale's PAID / PARTIALLY_PAID / ISSUED status. Run once after applying the Phase 2
 * migrations: old statuses only counted payments recorded against each sale.
 *
 *   npm run khata:refresh            dry run: shows what would change, writes nothing
 *   APPLY=1 npm run khata:refresh    writes the changes
 *   TENANT_ID=<id> ...               one tenant only
 */
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../.env'] }), PrismaModule, IdempotencyModule],
  providers: [KhataService, FileStorageService],
})
class RefreshKhataModule {}

class DryRun extends Error {
  constructor(readonly changed: { saleNumber: string; from: string; to: string }[]) {
    super('dry run');
  }
}

async function main() {
  const app = await NestFactory.createApplicationContext(RefreshKhataModule, { logger: ['error'] });
  const prisma = app.get(PrismaService);
  const khata = app.get(KhataService);
  const apply = process.env.APPLY === '1';
  const customers = await prisma.customer.findMany({
    where: process.env.TENANT_ID ? { tenantId: process.env.TENANT_ID } : {},
    select: { id: true, tenantId: true, name: true, tenant: { select: { name: true } } },
    orderBy: [{ tenantId: 'asc' }, { name: 'asc' }],
  });

  let sales = 0;
  for (const customer of customers) {
    let changed: { saleNumber: string; from: string; to: string }[];
    try {
      changed = await prisma.$transaction(async (tx) => {
        const result = await khata.refreshStatusesTx(tx, customer.tenantId, customer.id);
        if (!apply) throw new DryRun(result.changed);
        return result.changed;
      });
    } catch (error) {
      if (!(error instanceof DryRun)) throw error;
      changed = error.changed;
    }
    sales += changed.length;
    for (const c of changed) console.log(`${customer.tenant.name} · ${customer.name} · ${c.saleNumber}: ${c.from} → ${c.to}`);
  }

  console.log(`${apply ? 'APPLIED' : 'DRY RUN (nothing written; set APPLY=1 to write)'} — ${customers.length} customer(s) checked, ${sales} sale status(es) ${apply ? 'changed' : 'would change'}`);
  await app.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
