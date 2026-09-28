import { NextRequest, NextResponse } from 'next/server';
import { 
  recordMatchHealth, 
  getMatchHealthHistory, 
  getMatchHealthTrend, 
  getTeacherCrossLearnerPattern, 
  getActivePeers,
  logNetworkGap
} from '@/lib/cloudStore';
import { GoogleGenAI } from '@google/genai';
import { determineAutonomousActionWithAI } from '@/lib/agents/adaptation-engine';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
const model = 'gemini-2.0-flash';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const matchId = searchParams.get('matchId');
  const learnerId = searchParams.get('learnerId');
  const skill = searchParams.get('skill');

  if (matchId) {
    return NextResponse.json({ history: getMatchHealthHistory(matchId) });
  }

  if (learnerId && skill) {
    return NextResponse.json({ trend: getMatchHealthTrend(learnerId, skill) });
  }

  return NextResponse.json({ error: 'Provide either matchId or learnerId & skill' }, { status: 400 });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'pre-quiz') {
      const { skill } = body;
      if (!skill) return NextResponse.json({ error: 'Missing skill' }, { status: 400 });

      const prompt = `Generate 3 short diagnostic multiple choice questions to assess knowledge of ${skill}. Return exactly and only JSON format: { "questions": [{ "question": "...", "options": ["...", "...", "...", "..."], "answerIndex": 0 }] }`;
      const response = await ai.models.generateContent({ model, contents: prompt });
      let text = response.text || '';
      
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
        return NextResponse.json(parsed);
      } catch (e) {
        return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 });
      }
    }

    if (action === 'post-quiz') {
      const { matchId, learnerId, teacherId, skill, sessionNumber, preScore, postScore } = body;
      
      const record = recordMatchHealth({
        match_id: matchId,
        learner_id: learnerId,
        teacher_id: teacherId,
        skill,
        session_number: sessionNumber,
        pre_score: preScore,
        post_score: postScore,
      });

      const trend = getMatchHealthTrend(learnerId, skill);
      let consecutiveDeclines = 0;
      
      for (let i = trend.length - 1; i >= 0; i--) {
        if (trend[i].delta <= 0) {
          consecutiveDeclines++;
        } else {
          break;
        }
      }

      const avgDelta = trend.length > 0 ? trend.reduce((sum, s) => sum + s.delta, 0) / trend.length : 0;
      const { action: adaptationAction, reason } = await determineAutonomousActionWithAI(
        {
          trend: avgDelta < -5 || consecutiveDeclines >= 2 ? 'declining' : avgDelta > 5 ? 'improving' : 'flat',
          avgDelta,
          consecutiveDeclines,
        },
        { skill, learnerName: learnerId, teacherName: teacherId }
      );

      return NextResponse.json({
        health: record,
        adaptation: adaptationAction ? { action: adaptationAction, reason } : null
      });
    }

    if (action === 'both-stuck') {
      const { sessionId, topic, peerAId, peerBId } = body;
      
      const peers = getActivePeers();
      const thirdPeer = peers.find(
        (p) =>
          p.id !== peerAId &&
          p.id !== peerBId &&
          (p.domain === topic || (p.offers && p.offers.includes(topic)))
      );

      if (thirdPeer) {
        return NextResponse.json({ 
          action: 'third_peer', 
          peer: thirdPeer 
        });
      } else {
        logNetworkGap(topic, [peerAId, peerBId].filter(Boolean));
        const prompt = `Explain the topic '${topic}' comprehensively and clearly as an AI tutor, since human peers are currently stuck.`;
        const response = await ai.models.generateContent({ model, contents: prompt });
        return NextResponse.json({
          action: 'ai_fallback',
          explanation: response.text || 'Unable to generate explanation'
        });
      }
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
