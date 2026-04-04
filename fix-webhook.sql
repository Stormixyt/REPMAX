-- 0. Ensure HTTP requests are enabled
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 1. Drop the old trigger/function
DROP TRIGGER IF EXISTS trigger_send_push ON messages;
DROP FUNCTION IF EXISTS notify_send_push CASCADE;

-- 2. Create the fixed function using pg_net
CREATE OR REPLACE FUNCTION notify_send_push()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM net.http_post(
    'https://hqwnyzmipumhhqmvdzus.supabase.co/functions/v1/send-push',
    jsonb_build_object('record', row_to_json(NEW)),
    null,
    jsonb_build_object('Content-Type', 'application/json')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Re-attach the trigger
CREATE TRIGGER trigger_send_push
AFTER INSERT ON messages
FOR EACH ROW EXECUTE FUNCTION notify_send_push();
