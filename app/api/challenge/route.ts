import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { getChallengeForSession, saveChallenge } from '@/lib/cloudStore';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId') || 'global_collab';

    const existing = getChallengeForSession(sessionId);
    return NextResponse.json({ success: true, challenge: existing });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { sessionId = 'global_collab', track = 'React', skillArea = 'Architecture', user1 = 'Learner 1', user2 = 'Learner 2' } = body;

    // Check if challenge already generated for this pairing session
    const existing = getChallengeForSession(sessionId);
    if (existing) {
      return NextResponse.json({ success: true, challenge: existing, cached: true });
    }

    let title = `${track} Peer Challenge: Async State Synchronizer`;
    let description = `Pair with your partner to build a robust custom state handler in ${track}. Address race conditions, memoization, and cleanup.`;
    let starterCode = `// Collaborative Challenge: ${track} (${skillArea})\n// Authors: ${user1} & ${user2}\n\nfunction useResilientSync(endpoint) {\n  // TODO: Implement paired solution with error boundaries\n  return { status: 'idle', data: null };\n}`;

    // Attempt generation with Gemini if API key is present
    if (process.env.GEMINI_API_KEY) {
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const prompt = `You are an expert pair-programming challenge generator. Create a practical 15-minute coding challenge for two learners pairing on ${track} (Focus: ${skillArea}).
Respond in valid JSON only with keys:
{
  "title": "Short punchy challenge title",
  "description": "2-3 sentences explaining the bug or feature to implement collaboratively",
  "starterCode": "Clean commented starter code template"
}`;

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
        });

        const text = response.text || '';
        const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleaned);

        if (parsed.title && parsed.starterCode) {
          title = parsed.title;
          description = parsed.description || description;
          starterCode = parsed.starterCode;
        }
      } catch (aiErr) {
        console.warn('[challenge-api] Gemini fallback engaged:', aiErr);
      }
    }

    const saved = saveChallenge({
      sessionId,
      title,
      description,
      starterCode,
      skillArea: track,
    });

    return NextResponse.json({ success: true, challenge: saved, cached: false });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message }, { status: 500 });
  }
}
