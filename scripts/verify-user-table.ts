import { prisma } from '../lib/prisma'

/**
 * Verify the User table exists and check its columns
 */
async function verifyUserTable() {
  try {
    console.log('Checking User table...')

    // Try to query the User table structure
    const result = await prisma.$queryRaw<Array<{ column_name: string; data_type: string }>>`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'User'
      ORDER BY ordinal_position;
    `

    console.log(`\nFound ${result.length} columns in User table:`)
    result.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type})`)
    })

    // Check specifically for our new columns
    const hasFirstName = result.some(col => col.column_name === 'firstName')
    const hasLastName = result.some(col => col.column_name === 'lastName')
    const hasBirthday = result.some(col => col.column_name === 'birthday')
    const hasOnboardingCompleted = result.some(col => col.column_name === 'onboardingCompleted')

    console.log('\nNew columns status:')
    console.log(`  - firstName: ${hasFirstName ? '✅ EXISTS' : '❌ MISSING'}`)
    console.log(`  - lastName: ${hasLastName ? '✅ EXISTS' : '❌ MISSING'}`)
    console.log(`  - birthday: ${hasBirthday ? '✅ EXISTS' : '❌ MISSING'}`)
    console.log(`  - onboardingCompleted: ${hasOnboardingCompleted ? '✅ EXISTS' : '❌ MISSING'}`)

  } catch (error: any) {
    console.error('Error checking User table:', error.message)
    if (error.message.includes('relation') && error.message.includes('does not exist')) {
      console.error('\n⚠️  The User table does not exist in the database!')
      console.error('This might mean:')
      console.error('  1. The database connection is incorrect')
      console.error('  2. The migrations have not been applied')
      console.error('  3. The table name is different than expected')
    }
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run the verification
verifyUserTable()
  .then(() => {
    console.log('\n✅ Verification completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Verification failed:', error)
    process.exit(1)
  })

