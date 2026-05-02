-- ============================================================
-- Communities Schema — Run in Supabase SQL Editor
-- ============================================================
-- Creates backing tables for City/Gym/Split crews, challenge
-- rooms, PR wall reactions, and elite streak board.
-- Safe to re-run (IF NOT EXISTS on everything).

-- ===== 1. Crews (City, Gym, Split) =====
CREATE TABLE IF NOT EXISTS communities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('city', 'gym', 'split', 'custom')),
  description text DEFAULT '',
  image_url text DEFAULT NULL,
  metadata jsonb DEFAULT '{}',
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS community_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role text DEFAULT 'member' CHECK (role IN ('member', 'admin', 'king')),
  joined_at timestamptz DEFAULT now(),
  UNIQUE (community_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_community_members_user ON community_members(user_id);
CREATE INDEX IF NOT EXISTS idx_community_members_community ON community_members(community_id);

-- ===== 2. Challenge Rooms =====
CREATE TABLE IF NOT EXISTS challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid REFERENCES communities(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text DEFAULT '',
  type text NOT NULL CHECK (type IN ('volume_duel', 'pr_race', 'streak_survivor', 'custom')),
  stake text DEFAULT '',
  starts_at timestamptz DEFAULT now(),
  ends_at timestamptz,
  status text DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  winner_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS challenge_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  score numeric DEFAULT 0,
  joined_at timestamptz DEFAULT now(),
  UNIQUE (challenge_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_challenge_participants_user ON challenge_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_challenge_participants_challenge ON challenge_participants(challenge_id);

-- ===== 3. PR Wall Reactions =====
CREATE TABLE IF NOT EXISTS pr_wall_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pr_id uuid NOT NULL REFERENCES personal_records(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  emoji text NOT NULL DEFAULT '🔥',
  created_at timestamptz DEFAULT now(),
  UNIQUE (pr_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_pr_wall_reactions_pr ON pr_wall_reactions(pr_id);

-- ===== 4. Profile fields for crews =====
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS home_gym text DEFAULT NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS city text DEFAULT NULL;

-- ===== 5. Voice messages bucket (run via Supabase Dashboard > Storage) =====
-- Create a public bucket called "voice-messages" in Supabase Storage.
-- Policy: authenticated users can upload, anyone can read (public).
-- This cannot be done via SQL — use the Dashboard UI.

-- ===== 6. Enable Realtime on new tables =====
ALTER TABLE communities REPLICA IDENTITY FULL;
ALTER TABLE community_members REPLICA IDENTITY FULL;
ALTER TABLE challenges REPLICA IDENTITY FULL;
ALTER TABLE challenge_participants REPLICA IDENTITY FULL;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE communities;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE community_members;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE challenges;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE challenge_participants;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ===== 7. RLS Policies =====
ALTER TABLE communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE pr_wall_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Anyone can view communities" ON communities FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Auth users can create communities" ON communities FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY IF NOT EXISTS "Anyone can view community members" ON community_members FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Auth users can join communities" ON community_members FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "Users can leave communities" ON community_members FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Anyone can view challenges" ON challenges FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Auth users can create challenges" ON challenges FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY IF NOT EXISTS "Creators can update challenges" ON challenges FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY IF NOT EXISTS "Anyone can view challenge participants" ON challenge_participants FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Auth users can join challenges" ON challenge_participants FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Anyone can view PR reactions" ON pr_wall_reactions FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Auth users can react to PRs" ON pr_wall_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "Users can remove their reactions" ON pr_wall_reactions FOR DELETE USING (auth.uid() = user_id);

SELECT 'Communities schema created ✅' AS result;
