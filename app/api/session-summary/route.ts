import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { addReinforceTopic, logAgentActivity } from '@/lib/cloudStore';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      userId,
      peerName,
      topic = 'React',
      preScore,
      postScore,
      messages = [],
      challengeTitle,
      codeSolution,
    } = body;

    if (!userId) {
      return NextResponse.json({ success: false, error: 'userId is required' }, { status: 400 });
    }

    const delta = (typeof postScore === 'number' && typeof preScore === 'number')
      ? postScore - preScore
      : null;

    let summary = `Completed peer session on ${topic} with ${peerName || 'partner'}.`;
    let strengths: string[] = ['Active peer collaboration and code co-authoring'];
    let weakTopics: string[] = [];

    // Use Gemini for intelligent session synthesis if API key is present
    if (process.env.GEMINI_API_KEY) {
      try {
        const recentSnippet = messages.slice(-10).map((m: any) => `${m.senderName || m.sender}: ${m.text}`).join('\n');
        const prompt = `You are the Synapse Autonomous Learning Planner Agent.
Analyze this peer learning session:
- Topic: ${topic}
- Pre-quiz Score: ${preScore ?? 'N/A'}%
- Post-quiz Score: ${postScore ?? 'N/A'}%
- Score Improvement: ${delta !== null ? (delta >= 0 ? `+${delta}%` : `${delta}%`) : 'N/A'}
- Challenge: ${challengeTitle || 'Custom asynchronous hook'}
- Discussion excerpt:
${recentSnippet || 'Peer discussed logic and error handling.'}

Return JSON strictly conforming to:
{
  "summary": "2-sentence executive summary of student mastery and session dynamics",
  "strengths": ["string", "string"],
  "weakTopics": ["string"]
}
If post-quiz is below 70% or score dropped or student was confused, include 1 specific subtopic in weakTopics that needs reinforcement.`;

        const response = await ai.models.generateContent({
          model: 'gemini-2.0-flash',
          contents: prompt,
        });

        if (response.text) {
          const clean = response.text.replace(/```json/gi, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(clean);
          if (parsed.summary) summary = parsed.summary;
          if (Array.isArray(parsed.strengths)) strengths = parsed.strengths;
          if (Array.isArray(parsed.weakTopics)) weakTopics = parsed.weakTopics;
        }
      } catch (e) {
        console.warn('[session-summary] AI synthesis fallback:', e);
      }
    }

    // Fallback topic detection if post-score is low
    if (typeof postScore === 'number' && postScore < 70 && weakTopics.length === 0) {
      weakTopics.push(`${topic} Edge Cases & Error Boundaries`);
    }

    // Autonomous action: If weak topics found, insert them into roadmap as reinforce nodes!
    let updatedNodes = null;
    if (weakTopics.length > 0) {
      for (const wt of weakTopics) {
        updatedNodes = addReinforceTopic(userId, topic, wt);
        logAgentActivity(
          'Planner',
          'auto_reinforce_topic',
          `Added reinforcement module "${wt}" to learner's roadmap based on session diagnosis (post-score: ${postScore ?? 'N/A'}%).`,
          { topic, weakTopic: wt, postScore }
        );
      }
    } else {
      logAgentActivity(
        'Planner',
        'session_completed_mastered',
        `Learner successfully completed session for "${topic}" with post-score ${postScore}%. Strengths: ${strengths.join(', ')}.`,
        { topic, postScore }
      );
    }

    return NextResponse.json({
      success: true,
      summary,
      strengths,
      weakTopics,
      roadmapUpdated: weakTopics.length > 0,
      updatedNodes,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}
