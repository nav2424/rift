-- AlterTable
-- Add firstName, lastName, and birthday columns if they don't exist
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'User') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'firstName') THEN
      ALTER TABLE "User" ADD COLUMN "firstName" TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'lastName') THEN
      ALTER TABLE "User" ADD COLUMN "lastName" TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'birthday') THEN
      ALTER TABLE "User" ADD COLUMN "birthday" TIMESTAMP(3);
    END IF;
  END IF;
END $$;

