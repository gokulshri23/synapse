import { NextResponse } from 'next/server';
import {
  getOrCreateDailyMission,
  completeDailyMission,
  getCompletedDailyMissions,
} from '@/lib/cloudStore';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId') || 'learner@synapse.edu';
    const topic = searchParams.get('topic') || 'Core Fundamentals';

    const currentMission = getOrCreateDailyMission(userId, topic);
    const history = getCompletedDailyMissions(userId);

    return NextResponse.json({
      success: true,
      currentMission,
      history,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, missionId, submissionCode } = body;

    if (!userId || !missionId) {
      return NextResponse.json(
        { success: false, error: 'userId and missionId are required' },
        { status: 400 }
      );
    }

    const result = completeDailyMission(userId, missionId, submissionCode);
    return NextResponse.json({ success: result.success, xpEarned: result.xpEarned });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message }, { status: 500 });
  }
}
