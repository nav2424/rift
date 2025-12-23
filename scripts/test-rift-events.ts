/**
 * Test script to verify rift events are being logged
 */

import { prisma } from '../lib/prisma'

async function main() {
  try {
    console.log('Checking rift events...\n')
    
    // Get recent events
    const recentEvents = await prisma.riftEvent.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        rift: {
          select: {
            id: true,
            riftNumber: true,
            itemTitle: true,
            status: true,
          },
        },
      },
    })
    
    if (recentEvents.length === 0) {
      console.log('⚠️  No events found yet.')
      console.log('   Create a Rift transaction to generate events.\n')
      return
    }
    
    console.log(`✅ Found ${recentEvents.length} recent events:\n`)
    
    recentEvents.forEach((event, i) => {
      console.log(`${i + 1}. ${event.eventType}`)
      console.log(`   Rift: #${event.rift.riftNumber} - ${event.rift.itemTitle}`)
      console.log(`   Actor: ${event.actorType}${event.actorId ? ` (${event.actorId})` : ''}`)
      console.log(`   Time: ${event.createdAt.toISOString()}`)
      console.log(`   Payload:`, JSON.stringify(event.payload, null, 2))
      console.log('')
    })
    
    // Get event counts by type
    const eventCounts = await prisma.riftEvent.groupBy({
      by: ['eventType'],
      _count: {
        eventType: true,
      },
      orderBy: {
        _count: {
          eventType: 'desc',
        },
      },
    })
    
    console.log('\n📊 Event counts by type:')
    eventCounts.forEach(({ eventType, _count }) => {
      console.log(`   ${eventType}: ${_count}`)
    })
    
  } catch (error: any) {
    console.error('❌ Error:', error.message)
    if (error.message.includes('rift_events')) {
      console.error('\n⚠️  The rift_events table may not exist yet.')
      console.error('   Run the migration first.')
    }
  } finally {
    await prisma.$disconnect()
  }
}

main()
