-- Check Realtime status for messaging tables
-- Run this in Supabase SQL Editor to see which tables have Realtime enabled

SELECT 
  tablename,
  CASE 
    WHEN tablename IN ('messages', 'conversations', 'conversation_participants') 
    THEN '✅ Enabled' 
    ELSE 'Other table'
  END as status
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;

-- Check if all required tables are enabled
SELECT 
  CASE 
    WHEN COUNT(*) = 3 THEN '✅ All messaging tables have Realtime enabled'
    ELSE '⚠️ Some tables missing: ' || (3 - COUNT(*))::text || ' table(s) not enabled'
  END as summary
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
  AND tablename IN ('messages', 'conversations', 'conversation_participants');
