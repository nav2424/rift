import { prisma } from '../lib/prisma'

/**
 * Add onboardingCompleted column to User table if it doesn't exist
 */
async function addOnboardingField() {
  try {
    console.log('Adding onboardingCompleted column to User table...')

    await prisma.$executeRaw`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'User' 
          AND column_name = 'onboardingCompleted'
        ) THEN
          ALTER TABLE "User" ADD COLUMN "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false;
          RAISE NOTICE 'Added onboardingCompleted column';
        ELSE
          RAISE NOTICE 'onboardingCompleted column already exists';
        END IF;
      END $$;
    `

    console.log('✅ Successfully added onboardingCompleted column!')
  } catch (error) {
    console.error('Error adding column:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

addOnboardingField()
  .then(() => {
    console.log('Script completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Script failed:', error)
    process.exit(1)
  })

