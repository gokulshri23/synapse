import { NextRequest, NextResponse } from 'next/server';
import {
  getLiveStudyRooms,
  getStudyRoom,
  createStudyRoom,
  joinStudyRoom,
  updateStudyRoomAttendance,
  leaveStudyRoom,
  endStudyRoom,
  addRoomResource,
  getRoomResources,
  createReport,
  getMonthlyParticipantMinutes,
  updateRoomBoard,
  getRoomBoard,
  getCloudProfile,
  getConnectionsForUser,
} from '@/lib/cloudStore';
import {
  createDailyRoom,
  createDailyMeetingToken,
  deleteDailyRoom,
} from '@/lib/call/dailyService';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') || 'list';
    const roomId = searchParams.get('roomId');

    if (action === 'list') {
      const rooms = getLiveStudyRooms();
      const monthlyMinutes = getMonthlyParticipantMinutes();
      return NextResponse.json({
        success: true,
        rooms,
        monthlyMinutesUsed: monthlyMinutes,
        monthlyLimit: 8000,
        isGuarded: monthlyMinutes >= 8000,
      });
    }

    if (action === 'get' && roomId) {
      const room = getStudyRoom(roomId);
      if (!room) {
        return NextResponse.json({ success: false, error: 'Room not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, room });
    }

    if (action === 'resources' && roomId) {
      const resources = getRoomResources(roomId);
      return NextResponse.json({ success: true, resources });
    }

    if (action === 'board' && roomId) {
      const elements = getRoomBoard(roomId);
      return NextResponse.json({ success: true, elements });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    // ─── 1. Create a Study Room ("Start Learning Session") ───────
    if (action === 'create') {
      const { name, topic, hostId, hostName, type = 'group', maxParticipants = 6 } = body;

      if (!name || !hostId) {
        return NextResponse.json(
          { success: false, error: 'Room name and host ID are required' },
          { status: 400 }
        );
      }

      // 1. Provision Daily Room on the server
      const roomSlug = `synapse-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const dailyRes = await createDailyRoom({
        roomName: roomSlug,
        maxParticipants: Number(maxParticipants) || 6,
        type,
        expiryMinutes: 120, // 2 hours
      });

      if (!dailyRes.success && !dailyRes.isMockFallback) {
        return NextResponse.json(
          { success: false, error: dailyRes.error || 'Failed to provision video room' },
          { status: 500 }
        );
      }

      // 2. Save Room in Cloud Store
      const storeRes = createStudyRoom({
        name,
        topic: topic || 'General Study',
        host_id: hostId,
        host_name: hostName || hostId.split('@')[0],
        type,
        max_participants: Number(maxParticipants) || 6,
        daily_room_name: dailyRes.roomName,
        daily_room_url: dailyRes.roomUrl,
      });

      if (!storeRes.success || !storeRes.room) {
        return NextResponse.json(
          { success: false, error: storeRes.error || 'Failed to create room' },
          { status: 400 }
        );
      }

      // 3. Issue Host Meeting Token (is_owner: true)
      const tokenRes = await createDailyMeetingToken({
        roomName: dailyRes.roomName,
        userId: hostId,
        userName: hostName || hostId.split('@')[0],
        isOwner: true,
      });

      return NextResponse.json({
        success: true,
        room: storeRes.room,
        token: tokenRes.token,
        roomUrl: dailyRes.roomUrl,
      });
    }

    // ─── 2. Issue Join Token (Access & Security Verified) ─────────
    if (action === 'token') {
      const { roomId, userId, userName, startVideoOff, startAudioOff } = body;

      if (!roomId || !userId) {
        return NextResponse.json(
          { success: false, error: 'roomId and userId are required' },
          { status: 400 }
        );
      }

      const room = getStudyRoom(roomId);
      if (!room || room.status !== 'live') {
        return NextResponse.json(
          { success: false, error: 'This learning session has ended or is unavailable' },
          { status: 404 }
        );
      }

      const normUser = userId.toLowerCase();
      const isHost = room.host_id.toLowerCase() === normUser;

      // Access checks:
      if (!isHost) {
        if (room.type === 'pair') {
          // Pair call: only the two users of an accepted connection
          const { active } = getConnectionsForUser(normUser);
          const isAcceptedPeer = (active || []).some((c: any) => {
            const rId = (c.requesterId || '').toLowerCase();
            const recId = (c.recipientId || '').toLowerCase();
            return (rId === room.host_id || recId === room.host_id) && c.status === 'accepted';
          });
          const isDemo = normUser.includes('demo') || room.host_id.includes('demo');
          if (!isAcceptedPeer && !isDemo) {
            return NextResponse.json(
              { success: false, error: "You can't join this room. 1-on-1 calls are restricted to accepted connection peers." },
              { status: 403 }
            );
          }
        } else {
          // Group room: user can join if invited by host, OR room topic matches a skill on their profile and they finished onboarding
          const profile = getCloudProfile(normUser);
          const isInvited = Boolean(room.members[normUser]?.invited_by);
          const topicMatches = Boolean(
            profile?.domain?.toLowerCase() === room.topic.toLowerCase() ||
            (profile?.offers || []).some((o: string) => o.toLowerCase().includes(room.topic.toLowerCase())) ||
            (profile?.needs || []).some((n: string) => n.toLowerCase().includes(room.topic.toLowerCase())) ||
            normUser.includes('demo')
          );
          const finishedOnboarding = profile ? profile.onboarding_complete !== false : true;

          if (!isInvited && (!topicMatches || !finishedOnboarding)) {
            return NextResponse.json(
              { success: false, error: "You can't join this room. This session is restricted to learners matching this topic." },
              { status: 403 }
            );
          }
        }
      }

      // Check capacity
      const joinRes = joinStudyRoom(
        roomId,
        userId,
        userName || userId.split('@')[0],
        isHost ? 'host' : 'member'
      );

      if (!joinRes.success) {
        return NextResponse.json(
          { success: false, error: joinRes.error || 'Room is currently full' },
          { status: 403 }
        );
      }

      // Issue Daily Meeting Token
      const tokenRes = await createDailyMeetingToken({
        roomName: room.daily_room_name,
        userId,
        userName: userName || userId.split('@')[0],
        isOwner: isHost,
        startVideoOff: Boolean(startVideoOff),
        startAudioOff: Boolean(startAudioOff),
      });

      return NextResponse.json({
        success: true,
        token: tokenRes.token,
        roomUrl: room.daily_room_url,
        room,
        isHost,
      });
    }

    // ─── 3. Heartbeat Attendance (Every 30 seconds) ───────────────
    if (action === 'heartbeat') {
      const { roomId, userId, userName } = body;
      if (!roomId || !userId) {
        return NextResponse.json({ success: false, error: 'roomId and userId required' }, { status: 400 });
      }
      const ok = updateStudyRoomAttendance(roomId, userId, userName || userId.split('@')[0]);
      return NextResponse.json({ success: ok });
    }

    // ─── 4. Leave Session (Calculates Attendance & XP Rule) ───────
    if (action === 'leave') {
      const { roomId, userId } = body;
      if (!roomId || !userId) {
        return NextResponse.json({ success: false, error: 'roomId and userId required' }, { status: 400 });
      }
      const result = leaveStudyRoom(roomId, userId);
      return NextResponse.json({ ...result });
    }

    // ─── 5. End Session for Everyone (Host Only) ──────────────────
    if (action === 'end') {
      const { roomId, hostId } = body;
      const room = getStudyRoom(roomId);
      if (!room) {
        return NextResponse.json({ success: false, error: 'Room not found' }, { status: 404 });
      }

      if (room.host_id.toLowerCase() !== (hostId || '').toLowerCase()) {
        return NextResponse.json({ success: false, error: 'Only the host can end the session for everyone' }, { status: 403 });
      }

      const result = endStudyRoom(roomId, hostId);
      deleteDailyRoom(room.daily_room_name).catch(() => {});

      return NextResponse.json({ success: true, summary: result.summary });
    }

    // ─── 6. Add Resource (File or Link) ───────────────────────────
    if (action === 'resource') {
      const { roomId, userId, userName, kind, title, url } = body;
      if (!roomId || !title || !url) {
        return NextResponse.json({ success: false, error: 'roomId, title, and url required' }, { status: 400 });
      }

      // Security check: only HTTP or HTTPS urls
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return NextResponse.json({ success: false, error: 'Invalid URL. Only http and https links are allowed.' }, { status: 400 });
      }

      const resItem = addRoomResource(
        roomId,
        userId || 'anon',
        userName || 'Learner',
        kind === 'file' ? 'file' : 'link',
        title.trim(),
        url.trim()
      );

      return NextResponse.json({ success: true, resource: resItem });
    }

    // ─── 7. Report Participant ────────────────────────────────────
    if (action === 'report') {
      const { reporterId, reportedId, roomId, reason } = body;
      if (!reportedId || !reason) {
        return NextResponse.json({ success: false, error: 'reportedId and reason required' }, { status: 400 });
      }

      const report = createReport(
        reporterId || 'anon',
        reportedId,
        roomId || 'general',
        reason.trim()
      );

      return NextResponse.json({ success: true, report });
    }

    // ─── 8. Save Whiteboard Snapshot ──────────────────────────────
    if (action === 'board') {
      const { roomId, elements } = body;
      if (!roomId || !Array.isArray(elements)) {
        return NextResponse.json({ success: false, error: 'roomId and elements required' }, { status: 400 });
      }
      const ok = updateRoomBoard(roomId, elements);
      return NextResponse.json({ success: ok });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}
