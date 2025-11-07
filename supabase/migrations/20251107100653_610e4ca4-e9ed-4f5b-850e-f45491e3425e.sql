-- Add DELETE policies for user data control

-- Allow users to delete their own messages
CREATE POLICY "Users can delete own messages"
ON messages FOR DELETE
USING (auth.uid() = sender_id);

-- Allow users to leave chat rooms
CREATE POLICY "Users can leave chats"
ON chat_participants FOR DELETE
USING (auth.uid() = user_id);

-- Allow connection deletion
CREATE POLICY "Users can remove connections"
ON connections FOR DELETE
USING (auth.uid() = requester_id OR auth.uid() = receiver_id);

-- Allow users to delete their own read receipts
CREATE POLICY "Users can delete read receipts"
ON message_reads FOR DELETE
USING (auth.uid() = user_id);