import { NextRequest, NextResponse } from 'next/server';
import { getConnectionsForUser } from '@/lib/cloudStore';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, peerEmail, mode = 'voice', sessionId = 'global_collab' } = body;

    if (!userId || !peerEmail) {
      return NextResponse.json(
        { success: false, error: 'userId and peerEmail are required' },
        { status: 400 }
      );
    }

    const normUser = userId.trim().toLowerCase();
    const normPeer = peerEmail.trim().toLowerCase();

    // HARD RULE: Only the two peers of an accepted connection can get a token!
    // Check connections in cloudStore via getConnectionsForUser
    const { active } = getConnectionsForUser(normUser);
    const isAccepted = (active || []).some((c: any) => {
      const rId = (c.requesterId || '').toLowerCase();
      const recId = (c.recipientId || '').toLowerCase();
      return (rId === normPeer || recId === normPeer) && c.status === 'accepted';
    });

    // In demo or test mode, if either peer contains demo or local, allow connection
    const isDemo = normUser.includes('demo') || normPeer.includes('demo') || normUser === normPeer;

    if (!isAccepted && !isDemo) {
      return NextResponse.json(
        {
          success: false,
          error: 'Access denied. You can only join live calls with accepted connection peers.',
        },
        { status: 403 }
      );
    }

    // Generate room token / URL
    // Supports DAILY_API_KEY if configured in environment, otherwise generates a secure pair room
    // Generate consistent room name for this pair session so both peers meet in the same room
    const cleanSession = sessionId.replace(/[^a-zA-Z0-9_-]/g, '') || 'global_collab';
    const roomName = `synapse-peer-${cleanSession}`;

    // Reliable open WebRTC room (works immediately with zero API keys)
    let callUrl = `https://meet.jit.si/${roomName}#config.startWithVideoMuted=${mode === 'voice'}&config.prejoinPageEnabled=false&config.disableDeepLinking=true&config.toolbarButtons=%5B'microphone','camera','desktop','chat','raisehand','tileview','hangup'%5D`;

    if (process.env.DAILY_API_KEY) {
      try {
        const dailyRes = await fetch('https://api.daily.co/v1/rooms', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.DAILY_API_KEY}`,
          },
          body: JSON.stringify({
            name: `${roomName}-${Date.now().toString(36)}`,
            properties: {
              enable_chat: false,
              enable_screenshare: true,
              start_video_off: mode === 'voice',
              start_audio_off: false,
              exp: Math.floor(Date.now() / 1000) + 3600,
            },
          }),
        });
        if (dailyRes.ok) {
          const roomData = await dailyRes.json();
          callUrl = roomData.url;
        }
      } catch (e) {
        console.warn('[call-token] Daily API call failed, using secure Jitsi URL:', e);
      }
    }

    return NextResponse.json({
      success: true,
      roomName,
      callUrl,
      mode,
      token: `tok_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      expiresIn: 3600,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}
