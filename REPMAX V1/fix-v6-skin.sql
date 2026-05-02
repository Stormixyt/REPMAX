-- ============================================================
-- Fix V6 Aurora skin (ULTRA-only) — Run in Supabase SQL Editor
-- ============================================================
-- V6 is the apex ULTRA skin. DB CHECK constraint currently rejects 'v6'
-- so updateProfile silently fails and skin never applies on reload.
-- This migration is safe to re-run.

-- 1. Drop old CHECK constraint that blocks 'v6'
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_interface_skin_check;

-- 2. Add new CHECK constraint allowing 'v6'
ALTER TABLE profiles ADD CONSTRAINT profiles_interface_skin_check
  CHECK (interface_skin IN ('default', 'ultra-signature', 'v5', 'v6'));

-- 3. Done
SELECT 'V6 Aurora skin unlocked ✅' AS result;
