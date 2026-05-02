-- ============================================
-- REPMAX — Fix Social Features + Nutrition Tables
-- Run this in Supabase SQL Editor
-- ============================================

-- ===== FIX 1: Allow friend code lookup =====
-- Users need to search OTHER users by friend_code
-- Current policy only allows viewing own profile
CREATE POLICY "Users can search by friend code"
  ON profiles FOR SELECT
  USING (true);
-- ^ This replaces the restrictive "own profile only" SELECT policy
-- The sensitive data (email) is not stored in profiles, so this is safe
-- Users can only UPDATE their own profile (existing policy)

-- Drop the old restrictive SELECT policy
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;

-- ===== FIX 2: Generate friend code on signup =====
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_friend_code TEXT;
BEGIN
  -- Generate unique 8-char friend code
  new_friend_code := upper(substr(md5(random()::text || NEW.id::text), 1, 8));
  
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
  RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Regenerate friend codes for users who don't have one
UPDATE profiles 
SET friend_code = upper(substr(md5(random()::text || id::text), 1, 8))
WHERE friend_code IS NULL OR friend_code = '';

-- ===== NUTRITION TABLES =====

-- User's nutrition profile (TDEE, goals, macros)
CREATE TABLE IF NOT EXISTS nutrition_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
  age INTEGER,
  weight REAL,
  height REAL,
  gender TEXT CHECK (gender IN ('male', 'female')),
  activity_level TEXT CHECK (activity_level IN ('sedentary', 'light', 'moderate', 'active', 'very_active')),
  diet_goal TEXT CHECK (diet_goal IN ('bulk', 'lean_bulk', 'maintain', 'cut', 'aggressive_cut')) DEFAULT 'maintain',
  bmr REAL,
  tdee REAL,
  target_calories REAL,
  target_protein REAL,
  target_carbs REAL,
  target_fat REAL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE nutrition_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own nutrition profile" ON nutrition_profiles FOR ALL
  USING (auth.uid() = user_id);

-- Daily food logs
CREATE TABLE IF NOT EXISTS food_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  food_name TEXT NOT NULL,
  brand TEXT,
  serving_size TEXT,
  quantity REAL DEFAULT 1,
  calories REAL NOT NULL DEFAULT 0,
  protein REAL DEFAULT 0,
  carbs REAL DEFAULT 0,
  fat REAL DEFAULT 0,
  fiber REAL DEFAULT 0,
  sugar REAL DEFAULT 0,
  meal_type TEXT CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')) DEFAULT 'snack',
  source TEXT CHECK (source IN ('manual', 'ai', 'search', 'photo')) DEFAULT 'manual',
  logged_at DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE food_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own food logs" ON food_logs FOR ALL
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_food_logs_user_date ON food_logs(user_id, logged_at);
CREATE INDEX IF NOT EXISTS idx_nutrition_profiles_user ON nutrition_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_friend_code ON profiles(friend_code);
