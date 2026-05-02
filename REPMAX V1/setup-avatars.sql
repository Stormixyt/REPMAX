-- 1. Ensure the profiles table has an image_url column
ALTER TABLE IF EXISTS "public"."profiles" 
ADD COLUMN IF NOT EXISTS "image_url" text;
ALTER TABLE IF EXISTS "public"."profiles"
ADD COLUMN IF NOT EXISTS "avatar_config" jsonb;
ALTER TABLE IF EXISTS "public"."profiles"
ADD COLUMN IF NOT EXISTS "avatar_seed" text;

-- 2. Create the avatars storage bucket
INSERT INTO "storage"."buckets" ("id", "name", "public", "file_size_limit", "allowed_mime_types")
VALUES ('avatars', 'avatars', true, 5242880, '{"image/jpeg", "image/png", "image/webp"}')
ON CONFLICT ("id") DO UPDATE SET 
  "public" = EXCLUDED."public",
  "file_size_limit" = EXCLUDED."file_size_limit",
  "allowed_mime_types" = EXCLUDED."allowed_mime_types";

DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON "storage"."objects";
DROP POLICY IF EXISTS "Users can upload their own avatar" ON "storage"."objects";
DROP POLICY IF EXISTS "Users can update their own avatar" ON "storage"."objects";
DROP POLICY IF EXISTS "Users can delete their own avatar" ON "storage"."objects";

-- 3. Policy: Anyone can view avatars
CREATE POLICY "Avatar images are publicly accessible"
ON "storage"."objects" FOR SELECT
USING ( bucket_id = 'avatars' );

-- 4. Policy: Users can upload their own avatar
CREATE POLICY "Users can upload their own avatar"
ON "storage"."objects" FOR INSERT
WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 5. Policy: Users can update their own avatar
CREATE POLICY "Users can update their own avatar"
ON "storage"."objects" FOR UPDATE
USING (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 6. Policy: Users can delete their own avatar
CREATE POLICY "Users can delete their own avatar"
ON "storage"."objects" FOR DELETE
USING (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);
