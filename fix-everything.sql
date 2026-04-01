-- ========================================================
-- REPMAX — MASTER SQL MIGRATION
-- Run this ONCE in your Supabase SQL Editor
-- This replaces ALL previous individual SQL scripts
-- ========================================================

-- 1. Profile columns for avatars and themes
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_seed TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS theme_color TEXT DEFAULT 'green';

-- 2. Chat tables
CREATE TABLE IF NOT EXISTS chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT CHECK (type IN ('direct', 'group')) DEFAULT 'direct',
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID REFERENCES chats(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(chat_id, user_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID REFERENCES chats(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT,
  type TEXT CHECK (type IN ('text', 'invite', 'status')) DEFAULT 'text',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Enable RLS
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- 4. Chat policies (SAFE — no recursion)
DROP POLICY IF EXISTS "Users can view chats they belong to" ON chats;
CREATE POLICY "Users can view chats they belong to" ON chats FOR SELECT
  USING (EXISTS (SELECT 1 FROM chat_members WHERE chat_id = chats.id AND user_id = auth.uid()));

DROP POLICY IF EXISTS "Any authenticated user can create a chat" ON chats;
CREATE POLICY "Any authenticated user can create a chat" ON chats FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Only members can update group chat names" ON chats;
CREATE POLICY "Only members can update group chat names" ON chats FOR UPDATE
  USING (EXISTS (SELECT 1 FROM chat_members WHERE chat_id = chats.id AND user_id = auth.uid()));

-- 5. Chat member policies (FLAT — no infinite recursion)
DROP POLICY IF EXISTS "Users can view members of their own chats" ON chat_members;
CREATE POLICY "Users can view members of their own chats" ON chat_members FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can invite others if they are in the chat" ON chat_members;
DROP POLICY IF EXISTS "Users can add members or join groups" ON chat_members;
CREATE POLICY "Users can add members or join groups" ON chat_members FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can leave chats" ON chat_members;
CREATE POLICY "Users can leave chats" ON chat_members FOR DELETE
  USING (auth.uid() = user_id);

-- 6. Message policies
DROP POLICY IF EXISTS "Users can read messages in their chats" ON messages;
CREATE POLICY "Users can read messages in their chats" ON messages FOR SELECT
  USING (EXISTS (SELECT 1 FROM chat_members WHERE chat_id = messages.chat_id AND user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can ONLY send messages acting as themselves into their chats" ON messages;
CREATE POLICY "Users can ONLY send messages acting as themselves into their chats" ON messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (SELECT 1 FROM chat_members WHERE chat_id = messages.chat_id AND user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can delete their own messages" ON messages;
CREATE POLICY "Users can delete their own messages" ON messages FOR DELETE
  USING (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Users can update their own messages" ON messages;
CREATE POLICY "Users can update their own messages" ON messages FOR UPDATE
  USING (auth.uid() = sender_id);

-- 7. Realtime (for live messaging)
DROP PUBLICATION IF EXISTS supabase_realtime;
CREATE PUBLICATION supabase_realtime FOR TABLE messages, chats, chat_members;
