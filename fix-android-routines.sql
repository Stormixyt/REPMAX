-- ============================================
-- REPMAX — Fix Android Routine Creation Issues
-- ============================================

-- Ensure programs table has proper RLS for all authenticated users
DO $$
BEGIN
  -- Drop any overly restrictive policies
  DROP POLICY IF EXISTS "programs_insert_policy" ON programs;
  DROP POLICY IF EXISTS "programs_select_policy" ON programs;
  DROP POLICY IF EXISTS "programs_update_policy" ON programs;
  DROP POLICY IF EXISTS "programs_delete_policy" ON programs;
EXCEPTION WHEN undefined_table THEN
  -- programs table doesn't exist yet, skip
  NULL;
END $$;

-- Create permissive policies for the programs table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'programs') THEN
    -- Enable RLS
    ALTER TABLE programs ENABLE ROW LEVEL SECURITY;

    -- Users can view their own programs
    CREATE POLICY "Users can view own programs"
      ON programs FOR SELECT
      USING (auth.uid() = user_id);

    -- Users can insert their own programs
    CREATE POLICY "Users can insert own programs"
      ON programs FOR INSERT
      WITH CHECK (auth.uid() = user_id);

    -- Users can update their own programs
    CREATE POLICY "Users can update own programs"
      ON programs FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);

    -- Users can delete their own programs
    CREATE POLICY "Users can delete own programs"
      ON programs FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Similarly fix workouts and sets tables
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'workouts') THEN
    ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "workouts_crud" ON workouts;
    CREATE POLICY "workouts_crud"
      ON workouts FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sets') THEN
    ALTER TABLE sets ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "sets_crud" ON sets;
    CREATE POLICY "sets_crud"
      ON sets FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM workouts w WHERE w.id = sets.workout_id AND w.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM workouts w WHERE w.id = sets.workout_id AND w.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Fix any profile update issues (ensure all columns allow updates)
DO $$
BEGIN
  DROP POLICY IF EXISTS "profiles_update" ON profiles;
  CREATE POLICY "profiles_update"
    ON profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);
EXCEPTION WHEN undefined_table THEN
  NULL;
END $$;
