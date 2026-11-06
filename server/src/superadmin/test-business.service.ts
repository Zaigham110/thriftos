import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SYSTEM_COMPANY_CODE } from '../common/guards/module.guard';
import { SetupService } from '../tenant/setup.service';
import { fillSortingStory, SAMPLE_SETUP, storyContext } from '../demo/demo-seed';

/** GlobalConfig key holding the ids of test businesses (no schema change needed). */
const TEST_KEY = 'superadmin.testBusinesses';
const sampleKey = (id: string) => `superadmin.sample.${id}`;

export type SampleState = { state: 'running' | 'done' | 'failed'; at: string; sales?: number; bales?: number; message?: string };

/**
 * Test businesses (v2 review): the super admin marks a business as a test, can fill it with the demo's sample story
 * (containers, sorting, bales, sales, udhaar) and can delete it with everything in it. Real businesses are never
 * deleted: only a business marked as a test can be, and only after its name is typed again.
 */
@Injectable()
export class TestBusinessService {
  private readonly logger = new Logger(TestBusinessService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly moduleRef: ModuleRef,
  ) {}

  async ids(): Promise<Set<string>> {
    const row = await this.prisma.globalConfig.findUnique({ where: { key: TEST_KEY } });
    return new Set(Array.isArray(row?.valueJson) ? (row!.valueJson as string[]) : []);
  }

  async isTest(id: string): Promise<boolean> {
    return (await this.ids()).has(id);
  }

  async mark(id: string, isTest: boolean, actorId: string): Promise<{ isTest: boolean }> {
    const tenant = await this.business(id);
    const ids = await this.ids();
    if (isTest) ids.add(id);
    else ids.delete(id);
    await this.save(ids);
    await this.audit.log({ userId: actorId, tenantId: id, action: isTest ? 'TENANT_MARKED_TEST' : 'TENANT_MARKED_REAL', entityType: 'Tenant', entityId: id, metadataJson: { tenantName: tenant.name } });
    return { isTest };
  }

  async sampleState(id: string): Promise<SampleState | null> {
    const row = await this.prisma.globalConfig.findUnique({ where: { key: sampleKey(id) } });
    return (row?.valueJson as SampleState | undefined) ?? null;
  }

  /**
   * Starts filling an empty test business with the sample story and returns at once; the business page polls the
   * state (it takes about a minute). The business is set up for it: sorting by category and grade, the sample's
   * categories and grades, the setup wizard marked done.
   */
  async fillSample(id: string, actorId: string): Promise<SampleState> {
    const tenant = await this.business(id);
    if (!(await this.isTest(id))) throw new BadRequestException('Only a test business can get sample data.');
    if ((await this.sampleState(id))?.state === 'running') throw new ConflictException('Sample data is already being added.');
    const [containers, sales, customers] = await Promise.all([
      this.prisma.container.count({ where: { tenantId: id } }),
      this.prisma.sale.count({ where: { tenantId: id } }),
      this.prisma.customer.count({ where: { tenantId: id } }),
    ]);
    if (containers || sales || customers) throw new BadRequestException('Sample data goes into an empty business only. This one already has containers, sales or customers.');
    const owner = await this.prisma.user.findFirst({
      where: { tenantId: id, isActive: true, userRoles: { some: { role: { name: 'Admin' } } } },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (!owner) throw new BadRequestException('This business has no owner to record the sample data.');

    const running: SampleState = { state: 'running', at: new Date().toISOString() };
    await this.setSample(id, running);
    void this.runSample(id, tenant, owner.id, actorId);
    return running;
  }

  private async runSample(id: string, tenant: { name: string; currency: string; defaultLanguage: string }, ownerId: string, actorId: string): Promise<void> {
    try {
      const setup = this.moduleRef.get(SetupService, { strict: false });
      await setup.save(
        id,
        { businessName: tenant.name, currency: tenant.currency, language: tenant.defaultLanguage === 'en' ? 'en' : 'ur', sortingStages: 2, categories: SAMPLE_SETUP.categories, grades: SAMPLE_SETUP.grades } as never,
        ownerId,
      );
      const filled = await fillSortingStory(this.moduleRef, storyContext(this.moduleRef), { tenantId: id, ownerId, workerId: ownerId });
      await this.setSample(id, { state: 'done', at: new Date().toISOString(), sales: filled.sales, bales: filled.bales });
      await this.audit.log({ userId: actorId, tenantId: id, action: 'TENANT_SAMPLE_DATA', entityType: 'Tenant', entityId: id, metadataJson: { sales: filled.sales, bales: filled.bales } });
    } catch (e) {
      this.logger.error(`Sample data for ${id} failed`, e instanceof Error ? e.stack : String(e));
      await this.setSample(id, { state: 'failed', at: new Date().toISOString(), message: e instanceof Error ? e.message : 'Could not add the sample data' });
    }
  }

  /**
   * Deletes a test business and everything in it. Every table with a tenantId is emptied for this business, and
   * rows that hang off those rows without a tenantId of their own (sale lines, user roles, buckets…) go first. The
   * order comes from the database's own foreign keys: statements that fail on a reference are retried after the
   * others, inside one transaction, so either all of it goes or none of it.
   */
  async remove(id: string, confirmName: string, actorId: string): Promise<{ deleted: true; name: string }> {
    const tenant = await this.business(id);
    if (!(await this.isTest(id))) throw new BadRequestException('Only a business marked as a test can be deleted. Switch a real business off instead.');
    if (confirmName.trim().toLowerCase() !== tenant.name.trim().toLowerCase()) throw new BadRequestException('Type the business name exactly to delete it.');
    if ((await this.sampleState(id))?.state === 'running') throw new ConflictException('Wait until the sample data is added.');

    await this.prisma.$transaction(
      async (tx) => {
        const scoped = (await tx.$queryRaw<{ table_name: string }[]>`
          SELECT table_name FROM information_schema.columns
          WHERE table_schema = current_schema() AND column_name = 'tenantId' AND table_name <> 'Tenant'`).map((r) => r.table_name);
        const scopedSet = new Set(scoped);
        // Foreign keys from tables without tenantId to tenant tables: those rows are deleted through their parent.
        const fks = await tx.$queryRaw<{ child: string; col: string; parent: string; pcol: string }[]>`
          SELECT cl.relname AS child, a.attname AS col, pl.relname AS parent, pa.attname AS pcol
          FROM pg_constraint c
          JOIN pg_class cl ON cl.oid = c.conrelid
          JOIN pg_class pl ON pl.oid = c.confrelid
          JOIN pg_namespace n ON n.oid = cl.relnamespace AND n.nspname = current_schema()
          JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
          JOIN pg_attribute pa ON pa.attrelid = c.confrelid AND pa.attnum = c.confkey[1]
          WHERE c.contype = 'f' AND array_length(c.conkey, 1) = 1`;
        const q = (name: string) => `"${name.replace(/"/g, '""')}"`;
        const byTable = new Map<string, string[]>();
        const add = (table: string, sql: string) => byTable.set(table, [...(byTable.get(table) ?? []), sql]);
        for (const fk of fks) {
          if (scopedSet.has(fk.child) || fk.child === 'Tenant') continue;
          if (!scopedSet.has(fk.parent)) continue;
          add(fk.child, `DELETE FROM ${q(fk.child)} WHERE ${q(fk.col)} IN (SELECT ${q(fk.pcol)} FROM ${q(fk.parent)} WHERE "tenantId" = $1)`);
        }
        for (const table of scoped) add(table, `DELETE FROM ${q(table)} WHERE "tenantId" = $1`);
        // Children before parents (from the foreign keys), so almost nothing has to be retried.
        const tables = [...byTable.keys()];
        const parentsOf = new Map(tables.map((t) => [t, new Set(fks.filter((f) => f.child === t && f.parent !== t && byTable.has(f.parent)).map((f) => f.parent))]));
        const order: string[] = [];
        const left = new Set(tables);
        while (left.size) {
          // A table can go once no table still left refers to it.
          const ready = [...left].filter((t) => ![...left].some((c) => c !== t && parentsOf.get(c)!.has(t)));
          const next = ready.length ? ready : [...left];
          for (const t of next) { order.push(t); left.delete(t); }
          if (!ready.length) break;
        }
        const statements = order.flatMap((t) => byTable.get(t)!);

        let pending = statements;
        for (let pass = 0; pending.length && pass < 25; pass++) {
          const failed: string[] = [];
          for (const sql of pending) {
            await tx.$executeRawUnsafe('SAVEPOINT tos_delete');
            try {
              await tx.$executeRawUnsafe(sql, id);
              await tx.$executeRawUnsafe('RELEASE SAVEPOINT tos_delete');
            } catch (e) {
              await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT tos_delete');
              if (!(e instanceof Prisma.PrismaClientKnownRequestError) && !(e instanceof Prisma.PrismaClientUnknownRequestError)) throw e;
              failed.push(sql);
            }
          }
          // A pass that only fails means a reference no delete here can clear: stop rather than loop.
          if (failed.length === pending.length) throw new ConflictException('This business could not be deleted (data still refers to it).');
          pending = failed;
        }
        // Statements on child tables can run before their rows' parents are listed; one more sweep catches them.
        for (const sql of statements) await tx.$executeRawUnsafe(sql, id);
        await tx.tenant.delete({ where: { id } });
      },
      { timeout: 120_000, maxWait: 10_000 },
    );

    const ids = await this.ids();
    ids.delete(id);
    await this.save(ids);
    await this.prisma.globalConfig.deleteMany({ where: { key: sampleKey(id) } });
    const system = await this.prisma.tenant.findUnique({ where: { companyCode: SYSTEM_COMPANY_CODE }, select: { id: true } });
    await this.audit.log({ userId: actorId, tenantId: system?.id, action: 'TENANT_DELETED', entityType: 'Tenant', entityId: id, metadataJson: { tenantName: tenant.name, companyCode: tenant.companyCode, test: true } });
    return { deleted: true, name: tenant.name };
  }

  private async business(id: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id }, select: { id: true, name: true, companyCode: true, currency: true, defaultLanguage: true } });
    if (!tenant) throw new NotFoundException('Business not found');
    if (tenant.companyCode === SYSTEM_COMPANY_CODE) throw new BadRequestException('The platform account cannot be changed here.');
    return tenant;
  }

  private async save(ids: Set<string>): Promise<void> {
    const valueJson = [...ids] as Prisma.InputJsonValue;
    await this.prisma.globalConfig.upsert({ where: { key: TEST_KEY }, update: { valueJson }, create: { key: TEST_KEY, valueJson } });
  }

  private async setSample(id: string, state: SampleState): Promise<void> {
    const valueJson = state as unknown as Prisma.InputJsonValue;
    await this.prisma.globalConfig.upsert({ where: { key: sampleKey(id) }, update: { valueJson }, create: { key: sampleKey(id), valueJson } });
  }
}
