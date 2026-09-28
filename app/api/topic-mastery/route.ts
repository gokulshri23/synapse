import { NextRequest, NextResponse } from 'next/server';
import { getTopicMastery, updateTopicMastery, getSkillTopics } from '@/lib/cloudStore';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId') || 'learner@synapse.edu';
    const skill = searchParams.get('skill') || 'React';

    const masteryList = getTopicMastery(userId, skill);
    const weakTopics = masteryList.filter((m) => m.label === 'Weak').map((m) => m.topic);
    const strongTopics = masteryList.filter((m) => m.label === 'Strong').map((m) => m.topic);
    const developingTopics = masteryList.filter((m) => m.label === 'Developing').map((m) => m.topic);

    return NextResponse.json({
      success: true,
      topics: masteryList,
      weakTopics,
      strongTopics,
      developingTopics,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, skill, topic, score } = body;

    if (!userId || !skill || !topic || typeof score !== 'number') {
      return NextResponse.json(
        { success: false, error: 'userId, skill, topic, and score are required' },
        { status: 400 }
      );
    }

    const updated = updateTopicMastery(userId, skill, topic, score);
    return NextResponse.json({ success: true, topicMastery: updated });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}
