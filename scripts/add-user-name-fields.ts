import { prisma } from '../lib/prisma'

/**
 * Add firstName, lastName, and birthday columns to User table if they don't exist
 * This script safely adds the new columns without data loss
 */
async function addUserNameFields() {
  try {
    console.log('Adding firstName, lastName, and birthday columns to User table...')

    // Use raw SQL to add columns if they don't exist
    // Note: In PostgreSQL, when using information_schema, table names are case-insensitive
    // but we need to check the actual table name in the database
    await prisma.$executeRaw`
      DO $$ 
      BEGIN
        -- Check if firstName column exists
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'User' 
          AND column_name = 'firstName'
        ) THEN
          ALTER TABLE "User" ADD COLUMN "firstName" TEXT;
          RAISE NOTICE 'Added firstName column';
        ELSE
          RAISE NOTICE 'firstName column already exists';
        END IF;
        
        -- Check if lastName column exists
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'User' 
          AND column_name = 'lastName'
        ) THEN
          ALTER TABLE "User" ADD COLUMN "lastName" TEXT;
          RAISE NOTICE 'Added lastName column';
        ELSE
          RAISE NOTICE 'lastName column already exists';
        END IF;
        
        -- Check if birthday column exists
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'User' 
          AND column_name = 'birthday'
        ) THEN
          ALTER TABLE "User" ADD COLUMN "birthday" TIMESTAMP(3);
          RAISE NOTICE 'Added birthday column';
        ELSE
          RAISE NOTICE 'birthday column already exists';
        END IF;
      END $$;
    `

    console.log('✅ Successfully added firstName, lastName, and birthday columns!')
  } catch (error) {
    console.error('Error adding columns:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run the script
addUserNameFields()
  .then(() => {
    console.log('Script completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Script failed:', error)
    process.exit(1)
  })

