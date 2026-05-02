-- REPMAX V4 Migration
-- Run this ENTIRE script in your Supabase SQL Editor

-- 1. Add username column (unique, max 15 chars, lowercase/numbers/underscores)
ALTER TABLE IF EXISTS "public"."profiles"
ADD COLUMN IF NOT EXISTS "username" text;

ALTER TABLE IF EXISTS "public"."profiles"
ADD COLUMN IF NOT EXISTS "bio" text DEFAULT '';

ALTER TABLE IF EXISTS "public"."profiles"
ADD COLUMN IF NOT EXISTS "favorite_lift" text DEFAULT '';

ALTER TABLE IF EXISTS "public"."profiles"
ADD COLUMN IF NOT EXISTS "status_emoji" text DEFAULT '';

ALTER TABLE IF EXISTS "public"."profiles"
ADD COLUMN IF NOT EXISTS "status_text" text DEFAULT '';

ALTER TABLE IF EXISTS "public"."profiles"
ADD COLUMN IF NOT EXISTS "badges" jsonb DEFAULT '[]'::jsonb;

ALTER TABLE IF EXISTS "public"."profiles"
ADD COLUMN IF NOT EXISTS "image_url" text;

-- 2. Unique index on username (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique 
ON "public"."profiles" (lower(username));

-- 3. Check constraint: username must be 1-15 chars, lowercase alphanumeric + underscores
-- (we enforce this in the frontend too, but belt-and-suspenders)
DO $$ BEGIN
  ALTER TABLE "public"."profiles" 
    ADD CONSTRAINT username_format CHECK (
      username IS NULL OR (
        char_length(username) >= 1 AND 
        char_length(username) <= 15 AND 
        username ~ '^[a-z0-9_]+$'
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4. Message reactions table
CREATE TABLE IF NOT EXISTS "public"."message_reactions" (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id uuid REFERENCES messages(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  is_super boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);

ALTER TABLE "public"."message_reactions" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all reactions"
  ON message_reactions FOR SELECT USING (true);

CREATE POLICY "Users can add reactions"
  ON message_reactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their reactions"
  ON message_reactions FOR DELETE
  USING (auth.uid() = user_id);

-- 5. Enable realtime on reactions table
ALTER PUBLICATION supabase_realtime ADD TABLE message_reactions;
