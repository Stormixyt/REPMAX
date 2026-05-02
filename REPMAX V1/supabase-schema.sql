-- ============================================
-- REPMAX — Supabase Database Schema
-- Run this in your Supabase SQL Editor:
-- Dashboard → SQL Editor → New Query → Paste → Run
-- ============================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===== PROFILES =====
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  experience_level TEXT CHECK (experience_level IN ('beginner', 'intermediate', 'advanced')),
  goal TEXT CHECK (goal IN ('strength', 'hypertrophy', 'athletic', 'general')),
  training_days TEXT[] DEFAULT '{}',
  preferred_split TEXT,
  equipment TEXT[] DEFAULT '{}',
  onboarded BOOLEAN DEFAULT false,
  pro_until TIMESTAMPTZ,
  total_workouts INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ===== PROGRAMS =====
CREATE TABLE IF NOT EXISTS programs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  split_type TEXT,
  total_weeks INTEGER DEFAULT 4,
  current_week INTEGER DEFAULT 1,
  program_data JSONB NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own programs" ON programs FOR ALL USING (auth.uid() = user_id);

-- ===== WORKOUTS =====
CREATE TABLE IF NOT EXISTS workouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  program_id UUID REFERENCES programs(id) ON DELETE SET NULL,
  day_name TEXT,
  week_number INTEGER,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  total_volume REAL DEFAULT 0,
  notes TEXT
);

ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own workouts" ON workouts FOR ALL USING (auth.uid() = user_id);

-- ===== SETS =====
CREATE TABLE IF NOT EXISTS sets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workout_id UUID REFERENCES workouts(id) ON DELETE CASCADE NOT NULL,
  exercise_name TEXT NOT NULL,
  set_number INTEGER NOT NULL,
  target_reps INTEGER,
  actual_reps INTEGER,
  target_weight REAL,
  actual_weight REAL,
  rpe REAL,
  completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE sets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own sets" ON sets FOR ALL
  USING (EXISTS (SELECT 1 FROM workouts WHERE workouts.id = sets.workout_id AND workouts.user_id = auth.uid()));

-- ===== PERSONAL RECORDS =====
CREATE TABLE IF NOT EXISTS personal_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  exercise_name TEXT NOT NULL,
  weight REAL NOT NULL,
  reps INTEGER NOT NULL,
  estimated_1rm REAL,
  achieved_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE personal_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own PRs" ON personal_records FOR ALL USING (auth.uid() = user_id);

-- ===== WAITLIST (for landing page) =====
CREATE TABLE IF NOT EXISTS waitlist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Waitlist is public insert, no select (privacy)
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can join waitlist" ON waitlist FOR INSERT WITH CHECK (true);
CREATE POLICY "Count only via function" ON waitlist FOR SELECT USING (false);

-- Function to get waitlist count without exposing emails
CREATE OR REPLACE FUNCTION get_waitlist_count()
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER FROM waitlist;
$$ LANGUAGE sql SECURITY DEFINER;

-- ===== FEEDBACK =====
CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5) NOT NULL,
  review_text TEXT,
  workouts_completed INTEGER,
  display_name TEXT,
  rewarded BOOLEAN DEFAULT false,
  approved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert own feedback" ON feedback FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own feedback" ON feedback FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Approved feedback is public" ON feedback FOR SELECT USING (approved = true);

-- ===== INDEXES =====
CREATE INDEX IF NOT EXISTS idx_workouts_user_id ON workouts(user_id);
CREATE INDEX IF NOT EXISTS idx_workouts_completed_at ON workouts(completed_at);
CREATE INDEX IF NOT EXISTS idx_sets_workout_id ON sets(workout_id);
CREATE INDEX IF NOT EXISTS idx_programs_user_active ON programs(user_id, active);
CREATE INDEX IF NOT EXISTS idx_personal_records_user ON personal_records(user_id, exercise_name);
