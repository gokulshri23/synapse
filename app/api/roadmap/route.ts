import { NextRequest, NextResponse } from 'next/server';
import {
  applyEntryResult,
  getRoadmapNodes,
  passRoadmapTopic,
  logAgentActivity,
} from '@/lib/cloudStore';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId') || 'learner@synapse.edu';
    const skill = searchParams.get('skill') || 'React';

    let nodes = getRoadmapNodes(userId, skill);
    if (!nodes || nodes.length === 0) {
      // Initialize with default Level 1 if never initialized
      nodes = applyEntryResult(userId, skill, 0);
    }

    return NextResponse.json({ success: true, nodes });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, userId, skill, score, topic, topicResults } = body;

    if (!userId || !skill) {
      return NextResponse.json({ success: false, error: 'userId and skill are required' }, { status: 400 });
    }

    if (action === 'apply-entry') {
      const numScore = typeof score === 'number' ? score : 0;
      const nodes = applyEntryResult(userId, skill, numScore, topicResults);

      const unlockedNode = nodes.find((n) => n.status === 'unlocked');
      logAgentActivity(
        'Planner',
        'apply_entry_result',
        `Assigned roadmap for ${skill} at score ${numScore}%. Unlocked node: "${unlockedNode?.topic || 'None'}" (Index ${unlockedNode?.order_index ?? -1}).`,
        { score: numScore, unlockedTopic: unlockedNode?.topic }
      );

      return NextResponse.json({ success: true, nodes, unlockedNode });
    }

    if (action === 'pass-topic') {
      if (!topic) {
        return NextResponse.json({ success: false, error: 'topic is required for pass-topic' }, { status: 400 });
      }

      const numScore = typeof score === 'number' ? score : 0;
      const result = passRoadmapTopic(userId, skill, topic, numScore);

      if (result.success) {
        logAgentActivity(
          'Planner',
          'unlock_next_topic',
          `Passed topic "${topic}" with ${numScore}%. Unlocked next topic: "${result.nextUnlockedTopic || 'Roadmap Completed'}".`,
          { topic, score: numScore, nextUnlockedTopic: result.nextUnlockedTopic }
        );
      }

      return NextResponse.json({
        success: result.success,
        nodes: result.nodes,
        nextUnlockedTopic: result.nextUnlockedTopic,
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}
