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

    const trimmedMsg = message.trim();

    // Check for random gibberish or keyboard mashing
    const gibberishPattern = /[^aeiou\s\d.,!?@#]{5,}/i;
    const isGibberish = gibberishPattern.test(trimmedMsg) || (trimmedMsg.length === 1 && !/[a-z0-9?]/i.test(trimmedMsg));
    if (isGibberish) {
      return NextResponse.json({
        reply: "I'm not quite sure I caught that! Are you stuck on something in the code, or would you like me to walk through the problem step-by-step?"
      });
    }

    const peer = peerName || 'AI Peer Tutor';
    const domain = track || 'Programming';
    const isTutor = peer.toLowerCase().includes('tutor') || peer.toLowerCase().includes('ai');

    if (!apiKey) {
      const fallbackMsg = isTutor
        ? `In ${domain}, the best way to master this is by breaking down the logic into small, testable steps. Which concept should we start with?`
        : `Nice! I was looking at that function too. Let's make sure we handle the core logic cleanly.`;
      return NextResponse.json({ reply: fallbackMsg });
    }

    const systemPrompt = isTutor
      ? `You are the Synapse Autonomous AI Peer Tutor specializing in ${domain}.
You are conducting a dedicated 1-on-1 tutoring and pair-programming session with the student.
Student's message: "${trimmedMsg}"
Current Challenge Code snippet:
\`\`\`
${userCode || '// No code written yet'}
\`\`\`

Pedagogical Guidelines:
- Act as an empathetic, world-class computer science teacher and mentor.
- Provide crisp, accurate, plain-language explanations. If relevant, include a tiny 2-3 line code example.
- Highlight common bugs or edge cases (e.g., mutability, off-by-one errors, async handling).
- Ask an insightful question at the end to check their understanding and keep them actively learning.
- Keep responses friendly, encouraging, and under 4-5 sentences.`
      : `You are ${peer}, an enthusiastic, intelligent college study partner working together on a collaborative ${domain} coding challenge.
Student's message: "${trimmedMsg}"
Current Challenge Code snippet:
\`\`\`
${userCode || '// No code written yet'}
\`\`\`

Guidelines:
- Reply naturally and intelligently like a top-tier peer engineer and study partner (friendly, technical, concise, 2-3 sentences max).
- If they ask for help or explanation, give an accurate, crisp explanation with clear code advice.
- Point out edge cases or subtle issues if relevant.
- Never act like an artificial robotic AI assistant; speak as an equal, supportive peer collaborator.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: systemPrompt
    });

    const reply = response.text?.trim() || (
      isTutor
        ? `Let's break this down together. What is your current hypothesis about how this function should work?`
        : `That looks interesting! Let's test it out with a few test cases.`
    );

    return NextResponse.json({ reply });
  } catch (err: any) {
    console.warn('Peer chat warning:', err?.message || err);
    return NextResponse.json({
      reply: "Let's take a step back and examine the core logic together. Which part feels most confusing right now?"
    });
  }
}
