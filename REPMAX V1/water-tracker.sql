-- ============================================
-- REPMAX — Water Tracker & Saved Meals Tables
-- ============================================

-- Water tracking
CREATE TABLE IF NOT EXISTS water_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  logged_at DATE NOT NULL DEFAULT CURRENT_DATE,
  glasses INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, logged_at)
);

ALTER TABLE water_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own water logs" ON water_logs;
CREATE POLICY "Users can manage own water logs"
  ON water_logs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Saved meals / templates
CREATE TABLE IF NOT EXISTS saved_meals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  food_name TEXT NOT NULL,
  brand TEXT DEFAULT '',
  serving_size TEXT DEFAULT '',
  calories REAL DEFAULT 0,
  protein REAL DEFAULT 0,
  carbs REAL DEFAULT 0,
  fat REAL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE saved_meals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own saved meals" ON saved_meals;
CREATE POLICY "Users can manage own saved meals"
  ON saved_meals FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Add avatar config columns to profiles if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'avatar_config') THEN
    ALTER TABLE profiles ADD COLUMN avatar_config JSONB;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'avatar_seed') THEN
    ALTER TABLE profiles ADD COLUMN avatar_seed TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'theme_color') THEN
    ALTER TABLE profiles ADD COLUMN theme_color TEXT DEFAULT 'green';
  END IF;
END $$;
