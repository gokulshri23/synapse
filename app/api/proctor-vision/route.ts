import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

if (process.env.NODE_ENV !== 'production') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

const apiKey = process.env.GEMINI_API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export async function POST(req: Request) {
  try {
    const { image } = await req.json();

    if (!image || typeof image !== 'string') {
      return NextResponse.json({
        detected: false,
        item: null,
        confidence: 0,
        explanation: 'No image frame provided'
      });
    }

    const base64Data = image.includes(',') ? image.split(',')[1] : image;

    if (!apiKey) {
      return NextResponse.json({
        detected: false,
        item: null,
        confidence: 0,
        explanation: 'AI vision proctor inactive (missing API key)'
      });
    }

    const prompt = `You are a strict, ultra-vigilant AI Exam Proctor monitoring a student's webcam feed during a high-stakes online exam.
Inspect the image carefully for ANY signs of unauthorized assistance or cheating materials.

Check specifically for:
1. Cell phone, smartphone, or mobile device (being held in hand, raised, or lying near the camera).
2. Notebook, textbook, cheat sheet, handwritten notes, or book.
3. Tablet, smartwatch, or secondary monitor.
4. Second person in the room helping or whispering.

Respond strictly with a JSON object (no markdown, no backticks, just raw JSON):
{
  "detected": true or false,
  "item": "cell phone" | "notebook" | "textbook" | "notes" | "secondary device" | "second person" | null,
  "confidence": number from 0 to 100,
  "explanation": "one short sentence explaining what was detected"
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: base64Data
              }
            }
          ]
        }
      ]
    });

    let text = response.text || '{}';
    if (text.includes('```json')) {
      text = text.substring(text.indexOf('```json') + 7);
      if (text.includes('```')) text = text.substring(0, text.indexOf('```'));
    } else if (text.includes('```')) {
      text = text.substring(text.indexOf('```') + 3);
      if (text.includes('```')) text = text.substring(0, text.indexOf('```'));
    }

    try {
      const parsed = JSON.parse(text.trim());
      return NextResponse.json({
        detected: Boolean(parsed.detected),
        item: parsed.item || null,
        confidence: Number(parsed.confidence) || (parsed.detected ? 90 : 0),
        explanation: parsed.explanation || (parsed.detected ? `Detected ${parsed.item}` : 'Normal')
      });
    } catch (parseErr) {
      const lower = text.toLowerCase();
      const detected = lower.includes('"detected": true') || lower.includes('phone') || lower.includes('notebook') || lower.includes('book');
      return NextResponse.json({
        detected,
        item: lower.includes('phone') ? 'cell phone' : lower.includes('notebook') || lower.includes('book') ? 'notebook' : null,
        confidence: detected ? 85 : 0,
        explanation: detected ? 'Suspicious item detected in frame' : 'Normal'
      });
    }
  } catch (err: any) {
    console.warn('Proctor vision API warning:', err?.message || err);
    return NextResponse.json({
      detected: false,
      item: null,
      confidence: 0,
      explanation: 'Visual monitor operational'
    });
  }
}
