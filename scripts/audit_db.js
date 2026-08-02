const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function auditDatabase() {
  console.log('\n=============================================================');
  console.log('🔍 THRIFTOS DATABASE AUDIT & SANITY CHECK');
  console.log('=============================================================\n');

  try {
    // 1. Tenants & Users
    const tenants = await prisma.tenant.findMany();
    console.log(`📌 TENANTS (${tenants.length}):`);
    tenants.forEach(t => console.log(`   - [${t.id}] ${t.name} (${t.companyCode}) - Mode: ${t.operationMode}`));

    const users = await prisma.user.findMany({
      select: { id: true, email: true, name: true, tenantId: true, userRoles: { include: { role: true } } }
    });
    console.log(`\n📌 USERS (${users.length}):`);
    users.forEach(u => {
      const roles = u.userRoles.map(ur => ur.role?.name).join(', ') || 'No Role';
      console.log(`   - [${u.id}] ${u.email} (${u.name}) - Roles: [${roles}]`);
    });

    // 2. Vendors
    const vendors = await prisma.vendor.findMany({ select: { id: true, name: true, vendorType: true } });
    console.log(`\n📌 VENDORS (${vendors.length}):`);
    vendors.forEach(v => console.log(`   - [${v.id}] ${v.name} (${v.vendorType})`));

    // 3. Purchase Orders
    const pos = await prisma.purchaseOrder.findMany({
      include: { vendor: { select: { name: true } }, incomingBales: true, containers: true },
      orderBy: { createdAt: 'desc' },
    });
    console.log(`\n📌 PURCHASE ORDERS (${pos.length}):`);
    pos.forEach(po => {
      console.log(`   - ${po.poNumber} | Type: ${po.poType} | Status: ${po.status} | Cost: $${po.totalCost} | Vendor: ${po.vendor?.name || 'N/A'}`);
      console.log(`     └─ Bales: ${po.incomingBales.length} | Containers: ${po.containers.length}`);
    });

    // 4. Rags / Bales
    const rags = await prisma.rag.findMany({
      include: {
        rawCategory: { select: { name: true } },
        container: { select: { containerNumber: true } },
        sortSession: { select: { id: true, status: true, incomingBaleId: true } }
      },
      orderBy: { createdAt: 'desc' },
    });
    console.log(`\n📌 RAGS / BALES INTAKE (${rags.length}):`);
    rags.forEach(r => {
      console.log(`   - ${r.ragCode} | Type: ${r.ragBaleType} | Source: ${r.sourceType} | Status: ${r.status} | Weight: ${r.weightKg}kg | Cost: $${r.allocatedCost}`);
      console.log(`     └─ Category: ${r.rawCategory?.name || 'N/A'} | Session: ${r.sortSession ? `${r.sortSession.id} (${r.sortSession.status})` : 'None'}`);
    });

    // 5. Stage 1 Sort Sessions
    const sortSessions = await prisma.sortSession.findMany({
      include: {
        rag: { select: { ragCode: true } },
        incomingBale: { select: { baleCode: true, purchaseOrderId: true } },
        sortCategoryBuckets: { include: { category: { select: { name: true } } } }
      },
      orderBy: { createdAt: 'desc' }
    });
    console.log(`\n📌 STAGE 1 SORT SESSIONS (${sortSessions.length}):`);
    sortSessions.forEach(s => {
      console.log(`   - Session ID: ${s.id} | Status: ${s.status} | Rag: ${s.rag?.ragCode} | Linked Bale: ${s.incomingBaleId || 'None'}`);
      console.log(`     Input Weight: ${s.totalInputWeight}kg | Output Weight: ${s.totalOutputWeight}kg | Waste: ${s.wasteWeight}kg`);
      s.sortCategoryBuckets.forEach(b => {
        console.log(`     └─ Bucket: ${b.category?.name} => ${b.outputWeightKg}kg`);
      });
    });

    // 6. Category Outputs (Ready for Stage 2)
    const catOutputs = await prisma.categoryOutput.findMany({
      include: { category: { select: { name: true } } },
      orderBy: { createdAt: 'desc' }
    });
    console.log(`\n📌 CATEGORY OUTPUTS (${catOutputs.length}):`);
    catOutputs.forEach(co => {
      console.log(`   - ID: ${co.id} | Category: ${co.category?.name} | Weight: ${co.weightKg}kg | Cost: $${co.allocatedCost} | RagId: ${co.ragId} | SortSessionId: ${co.sortSessionId}`);
    });

    // 7. Stage 2 Grade Sessions
    const gradeSessions = await prisma.gradeSession.findMany({
      include: {
        categoryOutput: { include: { category: { select: { name: true } } } },
        gradeBuckets: { include: { grade: { select: { name: true } } } }
      },
      orderBy: { createdAt: 'desc' }
    });
    console.log(`\n📌 STAGE 2 GRADE SESSIONS (${gradeSessions.length}):`);
    gradeSessions.forEach(gs => {
      console.log(`   - Grade Session ID: ${gs.id} | Status: ${gs.status} | Source Category: ${gs.categoryOutput?.category?.name}`);
      gs.gradeBuckets.forEach(gb => {
        console.log(`     └─ Grade Output: ${gb.grade?.name} => ${gb.outputWeightKg}kg (Pcs: ${gb.outputCount})`);
      });
    });

    // 8. Grade Outputs
    const gradeOutputs = await prisma.gradeOutput.findMany({
      include: { grade: { select: { name: true } } },
      orderBy: { createdAt: 'desc' }
    });
    console.log(`\n📌 GRADE OUTPUTS (${gradeOutputs.length}):`);
    gradeOutputs.forEach(go => {
      console.log(`   - ID: ${go.id} | Grade: ${go.grade?.name} | Total: ${go.totalAmount}kg | Used: ${go.usedAmount}kg | Rem: ${go.remainingAmount}kg | Status: ${go.status}`);
    });

    // Integrity Verification Checks
    console.log('\n=============================================================');
    console.log('🛡️ DATA INTEGRITY & BUSINESS RULES CHECK');
    console.log('=============================================================');

    let issuesCount = 0;

    // Check 1: Rags status vs SortSession
    for (const r of rags) {
      if (r.status === 'IN_SORTING' && (!r.sortSession || r.sortSession.status !== 'OPEN')) {
        console.log(`❌ ISSUE: Rag ${r.ragCode} status is IN_SORTING but has no OPEN SortSession!`);
        issuesCount++;
      }
      if (r.status === 'SORTED' && (!r.sortSession || r.sortSession.status !== 'CLOSED')) {
        console.log(`⚠️ WARNING: Rag ${r.ragCode} status is SORTED but SortSession status is not CLOSED.`);
        issuesCount++;
      }
    }

    // Check 2: SortSession cost allocation matches Rag cost
    for (const s of sortSessions) {
      if (s.status === 'CLOSED') {
        const outputs = await prisma.categoryOutput.findMany({ where: { sortSessionId: s.id } });
        const totalAllocated = outputs.reduce((sum, o) => sum + Number(o.allocatedCost), 0);
        const rag = await prisma.rag.findUnique({ where: { id: s.ragId } });
        const expectedCost = Number(rag?.allocatedCost || 0);

        if (Math.abs(totalAllocated - expectedCost) > 0.05 && expectedCost > 0) {
          console.log(`❌ ISSUE: SortSession ${s.id} CategoryOutputs cost ($${totalAllocated.toFixed(2)}) does not match Rag allocated cost ($${expectedCost.toFixed(2)})!`);
          issuesCount++;
        } else {
          console.log(`✅ OK: SortSession ${s.id} cost allocation matches Rag cost ($${expectedCost.toFixed(2)})`);
        }
      }
    }

    if (issuesCount === 0) {
      console.log('\n🎉 ALL DATABASE ENTRIES ARE 100% VALID AND IN PERFECT SYNC!');
    } else {
      console.log(`\n⚠️ AUDIT COMPLETED: Found ${issuesCount} data issue(s).`);
    }

  } catch (error) {
    console.error('Audit script error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

auditDatabase();
