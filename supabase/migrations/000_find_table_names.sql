-- Helper query to find your actual table names in Supabase
-- Run this first to see what your tables are actually named

-- Find all tables in the public schema
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Find tables that might be your transactions table
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
  AND (
    LOWER(table_name) LIKE '%transaction%' 
    OR LOWER(table_name) LIKE '%escrow%'
  )
ORDER BY table_name;

-- Find tables that might be your users table
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
  AND LOWER(table_name) LIKE '%user%'
ORDER BY table_name;

