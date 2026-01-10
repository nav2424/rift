/**
 * Verify OWNERSHIP_TRANSFER exists in ItemType enum
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  try {
    // Try to query the enum values directly
    const result = await prisma.$queryRawUnsafe<Array<{ enumlabel: string }>>(`
      SELECT enumlabel 
      FROM pg_enum 
      WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'ItemType') 
      ORDER BY enumsortorder;
    `)
    
    console.log('Current ItemType enum values:')
    result.forEach((row) => {
      console.log(`  - ${row.enumlabel}`)
    })
    
    const hasOwnershipTransfer = result.some((row) => row.enumlabel === 'OWNERSHIP_TRANSFER')
    
    if (hasOwnershipTransfer) {
      console.log('\n✅ OWNERSHIP_TRANSFER exists in the enum')
    } else {
      console.log('\n❌ OWNERSHIP_TRANSFER is MISSING from the enum')
      console.log('Adding it now...')
      
      await prisma.$executeRawUnsafe(`
        DO $$ 
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_enum 
            WHERE enumlabel = 'OWNERSHIP_TRANSFER' 
            AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'ItemType')
          ) THEN
            ALTER TYPE "ItemType" ADD VALUE 'OWNERSHIP_TRANSFER';
            RAISE NOTICE 'Added OWNERSHIP_TRANSFER to ItemType enum';
          END IF;
        END $$;
      `)
      
      console.log('✅ Added OWNERSHIP_TRANSFER to the enum')
    }
  } catch (error: any) {
    console.error('Error:', error.message)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })

