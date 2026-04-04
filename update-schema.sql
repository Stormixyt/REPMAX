-- Fix Message Updates (for Gym Invites)
CREATE POLICY "Users can update messages in their chats (for invites)"
  ON messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM chat_members 
      WHERE chat_members.chat_id = messages.chat_id 
      AND chat_members.user_id = auth.uid()
    )
  );

-- Fix Message Deletions
CREATE POLICY "Users can delete their own messages"
  ON messages FOR DELETE
  USING (auth.uid() = sender_id);

-- Storage bucket for avatars and custom images
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

CREATE POLICY "Avatar images are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatars"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own avatars"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own avatars"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- We also need to add 'image_url' and 'push_subscription' to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_subscription jsonb;

-- Database Webhook for Push Notifications
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

DROP TRIGGER IF EXISTS trigger_send_push ON messages;
CREATE TRIGGER trigger_send_push
AFTER INSERT ON messages
FOR EACH ROW EXECUTE FUNCTION notify_send_push();
