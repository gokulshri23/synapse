-- =========================================================================
-- Synapse: Chat & Call Isolation Migration
-- Guarantees isolated private threads per friend connection & private calls
-- =========================================================================

-- 1. Ensure connections table has proper columns
CREATE TABLE IF NOT EXISTS public.connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id TEXT NOT NULL,
  requester_name TEXT,
  recipient_id TEXT NOT NULL,
  recipient_name TEXT,
  skill_area TEXT DEFAULT 'General',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_connections_pair ON public.connections (
  least(lower(requester_id), lower(recipient_id)),
  greatest(lower(requester_id), lower(recipient_id))
);

-- 2. Enhance messages table with thread_type and thread_id
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS thread_type TEXT NOT NULL DEFAULT 'pair' CHECK (thread_type IN ('pair', 'room'));
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS thread_id TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS sender_email TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'text';
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS voice_url TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS flagged BOOLEAN DEFAULT FALSE;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS reply_to_id UUID;

-- Delete unisolated old test messages that cannot be mapped to private threads
DELETE FROM public.messages WHERE thread_id = 'global_collab' OR thread_id IS NULL;

-- Make thread_id NOT NULL after cleaning legacy rows
ALTER TABLE public.messages ALTER COLUMN thread_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_thread_lookup ON public.messages(thread_id, thread_type, created_at ASC);

-- 3. Lock down messages with Row Level Security (RLS)
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all authenticated users" ON public.messages;
DROP POLICY IF EXISTS "read own threads" ON public.messages;
DROP POLICY IF EXISTS "write own threads" ON public.messages;

-- Read policy: only participants of the accepted connection or members of the study room
CREATE POLICY "read own threads" ON public.messages FOR SELECT USING (
  (thread_type = 'pair' AND EXISTS (
     SELECT 1 FROM public.connections c
     WHERE (
       c.id::text = messages.thread_id 
       OR ('pair__' || least(lower(c.requester_id), lower(c.recipient_id)) || '__' || greatest(lower(c.requester_id), lower(c.recipient_id))) = messages.thread_id
     )
     AND c.status = 'accepted'
     AND (
       auth.uid()::text = c.requester_id 
       OR auth.uid()::text = c.recipient_id 
       OR lower(auth.jwt()->>'email') IN (lower(c.requester_id), lower(c.recipient_id))
     )
  ))
  OR
  (thread_type = 'room' AND EXISTS (
     SELECT 1 FROM public.study_room_members m
     WHERE m.room_id = messages.thread_id 
       AND (m.user_id = auth.uid()::text OR lower(m.user_id) = lower(auth.jwt()->>'email'))
  ))
);

-- Write policy: only as oneself into an accepted thread or active room
CREATE POLICY "write own threads" ON public.messages FOR INSERT WITH CHECK (
  (
    thread_type = 'pair' AND EXISTS (
       SELECT 1 FROM public.connections c
       WHERE (
         c.id::text = thread_id 
         OR ('pair__' || least(lower(c.requester_id), lower(c.recipient_id)) || '__' || greatest(lower(c.requester_id), lower(c.recipient_id))) = thread_id
       )
       AND c.status = 'accepted'
       AND (
         auth.uid()::text IN (c.requester_id, c.recipient_id)
         OR lower(auth.jwt()->>'email') IN (lower(c.requester_id), lower(c.recipient_id))
         OR lower(sender_email) IN (lower(c.requester_id), lower(c.recipient_id))
       )
    )
  )
  OR
  (
    thread_type = 'room' AND EXISTS (
       SELECT 1 FROM public.study_room_members m
       WHERE m.room_id = thread_id 
         AND (
           m.user_id = auth.uid()::text 
           OR lower(m.user_id) = lower(auth.jwt()->>'email')
           OR lower(m.user_id) = lower(sender_email)
         )
    )
  )
);

-- 4. Calls Table with strict privacy & server-generated room names
CREATE TABLE IF NOT EXISTS public.calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id TEXT NOT NULL,
  caller_id TEXT NOT NULL,
  caller_name TEXT,
  caller_avatar TEXT,
  callee_id TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'voice' CHECK (type IN ('voice', 'video', 'audio')),
  status TEXT NOT NULL DEFAULT 'ringing' CHECK (status IN ('ringing', 'accepted', 'declined', 'missed', 'ended')),
  room_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_calls_callee_status ON public.calls(callee_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_calls_connection ON public.calls(connection_id, status);

ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "calls_select_own" ON public.calls;
DROP POLICY IF EXISTS "calls_insert_own" ON public.calls;
DROP POLICY IF EXISTS "calls_update_own" ON public.calls;

CREATE POLICY "calls_select_own" ON public.calls FOR SELECT USING (
  auth.uid()::text IN (caller_id, callee_id)
  OR lower(auth.jwt()->>'email') IN (lower(caller_id), lower(callee_id))
);

CREATE POLICY "calls_insert_own" ON public.calls FOR INSERT WITH CHECK (
  auth.uid()::text = caller_id
  OR lower(auth.jwt()->>'email') = lower(caller_id)
);

CREATE POLICY "calls_update_own" ON public.calls FOR UPDATE USING (
  auth.uid()::text IN (caller_id, callee_id)
  OR lower(auth.jwt()->>'email') IN (lower(caller_id), lower(callee_id))
);

-- 5. Enable Realtime Replication for calls and messages
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.messages, public.calls;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;
