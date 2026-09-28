import { NextResponse } from 'next/server';
import {
  createConnection,
  updateConnectionStatus,
  cancelConnectionByUser,
  getConnectionsForUser,
} from '@/lib/cloudStore';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

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

    const normUser = userId.trim().toLowerCase();
    const supabase = getSupabase();

    // Query Supabase if available to ensure cross-device and reload persistence
    if (supabase) {
      try {
        const { data: dbConns, error } = await supabase
          .from('connections')
          .select('*')
          .or(`requester_id.ilike.${normUser},recipient_id.ilike.${normUser}`);

        if (!error && Array.isArray(dbConns)) {
          // Sync database state into local memory store
          for (const conn of dbConns) {
            const reqNorm = (conn.requester_id || '').toLowerCase();
            const recNorm = (conn.recipient_id || '').toLowerCase();
            if (conn.status === 'accepted' || conn.status === 'pending') {
              const memoryConn = createConnection(
                reqNorm,
                conn.requester_name || reqNorm.split('@')[0],
                recNorm,
                conn.recipient_name || recNorm.split('@')[0],
                conn.skill_area || 'General'
              );
              if (conn.status === 'accepted') {
                updateConnectionStatus(memoryConn.id, 'accepted');
              }
            } else if (conn.status === 'declined' || conn.status === 'cancelled') {
              cancelConnectionByUser(reqNorm, recNorm);
            }
          }
        }
      } catch (dbErr) {
        // Fall back to cloudStore
      }
    }

    const conns = getConnectionsForUser(normUser);
    return NextResponse.json({ success: true, ...conns });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, requesterId, requesterName, recipientId, recipientName, skillArea, connectionId } = body;
    const supabase = getSupabase();

    if (action === 'create') {
      if (!requesterId || !recipientId) {
        return NextResponse.json(
          { success: false, error: 'requesterId and recipientId required' },
          { status: 400 }
        );
      }

      const reqNorm = requesterId.trim().toLowerCase();
      const recNorm = recipientId.trim().toLowerCase();

      const conn = createConnection(
        reqNorm,
        requesterName || reqNorm.split('@')[0],
        recNorm,
        recipientName || recNorm.split('@')[0],
        skillArea || 'General'
      );

      // Persist to Supabase connections table
      if (supabase) {
        try {
          const { data: existing } = await supabase
            .from('connections')
            .select('id, status')
            .or(`and(requester_id.ilike.${reqNorm},recipient_id.ilike.${recNorm}),and(requester_id.ilike.${recNorm},recipient_id.ilike.${reqNorm})`)
            .maybeSingle();

          if (existing) {
            await supabase
              .from('connections')
              .update({
                requester_id: reqNorm,
                requester_name: requesterName || reqNorm.split('@')[0],
                recipient_id: recNorm,
                recipient_name: recipientName || recNorm.split('@')[0],
                skill_area: skillArea || 'General',
                status: conn.status,
                updated_at: new Date().toISOString(),
              })
              .eq('id', existing.id);
          } else {
            await supabase.from('connections').insert({
              requester_id: reqNorm,
              requester_name: requesterName || reqNorm.split('@')[0],
              recipient_id: recNorm,
              recipient_name: recipientName || recNorm.split('@')[0],
              skill_area: skillArea || 'General',
              status: conn.status,
            });
          }
        } catch (dbErr) {
          // CloudStore handles in-memory fallback
        }
      }

      return NextResponse.json({ success: true, connection: conn });
    }

    if (action === 'cancel') {
      const reqNorm = (requesterId || '').trim().toLowerCase();
      const recNorm = (recipientId || '').trim().toLowerCase();

      if (reqNorm && recNorm) {
        cancelConnectionByUser(reqNorm, recNorm);
      }
      if (connectionId) {
        updateConnectionStatus(connectionId, 'cancelled');
      }

      if (supabase) {
        try {
          if (connectionId) {
            await supabase.from('connections').delete().eq('id', connectionId);
          } else if (reqNorm && recNorm) {
            await supabase
              .from('connections')
              .delete()
              .or(`and(requester_id.ilike.${reqNorm},recipient_id.ilike.${recNorm}),and(requester_id.ilike.${recNorm},recipient_id.ilike.${reqNorm})`);
          }
        } catch (dbErr) {}
      }

      return NextResponse.json({ success: true });
    }

    if (action === 'accept' || action === 'decline') {
      if (!connectionId && (!requesterId || !recipientId)) {
        return NextResponse.json(
          { success: false, error: 'connectionId or peer IDs required' },
          { status: 400 }
        );
      }

      const newStatus = action === 'accept' ? 'accepted' : 'declined';
      let updated = null;

      if (connectionId) {
        updated = updateConnectionStatus(connectionId, newStatus);
      }

      if (supabase) {
        try {
          let updatedRow = null;
          if (connectionId) {
            const { data } = await supabase
              .from('connections')
              .update({ status: newStatus, updated_at: new Date().toISOString() })
              .eq('id', connectionId)
              .select('*')
              .maybeSingle();
            updatedRow = data;
          } else if (requesterId && recipientId) {
            const reqNorm = requesterId.trim().toLowerCase();
            const recNorm = recipientId.trim().toLowerCase();
            const { data } = await supabase
              .from('connections')
              .update({ status: newStatus, updated_at: new Date().toISOString() })
              .or(`and(requester_id.ilike.${reqNorm},recipient_id.ilike.${recNorm}),and(requester_id.ilike.${recNorm},recipient_id.ilike.${reqNorm})`)
              .select('*')
              .maybeSingle();
            updatedRow = data;
          }

          // If accepted, initialize chat thread in public.messages
          if (action === 'accept' && updatedRow) {
            const pairMembers = [updatedRow.requester_id.toLowerCase(), updatedRow.recipient_id.toLowerCase()].sort();
            const threadId = `pair__${pairMembers.join('__')}`;
            await supabase.from('messages').insert({
              thread_id: threadId,
              user_id: 'system',
              sender_name: 'Synapse Peer Connection',
              content: `🎉 You are now connected! Start exchanging knowledge in ${updatedRow.skill_area || 'your study domain'}.`,
              type: 'system',
            });
          }
        } catch (dbErr) {}
      }

      return NextResponse.json({ success: true, connection: updated });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message }, { status: 500 });
  }
}
