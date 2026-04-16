-- REPMAX multi-device push subscriptions
-- Run in Supabase SQL Editor when you're ready to move from one device per user
-- to one row on the profile that can hold multiple device subscriptions.

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS push_subscriptions jsonb DEFAULT '[]'::jsonb;

UPDATE profiles
SET push_subscriptions = jsonb_build_array(
  jsonb_build_object(
    'device_id', 'legacy-device',
    'endpoint', push_subscription->>'endpoint',
    'subscription', push_subscription,
    'updated_at', now()
  )
)
WHERE push_subscription IS NOT NULL
  AND (
    push_subscriptions IS NULL
    OR jsonb_typeof(push_subscriptions) <> 'array'
    OR jsonb_array_length(push_subscriptions) = 0
  );

ALTER TABLE profiles
ALTER COLUMN push_subscriptions SET DEFAULT '[]'::jsonb;
