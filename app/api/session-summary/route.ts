import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import {
  saveSessionSummary,
  getSessionSummaries,
  getLatestSessionSummary,
  updateTopicMastery,
  updateTeachingStats,
  logAgentActivity,
} from '@/lib/cloudStore';
import { runAdaptiveEngine } from '@/lib/agents/adaptation-engine';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const sessionId = searchParams.get('sessionId') || undefined;

    if (!userId) {
      return NextResponse.json({ success: false, error: 'userId is required' }, { status: 400 });
    }

    if (sessionId) {
      const summary = getLatestSessionSummary(userId, sessionId);
      return NextResponse.json({ success: true, summary });
    }

    const summaries = getSessionSummaries(userId);
    return NextResponse.json({ success: true, summaries });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      userId,
      peerId,
      peerName = 'Peer Partner',
      topic = 'React',
      skill = 'React',
      preScore = null,
      postScore = null,
      durationMinutes = 25,
      messages = [],
      challengeTitle,
      codeSolution,
    } = body;

    if (!userId) {
      return NextResponse.json({ success: false, error: 'userId is required' }, { status: 400 });
    }

    const validPre = typeof preScore === 'number' && !isNaN(preScore) ? preScore : null;
    const validPost = typeof postScore === 'number' && !isNaN(postScore) ? postScore : null;
    const improvement = (validPre !== null && validPost !== null) ? validPost - validPre : null;

    let aiSummary = `Completed ${durationMinutes}-minute peer session on ${topic} with ${peerName}.`;
    let keyTakeaways = [
      `Deliberate practice with collaborative problem solving in ${topic}`,
      `Code review and architectural verification with peer ${peerName}`,
    ];

    // Generate educational synthesis if Gemini is configured
    if (process.env.GEMINI_API_KEY) {
      try {
        const recentSnippet = messages.slice(-10).map((m: any) => `${m.senderName || m.sender}: ${m.text}`).join('\n');
        const prompt = `You are the Synapse Autonomous Learning Planner Agent.
Analyze this peer learning session:
- Domain/Skill: ${skill}
- Topic: ${topic}
- Pre-quiz Score: ${validPre !== null ? `${validPre}%` : 'Skipped'}
- Post-quiz Score: ${validPost !== null ? `${validPost}%` : 'Skipped'}
- Improvement: ${improvement !== null ? (improvement >= 0 ? `+${improvement} points` : `${improvement} points`) : 'Skipped'}
- Challenge: ${challengeTitle || 'Practical Challenge'}
- Discussion excerpt:
${recentSnippet || 'Active peer discussion on implementation details.'}

Return JSON strictly conforming to:
{
  "summary": "Concise 2-sentence executive summary of student mastery and session outcome",
  "takeaways": ["Specific bullet 1 of what was learned", "Specific bullet 2 of what was learned"]
}`;

        const response = await ai.models.generateContent({
          model: 'gemini-2.0-flash',
          contents: prompt,
        });

        if (response.text) {
          const clean = response.text.replace(/```json/gi, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(clean);
          if (parsed.summary) aiSummary = parsed.summary;
          if (Array.isArray(parsed.takeaways) && parsed.takeaways.length > 0) {
            keyTakeaways = parsed.takeaways;
          }
        }
      } catch (e) {
        console.warn('[session-summary] AI synthesis fallback:', e);
      }
    }

    // Run Adaptive Engine (Section 3) to obtain next action and decision_id
    const adaptiveDecision = await runAdaptiveEngine({
      userId,
      skill,
      topic,
      currentScore: validPost !== null ? validPost : (validPre !== null ? validPre : 65),
      contextPeerId: peerId,
    });

    const nextRecommendation = {
      action: adaptiveDecision.action,
      reason_code: adaptiveDecision.reason_code,
      reason_text: adaptiveDecision.reason_text,
      decision_id: adaptiveDecision.decision_id,
      kind: adaptiveDecision.kind,
      evidence: adaptiveDecision.evidence,
      details: adaptiveDecision.details,
    };

    // Save session summary in session_summaries table
    const sessionId = body.sessionId || `sess_${Date.now()}`;
    const summaryRecord = saveSessionSummary({
      session_id: sessionId,
      user_id: userId,
      topic,
      duration_minutes: durationMinutes,
      before_score: validPre,
      after_score: validPost,
      improvement,
      next_recommendation: nextRecommendation,
      ai_summary: aiSummary,
      ai_review: JSON.stringify({ keyTakeaways, peerName }),
    });

    // Side effect 1: Updates topic_mastery for the topic (using post-quiz score if taken, or attendance baseline if skipped)
    const effectiveScore = validPost !== null ? validPost : 65;
    updateTopicMastery(userId, skill, topic, effectiveScore);

    // Side effect 2: Updates teacher's teaching stats (teaching_stats table: total_sessions, total_delta, average_delta)
    if (peerId && improvement !== null) {
      updateTeachingStats(peerId, skill, improvement);
    }

    // Log to Agent Activity with decision_id
    logAgentActivity(
      'Adaptation',
      'session_summary_concluded',
      `Session ended for ${topic}. Pre: ${validPre !== null ? `${validPre}%` : '—'}, Post: ${validPost !== null ? `${validPost}%` : '—'}, Delta: ${improvement !== null ? `${improvement >= 0 ? '+' : ''}${improvement}` : '—'}. Next: ${adaptiveDecision.action}.`,
      {
        decision_id: adaptiveDecision.decision_id,
        userId,
        peerName,
        topic,
        improvement,
        action: adaptiveDecision.action,
      }
    );

    return NextResponse.json({
      success: true,
      summary: summaryRecord,
      keyTakeaways,
      nextRecommendation,
      decisionId: adaptiveDecision.decision_id,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}
