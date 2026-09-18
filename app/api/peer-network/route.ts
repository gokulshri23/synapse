import { NextResponse } from 'next/server';
import {
  getActivePeers,
  updatePeerHeartbeat,
  getMessages,
  addMessage,
} from '@/lib/cloudStore';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const excludeEmail = searchParams.get('excludeEmail') || '';
    const sessionId = searchParams.get('sessionId') || '';

    // If querying chat messages
    if (sessionId) {
      const messages = getMessages(sessionId, 60);
      return NextResponse.json({ messages });
    }

    // Otherwise querying active peers
    const peers = getActivePeers(excludeEmail);
    return NextResponse.json({ peers });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Case 1: Posting a message
    if (body.type === 'message') {
      if (!body.text || !body.text.trim()) {
        return NextResponse.json({ error: 'Message text required' }, { status: 400 });
      }

      const msg = addMessage({
        sessionId: body.sessionId || 'global_collab',
        senderId: body.senderId || 'anon',
        senderName: body.senderName || 'Peer Learner',
        senderRole: 'peer',
        text: body.text.trim(),
      });

      return NextResponse.json({ success: true, message: msg });
    }

    // Case 2: Registering active peer / heartbeat
    const { name, email, domain, level, score, avatar, offers, needs } = body;
    if (!email) {
      return NextResponse.json({ error: 'Email required for peer registration' }, { status: 400 });
    }

    const peer = updatePeerHeartbeat({
      name: name || email.split('@')[0],
      email,
      domain: domain || 'React',
      level: level || 'intermediate',
      score: Number(score) || 85,
      avatar,
      offers,
      needs,
    });

    return NextResponse.json({ success: true, peer });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}
