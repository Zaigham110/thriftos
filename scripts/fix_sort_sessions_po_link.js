const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixSortSessionLinks() {
  console.log('\n=============================================================');
  console.log('🔧 BACKFILLING MISSING INCOMING BALE / PO LINKS ON SORT SESSIONS');
  console.log('=============================================================\n');

  try {
    const sessionsWithoutBale = await prisma.sortSession.findMany({
      where: { incomingBaleId: null },
      include: {
        rag: {
          select: { id: true, ragCode: true, containerId: true, notes: true }
        }
      }
    });

    console.log(`Found ${sessionsWithoutBale.length} SortSession(s) with incomingBaleId = NULL.\n`);

    let updatedCount = 0;

    for (const session of sessionsWithoutBale) {
      if (!session.rag) continue;

      const ragCode = session.rag.ragCode;
      
      // Try to find matching IncomingBale by baleCode
      const matchingBale = await prisma.incomingBale.findFirst({
        where: {
          tenantId: session.tenantId,
          baleCode: ragCode
        },
        include: { purchaseOrder: true }
      });

      if (matchingBale) {
        await prisma.sortSession.update({
          where: { id: session.id },
          data: { incomingBaleId: matchingBale.id }
        });
        console.log(`✅ LINKED: SortSession [${session.id}] (Rag: ${ragCode}) ➔ IncomingBale [${matchingBale.id}] (PO: ${matchingBale.purchaseOrder?.poNumber || matchingBale.purchaseOrderId})`);
        updatedCount++;
      } else {
        // Check if notes contains auto_migrated_bale or auto_created PO
        console.log(`ℹ️ NO DIRECT BALE MATCH: SortSession [${session.id}] (Rag: ${ragCode}, ContainerId: ${session.rag.containerId || 'None'})`);
      }
    }

    console.log(`\n🎉 BACKFILL COMPLETED: Successfully linked ${updatedCount} SortSession(s) to their Purchase Orders!`);

  } catch (error) {
    console.error('Error fixing links:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixSortSessionLinks();
