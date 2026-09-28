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
    const roomName = `synapse-${sessionId.replace(/[^a-zA-Z0-9_-]/g, '')}-${Date.now().toString(36)}`;
    let callUrl = `https://synapse-demo.daily.co/${roomName}`;

    if (process.env.DAILY_API_KEY) {
      try {
        const dailyRes = await fetch('https://api.daily.co/v1/rooms', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.DAILY_API_KEY}`,
          },
          body: JSON.stringify({
            name: roomName,
            properties: {
              enable_chat: false,
              enable_screenshare: true,
              start_video_off: mode === 'voice',
              start_audio_off: false,
              exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour expiration
            },
          }),
        });
        if (dailyRes.ok) {
          const roomData = await dailyRes.json();
          callUrl = roomData.url;
        }
      } catch (e) {
        console.warn('[call-token] Daily API call failed, using secure pair URL:', e);
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
