import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

if (process.env.NODE_ENV !== 'production') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

const apiKey = process.env.GEMINI_API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (body.mode === 'rephrase') {
      const prompt = `You are a helpful teaching assistant. Rephrase the following explanation in simpler terms that a complete beginner would understand. Use an analogy if helpful. Keep it concise (2-3 sentences max).\n\nOriginal: ${body.originalMessage}`;
      const response = await ai.models.generateContent({ model: 'gemini-2.0-flash', contents: prompt });
      return NextResponse.json({ reply: response.text, mode: 'rephrase' });
    }

    if (body.mode === 'fallback') {
      const prompt = `You are an expert tutor. Both learners are stuck on this topic: ${body.topic}. Here is their recent conversation: ${JSON.stringify(body.recentMessages)}. Provide a clear, comprehensive explanation that addresses their confusion. Use simple language, step-by-step breakdown, and practical examples. Keep it under 300 words.`;
      const response = await ai.models.generateContent({ model: 'gemini-2.0-flash', contents: prompt });
      return NextResponse.json({ reply: response.text, mode: 'fallback' });
    }

    const { message, history, userCode, track, peerName } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ reply: 'Hey! Ready when you are. What part of the challenge are you working on?' });
    }

    if (!apiKey) {
      return NextResponse.json({
        reply: "Nice! I was looking at that function too. Let's make sure we handle the loading and error states cleanly."
      });
    }

    const peer = peerName || 'Maya';
    const domain = track || 'Programming';

    const prompt = `You are ${peer}, an enthusiastic, sharp peer student working together on a collaborative ${domain} coding challenge in a university hackathon/study lab.
You are chatting with your study partner in a peer coding session.
Student's message: "${message}"
Current Challenge Code snippet:
\`\`\`
${userCode || '// No code submitted yet'}
\`\`\`

Guidelines:
- Reply naturally like a real college peer / hackathon partner (friendly, technical, concise, 2-3 sentences).
- Give constructive peer feedback, point out clever tricks or subtle bugs (like cleanup functions in useEffect, memory leaks, off-by-one errors).
- Occasionally use natural developer phrasing ("Totally agree", "Good catch", "Let's test edge cases", "Looks solid!").
- Do NOT talk like an AI robot or assistant; talk as an equal peer studying together.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt
    });

    const reply = response.text?.trim() || "That looks promising! Let's submit the solution to the evaluation agent and see our score.";
    return NextResponse.json({ reply });
  } catch (err: any) {
    console.warn('Peer chat warning:', err?.message || err);
    return NextResponse.json({
      reply: "Great point! Let's optimize the logic and run the evaluator to check our mastery score."
    });
  }
}
