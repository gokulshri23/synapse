import { NextRequest, NextResponse } from 'next/server';
import { runAdaptiveEngine, AdaptiveEngineInput } from '@/lib/agents/adaptation-engine';
import {
  getAgentDecision,
  getAgentDecisionsForUser,
  recordActionHistory,
  getActionHistory,
} from '@/lib/cloudStore';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const decisionId = searchParams.get('decisionId');
    const userId = searchParams.get('userId');
    const topic = searchParams.get('topic');

    if (decisionId) {
      const decision = getAgentDecision(decisionId);
      if (!decision) {
        return NextResponse.json({ success: false, error: 'Decision not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, decision });
    }

    if (userId) {
      const decisions = getAgentDecisionsForUser(userId);
      const history = topic ? getActionHistory(userId, topic) : getActionHistory(userId);
      return NextResponse.json({ success: true, decisions, history });
    }

    return NextResponse.json({ success: false, error: 'decisionId or userId is required' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action = 'evaluate', userId, skill, topic } = body;

    if (!userId) {
      return NextResponse.json({ success: false, error: 'userId is required' }, { status: 400 });
    }

    if (action === 'evaluate') {
      const input: AdaptiveEngineInput = {
        userId,
        skill: skill || 'React',
        topic: topic || 'Core Foundations',
        currentScore: typeof body.currentScore === 'number' ? body.currentScore : undefined,
        subtopicScores: body.subtopicScores || undefined,
        skippedSessionsCount: typeof body.skippedSessionsCount === 'number' ? body.skippedSessionsCount : undefined,
        abandonedAssessmentsCount: typeof body.abandonedAssessmentsCount === 'number' ? body.abandonedAssessmentsCount : undefined,
        practiceCompletionPct: typeof body.practiceCompletionPct === 'number' ? body.practiceCompletionPct : undefined,
        isBothStuckSignal: Boolean(body.isBothStuckSignal),
        contextPeerId: body.contextPeerId,
      };

      const decision = await runAdaptiveEngine(input);
      return NextResponse.json({ success: true, decision });
    }

    if (action === 'record-outcome' || action === 'dismiss') {
      const targetTopic = topic || 'Core Topic';
      const targetAction = body.targetAction || 'intervention';
      const outcome = action === 'dismiss' ? 'skipped' : (body.outcome || 'passed');

      const record = recordActionHistory(userId, targetTopic, targetAction, outcome);
      return NextResponse.json({ success: true, record });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}
