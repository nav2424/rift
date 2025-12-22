-- Helper query to find the actual transaction table name
-- Run this in Supabase SQL Editor first to see what tables exist

-- Find all tables in the public schema
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Specifically look for transaction/escrow tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
  AND (
    LOWER(table_name) LIKE '%transaction%' 
    OR LOWER(table_name) LIKE '%escrow%'
    OR LOWER(table_name) LIKE '%rift%'
  )
ORDER BY table_name;

