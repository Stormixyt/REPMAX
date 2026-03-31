-- ============================================
-- REPMAX — Definitive Social Fix
-- Run this in Supabase SQL Editor
-- This replaces ALL previous social fix files
-- ============================================

-- ===== STEP 1: Ensure friend_code column exists =====
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS friend_code TEXT;

-- Make sure it's unique (ignore if already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'profiles' AND indexname = 'idx_profiles_friend_code_unique'
  ) THEN
    CREATE UNIQUE INDEX idx_profiles_friend_code_unique ON profiles(friend_code)
      WHERE friend_code IS NOT NULL;
  END IF;
END$$;

-- Fast lookup index
CREATE INDEX IF NOT EXISTS idx_profiles_friend_code ON profiles(friend_code);

-- ===== STEP 2: Generate friend codes for ALL users who are missing one =====
UPDATE profiles
SET friend_code = upper(substr(md5(random()::text || id::text || now()::text), 1, 8))
WHERE friend_code IS NULL OR trim(friend_code) = '';

-- ===== STEP 3: Fix RLS SELECT policies on profiles =====
-- Drop every possible SELECT policy that may have been created across all SQL files
DROP POLICY IF EXISTS "Users can view own profile"                          ON profiles;
DROP POLICY IF EXISTS "Users can search by friend code"                    ON profiles;
DROP POLICY IF EXISTS "Profiles are viewable by all authenticated users"   ON profiles;
DROP POLICY IF EXISTS "Authenticated users can view profiles"              ON profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone"           ON profiles;
DROP POLICY IF EXISTS "Service role can do anything"                       ON profiles;

-- Create ONE clean, open SELECT policy for authenticated users
-- Profiles don't store emails or passwords — only display info — so this is safe
CREATE POLICY "Authenticated users can view all profiles"
  ON profiles FOR SELECT
  USING (auth.role() = 'authenticated');

-- ===== STEP 4: Make sure UPDATE and INSERT policies still exist =====
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ===== STEP 5: Fix the signup trigger to always generate a friend_code =====
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_friend_code TEXT;
  attempts        INTEGER := 0;
BEGIN
  -- Generate a unique 8-char friend code, retry up to 5 times on collision
  LOOP
    new_friend_code := upper(substr(md5(random()::text || NEW.id::text || clock_timestamp()::text), 1, 8));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE friend_code = new_friend_code);
    attempts := attempts + 1;
    EXIT WHEN attempts >= 5;
  END LOOP;

  INSERT INTO public.profiles (id, display_name, friend_code)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'display_name',
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    new_friend_code
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user failed for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===== STEP 6: Grant permissions so the trigger function can write =====
GRANT USAGE  ON SCHEMA public              TO supabase_auth_admin;
GRANT ALL    ON TABLE  public.profiles     TO supabase_auth_admin;

-- ===== STEP 7: Ensure friendships RLS is correct =====
-- Drop and recreate to make sure nothing is stale
DROP POLICY IF EXISTS "Users can see own friendships"      ON friendships;
DROP POLICY IF EXISTS "Users can send friend requests"     ON friendships;
DROP POLICY IF EXISTS "Users can update own friendships"   ON friendships;
DROP POLICY IF EXISTS "Users can delete own friendships"   ON friendships;

CREATE POLICY "Users can see own friendships"
  ON friendships FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can send friend requests"
  ON friendships FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own friendships"
  ON friendships FOR UPDATE
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can delete own friendships"
  ON friendships FOR DELETE
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- ===== VERIFICATION =====
-- After running, you can verify with:
-- SELECT id, display_name, friend_code FROM profiles ORDER BY created_at DESC LIMIT 20;
-- SELECT COUNT(*) FROM profiles WHERE friend_code IS NULL;  -- should be 0
