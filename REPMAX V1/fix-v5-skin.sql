-- ============================================================
-- Fix V5 skin + Realtime — Run this in Supabase SQL Editor
-- ============================================================

-- 1. Drop the old CHECK constraint that blocks 'v5'
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_interface_skin_check;

-- 2. Add new CHECK constraint allowing 'v5'
ALTER TABLE profiles ADD CONSTRAINT profiles_interface_skin_check 
  CHECK (interface_skin IN ('default', 'ultra-signature', 'v5'));

-- 3. Add profile customization columns for ULTRA users
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio text DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS status_emoji text DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_badge text DEFAULT '';

-- 4. Enable Realtime on notifications table
ALTER TABLE notifications REPLICA IDENTITY FULL;

-- 5. Add notifications to Realtime publication
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- 6. Done
SELECT 'V5 skin + Realtime notifications fixed ✅' AS result;
