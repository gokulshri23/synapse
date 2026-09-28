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

// =========================================================================
//  Finals Upgrade — New Types
// =========================================================================

export interface SkillDeclaration {
  id: string;
  user_id: string;
  skill: string;
  intent: 'teach' | 'learn';
  status: 'pending' | 'verified' | 'rejected';
  verified_level: number;
  quiz_score: number;
  attempt_count: number;
  evidence_url: string | null;
  last_attempt_at: string;
  created_at: string;
  subtopic_scores?: Record<string, number>;
}

export interface MatchHealth {
  id: string;
  match_id: string;
  learner_id: string;
  teacher_id: string;
  skill: string;
  session_number: number;
  pre_score: number;
  post_score: number;
  delta: number;
  autonomous_action: string | null;
  action_reason: string | null;
  created_at: string;
}

export interface NetworkGap {
  id: string;
  skill: string;
  learner_ids: string[];
  resolved: boolean;
  resolution: string | null;
  timestamp: string;
}

export interface EnhancedMessage {
  id: string;
  sessionId: string;
  senderId: string;
  senderName: string;
  senderRole: 'peer' | 'me';
  text: string;
  timestamp: string;
  type: 'text' | 'voice' | 'ai_rephrase' | 'ai_fallback' | 'system';
  voiceDataUrl?: string;
  reactions?: string[];
  flagged?: boolean;
  replyToId?: string;
}

export interface TeachingChallengeResult {
  accuracy: number;
  clarity: number;
  beginnerFriendliness: number;
  average: number;
  feedback: string;
  passed: boolean;
  assignedLevel: number;
}

export interface MatchHealthTrend {
  sessions: MatchHealth[];
  trend: 'improving' | 'flat' | 'declining';
  avgDelta: number;
  recommendedAction: string | null;
}

export const PYTHON_TEACHING_SUBTOPICS = [
  { id: 'py-vars', name: 'Variables & Data Types', weight: 0.15 },
  { id: 'py-funcs', name: 'Functions & Scopes', weight: 0.20 },
  { id: 'py-oop', name: 'Object-Oriented Programming', weight: 0.20 },
  { id: 'py-files', name: 'File Handling & I/O', weight: 0.15 },
  { id: 'py-numpy', name: 'NumPy', weight: 0.15 },
  { id: 'py-pandas', name: 'Pandas', weight: 0.15 },
] as const;

// =========================================================================
//  Finals Prompt Part 2 — Core Types
// =========================================================================

export interface RoadmapNode {
  id: string;
  user_id: string;
  skill: string;
  topic: string;
  order_index: number;
  status: 'locked' | 'unlocked' | 'completed' | 'reinforce';
  entry_applied_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ChallengeRubric {
  criteria: string[];
  max_score: number;
}

export interface ChallengeRecord {
  id: string;
  session_id: string;
  topic: string;
  question: string;
  rubric: ChallengeRubric;
  starter_code?: string;
  created_at: string;
}

export interface SubmissionFeedback {
  correct_points: string[];
  missing_points: string[];
  one_improvement: string;
  summary?: string;
}

export interface SubmissionRecord {
  id: string;
  challenge_id: string;
  user_id: string;
  answer: string;
  score: number | null;
  feedback?: SubmissionFeedback | null;
  status: 'pending' | 'evaluated' | 'not_evaluated';
  created_at: string;
}

export interface DailyAssessmentMCQ {
  id: string;
  question: string;
  options: string[];
  // Stored strictly on server; never sent to client prior to submit!
  correct_index?: number;
}

export interface DailyAssessmentShortAnswer {
  id: string;
  question: string;
  rubric: string;
}

export interface DailyAssessmentRecord {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  topic: string;
  questions: {
    mcqs: DailyAssessmentMCQ[];
    short_answer: DailyAssessmentShortAnswer;
  };
  status: 'pending' | 'completed' | 'failed';
  score: number | null;
  completed_at?: string | null;
  xp_awarded?: number;
}

export interface VideoLibraryItem {
  id: string;
  topic: string;
  youtube_id: string;
  title: string;
  status: 'active' | 'deprecated';
  created_at: string;
}

export interface VideoEffectivenessRecord {
  id: string;
  video_id: string;
  topic: string;
  attempts: number;
  avg_score: number;
  total_score: number;
  updated_at: string;
}

export interface AgentActivityEntry {
  id: string;
  timestamp: string;
  agent: 'Planner' | 'Matcher' | 'Adaptation' | 'StudyAssistant' | 'Assessment' | 'Evaluation' | 'System';
  action: string;
  reason: string;
  details?: Record<string, any>;
  decision_id?: string;
}

// =========================================================================
//  Adaptive Engine v2 Types (Sections 1 - 6)
// =========================================================================

export interface SkillTopic {
  id?: string;
  skill: string;
  topic: string;
  order_index: number;
}

export type TopicMasteryLabel = 'Weak' | 'Developing' | 'Strong' | 'Not enough data yet';

export interface TopicMastery {
  id?: string;
  user_id: string;
  skill: string;
  topic: string;
  mastery: number;
  answered: number;
  mastery_pct?: number;
  questions_answered?: number;
  updated_at: string;
  label?: TopicMasteryLabel;
}

export interface ActionHistoryRecord {
  id: string;
  user_id: string;
  topic: string;
  action: 'daily_mission' | 'revision_node' | 'targeted_practice' | 'ai_explanation' | 'peer_rematch' | 'joint_concept_and_video' | 'network_gap_retry' | string;
  tried_at: string;
  outcome: 'passed' | 'failed' | 'skipped' | 'pending';
}

export interface AgentDecision {
  id: string;
  user_id: string;
  kind: 'peer_suggestion' | 'practice' | 'revision' | 'ai_explanation' | 'rematch' | 'video' | 'daily_mission' | 'reminder';
  action: string;
  reason_code: 'low_engagement' | 'missing_basics' | 'specific_gap' | 'needs_explanation' | 'explanation_not_enough' | 'both_stuck' | 'exhausted' | string;
  reason_text: string;
  evidence: Record<string, any>;
  created_at: string;
}

export interface SessionSummaryRecord {
  id: string;
  session_id: string;
  user_id: string;
  topic: string;
  duration_minutes: number;
  before_score: number | null;
  after_score: number | null;
  improvement: number | null;
  next_recommendation: {
    action: string;
    topic?: string;
    reason?: string;
    decision_id?: string;
  };
  ai_summary: string;
  ai_review: string;
  created_at: string;
}

export interface TeachingStats {
  id?: string;
  user_id: string;
  skill: string;
  sessions: number;
  avg_improvement: number;
  updated_at: string;
}

