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

    const prompt = `You are ${peer}, an enthusiastic, intelligent college study partner working together on a collaborative ${domain} coding challenge.
You are chatting with your study partner in real-time.
Student's message: "${message}"
Current Challenge Code snippet:
\`\`\`
${userCode || '// No code written yet'}
\`\`\`

Guidelines:
- Reply naturally and intelligently like a top-tier peer engineer and study partner (friendly, technical, concise, 2-3 sentences max).
- If they ask for help or explanation, give an accurate, crisp explanation with clear code advice.
- Point out edge cases or subtle issues if relevant (like async race conditions, cleanup functions, state mutation).
- Never act like an artificial robotic AI assistant; speak as an equal, supportive peer collaborator.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
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
