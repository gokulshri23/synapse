/**
 * Daily.co Call Service Provider
 * All Daily REST API calls are kept strictly on the server in this module.
 * The browser only ever receives a short-lived join token.
 */

interface DailyRoomProperties {
  name: string;
  privacy?: 'public' | 'private';
  properties: {
    max_participants: number;
    enable_screenshare: boolean;
    enable_chat: boolean;
    exp: number;
    eject_at_room_exp?: boolean;
    start_video_off?: boolean;
    start_audio_off?: boolean;
  };
}

export interface CreateDailyRoomResult {
  success: boolean;
  roomUrl: string;
  roomName: string;
  error?: string;
  isMockFallback?: boolean;
}

export interface CreateDailyTokenResult {
  success: boolean;
  token?: string;
  roomUrl?: string;
  error?: string;
}

const DAILY_API_BASE = 'https://api.daily.co/v1';

/**
 * Creates a Daily room on demand
 */
export async function createDailyRoom(params: {
  roomName: string;
  maxParticipants: number;
  expiryMinutes?: number;
  type?: 'pair' | 'group';
}): Promise<CreateDailyRoomResult> {
  const apiKey = process.env.DAILY_API_KEY;
  const expiry = Math.floor(Date.now() / 1000) + (params.expiryMinutes || 120) * 60;
  const sanitizedRoomName = params.roomName.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 40);

  if (!apiKey) {
    console.warn('[DailyService] DAILY_API_KEY is not set. Using secure fallback room URL.');
    return {
      success: true,
      roomName: sanitizedRoomName,
      roomUrl: `https://synapse-demo.daily.co/${sanitizedRoomName}`,
      isMockFallback: true,
    };
  }

  try {
    const payload: DailyRoomProperties = {
      name: sanitizedRoomName,
      privacy: 'private', // Requires token to join
      properties: {
        max_participants: params.maxParticipants,
        enable_screenshare: true,
        enable_chat: false, // We use Synapse's persisted chat
        exp: expiry,
        eject_at_room_exp: true,
      },
    };

    const res = await fetch(`${DAILY_API_BASE}/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      // If room already exists, fetch it
      if (res.status === 400 && errJson?.info?.includes('already exists')) {
        const getRes = await fetch(`${DAILY_API_BASE}/rooms/${sanitizedRoomName}`, {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (getRes.ok) {
          const roomData = await getRes.json();
          return {
            success: true,
            roomName: roomData.name,
            roomUrl: roomData.url,
          };
        }
      }
      return {
        success: false,
        roomName: sanitizedRoomName,
        roomUrl: '',
        error: errJson?.error || errJson?.info || 'Failed to create Daily room',
      };
    }

    const roomData = await res.json();
    return {
      success: true,
      roomName: roomData.name,
      roomUrl: roomData.url,
    };
  } catch (err: any) {
    console.error('[DailyService] Room creation error:', err);
    return {
      success: false,
      roomName: sanitizedRoomName,
      roomUrl: '',
      error: err?.message || 'Daily service request failed',
    };
  }
}

/**
 * Generates a short-lived user join token
 */
export async function createDailyMeetingToken(params: {
  roomName: string;
  userId: string;
  userName: string;
  isOwner: boolean;
  startVideoOff?: boolean;
  startAudioOff?: boolean;
}): Promise<CreateDailyTokenResult> {
  const apiKey = process.env.DAILY_API_KEY;

  if (!apiKey) {
    return {
      success: true,
      token: `token_demo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      roomUrl: `https://synapse-demo.daily.co/${params.roomName}`,
    };
  }

  try {
    const payload = {
      properties: {
        room_name: params.roomName,
        user_name: params.userName,
        user_id: params.userId,
        is_owner: params.isOwner,
        enable_screenshare: true,
        start_video_off: Boolean(params.startVideoOff),
        start_audio_off: Boolean(params.startAudioOff),
        exp: Math.floor(Date.now() / 1000) + 7200, // 2 hours
      },
    };

    const res = await fetch(`${DAILY_API_BASE}/meeting-tokens`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return {
        success: false,
        error: errData?.error || 'Failed to issue meeting token',
      };
    }

    const tokenData = await res.json();
    return {
      success: true,
      token: tokenData.token,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Daily token generation failed',
    };
  }
}

/**
 * Deletes / ends a Daily room
 */
export async function deleteDailyRoom(roomName: string): Promise<boolean> {
  const apiKey = process.env.DAILY_API_KEY;
  if (!apiKey) return true;

  try {
    const res = await fetch(`${DAILY_API_BASE}/rooms/${roomName}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}
