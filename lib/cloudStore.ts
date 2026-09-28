import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import dns from 'dns';
import {
  RoadmapNode,
  ChallengeRecord,
  SubmissionRecord,
  DailyAssessmentRecord,
  VideoLibraryItem,
  VideoEffectivenessRecord,
  AgentActivityEntry,
  SkillTopic,
  TopicMastery,
  TopicMasteryLabel,
  ActionHistoryRecord,
  AgentDecision,
  SessionSummaryRecord,
  TeachingStats,
} from '@/lib/types';

// Ensure IPv4 first on Node to prevent connection latency
try {
  dns.setDefaultResultOrder('ipv4first');
} catch (e) {}

export interface CloudUser {
  id: string;
  email: string;
  fullName: string;
  passwordHash: string;
  salt: string;
  createdAt: string;
}

export interface CloudProfile {
  name: string;
  email: string;
  bio?: string;
  domain: string;
  level: string; // '0' | '1' | '2' | '3' | '4' | '5' or text
  numeric_level?: number;
  goal: string;
  score: number;
  completed_at: string;
  onboarding_complete: boolean;
  xp?: number;
  reputation_score?: number;
  known_skills?: Array<{ skill: string; level: number }>;
  learning_goals?: Array<{ skill: string; currentLevel: number; targetLevel: number }>;
  availability?: string[];
  preferences?: {
    method?: string;
    pace?: string;
  };
  canTeach?: string[];
  seekingGuidance?: string[];
  offers?: string[];
  needs?: string[];
}

export interface CloudPeer {
  id: string;
  name: string;
  email: string;
  domain: string;
  level: string;
  numeric_level?: number;
  score: number;
  avatar?: string;
  lastSeen: number;
  offers: string[];
  needs: string[];
  onboarding_complete?: boolean;
  verified_level?: number | null;
  verified?: boolean;
}

export interface CloudMessage {
  id: string;
  sessionId: string;
  senderId: string;
  senderName: string;
  senderRole: 'peer' | 'me';
  text: string;
  timestamp: string;
  // Part D + H enhancements & Part 6 live calling
  type?: 'text' | 'voice' | 'ai_rephrase' | 'ai_fallback' | 'system' | 'call_invite' | 'call_end';
  callUrl?: string;
  callMode?: 'voice' | 'video';
  callStatus?: 'ringing' | 'accepted' | 'declined' | 'ended';
  voiceDataUrl?: string;
  reactions?: string[];
  flagged?: boolean;
  replyToId?: string;
  createdAt?: number;
}

// Part A — Skill verification replaces self-declared levels
export interface CloudSkillDeclaration {
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
  // Part C — Python subtopic tracking
  subtopic_scores?: Record<string, number>;
}

// Part B — Match health tracking per session
export interface CloudMatchHealth {
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

// Part E — Network gap logging
export interface CloudNetworkGap {
  id: string;
  skill: string;
  learner_ids: string[];
  resolved: boolean;
  resolution: string | null;
  timestamp: string;
}

export interface CloudConnection {
  id: string;
  requesterId: string;
  requesterName: string;
  recipientId: string;
  recipientName: string;
  skillArea: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}

export interface CloudChallenge {
  id: string;
  sessionId: string;
  title: string;
  description: string;
  starterCode: string;
  skillArea: string;
  createdAt: string;
}

export interface CloudRating {
  id: string;
  raterId: string;
  rateeId: string;
  sessionId: string;
  stars: number;
  comment: string;
  createdAt: string;
}

export interface CloudDailyMission {
  id: string;
  userId: string;
  date: string;
  taskText: string;
  sourceTopic: string;
  completedAt: string | null;
  xpReward: number;
  challengeTitle?: string;
  problemStatement?: string;
  starterCode?: string;
  solutionHint?: string;
  submissionCode?: string;
}

// =========================================================================
//  Study Room ("Start Learning Session") Types
// =========================================================================

export interface CloudStudyRoom {
  id: string;
  name: string;
  topic: string;
  host_id: string;
  host_name: string;
  type: 'pair' | 'group';
  max_participants: number;
  status: 'live' | 'ended';
  daily_room_name: string;
  daily_room_url?: string;
  created_at: string;
  ended_at: string | null;
  members: Record<string, CloudStudyRoomMember>;
  resources: CloudRoomResource[];
  attendance: Record<string, CloudSessionAttendance>;
  board_elements?: any[];
}

export interface CloudStudyRoomMember {
  room_id: string;
  user_id: string;
  user_name: string;
  role: 'host' | 'member';
  invited_by?: string;
  joined_at: string;
}

export interface CloudRoomResource {
  id: string;
  room_id: string;
  user_id: string;
  user_name: string;
  kind: 'file' | 'link';
  title: string;
  url: string;
  created_at: string;
}

export interface CloudSessionAttendance {
  room_id: string;
  user_id: string;
  user_name: string;
  joined_at: number; // epoch ms
  last_seen: number; // epoch ms
}

export interface CloudReport {
  id: string;
  reporter_id: string;
  reported_id: string;
  room_id: string;
  reason: string;
  created_at: string;
}

interface CloudStoreData {
  users: Record<string, CloudUser>;
  profiles: Record<string, CloudProfile>;
  peers: Record<string, CloudPeer>;
  messages: CloudMessage[];
  connections: Record<string, CloudConnection>;
  challenges: Record<string, CloudChallenge>;
  ratings: CloudRating[];
  daily_missions: Record<string, CloudDailyMission[]>;
  // Finals upgrade additions
  skill_declarations: Record<string, CloudSkillDeclaration[]>;
  match_health: CloudMatchHealth[];
  network_gaps: CloudNetworkGap[];
  // Finals Part 2 additions
  roadmap_nodes: Record<string, RoadmapNode[]>;
  challenge_records: Record<string, ChallengeRecord>;
  submissions: Record<string, SubmissionRecord[]>;
  daily_assessments: Record<string, DailyAssessmentRecord>;
  video_library: VideoLibraryItem[];
  video_effectiveness: Record<string, VideoEffectivenessRecord>;
  agent_activity_logs: AgentActivityEntry[];
  // Study Room additions
  study_rooms: Record<string, CloudStudyRoom>;
  reports: CloudReport[];
  signaling?: Record<string, CloudSignalingMessage[]>;
  // Adaptive Engine v2 additions (Sections 1-6)
  skill_topics: Record<string, SkillTopic[]>;
  topic_mastery: Record<string, TopicMastery>;
  action_history: Record<string, ActionHistoryRecord[]>;
  agent_decisions: AgentDecision[];
  session_summaries: SessionSummaryRecord[];
  teaching_stats: Record<string, TeachingStats>;
  calls?: Record<string, CloudCallRecord>;
}

export interface CloudCallRecord {
  id: string;
  connection_id: string;
  caller_id: string;
  caller_name: string;
  caller_avatar?: string;
  callee_id: string;
  type: 'voice' | 'video' | 'audio';
  status: 'ringing' | 'accepted' | 'declined' | 'missed' | 'ended';
  room_name: string;
  created_at: string;
}

export interface CloudSignalingMessage {
  id: string;
  sessionId: string;
  senderId: string;
  recipientId?: string;
  type: 'webrtc_offer' | 'webrtc_answer' | 'webrtc_candidate' | 'webrtc_call_end' | string;
  payload: any;
  createdAt: number;
}

// Global in-memory cache to maintain state across hot lambda invocations
declare global {
  var __synapse_cloud_cache: CloudStoreData | undefined;
}

function getCacheFilePath(): string {
  // Use OS tmp dir which is writable on Vercel (/tmp) and Windows (%TEMP%)
  return path.join(os.tmpdir(), 'synapse_cloud_store_v3.json');
}

function loadStore(): CloudStoreData {
  if (global.__synapse_cloud_cache) {
    return global.__synapse_cloud_cache;
  }

  const filePath = getCacheFilePath();
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      global.__synapse_cloud_cache = {
        users: parsed.users || {},
        profiles: parsed.profiles || {},
        peers: parsed.peers || {},
        messages: Array.isArray(parsed.messages) ? parsed.messages : [],
        connections: parsed.connections || {},
        challenges: parsed.challenges || {},
        ratings: Array.isArray(parsed.ratings) ? parsed.ratings : [],
        daily_missions: parsed.daily_missions || {},
        skill_declarations: parsed.skill_declarations || {},
        match_health: Array.isArray(parsed.match_health) ? parsed.match_health : [],
        network_gaps: Array.isArray(parsed.network_gaps) ? parsed.network_gaps : [],
        roadmap_nodes: parsed.roadmap_nodes || {},
        challenge_records: parsed.challenge_records || {},
        submissions: parsed.submissions || {},
        daily_assessments: parsed.daily_assessments || {},
        video_library: Array.isArray(parsed.video_library) ? parsed.video_library : [],
        video_effectiveness: parsed.video_effectiveness || {},
        agent_activity_logs: Array.isArray(parsed.agent_activity_logs) ? parsed.agent_activity_logs : [],
        study_rooms: parsed.study_rooms || {},
        reports: Array.isArray(parsed.reports) ? parsed.reports : [],
        skill_topics: parsed.skill_topics || {},
        topic_mastery: parsed.topic_mastery || {},
        action_history: parsed.action_history || {},
        agent_decisions: Array.isArray(parsed.agent_decisions) ? parsed.agent_decisions : [],
        session_summaries: Array.isArray(parsed.session_summaries) ? parsed.session_summaries : [],
        teaching_stats: parsed.teaching_stats || {},
        calls: parsed.calls || {},
      };
      return global.__synapse_cloud_cache;
    }
  } catch (err) {
    console.warn('[cloudStore] Could not read cache file:', err);
  }

  const initial: CloudStoreData = {
    users: {},
    profiles: {},
    peers: {},
    messages: [
      {
        id: 'msg_welcome',
        sessionId: 'global_collab',
        senderId: 'system',
        senderName: 'Synapse Live System',
        senderRole: 'peer',
        text: 'Welcome to the Synapse live collaborative room! Connect across any device to start pair learning.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ],
    connections: {},
    challenges: {},
    ratings: [],
    daily_missions: {},
    skill_declarations: {},
    match_health: [],
    network_gaps: [],
    roadmap_nodes: {},
    challenge_records: {},
    submissions: {},
    daily_assessments: {},
    video_library: [],
    video_effectiveness: {},
    agent_activity_logs: [],
    study_rooms: {},
    reports: [],
    skill_topics: {},
    topic_mastery: {},
    action_history: {},
    agent_decisions: [],
    session_summaries: [],
    teaching_stats: {},
    calls: {},
  };

  global.__synapse_cloud_cache = initial;
  return initial;
}

function saveStore(data: CloudStoreData): void {
  global.__synapse_cloud_cache = data;
  const filePath = getCacheFilePath();
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[cloudStore] Could not write cache file:', err);
  }
}

// Password hashing
export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const s = salt || crypto.randomBytes(16).toString('hex');
  const h = crypto.pbkdf2Sync(password, s, 1000, 64, 'sha512').toString('hex');
  return { hash: h, salt: s };
}

export function verifyPassword(password: string, storedHash: string, salt: string): boolean {
  const h = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return h === storedHash;
}

// --- Cloud Users (Unlimited accounts) ---
export function getCloudUser(email: string): CloudUser | null {
  const store = loadStore();
  return store.users[email.trim().toLowerCase()] || null;
}

export function saveCloudUser(email: string, fullName: string, password: string): CloudUser {
  const store = loadStore();
  const normalized = email.trim().toLowerCase();
  const { hash, salt } = hashPassword(password);

  const user: CloudUser = {
    id: 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    email: normalized,
    fullName: fullName || email.split('@')[0],
    passwordHash: hash,
    salt,
    createdAt: new Date().toISOString(),
  };

  store.users[normalized] = user;
  saveStore(store);
  return user;
}

// --- Cloud Profiles (Study Data) ---
export function getCloudProfile(email: string): CloudProfile | null {
  const store = loadStore();
  return store.profiles[email.trim().toLowerCase()] || null;
}

export function getAllCloudProfiles(): CloudProfile[] {
  const store = loadStore();
  return Object.values(store.profiles);
}

export function saveCloudProfile(profile: Partial<CloudProfile> & { email: string; name: string }): CloudProfile {
  const store = loadStore();
  const normalized = profile.email.trim().toLowerCase();
  const existing = store.profiles[normalized] || {};

  const numLevel = typeof profile.numeric_level === 'number'
    ? profile.numeric_level
    : profile.level === '0' || profile.level?.includes('0') ? 0
    : profile.level === 'beginner' || profile.level === '1' ? 1
    : profile.level === 'intermediate' || profile.level === '3' ? 3
    : profile.level === 'advanced' || profile.level === '4' ? 4
    : 2;

  const updated: CloudProfile = {
    name: profile.name || existing.name || profile.email.split('@')[0],
    email: normalized,
    bio: profile.bio ?? existing.bio ?? '',
    domain: profile.domain || existing.domain || 'React',
    level: profile.level || existing.level || 'intermediate',
    numeric_level: numLevel,
    goal: profile.goal || existing.goal || '30-day sprint to skill mastery',
    score: profile.score ?? existing.score ?? (numLevel === 0 ? 10 : 85),
    completed_at: profile.completed_at || existing.completed_at || new Date().toISOString(),
    onboarding_complete: profile.onboarding_complete ?? existing.onboarding_complete ?? true,
    xp: profile.xp ?? existing.xp ?? 350,
    reputation_score: profile.reputation_score ?? existing.reputation_score ?? 100,
    known_skills: profile.known_skills || existing.known_skills || [{ skill: profile.domain || 'React', level: numLevel }],
    learning_goals: profile.learning_goals || existing.learning_goals || [{ skill: profile.domain || 'React', currentLevel: numLevel, targetLevel: Math.min(5, numLevel + 2) }],
    availability: profile.availability || existing.availability || ['Weekday Evenings', 'Weekend Mornings'],
    preferences: profile.preferences || existing.preferences || { method: 'Hands-on Code Pairing', pace: 'Intensive' },
    canTeach: profile.canTeach || profile.offers || existing.canTeach || [profile.domain || 'React', 'Problem Solving'],
    seekingGuidance: profile.seekingGuidance || profile.needs || existing.seekingGuidance || [profile.domain === 'React' ? 'Python' : 'React', 'Algorithms'],
  };

  store.profiles[normalized] = updated;

  // Only add/update to active peers if onboarding is complete!
  if (updated.onboarding_complete) {
    store.peers[normalized] = {
      id: normalized,
      name: updated.name,
      email: normalized,
      domain: updated.domain,
      level: updated.level,
      numeric_level: updated.numeric_level,
      score: updated.score,
      lastSeen: Date.now(),
      offers: updated.canTeach || [updated.domain, 'Problem Solving', 'Code Review'],
      needs: updated.seekingGuidance || ['System Design', 'Performance Optimization'],
      onboarding_complete: true,
    };
  } else {
    // If onboarding incomplete, ensure NOT in peers list
    delete store.peers[normalized];
  }

  saveStore(store);
  return updated;
}

// --- Cloud Peers ---
export function getActivePeers(excludeEmail?: string): CloudPeer[] {
  const store = loadStore();
  const now = Date.now();
  const normExclude = excludeEmail?.trim().toLowerCase() || '';

  return Object.values(store.peers)
    .filter((p) => p.onboarding_complete !== false) // Strictly filter out incomplete onboarding
    .filter((p) => now - p.lastSeen < 24 * 60 * 60 * 1000)
    .filter((p) => !normExclude || p.email.toLowerCase() !== normExclude)
    .map((p) => {
      const vLevel = getVerifiedLevel(p.email, p.domain);
      return {
        ...p,
        verified_level: vLevel,
        verified: vLevel !== null && vLevel > 0,
      };
    });
}

export function updatePeerHeartbeat(peer: Partial<CloudPeer> & { email: string; name: string }): CloudPeer {
  const store = loadStore();
  const normalized = peer.email.trim().toLowerCase();
  const track = peer.domain || 'React';

  const updated: CloudPeer = {
    id: peer.id || normalized,
    name: peer.name || peer.email.split('@')[0],
    email: normalized,
    domain: track,
    level: peer.level || 'intermediate',
    numeric_level: peer.numeric_level ?? 2,
    score: Number(peer.score) || 85,
    avatar: peer.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(peer.name)}&background=D97706&color=fff`,
    lastSeen: Date.now(),
    offers: peer.offers || [track, 'Problem Solving', 'Code Review'],
    needs: peer.needs || ['System Design', 'Performance Optimization'],
    onboarding_complete: peer.onboarding_complete ?? true,
  };

  if (updated.onboarding_complete) {
    store.peers[normalized] = updated;
  }
  saveStore(store);
  return updated;
}

// --- Cloud Messages ---
export function getMessages(sessionId = 'global_collab', limit = 100): CloudMessage[] {
  const store = loadStore();
  return store.messages
    .filter((m) => (m.sessionId || 'global_collab') === sessionId)
    .slice(-limit);
}

export function addMessage(msg: {
  sessionId?: string;
  senderId: string;
  senderName: string;
  senderRole?: 'peer' | 'me';
  text: string;
  type?: any;
  callUrl?: string;
  callMode?: 'voice' | 'video';
  callStatus?: 'ringing' | 'accepted' | 'declined' | 'ended';
  voiceDataUrl?: string;
  replyToId?: string;
}): CloudMessage {
  const store = loadStore();
  const newMsg: CloudMessage = {
    id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    sessionId: msg.sessionId || 'global_collab',
    senderId: msg.senderId || 'anon',
    senderName: msg.senderName || 'Peer Learner',
    senderRole: msg.senderRole || 'peer',
    text: msg.text,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    type: msg.type || 'text',
    callUrl: msg.callUrl,
    callMode: msg.callMode,
    callStatus: msg.callStatus,
    voiceDataUrl: msg.voiceDataUrl,
    replyToId: msg.replyToId,
    createdAt: Date.now(),
  };

  store.messages.push(newMsg);
  if (store.messages.length > 250) {
    store.messages = store.messages.slice(-250);
  }
  saveStore(store);
  return newMsg;
}

// --- Connections (Pending -> Accepted -> Declined / Cancelled) ---
export function createConnection(
  requesterId: string,
  requesterName: string,
  recipientId: string,
  recipientName: string,
  skillArea = 'General'
): CloudConnection {
  const store = loadStore();
  const reqNorm = requesterId.trim().toLowerCase();
  const recNorm = recipientId.trim().toLowerCase();
  const connKey = [reqNorm, recNorm].sort().join('___');

  // If connection already exists, return existing or reset if previously declined/cancelled
  if (store.connections[connKey]) {
    const existing = store.connections[connKey];
    if (existing.status === 'declined' || existing.status === 'cancelled') {
      existing.status = 'pending';
      existing.requesterId = reqNorm;
      existing.requesterName = requesterName;
      existing.recipientId = recNorm;
      existing.recipientName = recipientName;
      existing.skillArea = skillArea;
      existing.updatedAt = new Date().toISOString();
      saveStore(store);
    }
    return existing;
  }

  const conn: CloudConnection = {
    id: 'conn_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    requesterId: reqNorm,
    requesterName,
    recipientId: recNorm,
    recipientName,
    skillArea,
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  store.connections[connKey] = conn;
  saveStore(store);
  return conn;
}

export function updateConnectionStatus(
  connId: string,
  status: 'accepted' | 'declined' | 'cancelled'
): CloudConnection | null {
  const store = loadStore();
  const connKey = Object.keys(store.connections).find((k) => store.connections[k].id === connId);
  if (!connKey) return null;

  store.connections[connKey].status = status;
  store.connections[connKey].updatedAt = new Date().toISOString();
  saveStore(store);
  return store.connections[connKey];
}

export function cancelConnectionByUser(
  requesterId: string,
  recipientId: string
): boolean {
  const store = loadStore();
  const reqNorm = requesterId.trim().toLowerCase();
  const recNorm = recipientId.trim().toLowerCase();
  const connKey = [reqNorm, recNorm].sort().join('___');

  if (store.connections[connKey]) {
    store.connections[connKey].status = 'cancelled';
    store.connections[connKey].updatedAt = new Date().toISOString();
    saveStore(store);
    return true;
  }
  return false;
}

export function getConnectionsForUser(userId: string): {
  active: CloudConnection[];
  pendingIncoming: CloudConnection[];
  pendingOutgoing: CloudConnection[];
} {
  const store = loadStore();
  const norm = userId.trim().toLowerCase();
  const allConns = Object.values(store.connections);

  const active = allConns.filter(
    (c) => c.status === 'accepted' && (c.requesterId === norm || c.recipientId === norm)
  );
  const pendingIncoming = allConns.filter(
    (c) => c.status === 'pending' && c.recipientId === norm
  );
  const pendingOutgoing = allConns.filter(
    (c) => c.status === 'pending' && c.requesterId === norm
  );

  return { active, pendingIncoming, pendingOutgoing };
}

// --- WebRTC Peer-to-Peer Signaling Buffer ---
export function addSignalingMessage(msg: {
  sessionId?: string;
  senderId: string;
  recipientId?: string;
  type: 'webrtc_offer' | 'webrtc_answer' | 'webrtc_candidate' | string;
  payload: any;
}): CloudSignalingMessage {
  const store = loadStore();
  if (!store.signaling) store.signaling = {};

  const sessKey = msg.sessionId || 'global_collab';
  if (!store.signaling[sessKey]) store.signaling[sessKey] = [];

  const newSignal: CloudSignalingMessage = {
    id: 'sig_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    sessionId: sessKey,
    senderId: msg.senderId.toLowerCase().trim(),
    recipientId: (msg.recipientId || '').toLowerCase().trim(),
    type: msg.type,
    payload: msg.payload,
    createdAt: Date.now(),
  };

  store.signaling[sessKey].push(newSignal);
  // Keep last 40 signaling packets per session
  if (store.signaling[sessKey].length > 40) {
    store.signaling[sessKey] = store.signaling[sessKey].slice(-40);
  }
  saveStore(store);
  return newSignal;
}

export function getSignalingMessages(
  sessionId: string,
  forUserId: string,
  sinceTime = 0
): CloudSignalingMessage[] {
  const store = loadStore();
  if (!store.signaling) return [];

  const sessKey = sessionId || 'global_collab';
  const list = store.signaling[sessKey] || [];
  const normUser = (forUserId || '').toLowerCase().trim();
  const userPrefix = normUser.split('@')[0];

  // Return all signaling packets in this session not sent by this user
  return list.filter((s) => {
    if (s.createdAt <= sinceTime) return false;
    const sSender = (s.senderId || '').toLowerCase().trim();
    const senderPrefix = sSender.split('@')[0];

    // Don't return messages sent by this same user
    if (sSender && normUser && (sSender === normUser || (userPrefix && senderPrefix === userPrefix))) {
      return false;
    }
    return true;
  });
}


// --- Challenges (Shared live code tasks) ---
export function saveChallenge(challenge: Omit<CloudChallenge, 'id' | 'createdAt'>): CloudChallenge {
  const store = loadStore();
  const newChallenge: CloudChallenge = {
    ...challenge,
    id: 'chal_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    createdAt: new Date().toISOString(),
  };

  store.challenges[challenge.sessionId] = newChallenge;
  saveStore(store);
  return newChallenge;
}

export function getChallengeForSession(sessionId: string): CloudChallenge | null {
  const store = loadStore();
  return store.challenges[sessionId] || null;
}

// --- Ratings (Authoritative XP & Reputation Updates) ---
export function submitPeerRating(data: {
  raterId: string;
  rateeId: string;
  sessionId: string;
  stars: number;
  comment: string;
}): { rating: CloudRating; updatedRatee: CloudProfile | null } {
  const store = loadStore();
  const rating: CloudRating = {
    id: 'rat_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    raterId: data.raterId.trim().toLowerCase(),
    rateeId: data.rateeId.trim().toLowerCase(),
    sessionId: data.sessionId,
    stars: data.stars,
    comment: data.comment,
    createdAt: new Date().toISOString(),
  };

  store.ratings.push(rating);

  // Authoritatively update ratee's XP & reputation score in their profile!
  const rateeProfile = store.profiles[rating.rateeId];
  let updatedRatee: CloudProfile | null = null;
  if (rateeProfile) {
    const xpBonus = rating.stars * 25;
    rateeProfile.xp = (rateeProfile.xp || 350) + xpBonus;
    rateeProfile.reputation_score = Math.min(100, Math.round(((rateeProfile.reputation_score || 85) + rating.stars * 20) / 2));
    updatedRatee = rateeProfile;
  }

  saveStore(store);
  return { rating, updatedRatee };
}

// --- Daily Missions ---
export function getOrCreateDailyMission(userId: string, sourceTopic: string): CloudDailyMission {
  const store = loadStore();
  const norm = userId.trim().toLowerCase();
  const today = new Date().toISOString().split('T')[0];

  if (!store.daily_missions[norm]) {
    store.daily_missions[norm] = [];
  }

  const existing = store.daily_missions[norm].find((m) => m.date === today);
  if (existing) return existing;

  const topicLower = (sourceTopic || 'general').toLowerCase();

  let challengeTitle = `Challenge: Implement ${sourceTopic} Pattern`;
  let problemStatement = `Write an optimized, production-ready implementation that demonstrates ${sourceTopic}. Handle potential edge cases, prevent race conditions, and follow clean architectural design.`;
  let starterCode = `// Daily Challenge: ${sourceTopic}\n// Write your solution below and click "Run & Submit"\n\nfunction solution() {\n  // TODO: Implement your logic here\n  return true;\n}\n`;
  let solutionHint = `Break down the problem into smaller functions and verify edge cases such as empty input or boundaries.`;

  if (topicLower.includes('hook') || topicLower.includes('custom hook')) {
    challengeTitle = `Build a useDebounce Hook`;
    problemStatement = `Create a custom React hook 'useDebounce(value, delay)' that returns the debounced value. Ensure it cancels any pending timeout when the value changes or when the component unmounts.`;
    starterCode = `import { useState, useEffect } from 'react';\n\nexport function useDebounce<T>(value: T, delay: number = 500): T {\n  const [debouncedValue, setDebouncedValue] = useState<T>(value);\n\n  useEffect(() => {\n    // TODO: Set up timer to update debouncedValue after delay\n    const handler = setTimeout(() => {\n      setDebouncedValue(value);\n    }, delay);\n\n    // TODO: Clean up timeout on value change or unmount\n    return () => {\n      clearTimeout(handler);\n    };\n  }, [value, delay]);\n\n  return debouncedValue;\n}\n`;
    solutionHint = `Use setTimeout inside useEffect, and return a cleanup function with clearTimeout.`;
  } else if (topicLower.includes('jsx') || topicLower.includes('render') || topicLower.includes('component')) {
    challengeTitle = `Component Render Profiler with useRef`;
    problemStatement = `Build a React component or hook that tracks how many times a component renders without causing infinite loops or re-renders itself.`;
    starterCode = `import React, { useState, useRef, useEffect } from 'react';\n\nexport function RenderCounter() {\n  const [count, setCount] = useState(0);\n  const renderCount = useRef(1);\n\n  useEffect(() => {\n    // TODO: Increment renderCount.current without triggering re-render\n    renderCount.current += 1;\n  });\n\n  return (\n    <div className="p-4 rounded-xl border border-border">\n      <p>State Count: {count}</p>\n      <p>Render Passes: {renderCount.current}</p>\n      <button onClick={() => setCount(c => c + 1)}>Increment</button>\n    </div>\n  );\n}\n`;
    solutionHint = `useRef persists across renders without triggering a re-render when its .current property changes.`;
  } else if (topicLower.includes('state') || topicLower.includes('reducer') || topicLower.includes('context')) {
    challengeTitle = `Undo/Redo State History Reducer`;
    problemStatement = `Implement a custom reducer or hook that maintains an undo/redo history stack for state transitions.`;
    starterCode = `export interface HistoryState<T> {\n  past: T[];\n  present: T;\n  future: T[];\n}\n\nexport function historyReducer<T>(state: HistoryState<T>, action: { type: 'SET' | 'UNDO' | 'REDO'; newPresent?: T }): HistoryState<T> {\n  switch (action.type) {\n    case 'UNDO':\n      if (state.past.length === 0) return state;\n      const previous = state.past[state.past.length - 1];\n      return {\n        past: state.past.slice(0, -1),\n        present: previous,\n        future: [state.present, ...state.future],\n      };\n    case 'REDO':\n      if (state.future.length === 0) return state;\n      const next = state.future[0];\n      return {\n        past: [...state.past, state.present],\n        present: next,\n        future: state.future.slice(1),\n      };\n    default:\n      return state;\n  }\n}\n`;
    solutionHint = `Maintain three pieces of state: past array, present value, and future array.`;
  } else if (topicLower.includes('oop') || topicLower.includes('class') || topicLower.includes('python')) {
    challengeTitle = `Thread-Safe Bank Account with Transaction Log`;
    problemStatement = `Write a BankAccount class with deposit, withdraw, and transaction history. Prevent overdrafts and record timestamps for each ledger entry.`;
    starterCode = `class BankAccount:\n    def __init__(self, initial_balance=0.0):\n        self.balance = float(initial_balance)\n        self.transactions = []\n\n    def deposit(self, amount):\n        if amount <= 0:\n            raise ValueError("Deposit must be positive")\n        self.balance += amount\n        self.transactions.append(("DEPOSIT", amount, self.balance))\n        return self.balance\n\n    def withdraw(self, amount):\n        if amount > self.balance:\n            raise ValueError("Insufficient funds")\n        self.balance -= amount\n        self.transactions.append(("WITHDRAW", amount, self.balance))\n        return self.balance\n`;
    solutionHint = `Validate that amounts are positive and enforce that balance never drops below zero.`;
  } else if (topicLower.includes('async') || topicLower.includes('promise') || topicLower.includes('event loop')) {
    challengeTitle = `Promise.all Polyfill with Rejection Handling`;
    problemStatement = `Implement a custom promiseAll(promises) function that resolves an array of promises in parallel, preserving original order, and rejects immediately if any promise fails.`;
    starterCode = `function promiseAll(promises) {\n  return new Promise((resolve, reject) => {\n    if (!Array.isArray(promises)) return resolve([]);\n    const results = [];\n    let completed = 0;\n    if (promises.length === 0) return resolve(results);\n\n    promises.forEach((p, index) => {\n      Promise.resolve(p)\n        .then((val) => {\n          results[index] = val;\n          completed += 1;\n          if (completed === promises.length) resolve(results);\n        })\n        .catch(reject);\n    });\n  });\n}\n`;
    solutionHint = `Wrap each element in Promise.resolve(p) to support non-promise primitives, and track completed count.`;
  } else if (topicLower.includes('stack') || topicLower.includes('array') || topicLower.includes('two-pointer') || topicLower.includes('structures')) {
    challengeTitle = `Valid Parentheses Syntax Validator`;
    problemStatement = `Given a string s containing '(', ')', '{', '}', '[' and ']', verify that brackets are closed in the correct order using a Stack.`;
    starterCode = `function isValidParentheses(s: string): boolean {\n  const stack: string[] = [];\n  const pairs: Record<string, string> = { ')': '(', '}': '{', ']': '[' };\n\n  for (const ch of s) {\n    if (ch === '(' || ch === '{' || ch === '[') {\n      stack.push(ch);\n    } else if (pairs[ch]) {\n      if (stack.pop() !== pairs[ch]) return false;\n    }\n  }\n  return stack.length === 0;\n}\n`;
    solutionHint = `Push opening brackets onto stack. For closing brackets, check if stack.pop() matches the expected opening bracket.`;
  }

  const newMission: CloudDailyMission = {
    id: 'dm_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    userId: norm,
    date: today,
    taskText: `Master ${sourceTopic}: Complete coding challenge & write unit-tested implementation`,
    sourceTopic,
    completedAt: null,
    xpReward: 50,
    challengeTitle,
    problemStatement,
    starterCode,
    solutionHint,
  };

  store.daily_missions[norm].push(newMission);
  saveStore(store);
  return newMission;
}

export function completeDailyMission(
  userId: string,
  missionId: string,
  submissionCode?: string
): { success: boolean; xpEarned: number } {
  const store = loadStore();
  const norm = userId.trim().toLowerCase();
  const userMissions = store.daily_missions[norm] || [];
  const mission = userMissions.find((m) => m.id === missionId);

  if (!mission || mission.completedAt) {
    return { success: false, xpEarned: 0 };
  }

  mission.completedAt = new Date().toISOString();
  if (submissionCode) {
    mission.submissionCode = submissionCode;
  }

  // Add XP to user profile
  const profile = store.profiles[norm];
  if (profile) {
    profile.xp = (profile.xp || 350) + mission.xpReward;
  }

  saveStore(store);
  return { success: true, xpEarned: mission.xpReward };
}

export function getCompletedDailyMissions(userId: string): CloudDailyMission[] {
  const store = loadStore();
  const norm = userId.trim().toLowerCase();
  return (store.daily_missions[norm] || []).filter((m) => m.completedAt !== null);
}

// =========================================================================
// =========================================================================
//  PART A — Skill Declarations (One source of truth by intent)
// =========================================================================

export function normalizeSkillId(skill: string): string {
  const s = (skill || '').trim().toLowerCase();
  if (s === 'python' || s === 'python programming' || s === 'python3') return 'Python';
  if (s === 'react' || s === 'react.js' || s === 'reactjs') return 'React';
  if (s === 'javascript' || s === 'js') return 'JavaScript';
  if (s === 'typescript' || s === 'ts') return 'TypeScript';
  if (s === 'machine learning' || s === 'ml' || s === 'machinelearning') return 'Machine Learning';
  if (s === 'data structures' || s === 'ds' || s === 'dsa') return 'Data Structures';
  if (s === 'algorithms' || s === 'algo') return 'Algorithms';
  if (s === 'system design') return 'System Design';
  if (s === 'problem solving') return 'Problem Solving';
  if (s === 'web development' || s === 'web dev') return 'Web Development';
  if (s === 'databases' || s === 'db' || s === 'sql') return 'Databases';
  if (s === 'devops' || s === 'cloud') return 'DevOps';
  return skill.trim().replace(/\b\w/g, (c) => c.toUpperCase());
}

export function createSkillDeclaration(
  userId: string,
  skill: string,
  intent: 'teach' | 'learn'
): CloudSkillDeclaration {
  const store = loadStore();
  const norm = userId.trim().toLowerCase();
  const canonicalSkill = normalizeSkillId(skill);

  if (!store.skill_declarations[norm]) {
    store.skill_declarations[norm] = [];
  }

  // Check if a declaration already exists for this canonical skill + intent
  const existing = store.skill_declarations[norm].find(
    (d) => d.skill.toLowerCase() === canonicalSkill.toLowerCase() && d.intent === intent
  );
  if (existing && existing.status !== 'rejected') {
    return existing;
  }

  const decl: CloudSkillDeclaration = {
    id: 'sd_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    user_id: norm,
    skill: canonicalSkill,
    intent,
    status: 'pending',
    verified_level: 0,
    quiz_score: 0,
    attempt_count: 0,
    evidence_url: null,
    last_attempt_at: '',
    created_at: new Date().toISOString(),
  };

  store.skill_declarations[norm].push(decl);
  saveStore(store);
  return decl;
}

export function toggleSkillDeclaration(
  userId: string,
  skill: string,
  intent: 'teach' | 'learn'
): { toggled: 'added' | 'removed'; declaration?: CloudSkillDeclaration; declarations: CloudSkillDeclaration[] } {
  const store = loadStore();
  const norm = userId.trim().toLowerCase();
  const canonicalSkill = normalizeSkillId(skill);

  if (!store.skill_declarations[norm]) {
    store.skill_declarations[norm] = [];
  }

  const existingIdx = store.skill_declarations[norm].findIndex(
    (d) => d.skill.toLowerCase() === canonicalSkill.toLowerCase() && d.intent === intent
  );

  if (existingIdx !== -1) {
    store.skill_declarations[norm].splice(existingIdx, 1);
    saveStore(store);
    return { toggled: 'removed', declarations: store.skill_declarations[norm] };
  } else {
    const decl: CloudSkillDeclaration = {
      id: 'sd_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      user_id: norm,
      skill: canonicalSkill,
      intent,
      status: 'pending',
      verified_level: 0,
      quiz_score: 0,
      attempt_count: 0,
      evidence_url: null,
      last_attempt_at: '',
      created_at: new Date().toISOString(),
    };
    store.skill_declarations[norm].push(decl);
    saveStore(store);
    return { toggled: 'added', declaration: decl, declarations: store.skill_declarations[norm] };
  }
}

export function updateSkillDeclaration(
  declarationId: string,
  updates: Partial<CloudSkillDeclaration>
): CloudSkillDeclaration | null {
  const store = loadStore();
  for (const userId in store.skill_declarations) {
    const decls = store.skill_declarations[userId];
    const idx = decls.findIndex((d) => d.id === declarationId);
    if (idx !== -1) {
      decls[idx] = { ...decls[idx], ...updates };
      saveStore(store);
      return decls[idx];
    }
  }
  return null;
}

export function getSkillDeclarations(userId: string, intent?: 'teach' | 'learn'): CloudSkillDeclaration[] {
  const store = loadStore();
  const norm = userId.trim().toLowerCase();
  const all = store.skill_declarations[norm] || [];
  if (intent) {
    return all.filter((d) => d.intent === intent);
  }
  return all;
}

export function getVerifiedLevel(userId: string, skill: string): number | null {
  const store = loadStore();
  const norm = userId.trim().toLowerCase();
  const decls = store.skill_declarations[norm] || [];
  const verified = decls.find(
    (d) =>
      d.skill.toLowerCase() === skill.toLowerCase() &&
      d.status === 'verified'
  );
  return verified ? verified.verified_level : null;
}

export function canRetakeQuiz(userId: string, skill: string): { allowed: boolean; hoursRemaining: number } {
  const store = loadStore();
  const norm = userId.trim().toLowerCase();
  const decls = store.skill_declarations[norm] || [];
  const latest = decls
    .filter((d) => d.skill.toLowerCase() === skill.toLowerCase() && d.last_attempt_at)
    .sort((a, b) => new Date(b.last_attempt_at).getTime() - new Date(a.last_attempt_at).getTime())[0];

  if (!latest || !latest.last_attempt_at) {
    return { allowed: true, hoursRemaining: 0 };
  }

  const elapsed = Date.now() - new Date(latest.last_attempt_at).getTime();
  const cooldownMs = 24 * 60 * 60 * 1000; // 24 hours
  if (elapsed >= cooldownMs) {
    return { allowed: true, hoursRemaining: 0 };
  }

  const remaining = Math.ceil((cooldownMs - elapsed) / (60 * 60 * 1000));
  return { allowed: false, hoursRemaining: remaining };
}

// =========================================================================
//  PART B — Match Health Score + Autonomous Adaptation
// =========================================================================

export function recordMatchHealth(data: {
  match_id: string;
  learner_id: string;
  teacher_id: string;
  skill: string;
  session_number: number;
  pre_score: number;
  post_score: number;
  autonomous_action?: string;
  action_reason?: string;
}): CloudMatchHealth {
  const store = loadStore();
  const record: CloudMatchHealth = {
    id: 'mh_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    match_id: data.match_id,
    learner_id: data.learner_id.trim().toLowerCase(),
    teacher_id: data.teacher_id.trim().toLowerCase(),
    skill: data.skill,
    session_number: data.session_number,
    pre_score: data.pre_score,
    post_score: data.post_score,
    delta: data.post_score - data.pre_score,
    autonomous_action: data.autonomous_action || null,
    action_reason: data.action_reason || null,
    created_at: new Date().toISOString(),
  };

  store.match_health.push(record);
  // Keep max 500 records
  if (store.match_health.length > 500) {
    store.match_health = store.match_health.slice(-500);
  }
  saveStore(store);
  return record;
}

export function getMatchHealthHistory(matchId: string): CloudMatchHealth[] {
  const store = loadStore();
  return store.match_health.filter((h) => h.match_id === matchId);
}

export function getMatchHealthTrend(
  learnerId: string,
  skill: string
): CloudMatchHealth[] {
  const store = loadStore();
  const norm = learnerId.trim().toLowerCase();
  return store.match_health
    .filter(
      (h) =>
        h.learner_id === norm &&
        h.skill.toLowerCase() === skill.toLowerCase()
    )
    .sort((a, b) => a.session_number - b.session_number)
    .slice(-5);
}

export function getTeacherCrossLearnerPattern(
  teacherId: string
): { avgDelta: number; learnerCount: number; declining: boolean } {
  const store = loadStore();
  const norm = teacherId.trim().toLowerCase();
  const records = store.match_health.filter((h) => h.teacher_id === norm);

  if (records.length === 0) {
    return { avgDelta: 0, learnerCount: 0, declining: false };
  }

  const uniqueLearners = new Set(records.map((r) => r.learner_id));
  const avgDelta =
    records.reduce((sum, r) => sum + r.delta, 0) / records.length;

  // Only flag declining if pattern spans 3+ different learners
  const declining = avgDelta < 0 && uniqueLearners.size >= 3;

  return {
    avgDelta: Math.round(avgDelta * 100) / 100,
    learnerCount: uniqueLearners.size,
    declining,
  };
}

// =========================================================================
//  PART E — Network Gap Logging
// =========================================================================

export function logNetworkGap(
  skill: string,
  learnerIds: string[]
): CloudNetworkGap {
  const store = loadStore();
  const gap: CloudNetworkGap = {
    id: 'ng_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    skill,
    learner_ids: learnerIds.map((id) => id.trim().toLowerCase()),
    resolved: false,
    resolution: null,
    timestamp: new Date().toISOString(),
  };

  store.network_gaps.push(gap);
  if (store.network_gaps.length > 200) {
    store.network_gaps = store.network_gaps.slice(-200);
  }
  saveStore(store);
  return gap;
}

export function resolveNetworkGap(gapId: string, resolution: string): void {
  const store = loadStore();
  const gap = store.network_gaps.find((g) => g.id === gapId);
  if (gap) {
    gap.resolved = true;
    gap.resolution = resolution;
    saveStore(store);
  }
}

// =========================================================================
//  PART D — Message Reactions & Enhanced Messages
// =========================================================================

export function addMessageReaction(
  messageId: string,
  reaction: string
): CloudMessage | null {
  const store = loadStore();
  const msg = store.messages.find((m) => m.id === messageId);
  if (!msg) return null;

  if (!msg.reactions) msg.reactions = [];
  if (!msg.reactions.includes(reaction)) {
    msg.reactions.push(reaction);
  }
  saveStore(store);
  return msg;
}

export function flagMessageLost(messageId: string): CloudMessage | null {
  const store = loadStore();
  const msg = store.messages.find((m) => m.id === messageId);
  if (!msg) return null;
  msg.flagged = true;
  if (!msg.reactions) msg.reactions = [];
  if (!msg.reactions.includes('lost')) msg.reactions.push('lost');
  saveStore(store);
  return msg;
}

export function addEnhancedMessage(msg: {
  sessionId?: string;
  senderId: string;
  senderName: string;
  senderRole?: 'peer' | 'me';
  text: string;
  type?: 'text' | 'voice' | 'ai_rephrase' | 'ai_fallback' | 'system';
  voiceDataUrl?: string;
  replyToId?: string;
}): CloudMessage {
  const store = loadStore();
  const newMsg: CloudMessage = {
    id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    sessionId: msg.sessionId || 'global_collab',
    senderId: msg.senderId,
    senderName: msg.senderName,
    senderRole: msg.senderRole || 'peer',
    text: msg.text,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    type: msg.type || 'text',
    voiceDataUrl: msg.voiceDataUrl,
    reactions: [],
    flagged: false,
    replyToId: msg.replyToId,
  };

  store.messages.push(newMsg);
  if (store.messages.length > 500) {
    store.messages = store.messages.slice(-500);
  }
  saveStore(store);
  return newMsg;
}

export function getSessionLostFlags(sessionId: string): { senderId: string; count: number }[] {
  const store = loadStore();
  const sessionMsgs = store.messages.filter(
    (m) => (m.sessionId || 'global_collab') === sessionId && m.flagged
  );

  const flagCounts: Record<string, number> = {};
  for (const msg of sessionMsgs) {
    flagCounts[msg.senderId] = (flagCounts[msg.senderId] || 0) + 1;
  }

  return Object.entries(flagCounts).map(([senderId, count]) => ({
    senderId,
    count,
  }));
}

// =========================================================================
//  FINALS PART 2 — Step 2: Part 3 Roadmap Nodes (Single Unlocked Guarantee)
// =========================================================================

export const DEFAULT_SKILL_TOPICS: Record<string, string[]> = {
  react: [
    'Modern JS (ES6+) & DOM Prerequisites',
    'JSX & Rendering Architecture',
    'Component Architecture & Props',
    'State Management & Lifecycle',
    'Hooks Deep Dive & Custom Hooks',
    'Global State & Context API',
    'Routing & Navigation Patterns',
    'Performance & Optimization',
    'Testing & Component Quality',
    'Full-Stack Architecture'
  ],
  python: [
    'Variables, Data Types & Control Flow',
    'Functions, Scopes & Modular Design',
    'Data Structures: Lists, Dicts, Sets & Tuples',
    'Object-Oriented Programming (OOP)',
    'File Handling & Exception Safety',
    'NumPy & Numerical Computing',
    'Pandas & Data Processing',
    'APIs & Async Python Architecture',
    'Web Frameworks: FastAPI & Flask',
    'Concurrency & Multiprocessing'
  ],
  javascript: [
    'Variables, Scopes & Lexical Environment',
    'Prototypes & Object-Oriented JS',
    'Asynchronous JS: Event Loop & Promises',
    'DOM Manipulation & Browser Events',
    'ES6+ Modules & Modern Tooling',
    'Memory Management & Closures',
    'Design Patterns & Clean Code',
    'Web APIs & Fetch/Networking',
    'Performance Optimization & Profiling',
    'Testing with Jest & Vitest'
  ],
  'machine learning': [
    'Linear Algebra & Calculus Foundations',
    'Probability, Statistics & Hypothesis Testing',
    'Data Preprocessing & Feature Engineering',
    'Supervised Learning: Regression & Classification',
    'Unsupervised Learning: Clustering & PCA',
    'Model Evaluation, Cross-Validation & Overfitting',
    'Ensemble Methods: Random Forests & XGBoost',
    'Deep Learning Foundations & Neural Networks',
    'Computer Vision (CNNs) & NLP (Transformers)',
    'MLOps, Model Deployment & Monitoring'
  ],
  'data structures': [
    'Complexity Analysis (Big-O Notation)',
    'Arrays, Strings & Two-Pointer Patterns',
    'Linked Lists & Fast/Slow Pointers',
    'Stacks, Queues & Monotonic Structures',
    'Hash Tables & Collision Resolution',
    'Recursion & Backtracking Algorithms',
    'Trees & Binary Search Trees (BST)',
    'Heaps & Priority Queues',
    'Graphs & Network Traversal',
    'Dynamic Programming & Greedy Strategies'
  ]
};

export function getDefaultTopicsForSkill(skill: string): string[] {
  const norm = (skill || '').trim().toLowerCase();
  for (const key of Object.keys(DEFAULT_SKILL_TOPICS)) {
    if (norm.includes(key) || key.includes(norm)) {
      return DEFAULT_SKILL_TOPICS[key];
    }
  }
  return DEFAULT_SKILL_TOPICS.react;
}

export function applyEntryResult(
  userId: string,
  skill: string,
  score: number,
  topicResults?: Record<string, number>
): RoadmapNode[] {
  const store = loadStore();
  const normUser = userId.trim().toLowerCase();
  const normSkill = skill.trim().toLowerCase();
  const mapKey = `${normUser}___${normSkill}`;

  // Idempotency check: if entry already applied and nodes exist, return existing
  const existing = store.roadmap_nodes[mapKey];
  if (existing && existing.length > 0 && existing[0].entry_applied_at) {
    return existing;
  }

  const topics = getDefaultTopicsForSkill(normSkill);
  let completedIndices = new Set<number>();
  let unlockedIndex = 0;

  if (topicResults && Object.keys(topicResults).length > 0) {
    // 1. Tag each entry topic with its score (>= 70% is completed)
    topics.forEach((t, i) => {
      const topicScore = topicResults[t];
      if (typeof topicScore === 'number' && topicScore >= 70) {
        completedIndices.add(i);
      }
    });

    // 2. First topic in order that is NOT completed becomes the single unlocked node
    let firstIncomplete = -1;
    for (let i = 0; i < topics.length; i++) {
      if (!completedIndices.has(i)) {
        firstIncomplete = i;
        break;
      }
    }
    unlockedIndex = firstIncomplete !== -1 ? firstIncomplete : topics.length - 1;
  } else {
    // 3. Fall back to non-overlapping score bands:
    // 0 <= score < 40  -> Level 1 (Node 0 unlocked)
    // 40 <= score < 70 -> Level 2 (Node 0 completed, Node 1 unlocked) -> 66% strictly here!
    // 70 <= score < 85 -> Level 3 (Node 0, 1 completed, Node 2 unlocked)
    // 85 <= score <= 100 -> Level 4 (Node 0, 1, 2 completed, Node 3 unlocked)
    const cleanScore = Math.max(0, Math.min(100, Math.round(score)));
    let level = 1;
    if (cleanScore >= 85) level = 4;
    else if (cleanScore >= 70) level = 3;
    else if (cleanScore >= 40) level = 2;
    else level = 1;

    for (let i = 0; i < level - 1; i++) {
      completedIndices.add(i);
    }
    unlockedIndex = level - 1;
  }

  const now = new Date().toISOString();
  const nodes: RoadmapNode[] = topics.map((topic, i) => {
    let status: RoadmapNode['status'] = 'locked';
    if (completedIndices.has(i)) {
      status = 'completed';
    } else if (i === unlockedIndex) {
      status = 'unlocked';
    } else {
      status = 'locked';
    }

    return {
      id: `rn_${normUser}_${normSkill}_${i}`,
      user_id: normUser,
      skill: normSkill,
      topic,
      order_index: i,
      status,
      entry_applied_at: now,
      updated_at: now,
    };
  });

  // Strict check: exactly ONE node must be 'unlocked'
  const unlockedCount = nodes.filter(n => n.status === 'unlocked').length;
  if (unlockedCount !== 1) {
    console.warn(`[roadmap] Anomaly detected: ${unlockedCount} unlocked nodes. Correcting to single unlocked node.`);
    let seenUnlocked = false;
    nodes.forEach(n => {
      if (n.status === 'unlocked') {
        if (!seenUnlocked) seenUnlocked = true;
        else n.status = 'locked';
      }
    });
  }

  store.roadmap_nodes[mapKey] = nodes;
  saveStore(store);
  return nodes;
}

export function getRoadmapNodes(userId: string, skill: string): RoadmapNode[] {
  const store = loadStore();
  const normUser = userId.trim().toLowerCase();
  const normSkill = skill.trim().toLowerCase();
  const mapKey = `${normUser}___${normSkill}`;
  return store.roadmap_nodes[mapKey] || [];
}

export function passRoadmapTopic(
  userId: string,
  skill: string,
  topic: string,
  score: number
): { success: boolean; nodes: RoadmapNode[]; nextUnlockedTopic?: string } {
  const store = loadStore();
  const normUser = userId.trim().toLowerCase();
  const normSkill = skill.trim().toLowerCase();
  const mapKey = `${normUser}___${normSkill}`;

  const nodes = store.roadmap_nodes[mapKey] || [];
  if (nodes.length === 0) {
    return { success: false, nodes: [] };
  }

  // Topic quiz must be passed with >= 70%
  if (score < 70) {
    return { success: false, nodes };
  }

  const currentIndex = nodes.findIndex(n => n.topic.toLowerCase() === topic.toLowerCase());
  if (currentIndex === -1) {
    return { success: false, nodes };
  }

  const now = new Date().toISOString();
  nodes[currentIndex].status = 'completed';
  nodes[currentIndex].updated_at = now;

  let nextUnlockedTopic: string | undefined;
  if (currentIndex + 1 < nodes.length) {
    nodes[currentIndex + 1].status = 'unlocked';
    nodes[currentIndex + 1].updated_at = now;
    nextUnlockedTopic = nodes[currentIndex + 1].topic;
  }

  // Enforce single unlocked node rule
  let seenUnlocked = false;
  nodes.forEach((n) => {
    if (n.status === 'unlocked') {
      if (!seenUnlocked) seenUnlocked = true;
      else n.status = 'locked';
    }
  });

  store.roadmap_nodes[mapKey] = nodes;
  saveStore(store);
  return { success: true, nodes, nextUnlockedTopic };
}

export function addReinforceTopic(userId: string, skill: string, topicName: string): RoadmapNode[] {
  const store = loadStore();
  const mapKey = `${userId.trim().toLowerCase()}___${skill.trim().toLowerCase()}`;
  const nodes = store.roadmap_nodes[mapKey] || [];

  const existing = nodes.find((n) => n.topic.toLowerCase() === topicName.toLowerCase());
  if (existing) {
    if (existing.status !== 'unlocked') {
      existing.status = 'reinforce';
      existing.updated_at = new Date().toISOString();
    }
  } else {
    const maxIndex = nodes.reduce((max, n) => Math.max(max, n.order_index), 0);
    const reinforceNode: RoadmapNode = {
      id: `rn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      user_id: userId.trim().toLowerCase(),
      skill,
      topic: topicName,
      status: 'reinforce',
      order_index: maxIndex + 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    nodes.push(reinforceNode);
  }

  store.roadmap_nodes[mapKey] = nodes;
  saveStore(store);
  return nodes;
}

// =========================================================================
//  FINALS PART 2 — Step 4: Part 1 Collaborative Hook Challenges
// =========================================================================

export function getOrCreateChallengeRecord(
  sessionId: string,
  topic: string,
  customData?: Partial<ChallengeRecord>
): ChallengeRecord {
  const store = loadStore();
  const existing = store.challenge_records[sessionId];
  if (existing) {
    return existing;
  }

  const newChallenge: ChallengeRecord = {
    id: `chal_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    session_id: sessionId,
    topic: topic || 'React',
    question:
      customData?.question ||
      `Implement a resilient asynchronous state synchronizer in ${topic}. Handle race conditions, debounced updates, and proper cleanup.`,
    rubric: customData?.rubric || {
      criteria: [
        'Correct logic and state updates',
        'Proper error and loading boundary management',
        'Clean edge case handling and cleanup',
      ],
      max_score: 100,
    },
    starter_code:
      customData?.starter_code ||
      `// Collaborative Challenge: ${topic}\nfunction useAsyncSync(endpoint) {\n  // Implement your collaborative solution\n  return { status: 'idle', data: null };\n}`,
    created_at: new Date().toISOString(),
  };

  store.challenge_records[sessionId] = newChallenge;
  saveStore(store);
  return newChallenge;
}

export function saveSubmissionRecord(
  data: Omit<SubmissionRecord, 'id' | 'created_at'>
): SubmissionRecord {
  const store = loadStore();
  if (!store.submissions[data.challenge_id]) {
    store.submissions[data.challenge_id] = [];
  }

  const userSubmissions = store.submissions[data.challenge_id];
  const existingIdx = userSubmissions.findIndex(
    (s) => s.user_id.toLowerCase() === data.user_id.toLowerCase()
  );

  const record: SubmissionRecord = {
    id: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    challenge_id: data.challenge_id,
    user_id: data.user_id.trim().toLowerCase(),
    answer: data.answer,
    score: data.score,
    feedback: data.feedback || null,
    status: data.status,
    created_at: new Date().toISOString(),
  };

  if (existingIdx !== -1) {
    userSubmissions[existingIdx] = record;
  } else {
    userSubmissions.push(record);
  }

  saveStore(store);
  return record;
}

export function getChallengeSubmissions(challengeId: string): SubmissionRecord[] {
  const store = loadStore();
  return store.submissions[challengeId] || [];
}

// =========================================================================
//  FINALS PART 2 — Step 3: Part 2 Daily Assessment
// =========================================================================

export function getOrCreateDailyAssessmentRecord(
  userId: string,
  topic: string,
  date: string,
  generator?: () => DailyAssessmentRecord['questions']
): DailyAssessmentRecord {
  const store = loadStore();
  const normUser = userId.trim().toLowerCase();
  const assessKey = `${normUser}___${date}`;

  const existing = store.daily_assessments[assessKey];
  if (existing) {
    return existing;
  }

  const questions = generator
    ? generator()
    : {
        mcqs: [
          {
            id: 'q1',
            question: `In ${topic}, what is the primary purpose of state immutability?`,
            options: [
              'To prevent mutation of values so change detection is predictable',
              'To speed up arithmetic operations',
              'To bypass garbage collection',
              'To enforce strict type casting',
            ],
            correct_index: 0,
          },
          {
            id: 'q2',
            question: `Which data structure or pattern is best suited for caching previous calculations in ${topic}?`,
            options: [
              'FIFO Queue',
              'Memoization Map / Hash Table',
              'Linked List',
              'Binary Heap',
            ],
            correct_index: 1,
          },
          {
            id: 'q3',
            question: `What is the asymptotic time complexity of looking up a key in a standard hash map in ${topic}?`,
            options: ['O(N)', 'O(log N)', 'O(1) average', 'O(N^2)'],
            correct_index: 2,
          },
          {
            id: 'q4',
            question: `When handling asynchronous operations in ${topic}, how should unhandled promise rejections be addressed?`,
            options: [
              'Ignore them because Node handles them silently',
              'Attach a .catch() handler or use try/catch blocks',
              'Wrap in a while loop until resolved',
              'Convert them to synchronous calls',
            ],
            correct_index: 1,
          },
        ],
        short_answer: {
          id: 'q5',
          question: `Explain how you would handle race conditions when two async requests for ${topic} complete in arbitrary order.`,
          rubric:
            'Must mention request cancellation (AbortController), tracking sequence counters/timestamps, or ignoring stale responses.',
        },
      };

  const newRecord: DailyAssessmentRecord = {
    id: `da_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    user_id: normUser,
    date,
    topic,
    questions,
    status: 'pending',
    score: null,
    completed_at: null,
    xp_awarded: 0,
  };

  store.daily_assessments[assessKey] = newRecord;
  saveStore(store);
  return newRecord;
}

export function submitDailyAssessmentRecord(
  userId: string,
  date: string,
  score: number,
  status: 'completed' | 'failed',
  xp: number
): DailyAssessmentRecord | null {
  const store = loadStore();
  const normUser = userId.trim().toLowerCase();
  const assessKey = `${normUser}___${date}`;

  const record = store.daily_assessments[assessKey];
  if (!record || record.status === 'completed') {
    return record || null; // Idempotent: don't double award
  }

  record.score = score;
  record.status = status;
  record.completed_at = new Date().toISOString();
  record.xp_awarded = xp;

  if (xp > 0) {
    const profile = store.profiles[normUser];
    if (profile) {
      profile.xp = (profile.xp || 350) + xp;
    }
  }

  saveStore(store);
  return record;
}

// =========================================================================
//  FINALS PART 2 — Step 6: Part 5 Video Library & Effectiveness
// =========================================================================

export const CURATED_TOPIC_VIDEOS: Record<string, { youtubeId: string; title: string }> = {
  react: {
    youtubeId: 'bMknfKXIFA8',
    title: 'React Course - Beginner to Advanced Tutorial',
  },
  python: {
    youtubeId: '_uQrJ0TkZlc',
    title: 'Python for Beginners - Full Course',
  },
  javascript: {
    youtubeId: 'W6NZfCO5SIk',
    title: 'JavaScript Tutorial for Beginners: Learn JavaScript in 1 Hour',
  },
  'machine learning': {
    youtubeId: 'i_LwzRVP7bg',
    title: 'Machine Learning for Everybody – Full Course',
  },
  'data structures': {
    youtubeId: 'RBSGKlAvoiM',
    title: 'Data Structures and Algorithms for Beginners',
  },
};

export function getVideoForTopic(topic: string): VideoLibraryItem {
  const store = loadStore();
  const norm = topic.trim().toLowerCase();

  // Check store
  const existing = store.video_library.find(
    (v) => v.topic.toLowerCase().includes(norm) && v.status === 'active'
  );
  if (existing) return existing;

  // Use curated default
  let picked = CURATED_TOPIC_VIDEOS.react;
  for (const k of Object.keys(CURATED_TOPIC_VIDEOS)) {
    if (norm.includes(k) || k.includes(norm)) {
      picked = CURATED_TOPIC_VIDEOS[k];
      break;
    }
  }

  const item: VideoLibraryItem = {
    id: `vid_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    topic,
    youtube_id: picked.youtubeId,
    title: picked.title,
    status: 'active',
    created_at: new Date().toISOString(),
  };

  store.video_library.push(item);
  saveStore(store);
  return item;
}

export function recordVideoAttempt(
  videoId: string,
  topic: string,
  score: number
): VideoEffectivenessRecord {
  const store = loadStore();
  let rec = store.video_effectiveness[videoId];
  if (!rec) {
    rec = {
      id: `ve_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      video_id: videoId,
      topic,
      attempts: 0,
      avg_score: 0,
      total_score: 0,
      updated_at: new Date().toISOString(),
    };
  }

  rec.attempts += 1;
  rec.total_score += score;
  rec.avg_score = Math.round((rec.total_score / rec.attempts) * 10) / 10;
  rec.updated_at = new Date().toISOString();

  // Hard rule: After at least 5 attempts, an average under 50% marks video deprecated
  if (rec.attempts >= 5 && rec.avg_score < 50) {
    const vid = store.video_library.find((v) => v.id === videoId || v.youtube_id === videoId);
    if (vid) {
      vid.status = 'deprecated';
    }
  }

  store.video_effectiveness[videoId] = rec;
  saveStore(store);
  return rec;
}

export function deprecateVideo(videoId: string, reason?: string): boolean {
  const store = loadStore();
  const vid = store.video_library.find((v) => v.id === videoId || v.youtube_id === videoId);
  if (vid) {
    vid.status = 'deprecated';
    saveStore(store);
    return true;
  }
  return false;
}

// =========================================================================
//  FINALS PART 2 — Step 8: Part 7 Agent Activity Feed
// =========================================================================

export function logAgentActivity(
  agent: AgentActivityEntry['agent'],
  action: string,
  reason: string,
  details?: Record<string, any>
): AgentActivityEntry {
  const store = loadStore();
  const entry: AgentActivityEntry = {
    id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    agent,
    action,
    reason,
    details: details || {},
  };

  store.agent_activity_logs.unshift(entry);
  if (store.agent_activity_logs.length > 200) {
    store.agent_activity_logs = store.agent_activity_logs.slice(0, 200);
  }
  saveStore(store);
  return entry;
}

export function getAgentActivityLogs(limit = 50): AgentActivityEntry[] {
  const store = loadStore();
  return (store.agent_activity_logs || []).slice(0, limit);
}

// =========================================================================
//  STUDY ROOM — "Start Learning Session" Operations & Free Minutes Guard
// =========================================================================

/**
 * Calculates total participant-minutes for the current calendar month across all sessions.
 * Free-minutes guard limit: 8,000 participant-minutes.
 */
export function getMonthlyParticipantMinutes(): number {
  const store = loadStore();
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  let totalMinutes = 0;
  for (const room of Object.values(store.study_rooms || {})) {
    const roomCreated = new Date(room.created_at).getTime();
    if (roomCreated >= currentMonthStart) {
      for (const att of Object.values(room.attendance || {})) {
        const durationMs = Math.max(0, (att.last_seen || att.joined_at) - att.joined_at);
        totalMinutes += Math.round(durationMs / 60000);
      }
    }
  }
  return totalMinutes;
}

/**
 * Retrieves all live study rooms, enriched with active learner count, host teacher status,
 * and automatically ending stale/empty rooms (5 min empty rule, 90 min max duration rule).
 */
export function getLiveStudyRooms(): Array<CloudStudyRoom & {
  currentLearnerCount: number;
  isFull: boolean;
  hostVerifiedTeacher: boolean;
  minutesRemaining: number;
}> {
  const store = loadStore();
  const now = Date.now();
  const rooms = Object.values(store.study_rooms || {});
  const activeRooms: Array<any> = [];

  for (const room of rooms) {
    if (room.status !== 'live') continue;

    const createdAt = new Date(room.created_at).getTime();
    const ageMinutes = (now - createdAt) / 60000;

    // Rule 1: Session auto-ends after 90 minutes
    if (ageMinutes >= 90) {
      room.status = 'ended';
      room.ended_at = new Date().toISOString();
      continue;
    }

    // Calculate active participants (heartbeat within last 45 seconds)
    const activeMembers = Object.values(room.attendance || {}).filter(
      (a) => now - (a.last_seen || 0) <= 45000
    );
    const learnerCount = activeMembers.length;

    // Rule 2: An empty room ends after 5 minutes of 0 active learners
    if (ageMinutes >= 5 && learnerCount === 0) {
      room.status = 'ended';
      room.ended_at = new Date().toISOString();
      continue;
    }

    // Check if host has verified_level >= 3 or verified badge
    const hostPeer = store.peers[room.host_id.toLowerCase()];
    const hostProfile = store.profiles[room.host_id.toLowerCase()];
    const hostDecls = store.skill_declarations[room.host_id.toLowerCase()] || [];
    const isTeacher = Boolean(
      (hostPeer && (hostPeer.verified_level || 0) >= 3) ||
      (hostProfile && (hostProfile.numeric_level || 0) >= 3) ||
      hostDecls.some((d) => d.status === 'verified' && d.verified_level >= 3)
    );

    const isFull = learnerCount >= room.max_participants;
    const minutesRemaining = Math.max(0, Math.round(90 - ageMinutes));

    activeRooms.push({
      ...room,
      currentLearnerCount: learnerCount,
      isFull,
      hostVerifiedTeacher: isTeacher,
      minutesRemaining,
    });
  }

  saveStore(store);
  return activeRooms;
}

export function getStudyRoom(roomId: string): CloudStudyRoom | null {
  const store = loadStore();
  return store.study_rooms[roomId] || null;
}

export function createStudyRoom(data: {
  name: string;
  topic: string;
  host_id: string;
  host_name: string;
  type: 'pair' | 'group';
  max_participants: number;
  daily_room_name: string;
  daily_room_url?: string;
}): { success: boolean; room?: CloudStudyRoom; error?: string } {
  const store = loadStore();

  // Free-minutes guard: above 8,000 participant-minutes, disable creating NEW group rooms
  if (data.type === 'group') {
    const totalMinutes = getMonthlyParticipantMinutes();
    if (totalMinutes >= 8000) {
      return {
        success: false,
        error: 'Study rooms are resting for this month. 1-on-1 pair calls are still available.',
      };
    }
  }

  const roomId = `room_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const nowStr = new Date().toISOString();

  const newRoom: CloudStudyRoom = {
    id: roomId,
    name: data.name,
    topic: data.topic,
    host_id: data.host_id.toLowerCase(),
    host_name: data.host_name,
    type: data.type,
    max_participants: Math.min(10, Math.max(data.type === 'pair' ? 2 : 3, data.max_participants || 6)),
    status: 'live',
    daily_room_name: data.daily_room_name,
    daily_room_url: data.daily_room_url,
    created_at: nowStr,
    ended_at: null,
    members: {
      [data.host_id.toLowerCase()]: {
        room_id: roomId,
        user_id: data.host_id.toLowerCase(),
        user_name: data.host_name,
        role: 'host',
        joined_at: nowStr,
      },
    },
    resources: [],
    attendance: {
      [data.host_id.toLowerCase()]: {
        room_id: roomId,
        user_id: data.host_id.toLowerCase(),
        user_name: data.host_name,
        joined_at: Date.now(),
        last_seen: Date.now(),
      },
    },
  };

  store.study_rooms[roomId] = newRoom;
  saveStore(store);

  logAgentActivity(
    'System',
    `Created ${data.type} study room: ${data.name}`,
    `Room provisioned for ${data.topic} with ${newRoom.max_participants} max participants`,
    { roomId, host: data.host_name, topic: data.topic }
  );

  return { success: true, room: newRoom };
}

export function joinStudyRoom(
  roomId: string,
  userId: string,
  userName: string,
  role: 'host' | 'member' = 'member',
  invitedBy?: string
): { success: boolean; room?: CloudStudyRoom; error?: string } {
  const store = loadStore();
  const room = store.study_rooms[roomId];

  if (!room || room.status !== 'live') {
    return { success: false, error: 'Room does not exist or has ended' };
  }

  const normUser = userId.toLowerCase();
  const now = Date.now();

  // Check if room is full (if user is not already a member)
  const activeCount = Object.values(room.attendance || {}).filter(
    (a) => now - (a.last_seen || 0) <= 45000 && a.user_id !== normUser
  ).length;

  if (activeCount >= room.max_participants) {
    return { success: false, error: 'Room is full' };
  }

  // Add or update member
  room.members[normUser] = {
    room_id: roomId,
    user_id: normUser,
    user_name: userName,
    role: room.host_id === normUser ? 'host' : role,
    invited_by: invitedBy,
    joined_at: room.members[normUser]?.joined_at || new Date().toISOString(),
  };

  // Update attendance
  if (!room.attendance[normUser]) {
    room.attendance[normUser] = {
      room_id: roomId,
      user_id: normUser,
      user_name: userName,
      joined_at: now,
      last_seen: now,
    };
  } else {
    room.attendance[normUser].last_seen = now;
  }

  saveStore(store);
  return { success: true, room };
}

export function updateStudyRoomAttendance(roomId: string, userId: string, userName: string): boolean {
  const store = loadStore();
  const room = store.study_rooms[roomId];
  if (!room || room.status !== 'live') return false;

  const normUser = userId.toLowerCase();
  const now = Date.now();

  if (!room.attendance[normUser]) {
    room.attendance[normUser] = {
      room_id: roomId,
      user_id: normUser,
      user_name: userName,
      joined_at: now,
      last_seen: now,
    };
  } else {
    room.attendance[normUser].last_seen = now;
  }

  saveStore(store);
  return true;
}

export function leaveStudyRoom(
  roomId: string,
  userId: string
): { success: boolean; durationMinutes: number; eligibleForXp: boolean; xpAwarded: number } {
  const store = loadStore();
  const room = store.study_rooms[roomId];
  if (!room) return { success: false, durationMinutes: 0, eligibleForXp: false, xpAwarded: 0 };

  const normUser = userId.toLowerCase();
  const att = room.attendance[normUser];
  const now = Date.now();

  let durationMinutes = 0;
  if (att) {
    att.last_seen = now;
    durationMinutes = Math.round((now - att.joined_at) / 60000);
  }

  // XP integrity: XP awarded only after at least 10 real minutes in room
  const eligibleForXp = durationMinutes >= 10;
  const xpAwarded = eligibleForXp ? 50 : 0;

  saveStore(store);
  return { success: true, durationMinutes, eligibleForXp, xpAwarded };
}

export function endStudyRoom(roomId: string, endedBy: string): { success: boolean; summary?: any } {
  const store = loadStore();
  const room = store.study_rooms[roomId];
  if (!room) return { success: false };

  room.status = 'ended';
  room.ended_at = new Date().toISOString();

  const totalLearners = Object.keys(room.attendance || {}).length;
  const createdAt = new Date(room.created_at).getTime();
  const durationMin = Math.round((Date.now() - createdAt) / 60000);

  logAgentActivity(
    'System',
    `Study room ended: ${room.name}`,
    `Session completed: ${durationMin} min duration with ${totalLearners} attendees`,
    { roomId, durationMin, totalLearners, endedBy }
  );

  saveStore(store);
  return {
    success: true,
    summary: {
      roomId,
      name: room.name,
      topic: room.topic,
      durationMinutes: durationMin,
      totalLearners,
      attendees: Object.values(room.attendance).map((a) => a.user_name),
    },
  };
}

export function addRoomResource(
  roomId: string,
  userId: string,
  userName: string,
  kind: 'file' | 'link',
  title: string,
  url: string
): CloudRoomResource | null {
  const store = loadStore();
  const room = store.study_rooms[roomId];
  if (!room) return null;

  const resItem: CloudRoomResource = {
    id: `res_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    room_id: roomId,
    user_id: userId,
    user_name: userName,
    kind,
    title,
    url,
    created_at: new Date().toISOString(),
  };

  room.resources.push(resItem);
  saveStore(store);
  return resItem;
}

export function getRoomResources(roomId: string): CloudRoomResource[] {
  const store = loadStore();
  const room = store.study_rooms[roomId];
  return room ? room.resources || [] : [];
}

export function createReport(
  reporterId: string,
  reportedId: string,
  roomId: string,
  reason: string
): CloudReport {
  const store = loadStore();
  const rep: CloudReport = {
    id: `rep_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    reporter_id: reporterId,
    reported_id: reportedId,
    room_id: roomId,
    reason,
    created_at: new Date().toISOString(),
  };

  store.reports.push(rep);
  saveStore(store);

  logAgentActivity(
    'System',
    `User Report Filed`,
    `Report filed against ${reportedId} in session ${roomId}: "${reason}"`,
    { reporterId, reportedId, roomId }
  );

  return rep;
}

export function updateRoomBoard(roomId: string, elements: any[]): boolean {
  const store = loadStore();
  const room = store.study_rooms[roomId];
  if (!room) return false;
  room.board_elements = elements;
  saveStore(store);
  return true;
}

export function getRoomBoard(roomId: string): any[] {
  const store = loadStore();
  const room = store.study_rooms[roomId];
  return room?.board_elements || [];
}

// =========================================================================
//  Adaptive Engine v2 Helpers (Sections 1 - 6)
// =========================================================================

export function getSkillTopics(skill: string): SkillTopic[] {
  const store = loadStore();
  const normSkill = (skill || '').trim().toLowerCase();
  if (store.skill_topics[normSkill] && store.skill_topics[normSkill].length > 0) {
    return store.skill_topics[normSkill];
  }

  // Initialize from default roadmap topics
  const defaultList = getDefaultTopicsForSkill(normSkill);
  const items: SkillTopic[] = defaultList.map((topic, order_index) => ({
    skill: normSkill,
    topic,
    order_index,
  }));
  store.skill_topics[normSkill] = items;
  saveStore(store);
  return items;
}

export function computeTopicMasteryLabel(mastery: number, answered: number): TopicMasteryLabel {
  if (answered < 3) {
    return 'Not enough data yet';
  }
  if (mastery >= 70) {
    return 'Strong';
  }
  if (mastery >= 50) {
    return 'Developing';
  }
  return 'Weak';
}

export function getTopicMastery(userId: string, skill: string, topic?: string): TopicMastery[] {
  const store = loadStore();
  const normUser = (userId || '').trim().toLowerCase();
  const normSkill = (skill || '').trim().toLowerCase();

  const allTopics = getSkillTopics(normSkill);
  const results: TopicMastery[] = [];

  for (const t of allTopics) {
    if (topic && t.topic.toLowerCase() !== topic.toLowerCase()) continue;
    const key = `${normUser}___${normSkill}___${t.topic.toLowerCase()}`;
    const record = store.topic_mastery[key];
    if (record) {
      results.push({
        ...record,
        label: computeTopicMasteryLabel(record.mastery, record.answered),
      });
    } else {
      // Default initial record
      results.push({
        user_id: normUser,
        skill: normSkill,
        topic: t.topic,
        mastery: 0,
        answered: 0,
        updated_at: new Date().toISOString(),
        label: 'Not enough data yet',
      });
    }
  }

  return results;
}

export function updateTopicMastery(
  userId: string,
  skill: string,
  topic: string,
  newPercent: number
): TopicMastery {
  const store = loadStore();
  const normUser = (userId || '').trim().toLowerCase();
  const normSkill = (skill || '').trim().toLowerCase();
  const normTopic = (topic || '').trim();
  const key = `${normUser}___${normSkill}___${normTopic.toLowerCase()}`;

  const cleanPercent = Math.max(0, Math.min(100, Math.round(newPercent)));
  const existing = store.topic_mastery[key];

  let nextMastery: number;
  let nextAnswered: number;

  if (existing && existing.answered > 0) {
    // Formula: mastery = 0.6 * new_percent + 0.4 * old_mastery
    nextMastery = Math.round(0.6 * cleanPercent + 0.4 * existing.mastery);
    nextAnswered = existing.answered + 1;
  } else {
    // First time: just the new percent
    nextMastery = cleanPercent;
    nextAnswered = 1;
  }

  const updated: TopicMastery = {
    id: existing?.id || `tm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    user_id: normUser,
    skill: normSkill,
    topic: normTopic,
    mastery: nextMastery,
    answered: nextAnswered,
    updated_at: new Date().toISOString(),
    label: computeTopicMasteryLabel(nextMastery, nextAnswered),
  };

  store.topic_mastery[key] = updated;
  saveStore(store);
  return updated;
}

// ─── Action History ─────────────────────────────────────────────
export function getActionHistory(userId: string, topic?: string): ActionHistoryRecord[] {
  const store = loadStore();
  const normUser = (userId || '').trim().toLowerCase();
  const list: ActionHistoryRecord[] = [];

  for (const key of Object.keys(store.action_history)) {
    if (key.startsWith(`${normUser}___`)) {
      if (topic) {
        const expectedKey = `${normUser}___${topic.toLowerCase()}`;
        if (key !== expectedKey) continue;
      }
      list.push(...store.action_history[key]);
    }
  }

  return list.sort((a, b) => new Date(b.tried_at).getTime() - new Date(a.tried_at).getTime());
}

export function recordActionHistory(
  userId: string,
  topic: string,
  action: string,
  outcome: 'passed' | 'failed' | 'skipped' | 'pending'
): ActionHistoryRecord {
  const store = loadStore();
  const normUser = (userId || '').trim().toLowerCase();
  const normTopic = (topic || '').trim().toLowerCase();
  const key = `${normUser}___${normTopic}`;

  if (!store.action_history[key]) {
    store.action_history[key] = [];
  }

  const record: ActionHistoryRecord = {
    id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    user_id: normUser,
    topic: topic.trim(),
    action,
    tried_at: new Date().toISOString(),
    outcome,
  };

  store.action_history[key].push(record);
  saveStore(store);
  return record;
}

export function hasActionFailedRecently(
  userId: string,
  topic: string,
  action: string
): boolean {
  const history = getActionHistory(userId, topic);
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

  return history.some((h) => {
    if (h.action !== action || h.outcome !== 'failed') return false;
    const triedTime = new Date(h.tried_at).getTime();
    return triedTime >= oneDayAgo;
  });
}

// ─── Agent Decisions ("Why am I being recommended this?") ───────
export function recordAgentDecision(
  decision: Omit<AgentDecision, 'id' | 'created_at'>
): AgentDecision {
  const store = loadStore();
  const record: AgentDecision = {
    id: `dec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    user_id: decision.user_id.trim().toLowerCase(),
    kind: decision.kind,
    action: decision.action,
    reason_code: decision.reason_code,
    reason_text: decision.reason_text,
    evidence: decision.evidence || {},
    created_at: new Date().toISOString(),
  };

  store.agent_decisions.unshift(record);
  if (store.agent_decisions.length > 500) {
    store.agent_decisions = store.agent_decisions.slice(0, 500);
  }

  saveStore(store);
  return record;
}

export function getAgentDecision(id: string): AgentDecision | null {
  const store = loadStore();
  return store.agent_decisions.find((d) => d.id === id) || null;
}

export function getAgentDecisionsForUser(userId: string, limit = 20): AgentDecision[] {
  const store = loadStore();
  const normUser = (userId || '').trim().toLowerCase();
  return store.agent_decisions
    .filter((d) => d.user_id === normUser)
    .slice(0, limit);
}

// ─── Session Summaries ──────────────────────────────────────────
export function saveSessionSummary(
  summary: Omit<SessionSummaryRecord, 'id' | 'created_at'>
): SessionSummaryRecord {
  const store = loadStore();
  const record: SessionSummaryRecord = {
    id: `sum_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    session_id: summary.session_id,
    user_id: summary.user_id.trim().toLowerCase(),
    topic: summary.topic,
    duration_minutes: summary.duration_minutes,
    before_score: summary.before_score !== null && typeof summary.before_score === 'number' ? summary.before_score : null,
    after_score: summary.after_score !== null && typeof summary.after_score === 'number' ? summary.after_score : null,
    improvement: summary.improvement !== null && typeof summary.improvement === 'number' ? summary.improvement : null,
    next_recommendation: summary.next_recommendation || { action: 'practice' },
    ai_summary: summary.ai_summary || '',
    ai_review: summary.ai_review || '',
    created_at: new Date().toISOString(),
  };

  store.session_summaries.unshift(record);
  saveStore(store);
  return record;
}

export function getSessionSummaries(userId: string): SessionSummaryRecord[] {
  const store = loadStore();
  const normUser = (userId || '').trim().toLowerCase();
  return store.session_summaries.filter((s) => s.user_id === normUser);
}

export function getLatestSessionSummary(userId: string, sessionId?: string): SessionSummaryRecord | null {
  const store = loadStore();
  const normUser = (userId || '').trim().toLowerCase();
  if (sessionId) {
    return store.session_summaries.find((s) => s.user_id === normUser && s.session_id === sessionId) || null;
  }
  return store.session_summaries.find((s) => s.user_id === normUser) || null;
}

// ─── Teaching Stats ─────────────────────────────────────────────
export function getTeachingStats(userId: string, skill?: string): TeachingStats[] {
  const store = loadStore();
  const normUser = (userId || '').trim().toLowerCase();
  const list: TeachingStats[] = [];

  for (const key of Object.keys(store.teaching_stats)) {
    if (key.startsWith(`${normUser}___`)) {
      if (skill) {
        const expectedKey = `${normUser}___${skill.toLowerCase()}`;
        if (key !== expectedKey) continue;
      }
      list.push(store.teaching_stats[key]);
    }
  }

  return list;
}

export function updateTeachingStats(
  userId: string,
  skill: string,
  sessionDelta: number
): TeachingStats {
  const store = loadStore();
  const normUser = (userId || '').trim().toLowerCase();
  const normSkill = (skill || '').trim().toLowerCase();
  const key = `${normUser}___${normSkill}`;

  const existing = store.teaching_stats[key];
  let nextSessions: number;
  let nextAvgImprovement: number;

  if (existing) {
    nextSessions = existing.sessions + 1;
    nextAvgImprovement = Math.round(
      ((existing.avg_improvement * existing.sessions) + sessionDelta) / nextSessions
    );
  } else {
    nextSessions = 1;
    nextAvgImprovement = Math.round(sessionDelta);
  }

  const updated: TeachingStats = {
    id: existing?.id || `ts_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    user_id: normUser,
    skill: normSkill,
    sessions: nextSessions,
    avg_improvement: nextAvgImprovement,
    updated_at: new Date().toISOString(),
  };

  store.teaching_stats[key] = updated;
  saveStore(store);
  return updated;
}

// ─── Private Calls (pair-<connection_id>) ───────────────────────
export function createCallRecord(call: {
  connection_id: string;
  caller_id: string;
  caller_name: string;
  caller_avatar?: string;
  callee_id: string;
  type?: 'voice' | 'video' | 'audio';
  room_name?: string;
}): CloudCallRecord {
  const store = loadStore();
  const id = `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const record: CloudCallRecord = {
    id,
    connection_id: call.connection_id,
    caller_id: (call.caller_id || '').trim().toLowerCase(),
    caller_name: call.caller_name || 'Caller',
    caller_avatar: call.caller_avatar,
    callee_id: (call.callee_id || '').trim().toLowerCase(),
    type: call.type || 'voice',
    status: 'ringing',
    room_name: call.room_name || `pair-${call.connection_id}`,
    created_at: new Date().toISOString(),
  };

  if (!store.calls) store.calls = {};
  store.calls[id] = record;
  saveStore(store);
  return record;
}

export function getIncomingCallsForUser(userId: string): CloudCallRecord[] {
  const store = loadStore();
  if (!store.calls) return [];
  const normUser = (userId || '').trim().toLowerCase();
  const now = Date.now();
  const results: CloudCallRecord[] = [];

  for (const c of Object.values(store.calls)) {
    if (c.callee_id === normUser) {
      const ageMs = now - new Date(c.created_at).getTime();
      // Ring timeout 30s -> mark as missed
      if (c.status === 'ringing' && ageMs > 30000) {
        c.status = 'missed';
      } else if (c.status === 'ringing' && ageMs <= 60000) {
        results.push(c);
      }
    }
  }

  saveStore(store);
  return results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function updateCallStatus(callId: string, status: CloudCallRecord['status']): CloudCallRecord | null {
  const store = loadStore();
  if (!store.calls || !store.calls[callId]) return null;
  store.calls[callId].status = status;
  saveStore(store);
  return store.calls[callId];
}

export function getCallRecord(callId: string): CloudCallRecord | null {
  const store = loadStore();
  return store.calls?.[callId] || null;
}
