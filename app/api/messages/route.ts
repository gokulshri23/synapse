import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { addMessage, getMessages } from '@/lib/cloudStore';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const threadId = searchParams.get('threadId');
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') || '50')));

    if (!threadId) {
      return NextResponse.json({ success: false, error: 'threadId is required' }, { status: 400 });
    }

    const supabase = getSupabase();
    let dbMessages: any[] = [];

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .eq('thread_id', threadId)
          .order('created_at', { ascending: true })
          .limit(limit);

        if (!error && Array.isArray(data)) {
          dbMessages = data;
        }
      } catch (err) {}
    }

    // Merge with cloudStore fallback if needed
    if (dbMessages.length === 0) {
      const memoryMsgs = getMessages(threadId, limit);
      dbMessages = memoryMsgs.map((m) => ({
        id: m.id,
        thread_id: threadId,
        content: m.text,
        sender_name: m.senderName,
        sender_email: m.senderId,
        type: m.type || 'text',
        voice_url: m.voiceDataUrl,
        created_at: new Date(m.createdAt || Date.now()).toISOString(),
      }));
    }

    return NextResponse.json({ success: true, messages: dbMessages });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { threadId, threadType = 'pair', content, senderName, senderEmail, type = 'text', voiceUrl } = body;

    if (!threadId || !content) {
      return NextResponse.json(
        { success: false, error: 'threadId and content are required' },
        { status: 400 }
      );
    }

    const supabase = getSupabase();
    let createdMessage: any = null;

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('messages')
          .insert({
            thread_id: threadId,
            thread_type: threadType || 'pair',
            content,
            sender_name: senderName || 'Learner',
            sender_email: (senderEmail || '').toLowerCase().trim(),
            type,
            voice_url: voiceUrl || null,
          })
          .select('*')
          .single();

        if (!error && data) {
          createdMessage = data;
        }
      } catch (err) {}
    }

    // Mirror to cloudStore cache
    const memMsg = addMessage({
      sessionId: threadId,
      senderId: (senderEmail || 'anon').toLowerCase().trim(),
      senderName: senderName || 'Learner',
      text: content,
      type,
      voiceDataUrl: voiceUrl,
    });

    if (!createdMessage) {
      createdMessage = {
        id: memMsg.id,
        thread_id: threadId,
        content: memMsg.text,
        sender_name: memMsg.senderName,
        sender_email: memMsg.senderId,
        type: memMsg.type,
        voice_url: memMsg.voiceDataUrl,
        created_at: new Date(memMsg.createdAt || Date.now()).toISOString(),
      };
    }

    return NextResponse.json({ success: true, message: createdMessage });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Failed to send message' }, { status: 500 });
  }
}
