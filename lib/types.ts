export interface Profile {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  skill_level: string;
  learning_goal: string;
  onboarding_complete: boolean;
  created_at: string;
}

export interface Skill {
  id: string;
  user_id: string;
  name: string;
  mastery_pct: number;
  level: number;
  status: 'locked' | 'active' | 'mastered';
  parent_skill_id: string | null;
  description: string;
  order_index: number;
}

export interface AssessmentQuestion {
  question: string;
  options: string[];
  answerIndex: number;
}

export interface Assessment {
  id: string;
  user_id: string;
  skill_name: string;
  questions_json: any;
  answers_json: any;
  score: number;
  created_at: string;
}

export interface PeerProfile {
  id: string;
  name: string;
  avatar_url: string;
  skills: { name: string; mastery: number }[];
  needs: string[];
  offers: string[];
  bio: string;
}

export interface PeerMatch {
  id: string;
  user_a_id: string;
  user_b_id: string;
  compatibility_pct: number;
  skill_area: string;
  status: string;
  peer_profile?: PeerProfile;
  created_at: string;
}

export interface Session {
  id: string;
  match_id: string;
  title: string;
  status: string;
  peer_name: string;
  peer_avatar: string;
  skill_area: string;
  created_at: string;
}

export interface Message {
  id: string;
  session_id: string;
  user_id: string;
  sender_name: string;
  sender_avatar: string;
  content: string;
  created_at: string;
}

export interface EvaluationResult {
  correctness: number;
  quality: number;
  improvement: string;
  overall: number;
  summary: string;
}

export interface Artifact {
  id: string;
  session_id: string;
  user_id: string;
  file_name: string;
  file_url: string;
  evaluation_json: any;
  created_at: string;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  earned_at: string;
}

export interface Reputation {
  id: string;
  user_id: string;
  xp: number;
  level: number;
  badges: Badge[];
  mentor_status: boolean;
  mentor_skills: string[];
  updated_at: string;
}

export interface DailyMission {
  id: string;
  user_id: string;
  title: string;
  description: string;
  xp_reward: number;
  completed: boolean;
  skill_name: string;
  date: string;
}

export interface ReputationEntry {
  id: string;
  description: string;
  xp_change: number;
  timestamp: string;
  type: string;
}

export interface AdaptationAction {
  type: string;
  skill_name: string;
  description: string;
  timestamp: string;
}
