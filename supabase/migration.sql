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
