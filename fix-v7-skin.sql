-- ============================================================
-- Fix V7 Nocturne skin (ULTRA-only, REPMAX 2.0 Beta)
-- Run in Supabase SQL Editor
-- ============================================================
-- V7 is the apex ULTRA skin shipped with REPMAX 2.0 experimental
-- early access. Extend the CHECK constraint so updateProfile can
-- persist 'v7' for ULTRA members.
-- Safe to re-run.

-- 1. Drop old CHECK constraint
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_interface_skin_check;

-- 2. Add new CHECK constraint allowing 'v7'
ALTER TABLE profiles ADD CONSTRAINT profiles_interface_skin_check
  CHECK (interface_skin IN ('default', 'ultra-signature', 'v5', 'v6', 'v7'));

-- 3. Done
SELECT 'V7 Nocturne skin unlocked ✅' AS result;
