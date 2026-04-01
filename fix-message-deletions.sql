-- ========================================================
-- REPMAX HOTFIX: Message Deletions + Realtime
-- RUN THIS IN YOUR SUPABASE SQL EDITOR
-- ========================================================

-- Grant users the ability to delete their OWN messages
DROP POLICY IF EXISTS "Users can delete their own messages" ON messages;
CREATE POLICY "Users can delete their own messages" ON messages FOR DELETE
  USING (auth.uid() = sender_id);

-- Make sure ALL operations are allowed for message senders
DROP POLICY IF EXISTS "Users can insert messages" ON messages;
CREATE POLICY "Users can insert messages" ON messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Users can read chat messages" ON messages;
CREATE POLICY "Users can read chat messages" ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM chat_members cm WHERE cm.chat_id = messages.chat_id AND cm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update own messages" ON messages;
CREATE POLICY "Users can update own messages" ON messages FOR UPDATE
  USING (auth.uid() = sender_id)
  WITH CHECK (auth.uid() = sender_id);

-- Enable realtime for messages table so deletions propagate to all clients
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
