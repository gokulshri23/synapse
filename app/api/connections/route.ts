import { NextResponse } from 'next/server';
import {
  createConnection,
  updateConnectionStatus,
  getConnectionsForUser,
} from '@/lib/cloudStore';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId is required' },
        { status: 400 }
      );
    }

    const conns = getConnectionsForUser(userId);
    return NextResponse.json({ success: true, ...conns });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, requesterId, requesterName, recipientId, recipientName, skillArea, connectionId } = body;

    if (action === 'create') {
      if (!requesterId || !recipientId) {
        return NextResponse.json(
          { success: false, error: 'requesterId and recipientId required' },
          { status: 400 }
        );
      }

      const conn = createConnection(
        requesterId,
        requesterName || requesterId.split('@')[0],
        recipientId,
        recipientName || recipientId.split('@')[0],
        skillArea || 'General'
      );
      return NextResponse.json({ success: true, connection: conn });
    }

    if (action === 'accept' || action === 'decline') {
      if (!connectionId) {
        return NextResponse.json(
          { success: false, error: 'connectionId required' },
          { status: 400 }
        );
      }

      const updated = updateConnectionStatus(connectionId, action === 'accept' ? 'accepted' : 'declined');
      return NextResponse.json({ success: Boolean(updated), connection: updated });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message }, { status: 500 });
  }
}
