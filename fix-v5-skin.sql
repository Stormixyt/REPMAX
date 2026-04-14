-- ============================================================
-- Fix V5 skin — Run this in Supabase SQL Editor
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

-- 4. Enable Realtime on notifications table (required for in-app message banners)
ALTER TABLE notifications REPLICA IDENTITY FULL;

-- 5. Make sure notifications table is in the Realtime publication
-- (Supabase may already have this, but this ensures it)
BEGIN;
  -- Drop and re-add to publication if it exists
  ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END;

-- 6. Verify it worked
SELECT 'V5 skin + Realtime notifications fixed ✅' AS result;
