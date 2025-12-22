/**
 * Script to remove duplicate "Proof approved by admin" timeline events
 * Keeps only the first (earliest) PROOF_APPROVED event per rift
 */

import { prisma } from '../lib/prisma'

async function removeDuplicateProofApproved() {
  console.log('🔍 Finding duplicate PROOF_APPROVED timeline events...')

  // Find all PROOF_APPROVED events, ordered by creation time
  const allProofApproved = await prisma.timelineEvent.findMany({
    where: {
      type: 'PROOF_APPROVED',
    },
    orderBy: {
      createdAt: 'asc',
    },
  })

  console.log(`📊 Found ${allProofApproved.length} total PROOF_APPROVED events`)

  // Group by escrowId and createdById to find duplicates
  const grouped = new Map<string, typeof allProofApproved>()

  for (const event of allProofApproved) {
    // Create a key from escrowId and createdById
    // If createdById is null, use a special key
    const key = `${event.escrowId}:${event.createdById || 'null'}`
    
    if (!grouped.has(key)) {
      grouped.set(key, [])
    }
    grouped.get(key)!.push(event)
  }

  // Find groups with duplicates (more than 1 event)
  const duplicates: string[] = []
  let totalDuplicates = 0

  for (const [key, events] of grouped.entries()) {
    if (events.length > 1) {
      duplicates.push(key)
      totalDuplicates += events.length - 1 // Keep first, delete the rest
      
      console.log(`\n🔴 Duplicates found for ${key}:`)
      console.log(`   - Keeping: ${events[0].id} (created at ${events[0].createdAt})`)
      for (let i = 1; i < events.length; i++) {
        console.log(`   - Deleting: ${events[i].id} (created at ${events[i].createdAt})`)
      }
    }
  }

  if (duplicates.length === 0) {
    console.log('\n✅ No duplicate PROOF_APPROVED events found!')
    return
  }

  console.log(`\n📝 Summary:`)
  console.log(`   - Groups with duplicates: ${duplicates.length}`)
  console.log(`   - Total events to delete: ${totalDuplicates}`)

  // Delete duplicates (keep first, delete rest)
  let deletedCount = 0
  for (const [key, events] of grouped.entries()) {
    if (events.length > 1) {
      // Keep first event, delete the rest
      const toDelete = events.slice(1)
      
      for (const event of toDelete) {
        await prisma.timelineEvent.delete({
          where: { id: event.id },
        })
        deletedCount++
      }
    }
  }

  console.log(`\n✅ Successfully deleted ${deletedCount} duplicate PROOF_APPROVED events!`)
  console.log(`   Remaining: ${allProofApproved.length - deletedCount} PROOF_APPROVED events`)
}

// Run the script
removeDuplicateProofApproved()
  .catch((error) => {
    console.error('❌ Error removing duplicates:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
