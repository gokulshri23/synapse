-- Migration SQL for Synapse
-- Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  skill_level TEXT,
  learning_goal TEXT,
  onboarding_complete BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Skills
CREATE TABLE IF NOT EXISTS public.skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  mastery_pct INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  status TEXT DEFAULT 'locked',
  parent_skill_id UUID REFERENCES public.skills(id) ON DELETE SET NULL,
  description TEXT,
  order_index INTEGER DEFAULT 0
);

-- Assessments
CREATE TABLE IF NOT EXISTS public.assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  skill_name TEXT NOT NULL,
  questions_json JSONB,
  answers_json JSONB,
  score INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Peer Matches
CREATE TABLE IF NOT EXISTS public.peer_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_b_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  compatibility_pct INTEGER DEFAULT 0,
  skill_area TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Sessions
CREATE TABLE IF NOT EXISTS public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID REFERENCES public.peer_matches(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  peer_name TEXT,
  peer_avatar TEXT,
  skill_area TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Messages
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  sender_name TEXT NOT NULL,
  sender_avatar TEXT,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Artifacts
CREATE TABLE IF NOT EXISTS public.artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  evaluation_json JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Reputation
CREATE TABLE IF NOT EXISTS public.reputation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  xp INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  badges JSONB DEFAULT '[]'::jsonb,
  mentor_status BOOLEAN DEFAULT FALSE,
  mentor_skills JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Daily Missions
CREATE TABLE IF NOT EXISTS public.daily_missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  xp_reward INTEGER DEFAULT 0,
  completed BOOLEAN DEFAULT FALSE,
  skill_name TEXT NOT NULL,
  date DATE DEFAULT CURRENT_DATE
);

-- Auto Profile Trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name');
  
  INSERT INTO public.reputation (user_id)
  VALUES (new.id);
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.peer_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reputation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_missions ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated for simplicity in demo
CREATE POLICY "Allow all authenticated users" ON public.profiles FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all authenticated users" ON public.skills FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all authenticated users" ON public.assessments FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all authenticated users" ON public.peer_matches FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all authenticated users" ON public.sessions FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all authenticated users" ON public.messages FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all authenticated users" ON public.artifacts FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all authenticated users" ON public.reputation FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all authenticated users" ON public.daily_missions FOR ALL TO authenticated USING (true);

-- =========================================================================
-- Finals Upgrade: New Tables
-- =========================================================================

-- Part A: Skill Declarations (replaces self-declared levels)
CREATE TABLE IF NOT EXISTS public.skill_declarations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  skill TEXT NOT NULL,
  intent TEXT NOT NULL CHECK (intent IN ('teach', 'learn')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
  verified_level INTEGER DEFAULT 0,
  quiz_score NUMERIC DEFAULT 0,
  attempt_count INTEGER DEFAULT 0,
  evidence_url TEXT,
  last_attempt_at TIMESTAMP WITH TIME ZONE,
  subtopic_scores JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Part B: Match Health Tracking
CREATE TABLE IF NOT EXISTS public.match_health (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id TEXT NOT NULL,
  learner_id TEXT NOT NULL,
  teacher_id TEXT NOT NULL,
  skill TEXT NOT NULL,
  session_number INTEGER DEFAULT 1,
  pre_score NUMERIC DEFAULT 0,
  post_score NUMERIC DEFAULT 0,
  delta NUMERIC DEFAULT 0,
  autonomous_action TEXT,
  action_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Part E: Network Gaps
CREATE TABLE IF NOT EXISTS public.network_gaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill TEXT NOT NULL,
  learner_ids JSONB DEFAULT '[]'::jsonb,
  resolved BOOLEAN DEFAULT FALSE,
  resolution TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Part H: Enhance messages table with new columns
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'text';
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS voice_url TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS flagged BOOLEAN DEFAULT FALSE;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS reply_to_id UUID;

-- RLS for new tables
ALTER TABLE public.skill_declarations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.network_gaps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all authenticated users" ON public.skill_declarations FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all authenticated users" ON public.match_health FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all authenticated users" ON public.network_gaps FOR ALL TO authenticated USING (true);

-- =========================================================================
-- Finals Prompt Part 2: New Tables & Strict Constraints
-- =========================================================================

-- Part 3: Roadmap Nodes with Single Unlocked Index
CREATE TABLE IF NOT EXISTS public.roadmap_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  skill TEXT NOT NULL,
  topic TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('locked', 'unlocked', 'completed')),
  entry_applied_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, skill, topic)
);

-- STRICT RULE: Only one unlocked node per skill per user!
CREATE UNIQUE INDEX IF NOT EXISTS idx_single_unlocked ON public.roadmap_nodes(user_id, skill) WHERE status = 'unlocked';

-- Part 1: Collaborative Hook Challenges
CREATE TABLE IF NOT EXISTS public.challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  topic TEXT NOT NULL,
  question TEXT NOT NULL,
  rubric JSONB NOT NULL,
  starter_code TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Part 1: Submissions (Unique per user per challenge)
CREATE TABLE IF NOT EXISTS public.submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID REFERENCES public.challenges(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  answer TEXT NOT NULL,
  score NUMERIC,
  feedback JSONB,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'evaluated', 'not_evaluated')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(challenge_id, user_id)
);

-- Part 2: Daily Assessments (One per user per day)
CREATE TABLE IF NOT EXISTS public.daily_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,
  topic TEXT NOT NULL,
  questions JSONB NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  score NUMERIC DEFAULT 0,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, date)
);

-- Part 5: Video Library & Effectiveness
CREATE TABLE IF NOT EXISTS public.video_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic TEXT NOT NULL,
  youtube_id TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'deprecated')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.video_effectiveness (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id TEXT NOT NULL,
  topic TEXT NOT NULL,
  attempts INTEGER DEFAULT 0,
  avg_score NUMERIC DEFAULT 0,
  total_score NUMERIC DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Part 7: Persistent Agent Activity Logs
CREATE TABLE IF NOT EXISTS public.agent_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent TEXT NOT NULL,
  action TEXT NOT NULL,
  reason TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for all new tables
ALTER TABLE public.roadmap_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_effectiveness ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all authenticated users" ON public.roadmap_nodes FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all authenticated users" ON public.challenges FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all authenticated users" ON public.submissions FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all authenticated users" ON public.daily_assessments FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all authenticated users" ON public.video_library FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all authenticated users" ON public.video_effectiveness FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all authenticated users" ON public.agent_activity_logs FOR ALL TO authenticated USING (true);

-- =========================================================================
--  Study Room ("Start Learning Session") DDL
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.study_rooms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  topic TEXT NOT NULL,
  host_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('pair', 'group')),
  max_participants INTEGER DEFAULT 6,
  status TEXT NOT NULL DEFAULT 'live' CHECK (status IN ('live', 'ended')),
  daily_room_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  ended_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.study_room_members (
  room_id TEXT REFERENCES public.study_rooms(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('host', 'member')),
  invited_by TEXT,
  PRIMARY KEY (room_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.room_resources (
  id TEXT PRIMARY KEY,
  room_id TEXT REFERENCES public.study_rooms(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('file', 'link')),
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.session_attendance (
  room_id TEXT REFERENCES public.study_rooms(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (room_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.reports (
  id TEXT PRIMARY KEY,
  reporter_id TEXT NOT NULL,
  reported_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.study_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated study_rooms" ON public.study_rooms FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated study_room_members" ON public.study_room_members FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated room_resources" ON public.room_resources FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated session_attendance" ON public.session_attendance FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated reports" ON public.reports FOR ALL TO authenticated USING (true);

-- =========================================================================
-- Bug Fix Migration: Connections, Skill Declarations & Realtime Publication
-- =========================================================================

-- Connections Table with Order-Independent Pair Uniqueness
CREATE TABLE IF NOT EXISTS public.connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id TEXT NOT NULL,
  requester_name TEXT,
  recipient_id TEXT NOT NULL,
  recipient_name TEXT,
  skill_area TEXT DEFAULT 'General',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Unique index ensuring no duplicate connection in either direction
CREATE UNIQUE INDEX IF NOT EXISTS idx_connections_pair ON public.connections (
  least(lower(requester_id), lower(recipient_id)),
  greatest(lower(requester_id), lower(recipient_id))
);

ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated connections" ON public.connections FOR ALL TO authenticated USING (true);

-- Enhance messages table with thread_id for permanent session/room/pair grouping
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS thread_id TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS sender_email TEXT;
ALTER TABLE public.messages ALTER COLUMN session_id DROP NOT NULL;
ALTER TABLE public.messages ALTER COLUMN user_id DROP NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_thread ON public.messages(thread_id, created_at ASC);

-- Skill Declarations Unique Constraint: (user_id, skill, intent)
CREATE UNIQUE INDEX IF NOT EXISTS idx_skill_declarations_unique ON public.skill_declarations(user_id, skill, intent);

-- Study Rooms Table for Live Collaborative Sessions
CREATE TABLE IF NOT EXISTS public.study_rooms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  topic TEXT NOT NULL,
  host_id TEXT NOT NULL,
  host_name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'group' CHECK (type IN ('group', 'pair', 'broadcast')),
  status TEXT NOT NULL DEFAULT 'live' CHECK (status IN ('waiting', 'live', 'ended')),
  max_participants INTEGER DEFAULT 6,
  member_count INTEGER DEFAULT 1,
  daily_room_name TEXT,
  daily_room_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  ended_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_study_rooms_status ON public.study_rooms(status, created_at DESC);

ALTER TABLE public.study_rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated study rooms" ON public.study_rooms FOR ALL TO authenticated USING (true);

-- Realtime Publication for live multi-device synchronization
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.messages, public.study_rooms, public.connections;
EXCEPTION WHEN OTHERS THEN
  -- Table already added to publication or publication already configured
  NULL;
END $$;

-- =========================================================================
-- Adaptive Engine v2 Schema (Sections 1 - 6)
-- =========================================================================

-- 1. Skill Topics (Generated once per skill by Planner)
CREATE TABLE IF NOT EXISTS public.skill_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill TEXT NOT NULL,
  topic TEXT NOT NULL,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(skill, topic)
);

CREATE INDEX IF NOT EXISTS idx_skill_topics_skill ON public.skill_topics(skill, order_index ASC);

-- 2. Topic Mastery (Per-user topic mastery tracking)
CREATE TABLE IF NOT EXISTS public.topic_mastery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  skill TEXT NOT NULL,
  topic TEXT NOT NULL,
  mastery REAL DEFAULT 0,
  answered INTEGER DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, skill, topic)
);

CREATE INDEX IF NOT EXISTS idx_topic_mastery_user ON public.topic_mastery(user_id, skill);

-- 3. Action History (Adaptive engine action memory per user & topic)
CREATE TABLE IF NOT EXISTS public.action_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  topic TEXT NOT NULL,
  action TEXT NOT NULL,
  tried_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  outcome TEXT NOT NULL DEFAULT 'pending' CHECK (outcome IN ('passed', 'failed', 'skipped', 'pending'))
);

CREATE INDEX IF NOT EXISTS idx_action_history_user_topic ON public.action_history(user_id, topic, tried_at DESC);

-- 4. Agent Decisions ("Why am I being recommended this?")
CREATE TABLE IF NOT EXISTS public.agent_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  action TEXT NOT NULL,
  reason_code TEXT NOT NULL,
  reason_text TEXT NOT NULL,
  evidence JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_decisions_user ON public.agent_decisions(user_id, created_at DESC);

-- 5. Session Summaries
CREATE TABLE IF NOT EXISTS public.session_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  topic TEXT NOT NULL,
  duration_minutes INTEGER DEFAULT 0,
  before_score REAL,
  after_score REAL,
  improvement REAL,
  next_recommendation JSONB DEFAULT '{}'::jsonb,
  ai_summary TEXT,
  ai_review TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_session_summaries_user ON public.session_summaries(user_id, created_at DESC);

-- 6. Teaching Stats
CREATE TABLE IF NOT EXISTS public.teaching_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  skill TEXT NOT NULL,
  sessions INTEGER DEFAULT 0,
  avg_improvement REAL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, skill)
);

-- 7. Video Library & Effectiveness
CREATE TABLE IF NOT EXISTS public.video_library (
  id TEXT PRIMARY KEY,
  topic TEXT NOT NULL,
  concept TEXT NOT NULL,
  youtube_id TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('approved', 'deprecated')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.video_effectiveness (
  video_id TEXT PRIMARY KEY,
  concept TEXT NOT NULL,
  attempts INTEGER DEFAULT 0,
  avg_score REAL DEFAULT 0,
  total_score REAL DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'deprecated')),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.skill_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topic_mastery ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teaching_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_effectiveness ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated skill_topics" ON public.skill_topics FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated topic_mastery" ON public.topic_mastery FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated action_history" ON public.action_history FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated agent_decisions" ON public.agent_decisions FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated session_summaries" ON public.session_summaries FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated teaching_stats" ON public.teaching_stats FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated video_library" ON public.video_library FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated video_effectiveness" ON public.video_effectiveness FOR ALL TO authenticated USING (true);

-- =========================================================================
-- Chat & Call Isolation Schema: Private Threads & Dedicated Calls
-- =========================================================================

-- Ensure messages table has thread_type and thread_id
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS thread_type TEXT NOT NULL DEFAULT 'pair' CHECK (thread_type IN ('pair', 'room'));
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS thread_id TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS sender_email TEXT;
CREATE INDEX IF NOT EXISTS idx_messages_thread_lookup ON public.messages(thread_id, thread_type, created_at ASC);

-- Lock down messages with isolated RLS
DROP POLICY IF EXISTS "Allow all authenticated users" ON public.messages;
DROP POLICY IF EXISTS "read own threads" ON public.messages;
DROP POLICY IF EXISTS "write own threads" ON public.messages;

CREATE POLICY "read own threads" ON public.messages FOR SELECT USING (
  (thread_type = 'pair' AND EXISTS (
     SELECT 1 FROM public.connections c
     WHERE c.id::text = messages.thread_id AND c.status = 'accepted'
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

CREATE POLICY "write own threads" ON public.messages FOR INSERT WITH CHECK (
  (
    thread_type = 'pair' AND EXISTS (
       SELECT 1 FROM public.connections c
       WHERE c.id::text = thread_id AND c.status = 'accepted'
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

-- Calls Table for private 1-on-1 audio/video calls
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

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;






