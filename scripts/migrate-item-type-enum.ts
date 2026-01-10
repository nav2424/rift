/**
 * Migrate old ItemType enum values to new ones in the database
 * This script updates existing records:
 * - TICKETS -> OWNERSHIP_TRANSFER
 * - DIGITAL -> DIGITAL_GOODS
 * - LICENSE_KEYS -> DIGITAL_GOODS
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔄 Migrating ItemType enum values...')
  
  try {
    // Check current enum values in database
    const enumValues = await prisma.$queryRawUnsafe<Array<{ enumlabel: string }>>(`
      SELECT enumlabel 
      FROM pg_enum 
      WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'ItemType') 
      ORDER BY enumsortorder;
    `)
    
    console.log('Current ItemType enum values in database:')
    enumValues.forEach(v => console.log(`  - ${v.enumlabel}`))
    
    // Check if old values exist in data
    const ticketsCount = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(`
      SELECT COUNT(*) as count 
      FROM "EscrowTransaction" 
      WHERE "itemType"::text = 'TICKETS'
    `)
    
    const digitalCount = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(`
      SELECT COUNT(*) as count 
      FROM "EscrowTransaction" 
      WHERE "itemType"::text = 'DIGITAL'
    `)
    
    const licenseKeysCount = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(`
      SELECT COUNT(*) as count 
      FROM "EscrowTransaction" 
      WHERE "itemType"::text = 'LICENSE_KEYS'
    `)
    
    const tickets = Number(ticketsCount[0]?.count || 0)
    const digital = Number(digitalCount[0]?.count || 0)
    const licenseKeys = Number(licenseKeysCount[0]?.count || 0)
    
    console.log(`\nRecords with old enum values:`)
    console.log(`  TICKETS: ${tickets}`)
    console.log(`  DIGITAL: ${digital}`)
    console.log(`  LICENSE_KEYS: ${licenseKeys}`)
    
    if (tickets === 0 && digital === 0 && licenseKeys === 0) {
      console.log('\n✅ No records need migration. Database is up to date!')
      return
    }
    
    // Ensure new enum values exist
    console.log('\n📝 Ensuring new enum values exist...')
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
    
    await prisma.$executeRawUnsafe(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum 
          WHERE enumlabel = 'DIGITAL_GOODS' 
          AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'ItemType')
        ) THEN
          ALTER TYPE "ItemType" ADD VALUE 'DIGITAL_GOODS';
          RAISE NOTICE 'Added DIGITAL_GOODS to ItemType enum';
        END IF;
      END $$;
    `)
    
    console.log('✅ Enum values verified')
    
    // Migrate data
    console.log('\n🔄 Migrating data...')
    
    if (tickets > 0) {
      const result = await prisma.$executeRawUnsafe(`
        UPDATE "EscrowTransaction"
        SET "itemType" = 'OWNERSHIP_TRANSFER'::"ItemType"
        WHERE "itemType"::text = 'TICKETS'
      `)
      console.log(`  ✅ Migrated ${tickets} records: TICKETS -> OWNERSHIP_TRANSFER`)
    }
    
    if (digital > 0) {
      const result = await prisma.$executeRawUnsafe(`
        UPDATE "EscrowTransaction"
        SET "itemType" = 'DIGITAL_GOODS'::"ItemType"
        WHERE "itemType"::text = 'DIGITAL'
      `)
      console.log(`  ✅ Migrated ${digital} records: DIGITAL -> DIGITAL_GOODS`)
    }
    
    if (licenseKeys > 0) {
      const result = await prisma.$executeRawUnsafe(`
        UPDATE "EscrowTransaction"
        SET "itemType" = 'DIGITAL_GOODS'::"ItemType"
        WHERE "itemType"::text = 'LICENSE_KEYS'
      `)
      console.log(`  ✅ Migrated ${licenseKeys} records: LICENSE_KEYS -> DIGITAL_GOODS`)
    }
    
    console.log('\n✅ Migration completed successfully!')
    console.log('\n📊 Verification:')
    
    // Verify migration
    const verifyTickets = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(`
      SELECT COUNT(*) as count 
      FROM "EscrowTransaction" 
      WHERE "itemType"::text = 'TICKETS'
    `)
    const verifyDigital = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(`
      SELECT COUNT(*) as count 
      FROM "EscrowTransaction" 
      WHERE "itemType"::text = 'DIGITAL'
    `)
    
    if (Number(verifyTickets[0]?.count || 0) === 0 && Number(verifyDigital[0]?.count || 0) === 0) {
      console.log('  ✅ All old enum values have been migrated')
    } else {
      console.log('  ⚠️  Some records may still have old values')
    }
    
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message)
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
