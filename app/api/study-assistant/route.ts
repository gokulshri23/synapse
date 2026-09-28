import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import {
  getVideoForTopic,
  recordVideoAttempt,
  logAgentActivity,
} from '@/lib/cloudStore';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

// Session debounce store: sessionId -> timestamp of last intervention
const lastInterventionTimes: Record<string, number> = {};

const CONFUSION_PATTERNS = [
  /can'?t understand/i,
  /don'?t get it/i,
  /what do you mean/i,
  /confused/i,
  /make sense/i,
  /lost/i,
  /hard to follow/i,
  // Tanglish patterns
  /puriyala/i,
  /theriyala/i,
  /vilangala/i,
  /purila/i,
];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      sessionId = 'global_collab',
      topic = 'React',
      recentMessages = [],
      senderId = '',
      action = 'check_chat',
      videoId,
      postQuizScore,
    } = body;

    // Handle post-video quiz recording
    if (action === 'record_quiz') {
      if (!videoId) {
        return NextResponse.json({ success: false, error: 'videoId is required' }, { status: 400 });
      }
      const score = typeof postQuizScore === 'number' ? postQuizScore : 0;
      const effect = recordVideoAttempt(videoId, topic, score);

      logAgentActivity(
        'StudyAssistant',
        'record_video_quiz',
        `Recorded post-video quiz score ${score}% for video ${videoId} on topic "${topic}". Current avg: ${effect.avg_score}% (${effect.attempts} attempts).`,
        { videoId, score, avgScore: effect.avg_score, attempts: effect.attempts }
      );

      let adaptationNeeded = false;
      let adaptationReason = '';
      if (score < 50) {
        adaptationNeeded = true;
        adaptationReason = `Learner struggled with post-video quiz (${score}%). Autonomous rematch recommended.`;
      }

      return NextResponse.json({
        success: true,
        effectiveness: effect,
        adaptationNeeded,
        adaptationReason,
      });
    }

    // 1. Cost & Spam Control: Maximum 1 intervention per 3 minutes per session
    const now = Date.now();
    const lastTime = lastInterventionTimes[sessionId] || 0;
    const cooldownMs = 3 * 60 * 1000; // 3 minutes

    if (now - lastTime < cooldownMs) {
      return NextResponse.json({
        success: true,
        triggered: false,
        reason: 'Rate limit active (max 1 intervention per 3 minutes)',
      });
    }

    // 2. Cheap local keyword check
    const textMessages = Array.isArray(recentMessages) ? recentMessages : [];
    const last10 = textMessages.slice(-10);

    const isConfusionMsg = (text: string) =>
      CONFUSION_PATTERNS.some((pat) => pat.test(text || ''));

    // Count user's confusion messages in last 10
    const userConfusionCount = last10.filter(
      (m: any) =>
        (m.sender === 'me' || m.senderId === senderId) && isConfusionMsg(m.text)
    ).length;

    // Count peer's confusion messages in last 10
    const peerConfusionCount = last10.filter(
      (m: any) =>
        (m.sender === 'peer' || (m.senderId && m.senderId !== senderId)) &&
        isConfusionMsg(m.text)
    ).length;

    // Check if AI previously intervened in last 6 messages
    const last6 = textMessages.slice(-6);
    const hasPreviousAiIntervention = last6.some(
      (m: any) => m.type === 'ai_rephrase' || m.type === 'ai_fallback' || m.sender === 'ai'
    );
    const recentConfusionAfterAi = hasPreviousAiIntervention && last6.some((m: any) => isConfusionMsg(m.text));

    // --- TIER 3: Still confused after AI explained -> Send Video ---
    if (recentConfusionAfterAi) {
      lastInterventionTimes[sessionId] = now;
      const video = getVideoForTopic(topic);

      // Generate 3-5 fresh questions on the topic
      const postQuestions = [
        {
          id: 'vq1',
          question: `According to standard principles in ${topic}, what is the best practice for managing state updates?`,
          options: [
            'Directly mutate the state object',
            'Use immutable update patterns or setter functions',
            'Store everything in global variables',
            'Reload the page on change',
          ],
          correct: 1,
        },
        {
          id: 'vq2',
          question: `In ${topic}, which mechanism handles asynchronous error boundaries effectively?`,
          options: [
            'try/catch blocks with proper error state handling',
            'Ignoring rejected promises',
            'Wrapping all code in setTimeout',
            'Synchronous blocking while loops',
          ],
          correct: 0,
        },
        {
          id: 'vq3',
          question: `What is the primary architectural benefit of modular component separation in ${topic}?`,
          options: [
            'Decreases build times to zero',
            'Reusability, isolated testing, and predictable data flow',
            'Removes all need for unit tests',
            'Forces all components to share identical state',
          ],
          correct: 1,
        },
      ];

      logAgentActivity(
        'StudyAssistant',
        'tier_3_curated_video',
        `Both peers remained confused after AI explanation. Embedded curated video "${video.title}" (YouTube ID: ${video.youtube_id}) with post-video quiz.`,
        { topic, youtubeId: video.youtube_id }
      );

      return NextResponse.json({
        success: true,
        triggered: true,
        tier: 3,
        action: 'send_video',
        video: {
          id: video.id,
          youtubeId: video.youtube_id,
          title: video.title,
        },
        postQuiz: postQuestions,
        message: `Still having difficulty with ${topic}? Watch this targeted 5-minute curated tutorial together. The verification quiz will unlock once you finish watching.`,
      });
    }

    // --- TIER 2: Both peers confused about the same concept -> AI teaches both ---
    if (userConfusionCount >= 1 && peerConfusionCount >= 1) {
      lastInterventionTimes[sessionId] = now;

      let explanation = `In ${topic}, the key idea is breaking down complex asynchronous operations into predictable, isolated states (loading, success, error) so neither race conditions nor inconsistent states occur.`;

      if (process.env.GEMINI_API_KEY) {
        try {
          const prompt = `You are an AI study assistant joining a peer study session.
Both students are confused about '${topic}'.
Recent chat context:
${last10.map((m: any) => `${m.senderName || m.sender}: ${m.text}`).join('\n')}

Provide a clear, plain-language 2-sentence explanation of the concept followed by ONE concise 3-line code example. Keep it beginner-friendly and encouraging.`;

          const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: prompt,
          });

          if (response.text) {
            explanation = response.text.trim();
          }
        } catch (e) {
          console.warn('[study-assistant] Gemini call failed, using default explanation:', e);
        }
      }

      logAgentActivity(
        'StudyAssistant',
        'tier_2_joint_explanation',
        `Both peers were confused about "${topic}". Delivered shared plain-language explanation and example.`,
        { topic }
      );

      return NextResponse.json({
        success: true,
        triggered: true,
        tier: 2,
        action: 'teach_both',
        explanation,
        message: `🤖 **AI Study Assistant**: Both of you seem stuck on **${topic}**. Let's break it down together:\n\n${explanation}`,
      });
    }

    // --- TIER 1: Same user confused 3 times in last 10 messages -> Suggest Voice Call ---
    if (userConfusionCount >= 3) {
      lastInterventionTimes[sessionId] = now;

      logAgentActivity(
        'StudyAssistant',
        'tier_1_suggest_voice_call',
        `Learner sent 3 confusion signals within 10 messages. Suggested starting a live voice call for higher-bandwidth communication.`,
        { userConfusionCount }
      );

      return NextResponse.json({
        success: true,
        triggered: true,
        tier: 1,
        action: 'suggest_voice_call',
        message: 'Having trouble understanding each other? Try a voice call to explain in real-time.',
      });
    }

    return NextResponse.json({
      success: true,
      triggered: false,
      reason: 'No confusion threshold reached',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message }, { status: 500 });
  }
}
