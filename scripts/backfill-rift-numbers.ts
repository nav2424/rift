import { prisma } from '../lib/prisma';
import { generateNextRiftNumber } from '../lib/rift-number';

async function backfillRiftNumbers() {
  console.log('Checking rifts for riftNumber values...');
  
  // Get all rifts
  const allEscrows = await prisma.riftTransaction.findMany({
    orderBy: {
      createdAt: 'asc',
    },
    select: {
      id: true,
      riftNumber: true,
      itemTitle: true,
      createdAt: true,
    },
  });

  console.log(`Found ${allEscrows.length} total rifts`);

  // Show sample of rift numbers
  console.log('\nSample rifts:');
  allEscrows.slice(0, 10).forEach(e => {
    console.log(`  Rift #${e.riftNumber} - ${e.itemTitle} (${e.id.slice(0, 8)}...)`);
  });

  if (allEscrows.length > 0) {
    const minRiftNumber = Math.min(...allEscrows.map(e => e.riftNumber));
    const maxRiftNumber = Math.max(...allEscrows.map(e => e.riftNumber));
    console.log(`\nRift number range: ${minRiftNumber} to ${maxRiftNumber}`);
  }
}

backfillRiftNumbers()
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

