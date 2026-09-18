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
  level: string;
  goal: string;
  score: number;
  completed_at: string;
  onboarding_complete: boolean;
}

export interface CloudPeer {
  id: string;
  name: string;
  email: string;
  domain: string;
  level: string;
  score: number;
  avatar?: string;
  lastSeen: number;
  offers: string[];
  needs: string[];
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

interface CloudStoreData {
  users: Record<string, CloudUser>;
  profiles: Record<string, CloudProfile>;
  peers: Record<string, CloudPeer>;
  messages: CloudMessage[];
}

// Global in-memory cache to maintain state across hot lambda invocations
declare global {
  var __synapse_cloud_cache: CloudStoreData | undefined;
}

function getCacheFilePath(): string {
  // Use OS tmp dir which is writable on Vercel (/tmp) and Windows (%TEMP%)
  return path.join(os.tmpdir(), 'synapse_cloud_store_v2.json');
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
    // If file write fails on any restricted environment, in-memory cache still holds state
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

export function saveCloudProfile(profile: Partial<CloudProfile> & { email: string; name: string }): CloudProfile {
  const store = loadStore();
  const normalized = profile.email.trim().toLowerCase();
  const existing = store.profiles[normalized] || {};

  const updated: CloudProfile = {
    name: profile.name || existing.name || profile.email.split('@')[0],
    email: normalized,
    bio: profile.bio ?? existing.bio ?? '',
    domain: profile.domain || existing.domain || 'React',
    level: profile.level || existing.level || 'intermediate',
    goal: profile.goal || existing.goal || '30-day sprint to skill mastery',
    score: profile.score ?? existing.score ?? 85,
    completed_at: profile.completed_at || existing.completed_at || new Date().toISOString(),
    onboarding_complete: true,
  };

  store.profiles[normalized] = updated;

  // Also auto-register or update this user in active peers
  store.peers[normalized] = {
    id: normalized,
    name: updated.name,
    email: normalized,
    domain: updated.domain,
    level: updated.level,
    score: updated.score,
    lastSeen: Date.now(),
    offers: [updated.domain, 'Problem Solving', 'Code Review'],
    needs: ['System Design', 'Performance Optimization'],
  };

  saveStore(store);
  return updated;
}

// --- Cloud Peers ---
export function getActivePeers(excludeEmail?: string): CloudPeer[] {
  const store = loadStore();
  const now = Date.now();
  const normExclude = excludeEmail?.trim().toLowerCase() || '';

  return Object.values(store.peers)
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
    score: Number(peer.score) || 85,
    avatar: peer.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(peer.name)}&background=D97706&color=fff`,
    lastSeen: Date.now(),
    offers: peer.offers || [track, 'Problem Solving', 'Code Review'],
    needs: peer.needs || ['System Design', 'Performance Optimization'],
  };

  store.peers[normalized] = updated;
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
  // Cap at last 250 messages
  if (store.messages.length > 250) {
    store.messages = store.messages.slice(-250);
  }
  saveStore(store);
  return newMsg;
}
