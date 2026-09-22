import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import dns from 'dns';

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
}

export interface CloudMessage {
  id: string;
  sessionId: string;
  senderId: string;
  senderName: string;
  senderRole: 'peer' | 'me';
  text: string;
  timestamp: string;
}

export interface CloudConnection {
  id: string;
  requesterId: string;
  requesterName: string;
  recipientId: string;
  recipientName: string;
  skillArea: string;
  status: 'pending' | 'accepted' | 'declined';
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
    .filter((p) => !normExclude || p.email.toLowerCase() !== normExclude);
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
    .filter((m) => m.sessionId === sessionId || m.sessionId === 'global_collab')
    .slice(-limit);
}

export function addMessage(msg: {
  sessionId?: string;
  senderId: string;
  senderName: string;
  senderRole?: 'peer' | 'me';
  text: string;
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
  };

  store.messages.push(newMsg);
  if (store.messages.length > 250) {
    store.messages = store.messages.slice(-250);
  }
  saveStore(store);
  return newMsg;
}

// --- Connections (Pending -> Accepted -> Declined) ---
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

  // If connection already exists, return existing
  if (store.connections[connKey]) {
    return store.connections[connKey];
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
  status: 'accepted' | 'declined'
): CloudConnection | null {
  const store = loadStore();
  const connKey = Object.keys(store.connections).find((k) => store.connections[k].id === connId);
  if (!connKey) return null;

  store.connections[connKey].status = status;
  store.connections[connKey].updatedAt = new Date().toISOString();
  saveStore(store);
  return store.connections[connKey];
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

  const newMission: CloudDailyMission = {
    id: 'dm_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    userId: norm,
    date: today,
    taskText: `Master ${sourceTopic}: Solve 2 practice challenges & explain concept to a peer`,
    sourceTopic,
    completedAt: null,
    xpReward: 50,
  };

  store.daily_missions[norm].push(newMission);
  saveStore(store);
  return newMission;
}

export function completeDailyMission(userId: string, missionId: string): { success: boolean; xpEarned: number } {
  const store = loadStore();
  const norm = userId.trim().toLowerCase();
  const userMissions = store.daily_missions[norm] || [];
  const mission = userMissions.find((m) => m.id === missionId);

  if (!mission || mission.completedAt) {
    return { success: false, xpEarned: 0 };
  }

  mission.completedAt = new Date().toISOString();

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
