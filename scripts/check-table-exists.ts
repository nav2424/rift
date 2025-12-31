import { prisma } from '../lib/prisma'

/**
 * Check if User table exists and what its actual name is
 */
async function checkTableExists() {
  try {
    console.log('Checking for User table...')

    // Check all tables in the public schema
    const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `

    console.log(`\nFound ${tables.length} tables in public schema:`)
    tables.forEach(table => {
      console.log(`  - ${table.table_name}`)
    })

    // Check specifically for User (case variations)
    const userTable = tables.find(t => 
      t.table_name === 'User' || 
      t.table_name === 'user' || 
      t.table_name.toLowerCase() === 'user'
    )

    if (userTable) {
      console.log(`\n✅ Found User table: "${userTable.table_name}"`)
    } else {
      console.log('\n❌ User table not found!')
      console.log('Available tables:', tables.map(t => t.table_name).join(', '))
    }

    // Try to query the User table directly
    try {
      const userCount = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) as count FROM "User"
      `
      console.log(`\n✅ Successfully queried User table (${userCount[0].count} users)`)
    } catch (error: any) {
      console.error(`\n❌ Failed to query User table:`, error.message)
      
      // Try with lowercase
      try {
        const userCount = await prisma.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(*) as count FROM "user"
        `
        console.log(`\n✅ Successfully queried user table (lowercase) (${userCount[0].count} users)`)
      } catch (error2: any) {
        console.error(`\n❌ Also failed with lowercase:`, error2.message)
      }
    }

  } catch (error: any) {
    console.error('Error:', error.message)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

checkTableExists()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Script failed:', error)
    process.exit(1)
  })

