/**
 * Script to add OWNERSHIP_TRANSFER to ItemType enum
 * Run with: npx tsx scripts/add-ownership-transfer-enum.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Adding OWNERSHIP_TRANSFER to ItemType enum...')
  
  try {
    // Add OWNERSHIP_TRANSFER to ItemType enum
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
        ELSE
          RAISE NOTICE 'OWNERSHIP_TRANSFER already exists in ItemType enum';
        END IF;
      END $$;
    `)
    
    console.log('✅ Successfully added OWNERSHIP_TRANSFER to ItemType enum')
  } catch (error: any) {
    console.error('❌ Error adding enum value:', error.message)
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

