import { NextRequest, NextResponse } from 'next/server';
import { getAgentActivityLogs, logAgentActivity } from '@/lib/cloudStore';
import { AgentActivityEntry } from '@/lib/types';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const logs = getAgentActivityLogs(limit);
    return NextResponse.json({ success: true, logs });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { agent, action, reason, details } = body;
    if (!agent || !action || !reason) {
      return NextResponse.json({ success: false, error: 'agent, action, reason required' }, { status: 400 });
    }
    const entry = logAgentActivity(agent, action, reason, details);
    return NextResponse.json({ success: true, entry });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message }, { status: 500 });
  }
}
