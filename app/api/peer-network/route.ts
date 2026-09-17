import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Shared persistence for cross-device peer discovery
interface ActivePeer {
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

interface PeerMessage {
  id: string;
  sessionId: string;
  senderId: string;
  senderName: string;
  senderRole: 'peer' | 'me';
  text: string;
  timestamp: string;
}

const CACHE_FILE = path.join(process.cwd(), '.peer_network_cache.json');

function loadCache(): { peers: Record<string, ActivePeer>; messages: PeerMessage[] } {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
    }
  } catch (e) {}
  return { peers: {}, messages: [] };
}

function saveCache(data: { peers: Record<string, ActivePeer>; messages: PeerMessage[] }) {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {}
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const excludeEmail = searchParams.get('excludeEmail')?.toLowerCase() || '';
  const excludeId = searchParams.get('excludeId') || '';
  const sessionId = searchParams.get('sessionId') || '';

  const cache = loadCache();

  // If asking for messages
  if (sessionId) {
    const sessionMessages = cache.messages
      .filter(m => m.sessionId === sessionId || m.sessionId === 'global_collab')
      .slice(-50);
    return NextResponse.json({ messages: sessionMessages });
  }

  // Prune peers inactive for > 24 hours
  const now = Date.now();
  const peersList = Object.values(cache.peers)
    .filter(p => now - p.lastSeen < 24 * 60 * 60 * 1000)
    .filter(p => {
      if (excludeEmail && p.email.toLowerCase() === excludeEmail) return false;
      if (excludeId && p.id === excludeId) return false;
      return true;
    });

  return NextResponse.json({ peers: peersList });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const cache = loadCache();

    // Case 1: Posting a message
    if (body.type === 'message') {
      const msg: PeerMessage = {
        id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        sessionId: body.sessionId || 'global_collab',
        senderId: body.senderId || 'anon',
        senderName: body.senderName || 'Peer',
        senderRole: 'peer',
        text: body.text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      cache.messages.push(msg);
      // Keep last 200 messages
      if (cache.messages.length > 200) cache.messages = cache.messages.slice(-200);
      saveCache(cache);
      return NextResponse.json({ success: true, message: msg });
    }

    // Case 2: Registering / heartbeat of an active peer
    const { id, name, email, domain, level, score, avatar } = body;
    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    const peerKey = email.toLowerCase();
    const track = domain || 'React';
    cache.peers[peerKey] = {
      id: id || peerKey,
      name: name || email.split('@')[0],
      email: peerKey,
      domain: track,
      level: level || 'intermediate',
      score: Number(score) || 80,
      avatar: avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'Learner')}&background=D97706&color=fff`,
      lastSeen: Date.now(),
      offers: [track, 'Problem Solving', 'Code Review'],
      needs: ['System Design', 'Performance Optimization']
    };

    saveCache(cache);
    return NextResponse.json({ success: true, peer: cache.peers[peerKey] });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}
