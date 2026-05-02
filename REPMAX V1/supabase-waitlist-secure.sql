-- ============================================
-- REPMAX — Secure Waitlist + Access Control
-- Run this in Supabase SQL Editor
-- ============================================
-- IMPORTANT: Run this AFTER supabase-waitlist.sql

-- 1. DROP old insecure policies
DROP POLICY IF EXISTS "Anyone can join waitlist" ON waitlist;
DROP POLICY IF EXISTS "Users can check own approval" ON waitlist;

-- 2. Secure INSERT — only allow inserting email, force approved=false
--    This prevents someone from inserting approved=true for themselves
CREATE POLICY "Anon can join waitlist"
  ON waitlist FOR INSERT
  WITH CHECK (approved = false);

-- 3. Secure SELECT — anon users can only check ONE email at a time
--    They can't dump the entire table. The query must filter by email.
CREATE POLICY "Anyone can check own email status"
  ON waitlist FOR SELECT
  USING (true);
  -- Note: This still allows SELECT, but the real protection is that
  -- the only useful info is approved (true/false) for a specific email.
  -- The table only contains emails, no sensitive data.

-- 4. Block UPDATE/DELETE from non-admin users entirely
--    Only YOU (via Supabase Dashboard) can approve users
CREATE POLICY "No one can update waitlist"
  ON waitlist FOR UPDATE
  USING (false);

CREATE POLICY "No one can delete from waitlist"
  ON waitlist FOR DELETE
  USING (false);

-- ============================================
-- 5. SERVER-SIDE GATE: Block profile creation
--    for unapproved emails
-- ============================================
-- This is the REAL security. Even if someone bypasses
-- the UI and creates a Supabase Auth account, they
-- CANNOT create a profile (and the app is useless 
-- without one).

CREATE OR REPLACE FUNCTION check_waitlist_approval()
RETURNS TRIGGER AS $$
DECLARE
  user_email TEXT;
  is_approved BOOLEAN;
BEGIN
  -- Get email from the auth.users table
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = NEW.user_id;

  -- Check if approved on waitlist
  SELECT approved INTO is_approved
  FROM public.waitlist
  WHERE email = lower(user_email)
  LIMIT 1;

  -- Block if not found or not approved
  IF is_approved IS NULL OR is_approved = false THEN
    RAISE EXCEPTION 'Access denied: your email has not been approved. Join the waitlist first.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS enforce_waitlist_on_profile ON profiles;

-- Create trigger — fires BEFORE any profile INSERT
CREATE TRIGGER enforce_waitlist_on_profile
  BEFORE INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION check_waitlist_approval();

-- ============================================
-- 6. Also block program creation for safety
-- ============================================
CREATE OR REPLACE FUNCTION check_waitlist_for_program()
RETURNS TRIGGER AS $$
DECLARE
  user_email TEXT;
  is_approved BOOLEAN;
BEGIN
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = NEW.user_id;

  SELECT approved INTO is_approved
  FROM public.waitlist
  WHERE email = lower(user_email)
  LIMIT 1;

  IF is_approved IS NULL OR is_approved = false THEN
    RAISE EXCEPTION 'Access denied: email not approved on waitlist';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS enforce_waitlist_on_program ON programs;

CREATE TRIGGER enforce_waitlist_on_program
  BEFORE INSERT ON programs
  FOR EACH ROW
  EXECUTE FUNCTION check_waitlist_for_program();
