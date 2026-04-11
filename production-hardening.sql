-- ============================================================
-- REPMAX Production Hardening — Run this in Supabase SQL Editor
-- ============================================================

-- ===== 1. Profile columns for subscriptions, admin, units, learning =====
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_tier text DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro', 'ultra'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pro_request_status text DEFAULT NULL CHECK (pro_request_status IN (NULL, 'pending', 'approved', 'rejected'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pro_requested_at timestamptz DEFAULT NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pro_approved_by uuid DEFAULT NULL REFERENCES profiles(id);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pro_rejection_reason text DEFAULT NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS unit_preference text DEFAULT 'kg' CHECK (unit_preference IN ('kg', 'lbs'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS interface_skin text DEFAULT 'default' CHECK (interface_skin IN ('default', 'ultra-signature'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_type text DEFAULT NULL CHECK (onboarding_type IN ('quick', 'advanced'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS learned_preferences jsonb DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS workouts_since_last_learn int DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS height_cm numeric DEFAULT NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS weight_kg numeric DEFAULT NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS age int DEFAULT NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS injuries text[] DEFAULT '{}';

-- ===== 2. Set admin user =====
UPDATE profiles SET is_admin = true 
WHERE id IN (
  SELECT id FROM auth.users WHERE email = 'nassimchahman8@gmail.com'
);

-- ===== 3. PRO/ULTRA request audit trail =====
CREATE TABLE IF NOT EXISTS subscription_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  requested_tier text NOT NULL CHECK (requested_tier IN ('pro', 'ultra')),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reason text DEFAULT NULL,
  reviewed_by uuid DEFAULT NULL REFERENCES profiles(id),
  reviewed_at timestamptz DEFAULT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE subscription_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see own requests" ON subscription_requests
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create requests" ON subscription_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can see all requests" ON subscription_requests
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Admins can update requests" ON subscription_requests
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- ===== 4. RLS on profiles =====
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users read own profile
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
CREATE POLICY "Users can read own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- Users can read other profiles for social (limited)
DROP POLICY IF EXISTS "Users can read public profiles" ON profiles;
CREATE POLICY "Users can read public profiles" ON profiles
  FOR SELECT USING (true);

-- Users update own profile
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Admin can update any profile
DROP POLICY IF EXISTS "Admins can update any profile" ON profiles;
CREATE POLICY "Admins can update any profile" ON profiles
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- ===== 5. RLS on workouts =====
ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users own workouts" ON workouts;
CREATE POLICY "Users own workouts" ON workouts
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins read all workouts" ON workouts;
CREATE POLICY "Admins read all workouts" ON workouts
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- ===== 6. RLS on personal_records =====
ALTER TABLE personal_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users own PRs" ON personal_records;
CREATE POLICY "Users own PRs" ON personal_records
  FOR ALL USING (auth.uid() = user_id);

-- ===== 7. RLS on notifications =====
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users own notifications" ON notifications;
CREATE POLICY "Users own notifications" ON notifications
  FOR ALL USING (auth.uid() = user_id);

-- ===== 8. Admin analytics views =====
CREATE OR REPLACE VIEW admin_stats AS
SELECT
  (SELECT count(*) FROM profiles) AS total_users,
  (SELECT count(*) FROM profiles WHERE created_at > now() - interval '7 days') AS new_users_7d,
  (SELECT count(*) FROM profiles WHERE updated_at > now() - interval '7 days') AS active_users_7d,
  (SELECT count(*) FROM workouts WHERE completed_at IS NOT NULL) AS total_workouts,
  (SELECT count(*) FROM workouts WHERE completed_at > now() - interval '7 days') AS workouts_7d,
  (SELECT count(*) FROM profiles WHERE subscription_tier = 'pro') AS pro_users,
  (SELECT count(*) FROM profiles WHERE subscription_tier = 'ultra') AS ultra_users,
  (SELECT count(*) FROM subscription_requests WHERE status = 'pending') AS pending_requests,
  (SELECT avg(w.duration_seconds / 60.0) FROM workouts w WHERE w.completed_at IS NOT NULL AND w.completed_at > now() - interval '30 days') AS avg_session_minutes;

-- Grant admin view access
DROP POLICY IF EXISTS "Admin stats access" ON profiles;
-- Views don't have RLS, the underlying tables do. Admin will query via service or the view.

SELECT 'REPMAX Production Schema Applied ✅' AS result;
