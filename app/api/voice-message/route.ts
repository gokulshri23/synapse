import { NextRequest, NextResponse } from 'next/server';
import { addEnhancedMessage } from '@/lib/cloudStore';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, senderId, senderName, voiceDataUrl, senderRole } = body;

    if (!sessionId || !senderId || !senderName || !voiceDataUrl) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (typeof voiceDataUrl !== 'string' || !voiceDataUrl.startsWith('data:audio')) {
      return NextResponse.json({ error: 'Invalid voiceDataUrl. Must be a valid audio data URI.' }, { status: 400 });
    }

    const result = addEnhancedMessage({
      sessionId,
      type: 'voice',
      senderId,
      senderName,
      text: '🎤 Voice message',
      voiceDataUrl,
      senderRole
    });

    return NextResponse.json({ success: true, message: result });
  } catch (error) {
    console.error('Error in voice-message API:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
