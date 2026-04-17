-- ============================================================
-- Claude AI daily usage limits — Run in Supabase SQL Editor
-- ============================================================
-- Tracks daily Claude (Bedrock) message count per user.
-- PRO: 3 messages/day, ULTRA: 25 messages/day.
-- Safe to re-run.

-- 1. Create usage tracking table
CREATE TABLE IF NOT EXISTS claude_daily_usage (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_date date NOT NULL DEFAULT CURRENT_DATE,
  message_count int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, usage_date)
);

-- 2. Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_claude_daily_usage_lookup
  ON claude_daily_usage (user_id, usage_date);

-- 3. Enable RLS
ALTER TABLE claude_daily_usage ENABLE ROW LEVEL SECURITY;

-- 4. Service role can do everything (used by Vercel API)
DROP POLICY IF EXISTS "Service role full access" ON claude_daily_usage;
CREATE POLICY "Service role full access"
  ON claude_daily_usage FOR ALL
  USING (true)
  WITH CHECK (true);

-- 5. Users can read their own usage
DROP POLICY IF EXISTS "Users read own usage" ON claude_daily_usage;
CREATE POLICY "Users read own usage"
  ON claude_daily_usage FOR SELECT
  USING (auth.uid() = user_id);

-- 6. Done
SELECT 'Claude daily usage table created ✅' AS result;
