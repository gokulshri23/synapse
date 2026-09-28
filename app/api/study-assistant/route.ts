import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import {
  getVideoForTopic,
  recordVideoAttempt,
  deprecateVideo,
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
      reason = 'Not helpful / inappropriate',
    } = body;

    // Handle student reporting video ("Not helpful / inappropriate") -> deprecation flag
    if (action === 'report_video' || action === 'deprecate_video') {
      if (!videoId) {
        return NextResponse.json({ success: false, error: 'videoId is required' }, { status: 400 });
      }

      const success = deprecateVideo(videoId, reason);
      logAgentActivity(
        'StudyAssistant',
        'deprecate_video_reported',
        `Video ${videoId} reported as "${reason}" by student. Flagged as deprecated in video library.`,
        { videoId, reason, success }
      );

      return NextResponse.json({
        success: true,
        deprecated: true,
        message: 'Video feedback recorded. Video has been marked deprecated in the library.',
      });
    }

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
      if (score < 70) {
        // If score < 70%, trigger Adaptive Engine (rematch or easier subtopic)
        adaptationNeeded = true;
        adaptationReason = `Learner scored ${score}% (< 70%) on post-video quiz. Autonomous peer rematch or prerequisite revision triggered.`;
      }

      return NextResponse.json({
        success: true,
        effectiveness: effect,
        adaptationNeeded,
        adaptationReason,
        score,
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

    const anyConfusion = userConfusionCount > 0 || peerConfusionCount > 0;

    if (!anyConfusion) {
      return NextResponse.json({
        success: true,
        triggered: false,
        reason: 'No confusion detected in recent messages',
      });
    }

    // If matched: call Gemini to extract the EXACT concept they are confused about (never show raw)
    let extractedConcept = topic;
    if (process.env.GEMINI_API_KEY) {
      try {
        const conceptPrompt = `A student studying '${topic}' in a peer programming session is experiencing confusion.
Recent chat excerpt:
${last10.map((m: any) => `${m.senderName || m.sender}: ${m.text}`).join('\n')}

Extract the single EXACT specific concept or subtopic they are confused about (e.g. 'useEffect cleanup', 'list slicing', 'async error handling', 'props vs state').
Return ONLY the concise concept name (1 to 4 words). Do not include formatting, quotes, or conversational text.`;

        const conceptRes = await ai.models.generateContent({
          model: 'gemini-2.0-flash',
          contents: conceptPrompt,
        });

        if (conceptRes.text) {
          const cleaned = conceptRes.text.trim().replace(/^["']|["']$/g, '');
          if (cleaned.length > 2 && cleaned.length < 50) {
            extractedConcept = cleaned;
          }
        }
      } catch (e) {
        console.warn('[study-assistant] Gemini concept extraction fallback:', e);
      }
    }

    // Check if AI previously intervened in last 6 messages
    const last6 = textMessages.slice(-6);
    const hasPreviousAiIntervention = last6.some(
      (m: any) => m.type === 'ai_rephrase' || m.type === 'ai_fallback' || m.sender === 'ai'
    );
    const recentConfusionAfterAi = hasPreviousAiIntervention && last6.some((m: any) => isConfusionMsg(m.text));

    // --- STEP 3: Still confused after AI explanation -> Embed ONE video ---
    if (recentConfusionAfterAi) {
      lastInterventionTimes[sessionId] = now;
      const video = getVideoForTopic(extractedConcept || topic);

      const postQuestions = [
        {
          id: 'vq1',
          question: `In ${extractedConcept || topic}, which principle is essential for maintaining predictable behavior?`,
          options: [
            'Directly mutating shared global variables',
            'Applying immutable state updates and explicit dependency control',
            'Suppressing all asynchronous errors silently',
            'Running infinite synchronous loops',
          ],
          correct: 1,
        },
        {
          id: 'vq2',
          question: `How should edge cases and async failures in ${extractedConcept || topic} be managed?`,
          options: [
            'Robust try/catch error boundaries with fallback states',
            'Ignoring rejected promises',
            'Reloading the entire application window',
            'Wrapping all expressions in eval()',
          ],
          correct: 0,
        },
        {
          id: 'vq3',
          question: `What is the key architectural objective when designing modular implementations for ${extractedConcept || topic}?`,
          options: [
            'Minimizing readability to increase minification speed',
            'High cohesion, loose coupling, and testable isolated contracts',
            'Avoiding any type definitions or interfaces',
            'Merging business logic directly into presentation views',
          ],
          correct: 1,
        },
      ];

      logAgentActivity(
        'StudyAssistant',
        'tier_3_curated_video',
        `Learners remained confused after AI explanation regarding "${extractedConcept}". Embedded curated educational video "${video.title}" (ID: ${video.youtube_id}).`,
        { concept: extractedConcept, topic, youtubeId: video.youtube_id }
      );

      return NextResponse.json({
        success: true,
        triggered: true,
        tier: 3,
        action: 'send_video',
        concept: extractedConcept,
        video: {
          id: video.id,
          youtubeId: video.youtube_id,
          title: video.title,
          durationSeconds: 300,
        },
        postQuiz: postQuestions,
        message: `Here's a 5-minute video that explains ${extractedConcept} well. The verification quiz will unlock once you watch 80%.`,
      });
    }

    // --- STEP 2: Both users confused about the same concept -> AI teaches both in plain language with a 3-line example ---
    if (userConfusionCount >= 1 && peerConfusionCount >= 1) {
      lastInterventionTimes[sessionId] = now;

      let explanation = `In ${extractedConcept}, the core idea is separating initialization from side effects and cleanup to prevent memory leaks and unexpected state transitions.\n\n\`\`\`js\nuseEffect(() => {\n  const sub = subscribe(id, handler);\n  return () => sub.unsubscribe(); // clean up\n}, [id]);\n\`\`\``;

      if (process.env.GEMINI_API_KEY) {
        try {
          const prompt = `You are an AI study assistant joining a peer study session.
Both students are confused about '${extractedConcept}'.
Recent chat context:
${last10.map((m: any) => `${m.senderName || m.sender}: ${m.text}`).join('\n')}

Provide a clear, plain-language 2-sentence explanation of '${extractedConcept}' followed by ONE concise 3-line code example. Keep it beginner-friendly, concrete, and encouraging.`;

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
        `Both peers were confused about "${extractedConcept}". Delivered shared plain-language explanation with 3-line example.`,
        { concept: extractedConcept, topic }
      );

      return NextResponse.json({
        success: true,
        triggered: true,
        tier: 2,
        action: 'teach_both',
        concept: extractedConcept,
        explanation,
        message: `🤖 **AI Study Assistant**: Both of you seem stuck on **${extractedConcept}**. Let's break it down together:\n\n${explanation}`,
      });
    }

    // --- STEP 1: Same user confused 3 times in last 10 messages -> Suggest Voice Call ---
    if (userConfusionCount >= 3) {
      lastInterventionTimes[sessionId] = now;

      logAgentActivity(
        'StudyAssistant',
        'tier_1_suggest_voice_call',
        `Learner sent 3 confusion signals within 10 messages. Suggested starting a live voice call for higher bandwidth communication.`,
        { userConfusionCount, concept: extractedConcept }
      );

      return NextResponse.json({
        success: true,
        triggered: true,
        tier: 1,
        action: 'suggest_voice_call',
        concept: extractedConcept,
        message: 'Having trouble understanding each other? Try a voice call to explain in real-time.',
      });
    }

    return NextResponse.json({
      success: true,
      triggered: false,
      reason: 'Confusion threshold not met for intervention',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message }, { status: 500 });
  }
}
