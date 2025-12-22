-- Safely enable Realtime for messaging tables
-- This script checks if tables are already in the publication before adding them
-- Run this in Supabase SQL Editor

DO $$
BEGIN
  -- Check if supabase_realtime publication exists
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    
    -- Add messages table if not already added
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' 
      AND tablename = 'messages'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE messages;
      RAISE NOTICE 'Added messages table to supabase_realtime publication';
    ELSE
      RAISE NOTICE 'messages table is already in supabase_realtime publication';
    END IF;

    -- Add conversations table if not already added
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' 
      AND tablename = 'conversations'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
      RAISE NOTICE 'Added conversations table to supabase_realtime publication';
    ELSE
      RAISE NOTICE 'conversations table is already in supabase_realtime publication';
    END IF;

    -- Add conversation_participants table if not already added
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' 
      AND tablename = 'conversation_participants'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE conversation_participants;
      RAISE NOTICE 'Added conversation_participants table to supabase_realtime publication';
    ELSE
      RAISE NOTICE 'conversation_participants table is already in supabase_realtime publication';
    END IF;

  ELSE
    RAISE WARNING 'supabase_realtime publication does not exist. Realtime may not be enabled in your Supabase project.';
  END IF;
END $$;

-- Verify which tables are in the publication
SELECT 
  tablename,
  'Enabled' as status
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
  AND tablename IN ('messages', 'conversations', 'conversation_participants')
ORDER BY tablename;
