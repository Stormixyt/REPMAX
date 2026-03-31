-- ========================================================
-- REPMAX HOTFIX: Message Deletions
-- RUN THIS IN YOUR SUPABASE SQL EDITOR
-- ========================================================

-- Grant users the ability to delete their OWN messages
DROP POLICY IF EXISTS "Users can delete their own messages" ON messages;
CREATE POLICY "Users can delete their own messages" ON messages FOR DELETE
  USING (auth.uid() = sender_id);
