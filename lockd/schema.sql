-- ═══════════════════════════════════════════════════
-- LOCKD. Database Schema
-- Run in Supabase SQL Editor
-- ═══════════════════════════════════════════════════

-- Profiles
CREATE TABLE IF NOT EXISTS lockd_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro', 'ultra')),
  pro_until TIMESTAMPTZ,
  current_streak INT DEFAULT 0,
  longest_streak INT DEFAULT 0,
  total_proofs INT DEFAULT 0,
  streak_last_date DATE,
  shame_badges INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE lockd_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own profile" ON lockd_profiles;
CREATE POLICY "Users read own profile" ON lockd_profiles FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS "Users update own profile" ON lockd_profiles;
CREATE POLICY "Users update own profile" ON lockd_profiles FOR UPDATE USING (auth.uid() = id);
DROP POLICY IF EXISTS "Users insert own profile" ON lockd_profiles;
CREATE POLICY "Users insert own profile" ON lockd_profiles FOR INSERT WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "Public profiles readable" ON lockd_profiles;
CREATE POLICY "Public profiles readable" ON lockd_profiles FOR SELECT USING (true);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION lockd_handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO lockd_profiles (id, username, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || LEFT(NEW.id::text, 8)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'username', 'New User')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS lockd_on_auth_user_created ON auth.users;
CREATE TRIGGER lockd_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION lockd_handle_new_user();

-- Daily Non-Negotiables (user's recurring tasks)
CREATE TABLE IF NOT EXISTS lockd_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES lockd_profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  emoji TEXT DEFAULT '🔥',
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE lockd_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own tasks" ON lockd_tasks;
CREATE POLICY "Users manage own tasks" ON lockd_tasks FOR ALL USING (auth.uid() = user_id);

-- Daily Proofs
CREATE TABLE IF NOT EXISTS lockd_proofs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES lockd_profiles(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES lockd_tasks(id) ON DELETE CASCADE,
  proof_date DATE NOT NULL DEFAULT CURRENT_DATE,
  photo_url TEXT,
  thumbnail_url TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(task_id, proof_date)
);

ALTER TABLE lockd_proofs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own proofs" ON lockd_proofs;
CREATE POLICY "Users manage own proofs" ON lockd_proofs FOR ALL USING (auth.uid() = user_id);

-- War Rooms (squads)
CREATE TABLE IF NOT EXISTS lockd_war_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE DEFAULT UPPER(LEFT(gen_random_uuid()::text, 6)),
  created_by UUID NOT NULL REFERENCES lockd_profiles(id) ON DELETE CASCADE,
  max_members INT DEFAULT 8,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE lockd_war_rooms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members see their rooms" ON lockd_war_rooms;
DROP POLICY IF EXISTS "Creator manages room" ON lockd_war_rooms;
CREATE POLICY "Creator manages room" ON lockd_war_rooms FOR ALL USING (created_by = auth.uid());

-- War Room Members
CREATE TABLE IF NOT EXISTS lockd_war_room_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES lockd_war_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES lockd_profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(room_id, user_id)
);

ALTER TABLE lockd_war_room_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members see room members" ON lockd_war_room_members;
CREATE POLICY "Members see room members" ON lockd_war_room_members FOR SELECT USING (
  EXISTS (SELECT 1 FROM lockd_war_room_members m WHERE m.room_id = room_id AND m.user_id = auth.uid())
);
DROP POLICY IF EXISTS "Users manage own membership" ON lockd_war_room_members;
CREATE POLICY "Users manage own membership" ON lockd_war_room_members FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "War room members see proofs" ON lockd_proofs;
CREATE POLICY "War room members see proofs" ON lockd_proofs FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM lockd_war_room_members m1
    JOIN lockd_war_room_members m2 ON m1.room_id = m2.room_id
    WHERE m1.user_id = auth.uid() AND m2.user_id = lockd_proofs.user_id
  )
);

CREATE POLICY "Members see their rooms" ON lockd_war_rooms FOR SELECT USING (
  EXISTS (SELECT 1 FROM lockd_war_room_members WHERE room_id = id AND user_id = auth.uid())
);

-- Hard Mode Pledges
CREATE TABLE IF NOT EXISTS lockd_pledges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES lockd_profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  duration_days INT NOT NULL DEFAULT 30,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'failed')),
  is_public BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE lockd_pledges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own pledges" ON lockd_pledges;
CREATE POLICY "Users manage own pledges" ON lockd_pledges FOR ALL USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Public pledges visible" ON lockd_pledges;
CREATE POLICY "Public pledges visible" ON lockd_pledges FOR SELECT USING (is_public = true);

-- Streak calculation function
CREATE OR REPLACE FUNCTION lockd_update_streak(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
  v_yesterday DATE := CURRENT_DATE - 1;
  v_task_count INT;
  v_proof_count INT;
  v_current_streak INT;
  v_longest INT;
  v_last_date DATE;
BEGIN
  SELECT COUNT(*) INTO v_task_count FROM lockd_tasks WHERE user_id = p_user_id AND is_active = true;
  IF v_task_count = 0 THEN RETURN; END IF;

  SELECT COUNT(DISTINCT task_id) INTO v_proof_count
  FROM lockd_proofs WHERE user_id = p_user_id AND proof_date = v_today;

  IF v_proof_count < v_task_count THEN RETURN; END IF;

  SELECT current_streak, longest_streak, streak_last_date
  INTO v_current_streak, v_longest, v_last_date
  FROM lockd_profiles WHERE id = p_user_id;

  IF v_last_date = v_today THEN
    RETURN;
  ELSIF v_last_date = v_yesterday THEN
    v_current_streak := v_current_streak + 1;
  ELSE
    v_current_streak := 1;
  END IF;

  IF v_current_streak > v_longest THEN
    v_longest := v_current_streak;
  END IF;

  UPDATE lockd_profiles
  SET current_streak = v_current_streak,
      longest_streak = v_longest,
      streak_last_date = v_today,
      total_proofs = total_proofs + 1,
      updated_at = NOW()
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Storage bucket for proof photos
INSERT INTO storage.buckets (id, name, public) VALUES ('lockd-proofs', 'lockd-proofs', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Users upload own proofs" ON storage.objects;
CREATE POLICY "Users upload own proofs" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'lockd-proofs' AND auth.uid()::text = (storage.foldername(name))[1]);
DROP POLICY IF EXISTS "Public proof access" ON storage.objects;
CREATE POLICY "Public proof access" ON storage.objects
  FOR SELECT USING (bucket_id = 'lockd-proofs');

-- Indexes
CREATE INDEX IF NOT EXISTS idx_lockd_proofs_user_date ON lockd_proofs(user_id, proof_date);
CREATE INDEX IF NOT EXISTS idx_lockd_proofs_task_date ON lockd_proofs(task_id, proof_date);
CREATE INDEX IF NOT EXISTS idx_lockd_tasks_user ON lockd_tasks(user_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_lockd_wrm_room ON lockd_war_room_members(room_id);
CREATE INDEX IF NOT EXISTS idx_lockd_wrm_user ON lockd_war_room_members(user_id);
