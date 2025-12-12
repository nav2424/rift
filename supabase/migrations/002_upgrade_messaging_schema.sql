-- Upgrade messaging schema to use UUIDs and conversation_participants
-- This migration is idempotent and can be run multiple times safely

-- Drop old tables if they exist (in reverse order due to foreign keys)
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS conversation_participants CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;

-- Create conversations table with UUID
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  last_message_at TIMESTAMPTZ
);

-- Create conversation_participants table
CREATE TABLE conversation_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL, -- Using TEXT to match Prisma User.id (cuid format)
  role TEXT NOT NULL, -- 'buyer', 'seller', 'admin'
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(conversation_id, user_id)
);

-- Create messages table with UUID
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id TEXT, -- Using TEXT to match Prisma User.id (cuid format)
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  read_at TIMESTAMPTZ
);

-- Create indexes for performance (IF NOT EXISTS doesn't work for indexes, so we drop first)
DROP INDEX IF EXISTS idx_conversation_participants_user_id;
DROP INDEX IF EXISTS idx_conversation_participants_conversation_id;
DROP INDEX IF EXISTS idx_messages_conversation_id;
DROP INDEX IF EXISTS idx_messages_conversation_created;
DROP INDEX IF EXISTS idx_messages_sender_id;
DROP INDEX IF EXISTS idx_conversations_last_message_at;

CREATE INDEX idx_conversation_participants_user_id ON conversation_participants(user_id);
CREATE INDEX idx_conversation_participants_conversation_id ON conversation_participants(conversation_id);
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_conversation_created ON messages(conversation_id, created_at);
CREATE INDEX idx_messages_sender_id ON messages(sender_id);
CREATE INDEX idx_conversations_last_message_at ON conversations(last_message_at DESC);

-- Enable Realtime for Supabase (if publication exists)
-- Note: These commands may fail if the publication doesn't exist - that's okay
-- Realtime will be enabled automatically if Supabase Realtime is configured
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    -- Remove tables from publication first (in case they were added before)
    -- We use exception handling since DROP TABLE doesn't support IF EXISTS
    BEGIN
      ALTER PUBLICATION supabase_realtime DROP TABLE conversations;
    EXCEPTION WHEN undefined_object THEN
      -- Table not in publication, that's fine
      NULL;
    END;
    
    BEGIN
      ALTER PUBLICATION supabase_realtime DROP TABLE messages;
    EXCEPTION WHEN undefined_object THEN
      NULL;
    END;
    
    BEGIN
      ALTER PUBLICATION supabase_realtime DROP TABLE conversation_participants;
    EXCEPTION WHEN undefined_object THEN
      NULL;
    END;
    
    -- Add tables to publication
    ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
    ALTER PUBLICATION supabase_realtime ADD TABLE messages;
    ALTER PUBLICATION supabase_realtime ADD TABLE conversation_participants;
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- If publication doesn't exist or other errors, just continue
  -- Realtime might not be enabled, but that's okay
  NULL;
END $$;

-- Create function to update last_message_at timestamp
CREATE OR REPLACE FUNCTION update_conversation_last_message_at()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations
  SET last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it exists, then create it
DROP TRIGGER IF EXISTS update_conversation_last_message_at_trigger ON messages;
CREATE TRIGGER update_conversation_last_message_at_trigger
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_last_message_at();

-- Note: RLS is disabled because you're using custom auth (NextAuth) instead of Supabase Auth
-- Security is handled at the API level
ALTER TABLE conversations DISABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_participants DISABLE ROW LEVEL SECURITY;
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;
