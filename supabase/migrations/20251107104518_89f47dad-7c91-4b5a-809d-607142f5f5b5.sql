-- Drop the existing restrictive policy for joining chats
DROP POLICY IF EXISTS "Users can join chats" ON chat_participants;

-- Create a new policy that allows users to be added to direct message rooms
-- Users can join if:
-- 1. They are adding themselves (auth.uid() = user_id) AND
-- 2. Either it's an open/campus room, OR they have access, OR the room creator is adding them to a direct room
CREATE POLICY "Users can join chats"
ON chat_participants
FOR INSERT
WITH CHECK (
  (auth.uid() = user_id) AND 
  (
    is_open_or_campus_room(chat_room_id) OR 
    user_can_access_chat_room(auth.uid(), chat_room_id) OR
    EXISTS (
      SELECT 1 FROM chat_rooms 
      WHERE id = chat_room_id 
      AND type = 'direct' 
      AND created_by = auth.uid()
    )
  )
);

-- Also allow the room creator to add other users to direct rooms they created
CREATE POLICY "Room creators can add participants to their direct rooms"
ON chat_participants
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM chat_rooms 
    WHERE id = chat_room_id 
    AND type = 'direct' 
    AND created_by = auth.uid()
  )
);