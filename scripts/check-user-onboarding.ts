import { prisma } from '../lib/prisma'

/**
 * Check onboarding status for all users
 */
async function checkUserOnboarding() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        // onboardingCompleted field removed
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 10,
    })

    console.log(`\nFound ${users.length} recent users:`)
    users.forEach(user => {
      console.log(`  - ${user.email} (${user.name || 'No name'})`)
      // onboardingCompleted field removed
      console.log(`    createdAt: ${user.createdAt}`)
    })

    const incomplete = users.filter(u => !u.onboardingCompleted)
    console.log(`\nUsers who haven't completed onboarding: ${incomplete.length}`)
    
  } catch (error) {
    console.error('Error:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

checkUserOnboarding()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Script failed:', error)
    process.exit(1)
  })

