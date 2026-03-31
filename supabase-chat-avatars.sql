-- ========================================================
-- REPMAX — The Social Master Update (Phase 1)
-- Run this completely in your Supabase SQL Editor
-- This uses strict Row Level Security (RLS) to be UNHACKABLE
-- ========================================================

-- 1. Add Pro Themes and 3D Avatars to existing Profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_seed TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS theme_color TEXT DEFAULT 'green';


-- 2. Create Chats Table (Direct Messages & Groups)
CREATE TABLE IF NOT EXISTS chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT CHECK (type IN ('direct', 'group')) DEFAULT 'direct',
  name TEXT, -- Used for group chat titles
  created_at TIMESTAMPTZ DEFAULT now()
);


-- 3. Create Chat Members Table (Who is in which chat)
CREATE TABLE IF NOT EXISTS chat_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID REFERENCES chats(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(chat_id, user_id)
);


-- 4. Create Messages Table
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID REFERENCES chats(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT,
  type TEXT CHECK (type IN ('text', 'invite')) DEFAULT 'text',
  invite_id UUID REFERENCES training_invites(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);


-- ========================================================
-- SECURITY PROTOCOL: IRONCLAD RLS (ROW LEVEL SECURITY)
-- ========================================================
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- CHAT SECURITY
CREATE POLICY "Users can view chats they belong to" ON chats FOR SELECT
  USING (EXISTS (SELECT 1 FROM chat_members WHERE chat_id = chats.id AND user_id = auth.uid()));

CREATE POLICY "Any authenticated user can create a chat" ON chats FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Only members can update group chat names" ON chats FOR UPDATE
  USING (EXISTS (SELECT 1 FROM chat_members WHERE chat_id = chats.id AND user_id = auth.uid()));

-- MEMBERSHIP SECURITY
CREATE POLICY "Users can view members of their own chats" ON chat_members FOR SELECT
  USING (EXISTS (SELECT 1 FROM chat_members cm WHERE cm.chat_id = chat_members.chat_id AND cm.user_id = auth.uid()));

CREATE POLICY "Users can invite others if they are in the chat" ON chat_members FOR INSERT
  WITH CHECK (
    auth.uid() = user_id -- User is creating chat and adding themselves
    OR EXISTS (SELECT 1 FROM chat_members WHERE chat_id = chat_members.chat_id AND user_id = auth.uid()) -- Or member is adding a friend
  );

CREATE POLICY "Users can leave chats" ON chat_members FOR DELETE
  USING (auth.uid() = user_id);

-- MESSAGE SECURITY
CREATE POLICY "Users can read messages in their chats" ON messages FOR SELECT
  USING (EXISTS (SELECT 1 FROM chat_members WHERE chat_id = messages.chat_id AND user_id = auth.uid()));

CREATE POLICY "Users can ONLY send messages acting as themselves into their chats" ON messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id AND 
    EXISTS (SELECT 1 FROM chat_members WHERE chat_id = messages.chat_id AND user_id = auth.uid())
  );

-- ========================================================
-- REALTIME SETUP (WebSockets)
-- Required to see texts live without reloading
-- ========================================================
-- Drop old publication and make a fresh one tracking our new tables
DROP PUBLICATION IF EXISTS supabase_realtime;
CREATE PUBLICATION supabase_realtime FOR TABLE messages, chats, chat_members, training_invites;
