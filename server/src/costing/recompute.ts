import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { CostingModule } from './costing.module';
import { CostingService, RecalculationResult } from './costing.service';

/**
 * Recalculates every container and loose lot with the costing rules.
 * Run once after applying the v1 migrations (container lots were split by net weight before).
 *
 *   npm run costing:recompute            dry run: shows what would change, writes nothing
 *   APPLY=1 npm run costing:recompute    writes the changes
 *   TENANT_ID=<id> ...                   one tenant only
 */
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../.env'] }), PrismaModule, CostingModule],
})
class RecomputeModule {}

class DryRun extends Error {
  constructor(readonly result: RecalculationResult) {
    super('dry run');
  }
}

async function main() {
  const app = await NestFactory.createApplicationContext(RecomputeModule, { logger: ['error'] });
  const prisma = app.get(PrismaService);
  const costing = app.get(CostingService);
  const apply = process.env.APPLY === '1';
  const tenantFilter = process.env.TENANT_ID ? { id: process.env.TENANT_ID } : {};

  const tenants = await prisma.tenant.findMany({ where: tenantFilter, select: { id: true, name: true } });
  const totals = { containers: 0, lots: 0, categoryOutputs: 0, gradeOutputs: 0, baleInputs: 0, bales: 0, adjustments: 0 };
  let units = 0;

  /** Runs one recalculation; in a dry run the transaction is rolled back after reading the result. */
  const run = async (work: (tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0]) => Promise<RecalculationResult>) => {
    try {
      return await prisma.$transaction(async (tx) => {
        const result = await work(tx);
        if (!apply) throw new DryRun(result);
        return result;
      }, { timeout: 120_000 });
    } catch (error) {
      if (error instanceof DryRun) return error.result;
      throw error;
    }
  };

  for (const tenant of tenants) {
    const containers = await prisma.container.findMany({ where: { tenantId: tenant.id }, select: { id: true, containerNumber: true } });
    const looseLots = await prisma.rag.findMany({ where: { tenantId: tenant.id, containerId: null }, select: { id: true, ragCode: true } });
    const jobs = [
      ...containers.map((c) => ({ label: `container ${c.containerNumber}`, work: (tx: any) => costing.recalculateContainerTx(tx, tenant.id, c.id) })),
      ...looseLots.map((l) => ({ label: `loose lot ${l.ragCode}`, work: (tx: any) => costing.recalculateLotChainTx(tx, tenant.id, l.id) })),
    ];
    for (const job of jobs) {
      const result = await run(job.work);
      units += 1;
      const changed = Object.entries(result.changed).filter(([, n]) => n > 0);
      for (const [key, n] of Object.entries(result.changed)) totals[key as keyof typeof totals] += n;
      totals.adjustments += result.adjustments.length;
      if (changed.length || result.adjustments.length) {
        console.log(`${tenant.name} · ${job.label}: ${changed.map(([k, n]) => `${n} ${k}`).join(', ')}${result.adjustments.length ? `, ${result.adjustments.length} sold bale(s) re-costed` : ''}`);
      }
    }
  }

  console.log(`${apply ? 'APPLIED' : 'DRY RUN (nothing written; set APPLY=1 to write)'} — ${tenants.length} tenant(s), ${units} container(s)/loose lot(s) checked`);
  console.log(`changed: ${Object.entries(totals).map(([k, n]) => `${k}=${n}`).join(' ')}`);
  await app.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
