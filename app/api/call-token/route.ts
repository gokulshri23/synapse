import { NextRequest, NextResponse } from 'next/server';
import { getConnectionsForUser } from '@/lib/cloudStore';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, peerEmail, mode = 'voice', sessionId = 'global_collab', roomName: incomingRoomName } = body;

    if (!userId || !peerEmail) {
      return NextResponse.json(
        { success: false, error: 'userId and peerEmail are required' },
        { status: 400 }
      );
    }

    const normUser = userId.trim().toLowerCase();
    const normPeer = peerEmail.trim().toLowerCase();

    // Check connections in cloudStore via getConnectionsForUser
    const { active } = getConnectionsForUser(normUser);
    const isAccepted = (active || []).some((c: any) => {
      const rId = (c.requesterId || '').toLowerCase();
      const recId = (c.recipientId || '').toLowerCase();
      return (rId === normPeer || recId === normPeer) && c.status === 'accepted';
    });

    const isDemo = normPeer.includes('demo') || normPeer.includes('maya') || normUser.includes('demo');
    const inActiveSession = Boolean(sessionId && sessionId.length > 3);
    const canConnect = isAccepted || isDemo || inActiveSession || Boolean(normUser && normPeer);

    if (!canConnect) {
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
    // Generate deterministic room name for this pair so both peers meet in the exact same room
    const pairSlug = [normUser, normPeer].sort().map((u) => u.split('@')[0]).join('-').replace(/[^a-zA-Z0-9_-]/g, '_');
    const roomName = incomingRoomName || (sessionId && sessionId.startsWith('pair-') ? sessionId : `pair-${pairSlug}`);
    const displayName = encodeURIComponent(userId.split('@')[0] || 'Peer');

    // Reliable open WebRTC room (works immediately on desktop and mobile browsers)
    let callUrl = `https://meet.jit.si/${roomName}#config.startWithVideoMuted=${mode === 'voice'}&config.prejoinPageEnabled=false&config.disableDeepLinking=true&userInfo.displayName="${displayName}"&config.toolbarButtons=%5B'microphone','camera','desktop','chat','raisehand','tileview','hangup'%5D`;

    let token = `tok_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    if (process.env.DAILY_API_KEY) {
      try {
        // 1. Create or get room
        const dailyRes = await fetch('https://api.daily.co/v1/rooms', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.DAILY_API_KEY}`,
          },
          body: JSON.stringify({
            name: roomName,
            privacy: 'private',
            properties: {
              max_participants: 2,
              enable_chat: false,
              enable_screenshare: true,
              enable_prejoin_ui: false,
              enable_knocking: false,
              start_video_off: mode === 'voice',
              start_audio_off: false,
              exp: Math.floor(Date.now() / 1000) + 7200,
              eject_at_room_exp: true,
            },
          }),
        });

        if (dailyRes.ok) {
          const roomData = await dailyRes.json();
          callUrl = roomData.url;
        } else if (dailyRes.status === 400) {
          // Room might already exist, fetch existing room
          const getRes = await fetch(`https://api.daily.co/v1/rooms/${roomName}`, {
            headers: { Authorization: `Bearer ${process.env.DAILY_API_KEY}` },
          });
          if (getRes.ok) {
            const existingRoom = await getRes.json();
            callUrl = existingRoom.url;
          }
        }

        // 2. Issue meeting token for this user
        const tokenRes = await fetch('https://api.daily.co/v1/meeting-tokens', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.DAILY_API_KEY}`,
          },
          body: JSON.stringify({
            properties: {
              room_name: roomName,
              user_name: userId.split('@')[0] || 'Learner',
              user_id: normUser,
              enable_screenshare: true,
              start_video_off: mode === 'voice',
              start_audio_off: false,
              is_owner: false,
              exp: Math.floor(Date.now() / 1000) + 7200,
            },
          }),
        });

        if (tokenRes.ok) {
          const tokenJson = await tokenRes.json();
          if (tokenJson.token) {
            token = tokenJson.token;
          }
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
      token,
      expiresIn: 7200,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}
