import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import {
  getOrCreateChallengeRecord,
  getChallengeSubmissions,
  logAgentActivity,
} from '@/lib/cloudStore';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId') || 'global_collab';
    const topic = searchParams.get('topic') || 'React';

    const challenge = getOrCreateChallengeRecord(sessionId, topic);
    const submissions = getChallengeSubmissions(challenge.id);

    return NextResponse.json({
      success: true,
      challenge,
      submissions,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      sessionId = 'global_collab',
      topic = 'React',
      skillArea = 'Architecture',
      user1 = 'Learner 1',
      user2 = 'Learner 2',
    } = body;

    // Check if challenge already generated for this pairing session
    const existing = getOrCreateChallengeRecord(sessionId, topic);
    const submissions = getChallengeSubmissions(existing.id);

    // If existing has real question and wasn't generated fresh, return it (consistent across both peers)
    if (existing && existing.question && !existing.question.includes('customData')) {
      return NextResponse.json({
        success: true,
        challenge: existing,
        submissions,
        cached: true,
      });
    }

    let question = `Implement a production-ready resilient state handler in ${topic} addressing race conditions and memory leaks.`;
    let rubric = {
      criteria: [
        'Correct asynchronous coordination and edge-case handling',
        'State consistency under concurrent calls',
        'Clean error boundaries and unmount cleanup',
      ],
      max_score: 100,
    };
    let starterCode = `// Collaborative Challenge: ${topic} (${skillArea})\n// Authors: ${user1} & ${user2}\n\nfunction useResilientSync(endpoint) {\n  // Implement your shared solution\n  return { status: 'idle', data: null };\n}`;

    if (process.env.GEMINI_API_KEY) {
      try {
        const prompt = `You are an expert pair-programming challenge architect.
Create a real, challenging practical pair coding challenge for two learners working together on ${topic} (${skillArea}).
Return strictly JSON with keys:
{
  "question": "<Comprehensive challenge prompt with clear constraints and expected behavior>",
  "rubric": {
    "criteria": ["<criterion 1>", "<criterion 2>", "<criterion 3>"],
    "max_score": 100
  },
  "starter_code": "<Clean, commented starter template>"
}`;

        const response = await ai.models.generateContent({
          model: 'gemini-2.0-flash',
          contents: prompt,
        });

        const text = response.text || '';
        const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleaned);

        if (parsed.question && parsed.rubric) {
          question = parsed.question;
          rubric = parsed.rubric;
          if (parsed.starter_code) starterCode = parsed.starter_code;
        }
      } catch (aiErr) {
        console.warn('[challenge-api] Gemini fallback engaged:', aiErr);
      }
    }

    const savedChallenge = getOrCreateChallengeRecord(sessionId, topic, {
      question,
      rubric,
      starter_code: starterCode,
    });

    logAgentActivity(
      'Evaluation',
      'generate_collaborative_challenge',
      `Generated shared challenge for session ${sessionId} on topic "${topic}".`,
      { challengeId: savedChallenge.id, topic }
    );

    return NextResponse.json({
      success: true,
      challenge: savedChallenge,
      submissions: getChallengeSubmissions(savedChallenge.id),
      cached: false,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message }, { status: 500 });
  }
}
