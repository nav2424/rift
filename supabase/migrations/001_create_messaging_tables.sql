-- Create conversations table
-- Note: This uses TEXT IDs to match your Prisma schema (cuid format)
-- Foreign keys are commented out - add them manually after confirming your table names
-- Run the helper query in 000_find_table_names.sql to find your actual table names

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  transaction_id TEXT NOT NULL UNIQUE,
  buyer_id TEXT NOT NULL,
  seller_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT check_buyer_seller_different CHECK (buyer_id <> seller_id)
);

-- To add foreign keys later, run this (update table names to match your schema):
-- ALTER TABLE conversations 
--   ADD CONSTRAINT fk_transaction FOREIGN KEY (transaction_id) REFERENCES "YourTransactionTableName"(id) ON DELETE CASCADE,
--   ADD CONSTRAINT fk_buyer FOREIGN KEY (buyer_id) REFERENCES "YourUserTableName"(id) ON DELETE CASCADE,
--   ADD CONSTRAINT fk_seller FOREIGN KEY (seller_id) REFERENCES "YourUserTableName"(id) ON DELETE CASCADE;

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  conversation_id TEXT NOT NULL,
  sender_id TEXT,
  body TEXT NOT NULL,
  is_system BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT fk_conversation FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

-- To add foreign key for sender_id later, run this (update table name):
-- ALTER TABLE messages 
--   ADD CONSTRAINT fk_sender FOREIGN KEY (sender_id) REFERENCES "YourUserTableName"(id) ON DELETE SET NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_conversations_transaction ON conversations(transaction_id);

-- Note: RLS is disabled because you're using custom auth (NextAuth) instead of Supabase Auth
-- Security is handled at the API level in app/api/conversations/[transactionId]/route.ts
-- If you want to enable RLS later, you'll need to create custom policies that work with your auth system

-- For now, we'll disable RLS and rely on API-level validation
ALTER TABLE conversations DISABLE ROW LEVEL SECURITY;
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;

-- If you want to enable RLS in the future with custom auth, you can create policies like:
-- CREATE POLICY "Users can view their own conversations"
--   ON conversations FOR SELECT
--   USING (
--     -- You would need to pass user_id as a parameter or use a custom function
--     -- This is complex without Supabase Auth, so API-level validation is recommended
--     true
--   );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_conversation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations
  SET updated_at = NOW()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update conversation updated_at when message is inserted
CREATE TRIGGER update_conversation_timestamp
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_updated_at();

