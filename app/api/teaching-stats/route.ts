import { NextRequest, NextResponse } from 'next/server';
import { getTeachingStats, updateTeachingStats } from '@/lib/cloudStore';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const skill = searchParams.get('skill') || undefined;

    if (!userId) {
      return NextResponse.json({ success: false, error: 'userId is required' }, { status: 400 });
    }

    const stats = getTeachingStats(userId, skill);
    return NextResponse.json({
      success: true,
      stats,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, skill, delta } = body;

    if (!userId || !skill || typeof delta !== 'number') {
      return NextResponse.json(
        { success: false, error: 'userId, skill, and delta (number) are required' },
        { status: 400 }
      );
    }

    const updated = updateTeachingStats(userId, skill, delta);
    return NextResponse.json({
      success: true,
      stats: updated,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}
