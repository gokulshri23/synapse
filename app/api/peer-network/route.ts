import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  getActivePeers,
  updatePeerHeartbeat,
  getMessages,
  addMessage,
  addSignalingMessage,
  getSignalingMessages,
} from '@/lib/cloudStore';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

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
      const normUser = forUserId.toLowerCase().trim();
      const userPrefix = normUser.split('@')[0];
      const supabase = getSupabase();
      let signals: any[] = [];

      if (supabase) {
        try {
          const sinceIso = sinceTime > 0 ? new Date(sinceTime).toISOString() : new Date(Date.now() - 30000).toISOString();
          const { data, error } = await supabase
            .from('messages')
            .select('*')
            .eq('thread_id', sessionId)
            .eq('thread_type', 'webrtc_signal')
            .gt('created_at', sinceIso)
            .order('created_at', { ascending: true })
            .limit(50);

          if (!error && Array.isArray(data)) {
            for (const item of data) {
              const sSender = (item.sender_email || '').toLowerCase().trim();
              const senderPrefix = sSender.split('@')[0];
              // Don't return signals sent by self
              if (sSender === normUser || senderPrefix === userPrefix) continue;

              // Check recipient
              const sRec = (item.sender_name || '').toLowerCase().trim();
              const recPrefix = sRec.split('@')[0];
              if (sRec && sRec !== normUser && recPrefix !== userPrefix) continue;

              let parsedPayload: any = {};
              try {
                parsedPayload = JSON.parse(item.content || '{}');
              } catch (e) {
                parsedPayload = item.content;
              }

              signals.push({
                id: item.id,
                sessionId: item.thread_id,
                senderId: item.sender_email,
                recipientId: item.sender_name,
                type: item.type,
                payload: parsedPayload,
                createdAt: new Date(item.created_at).getTime(),
              });
            }
          }
        } catch (e) {}
      }

      // Merge memory cloudStore fallbacks if needed
      const memSignals = getSignalingMessages(sessionId, forUserId, sinceTime);
      for (const ms of memSignals) {
        if (!signals.some((s) => s.id === ms.id || (s.type === ms.type && Math.abs(s.createdAt - ms.createdAt) < 500))) {
          signals.push(ms);
        }
      }

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

    // Case 1: WebRTC Signaling packet (Offer / Answer / ICE candidate / Call End / Screen share / Track state)
    if (
      body.type?.startsWith('webrtc_') ||
      body.type?.startsWith('screen_share_')
    ) {
      const sessKey = body.sessionId || 'global_collab';
      const senderId = (body.senderId || 'anon').toLowerCase().trim();
      const recipientId = (body.recipientId || '').toLowerCase().trim();
      const payloadData = body.offer || body.answer || body.candidate || body.payload || {};

      const supabase = getSupabase();
      if (supabase) {
        try {
          await supabase.from('messages').insert({
            thread_id: sessKey,
            thread_type: 'webrtc_signal',
            sender_name: recipientId,
            sender_email: senderId,
            type: body.type,
            content: JSON.stringify(payloadData),
          });
        } catch (e) {}
      }

      const signal = addSignalingMessage({
        sessionId: sessKey,
        senderId,
        recipientId,
        type: body.type,
        payload: payloadData,
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
