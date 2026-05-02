-- ============================================
-- REPMAX v2.0 — Social + Subscription Schema
-- Run this in Supabase SQL Editor AFTER the v1 schema
-- ============================================

-- ===== FRIENDSHIPS =====
CREATE TABLE IF NOT EXISTS friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  friend_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  status TEXT CHECK (status IN ('pending', 'accepted', 'blocked')) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, friend_id)
);

ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can see own friendships" ON friendships FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() = friend_id);
CREATE POLICY "Users can send friend requests" ON friendships FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own friendships" ON friendships FOR UPDATE
  USING (auth.uid() = user_id OR auth.uid() = friend_id);
CREATE POLICY "Users can delete own friendships" ON friendships FOR DELETE
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- ===== TRAINING INVITES =====
CREATE TABLE IF NOT EXISTS training_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  receiver_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  location TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  workout_type TEXT,
  message TEXT,
  status TEXT CHECK (status IN ('pending', 'accepted', 'declined', 'expired')) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE training_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can see own invites" ON training_invites FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "Users can send invites" ON training_invites FOR INSERT
  WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Users can update invites" ON training_invites FOR UPDATE
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- ===== NUDGES =====
CREATE TABLE IF NOT EXISTS nudges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  receiver_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  message TEXT DEFAULT 'Time to train!',
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE nudges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can see own nudges" ON nudges FOR SELECT
  USING (auth.uid() = receiver_id OR auth.uid() = sender_id);
CREATE POLICY "Users can send nudges" ON nudges FOR INSERT
  WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Users can mark nudges read" ON nudges FOR UPDATE
  USING (auth.uid() = receiver_id);

-- ===== NOTIFICATIONS =====
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  data JSONB,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can see own notifications" ON notifications FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "System can create notifications" ON notifications FOR INSERT
  WITH CHECK (true);
CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- ===== AI COACH MESSAGES =====
CREATE TABLE IF NOT EXISTS ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  role TEXT CHECK (role IN ('user', 'assistant')) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own messages" ON ai_messages FOR ALL
  USING (auth.uid() = user_id);

-- ===== SUBSCRIPTION EVENTS =====
CREATE TABLE IF NOT EXISTS subscription_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  event_type TEXT NOT NULL,
  amount REAL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE subscription_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can see own events" ON subscription_events FOR SELECT
  USING (auth.uid() = user_id);

-- ===== UPDATE PROFILES TABLE =====
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'free';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_started_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_weeks_completed INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS units TEXT DEFAULT 'lbs';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS privacy TEXT DEFAULT 'friends';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notify_nudges BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notify_invites BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notify_reminders BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS friend_code TEXT;

-- Generate unique friend codes for existing users
UPDATE profiles SET friend_code = substr(md5(id::text || now()::text), 1, 8)
  WHERE friend_code IS NULL;

-- ===== INDEXES =====
CREATE INDEX IF NOT EXISTS idx_friendships_user ON friendships(user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_friend ON friendships(friend_id);
CREATE INDEX IF NOT EXISTS idx_invites_receiver ON training_invites(receiver_id);
CREATE INDEX IF NOT EXISTS idx_nudges_receiver ON nudges(receiver_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_ai_messages_user ON ai_messages(user_id);
