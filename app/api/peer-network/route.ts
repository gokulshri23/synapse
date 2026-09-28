import { NextResponse } from 'next/server';
import {
  getActivePeers,
  updatePeerHeartbeat,
  getMessages,
  addMessage,
  addSignalingMessage,
  getSignalingMessages,
} from '@/lib/cloudStore';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const excludeEmail = searchParams.get('excludeEmail') || '';
    const sessionId = searchParams.get('sessionId') || '';
    const isSignaling = searchParams.get('signaling') === 'true';
    const forUserId = searchParams.get('userId') || '';
    const sinceTime = Number(searchParams.get('since') || '0');

    // If querying WebRTC signaling
    if (isSignaling && sessionId && forUserId) {
      const signals = getSignalingMessages(sessionId, forUserId, sinceTime);
      return NextResponse.json({ signals });
    }

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

    // Case 1: WebRTC Signaling packet (Offer / Answer / ICE candidate / Call End)
    if (
      body.type === 'webrtc_offer' ||
      body.type === 'webrtc_answer' ||
      body.type === 'webrtc_candidate' ||
      body.type === 'webrtc_call_end'
    ) {
      const signal = addSignalingMessage({
        sessionId: body.sessionId || 'global_collab',
        senderId: body.senderId || 'anon',
        recipientId: body.recipientId,
        type: body.type,
        payload: body.offer || body.answer || body.candidate || body.payload,
      });
      return NextResponse.json({ success: true, signal });
    }

    // Case 2: Posting a message or call event
    if (body.type === 'message' || body.type === 'call_invite' || body.type === 'call_end') {
      const isCallInvite = body.type === 'call_invite';
      const defaultText = isCallInvite
        ? `📞 Started a live ${body.callMode || 'video'} call. Click Accept to join!`
        : body.type === 'call_end' ? 'Call ended' : '';

      const text = (body.text || defaultText).trim();
      if (!text && !isCallInvite) {
        return NextResponse.json({ error: 'Message text required' }, { status: 400 });
      }

      const msg = addMessage({
        sessionId: body.sessionId || 'global_collab',
        senderId: body.senderId || 'anon',
        senderName: body.senderName || 'Peer Learner',
        senderRole: 'peer',
        text: text || 'Live Call',
        type: body.type,
        callUrl: body.callUrl,
        callMode: body.callMode || body.mode,
        callStatus: body.callStatus || (isCallInvite ? 'ringing' : 'ended'),
        voiceDataUrl: body.voiceDataUrl,
      });

      return NextResponse.json({ success: true, message: msg });
    }

    // Case 3: Registering active peer / heartbeat
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
