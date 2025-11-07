
-- Migration: 20251106152053

-- Migration: 20251105142425

-- Migration: 20251105101358

-- Migration: 20251104065638
-- Step 1: Create all tables first (without policies)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  department TEXT NOT NULL,
  soft_skills TEXT[] DEFAULT '{}',
  technical_skills TEXT[] DEFAULT '{}',
  achievements TEXT[] DEFAULT '{}',
  bio TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  receiver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  status TEXT CHECK (status IN ('pending', 'accepted', 'rejected')) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(requester_id, receiver_id)
);

CREATE TABLE IF NOT EXISTS public.chat_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  type TEXT CHECK (type IN ('campus', 'direct')) NOT NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chat_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_room_id UUID REFERENCES public.chat_rooms(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(chat_room_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_room_id UUID REFERENCES public.chat_rooms(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  file_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Step 2: Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Step 3: Create all policies (now all tables exist)
-- Profiles policies
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;
CREATE POLICY "Profiles are viewable by authenticated users"
ON public.profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Connections policies
DROP POLICY IF EXISTS "Users can view their connections" ON public.connections;
CREATE POLICY "Users can view their connections"
ON public.connections FOR SELECT TO authenticated 
USING (auth.uid() = requester_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "Users can create connections" ON public.connections;
CREATE POLICY "Users can create connections"
ON public.connections FOR INSERT TO authenticated WITH CHECK (auth.uid() = requester_id);

DROP POLICY IF EXISTS "Users can update their connections" ON public.connections;
CREATE POLICY "Users can update their connections"
ON public.connections FOR UPDATE TO authenticated 
USING (auth.uid() = requester_id OR auth.uid() = receiver_id);

-- Chat rooms policies  
DROP POLICY IF EXISTS "Campus chat viewable" ON public.chat_rooms;
CREATE POLICY "Campus chat viewable"
ON public.chat_rooms FOR SELECT TO authenticated
USING (
  type = 'campus' OR 
  EXISTS (SELECT 1 FROM public.chat_participants WHERE chat_room_id = id AND user_id = auth.uid())
);

DROP POLICY IF EXISTS "Users can create chat rooms" ON public.chat_rooms;
CREATE POLICY "Users can create chat rooms"
ON public.chat_rooms FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

-- Chat participants policies
DROP POLICY IF EXISTS "Users can view chat participants" ON public.chat_participants;
CREATE POLICY "Users can view chat participants"
ON public.chat_participants FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.chat_rooms WHERE id = chat_room_id AND type = 'campus') OR
  EXISTS (SELECT 1 FROM public.chat_participants cp WHERE cp.chat_room_id = chat_participants.chat_room_id AND cp.user_id = auth.uid())
);

DROP POLICY IF EXISTS "Users can join chats" ON public.chat_participants;
CREATE POLICY "Users can join chats"
ON public.chat_participants FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Messages policies
DROP POLICY IF EXISTS "Users can view messages" ON public.messages;
CREATE POLICY "Users can view messages"
ON public.messages FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.chat_rooms WHERE id = chat_room_id AND type = 'campus') OR
  EXISTS (SELECT 1 FROM public.chat_participants WHERE chat_room_id = messages.chat_room_id AND user_id = auth.uid())
);

DROP POLICY IF EXISTS "Users can send messages" ON public.messages;
CREATE POLICY "Users can send messages"
ON public.messages FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = sender_id AND (
    EXISTS (SELECT 1 FROM public.chat_rooms WHERE id = chat_room_id AND type = 'campus') OR
    EXISTS (SELECT 1 FROM public.chat_participants WHERE chat_room_id = messages.chat_room_id AND user_id = auth.uid())
  )
);

-- Step 4: Create functions and triggers
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, department)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.email, COALESCE(NEW.raw_user_meta_data->>'department', ''));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_connections_updated_at ON public.connections;
CREATE TRIGGER update_connections_updated_at BEFORE UPDATE ON public.connections
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Step 5: Enable realtime and seed data
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'messages') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
END $$;

INSERT INTO public.chat_rooms (name, type, created_by)
SELECT 'Campus General Chat', 'campus', NULL
WHERE NOT EXISTS (SELECT 1 FROM public.chat_rooms WHERE type = 'campus');

-- Migration: 20251104065723
-- Fix function search path security warning
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


-- Migration: 20251105101429
-- Create avatars storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true);

-- Create storage policies for avatars
CREATE POLICY "Avatar images are publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own avatar"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own avatar"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Migration: 20251105110449
-- Create message read receipts table
CREATE TABLE public.message_reads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  read_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id)
);

-- Enable RLS on message_reads
ALTER TABLE public.message_reads ENABLE ROW LEVEL SECURITY;

-- Users can view read receipts for their messages
CREATE POLICY "Users can view read receipts for accessible messages"
ON public.message_reads
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.messages m
    JOIN public.chat_participants cp ON cp.chat_room_id = m.chat_room_id
    WHERE m.id = message_reads.message_id
    AND cp.user_id = auth.uid()
  )
);

-- Users can create read receipts
CREATE POLICY "Users can mark messages as read"
ON public.message_reads
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Enable realtime for message_reads only (messages already enabled)
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reads;

-- Function to create direct message chat room when connection is accepted
CREATE OR REPLACE FUNCTION public.create_dm_chat_room()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  room_id UUID;
BEGIN
  -- Only create chat room when connection is accepted
  IF NEW.status = 'accepted' AND (OLD.status IS NULL OR OLD.status != 'accepted') THEN
    -- Create a direct message chat room
    INSERT INTO public.chat_rooms (type, created_by)
    VALUES ('direct', NEW.requester_id)
    RETURNING id INTO room_id;
    
    -- Add both users as participants
    INSERT INTO public.chat_participants (chat_room_id, user_id)
    VALUES 
      (room_id, NEW.requester_id),
      (room_id, NEW.receiver_id);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger to auto-create DM chat rooms
CREATE TRIGGER on_connection_accepted
  AFTER UPDATE ON public.connections
  FOR EACH ROW
  EXECUTE FUNCTION public.create_dm_chat_room();



-- Migration: 20251106152541
-- Create a private bucket for chat attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-attachments', 'chat-attachments', false);

-- Policy: Users can upload chat files to their own folder
CREATE POLICY "Users can upload chat files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat-attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Users can only access files from chats they're in
CREATE POLICY "Users can access chat files from their rooms"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'chat-attachments'
  AND EXISTS (
    SELECT 1 FROM public.messages m
    JOIN public.chat_participants cp ON cp.chat_room_id = m.chat_room_id
    WHERE m.file_url LIKE '%' || name || '%'
    AND cp.user_id = auth.uid()
  )
);

-- Policy: Users can update their own uploaded files
CREATE POLICY "Users can update their own chat files"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'chat-attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Users can delete their own uploaded files
CREATE POLICY "Users can delete their own chat files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'chat-attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Migration: 20251106154651
-- Update chat_rooms policies to support 'open' type rooms
DROP POLICY IF EXISTS "Campus chat viewable" ON public.chat_rooms;
DROP POLICY IF EXISTS "Users can create chat rooms" ON public.chat_rooms;

CREATE POLICY "Users can view their chat rooms"
ON public.chat_rooms
FOR SELECT
USING (
  type = 'campus' OR 
  type = 'open' OR
  EXISTS (
    SELECT 1 FROM chat_participants
    WHERE chat_participants.chat_room_id = chat_rooms.id
    AND chat_participants.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create chat rooms"
ON public.chat_rooms
FOR INSERT
WITH CHECK (auth.uid() = created_by);

-- Update messages policies to support 'open' type rooms
DROP POLICY IF EXISTS "Users can send messages" ON public.messages;
DROP POLICY IF EXISTS "Users can view messages" ON public.messages;

CREATE POLICY "Users can view messages in accessible rooms"
ON public.messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM chat_rooms
    WHERE chat_rooms.id = messages.chat_room_id
    AND (chat_rooms.type = 'campus' OR chat_rooms.type = 'open')
  ) OR
  EXISTS (
    SELECT 1 FROM chat_participants
    WHERE chat_participants.chat_room_id = messages.chat_room_id
    AND chat_participants.user_id = auth.uid()
  )
);

CREATE POLICY "Users can send messages in accessible rooms"
ON public.messages
FOR INSERT
WITH CHECK (
  auth.uid() = sender_id AND (
    EXISTS (
      SELECT 1 FROM chat_rooms
      WHERE chat_rooms.id = messages.chat_room_id
      AND (chat_rooms.type = 'campus' OR chat_rooms.type = 'open')
    ) OR
    EXISTS (
      SELECT 1 FROM chat_participants
      WHERE chat_participants.chat_room_id = messages.chat_room_id
      AND chat_participants.user_id = auth.uid()
    )
  )
);

-- Update chat_participants policies
DROP POLICY IF EXISTS "Users can view chat participants" ON public.chat_participants;
DROP POLICY IF EXISTS "Users can join chats" ON public.chat_participants;

CREATE POLICY "Users can view chat participants in accessible rooms"
ON public.chat_participants
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM chat_rooms
    WHERE chat_rooms.id = chat_participants.chat_room_id
    AND (chat_rooms.type = 'campus' OR chat_rooms.type = 'open')
  ) OR
  EXISTS (
    SELECT 1 FROM chat_participants cp
    WHERE cp.chat_room_id = chat_participants.chat_room_id
    AND cp.user_id = auth.uid()
  )
);

CREATE POLICY "Users can join accessible chats"
ON public.chat_participants
FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND (
    EXISTS (
      SELECT 1 FROM chat_rooms
      WHERE chat_rooms.id = chat_participants.chat_room_id
      AND (chat_rooms.type = 'campus' OR chat_rooms.type = 'open')
    ) OR
    EXISTS (
      SELECT 1 FROM chat_participants cp
      WHERE cp.chat_room_id = chat_participants.chat_room_id
      AND cp.user_id = auth.uid()
    )
  )
);

-- Migration: 20251107021118
-- Drop existing policies first
DROP POLICY IF EXISTS "Users can view their chat rooms" ON public.chat_rooms;
DROP POLICY IF EXISTS "Campus chat viewable" ON public.chat_rooms;
DROP POLICY IF EXISTS "Users can create chat rooms" ON public.chat_rooms;

DROP POLICY IF EXISTS "Users can view messages in accessible rooms" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages in accessible rooms" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages" ON public.messages;
DROP POLICY IF EXISTS "Users can view messages" ON public.messages;

DROP POLICY IF EXISTS "Users can view chat participants in accessible rooms" ON public.chat_participants;
DROP POLICY IF EXISTS "Users can join accessible chats" ON public.chat_participants;
DROP POLICY IF EXISTS "Users can view chat participants" ON public.chat_participants;
DROP POLICY IF EXISTS "Users can join chats" ON public.chat_participants;

-- Create new policies for chat_rooms
CREATE POLICY "Users can view accessible chat rooms"
ON public.chat_rooms
FOR SELECT
USING (
  type = 'campus' OR 
  type = 'open' OR
  EXISTS (
    SELECT 1 FROM chat_participants
    WHERE chat_participants.chat_room_id = chat_rooms.id
    AND chat_participants.user_id = auth.uid()
  )
);

CREATE POLICY "Authenticated users can create chat rooms"
ON public.chat_rooms
FOR INSERT
WITH CHECK (auth.uid() = created_by);

-- Create new policies for messages
CREATE POLICY "Users can view accessible messages"
ON public.messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM chat_rooms
    WHERE chat_rooms.id = messages.chat_room_id
    AND (chat_rooms.type = 'campus' OR chat_rooms.type = 'open')
  ) OR
  EXISTS (
    SELECT 1 FROM chat_participants
    WHERE chat_participants.chat_room_id = messages.chat_room_id
    AND chat_participants.user_id = auth.uid()
  )
);

CREATE POLICY "Users can send messages to accessible rooms"
ON public.messages
FOR INSERT
WITH CHECK (
  auth.uid() = sender_id AND (
    EXISTS (
      SELECT 1 FROM chat_rooms
      WHERE chat_rooms.id = messages.chat_room_id
      AND (chat_rooms.type = 'campus' OR chat_rooms.type = 'open')
    ) OR
    EXISTS (
      SELECT 1 FROM chat_participants
      WHERE chat_participants.chat_room_id = messages.chat_room_id
      AND chat_participants.user_id = auth.uid()
    )
  )
);

-- Create new policies for chat_participants
CREATE POLICY "Users can view participants in accessible rooms"
ON public.chat_participants
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM chat_rooms
    WHERE chat_rooms.id = chat_participants.chat_room_id
    AND (chat_rooms.type = 'campus' OR chat_rooms.type = 'open')
  ) OR
  EXISTS (
    SELECT 1 FROM chat_participants cp
    WHERE cp.chat_room_id = chat_participants.chat_room_id
    AND cp.user_id = auth.uid()
  )
);

CREATE POLICY "Users can join open and campus chats"
ON public.chat_participants
FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND (
    EXISTS (
      SELECT 1 FROM chat_rooms
      WHERE chat_rooms.id = chat_participants.chat_room_id
      AND (chat_rooms.type = 'campus' OR chat_rooms.type = 'open')
    ) OR
    EXISTS (
      SELECT 1 FROM chat_participants cp
      WHERE cp.chat_room_id = chat_participants.chat_room_id
      AND cp.user_id = auth.uid()
    )
  )
);

-- Migration: 20251107022232
-- Drop all existing policies that cause recursion
DROP POLICY IF EXISTS "Users can view accessible chat rooms" ON public.chat_rooms;
DROP POLICY IF EXISTS "Authenticated users can create chat rooms" ON public.chat_rooms;
DROP POLICY IF EXISTS "Users can view accessible messages" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages to accessible rooms" ON public.messages;
DROP POLICY IF EXISTS "Users can view participants in accessible rooms" ON public.chat_participants;
DROP POLICY IF EXISTS "Users can join open and campus chats" ON public.chat_participants;

-- Create security definer functions to avoid recursion
CREATE OR REPLACE FUNCTION public.user_can_access_chat_room(_user_id uuid, _room_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM chat_participants
    WHERE chat_room_id = _room_id
    AND user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_open_or_campus_room(_room_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM chat_rooms
    WHERE id = _room_id
    AND type IN ('campus', 'open')
  );
$$;

-- Create simple, non-recursive policies for chat_rooms
CREATE POLICY "Users can view their accessible chat rooms"
ON public.chat_rooms
FOR SELECT
USING (
  type IN ('campus', 'open') OR
  public.user_can_access_chat_room(auth.uid(), id)
);

CREATE POLICY "Users can create chat rooms"
ON public.chat_rooms
FOR INSERT
WITH CHECK (auth.uid() = created_by);

-- Create simple policies for messages
CREATE POLICY "Users can view messages"
ON public.messages
FOR SELECT
USING (
  public.is_open_or_campus_room(chat_room_id) OR
  public.user_can_access_chat_room(auth.uid(), chat_room_id)
);

CREATE POLICY "Users can send messages"
ON public.messages
FOR INSERT
WITH CHECK (
  auth.uid() = sender_id AND (
    public.is_open_or_campus_room(chat_room_id) OR
    public.user_can_access_chat_room(auth.uid(), chat_room_id)
  )
);

-- Create simple policies for chat_participants
CREATE POLICY "Users can view participants"
ON public.chat_participants
FOR SELECT
USING (
  public.is_open_or_campus_room(chat_room_id) OR
  public.user_can_access_chat_room(auth.uid(), chat_room_id)
);

CREATE POLICY "Users can join chats"
ON public.chat_participants
FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND (
    public.is_open_or_campus_room(chat_room_id) OR
    public.user_can_access_chat_room(auth.uid(), chat_room_id)
  )
);
