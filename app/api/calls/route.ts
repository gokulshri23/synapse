import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  createCallRecord,
  getIncomingCallsForUser,
  updateCallStatus,
  getCallRecord,
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
    const calleeId = searchParams.get('calleeId');
    const callId = searchParams.get('callId');
    const connectionId = searchParams.get('connectionId');
    const supabase = getSupabase();

    // 1. Single call by ID
    if (callId) {
      let call: any = null;
      if (supabase) {
        try {
          const { data } = await supabase.from('calls').select('*').eq('id', callId).maybeSingle();
          if (data) call = data;
        } catch (e) {}
      }
      if (!call) {
        call = getCallRecord(callId);
      }
      if (!call) {
        return NextResponse.json({ success: false, error: 'Call not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, call });
    }

    // 2. Incoming ringing calls for a specific user (callee)
    if (calleeId) {
      const normCallee = calleeId.trim().toLowerCase();
      let activeCalls: any[] = [];

      if (supabase) {
        try {
          // Fetch ringing calls
          const { data, error } = await supabase
            .from('calls')
            .select('*')
            .eq('callee_id', normCallee)
            .eq('status', 'ringing')
            .order('created_at', { ascending: false });

          if (!error && Array.isArray(data)) {
            const now = Date.now();
            for (const c of data) {
              const ageMs = now - new Date(c.created_at).getTime();
              if (ageMs > 30000) {
                // Expired ring -> mark missed
                await supabase.from('calls').update({ status: 'missed' }).eq('id', c.id);
              } else {
                activeCalls.push(c);
              }
            }
          }
        } catch (e) {}
      }

      // Merge memory cloudStore fallbacks
      const memCalls = getIncomingCallsForUser(normCallee);
      for (const mc of memCalls) {
        if (!activeCalls.some((ac) => ac.id === mc.id || ac.connection_id === mc.connection_id)) {
          activeCalls.push(mc);
        }
      }

      return NextResponse.json({ success: true, calls: activeCalls });
    }

    // 3. Active call by connection ID
    if (connectionId) {
      let call: any = null;
      if (supabase) {
        try {
          const { data } = await supabase
            .from('calls')
            .select('*')
            .eq('connection_id', connectionId)
            .in('status', ['ringing', 'accepted'])
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (data) call = data;
        } catch (e) {}
      }

      return NextResponse.json({ success: true, call });
    }

    return NextResponse.json({ success: false, error: 'Missing calleeId, callId, or connectionId' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { connectionId, callerId, callerName, callerAvatar, calleeId, type = 'voice' } = body;

    if (!connectionId || !callerId || !calleeId) {
      return NextResponse.json(
        { success: false, error: 'connectionId, callerId, and calleeId are required' },
        { status: 400 }
      );
    }

    const normCaller = callerId.trim().toLowerCase();
    const normCallee = calleeId.trim().toLowerCase();
    const roomName = `pair-${connectionId}`;
    const supabase = getSupabase();

    let createdCall: any = null;

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('calls')
          .insert({
            connection_id: connectionId,
            caller_id: normCaller,
            caller_name: callerName || 'Caller',
            caller_avatar: callerAvatar || null,
            callee_id: normCallee,
            type: type || 'voice',
            status: 'ringing',
            room_name: roomName,
          })
          .select('*')
          .single();

        if (!error && data) {
          createdCall = data;
        }
      } catch (e) {}
    }

    // Fallback and memory mirroring
    const memRecord = createCallRecord({
      connection_id: connectionId,
      caller_id: normCaller,
      caller_name: callerName || 'Caller',
      caller_avatar: callerAvatar,
      callee_id: normCallee,
      type: type || 'voice',
      room_name: roomName,
    });

    if (!createdCall) {
      createdCall = memRecord;
    }

    return NextResponse.json({ success: true, call: createdCall });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Failed to initiate call' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { callId, status } = body;

    if (!callId || !status) {
      return NextResponse.json({ success: false, error: 'callId and status are required' }, { status: 400 });
    }

    const validStatuses = ['ringing', 'accepted', 'declined', 'missed', 'ended'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ success: false, error: 'Invalid call status' }, { status: 400 });
    }

    const supabase = getSupabase();
    let updatedCall: any = null;

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('calls')
          .update({ status })
          .eq('id', callId)
          .select('*')
          .maybeSingle();

        if (!error && data) {
          updatedCall = data;
        }
      } catch (e) {}
    }

    const memCall = updateCallStatus(callId, status);
    if (!updatedCall) {
      updatedCall = memCall;
    }

    return NextResponse.json({ success: true, call: updatedCall });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Failed to update call' }, { status: 500 });
  }
}
