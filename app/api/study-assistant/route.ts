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

// Curated high-yield learning videos for core curriculum concepts
const CURATED_CONCEPT_VIDEOS: Record<string, { youtubeId: string; title: string }> = {
  // Machine Learning / Neural Networks / Backpropagation / Gradients
  backpropagation: {
    youtubeId: 'Ilg3gGewQ5U',
    title: 'What is backpropagation really doing? | Deep learning, chapter 3 (3Blue1Brown)',
  },
  gradient: {
    youtubeId: 'IHZwWFHWa-w',
    title: 'Gradient descent, how neural networks learn | Deep learning, chapter 2',
  },
  'neural network': {
    youtubeId: 'aircAruvnKk',
    title: 'But what is a neural network? | Deep learning, chapter 1',
  },
  'machine learning': {
    youtubeId: 'i_LwzRVP7bg',
    title: 'Machine Learning for Everybody – Full Course',
  },
  // React & Web Development
  useeffect: {
    youtubeId: '0ZJgJwR445A',
    title: 'useEffect Complete Guide - React Hooks Explained',
  },
  'react lifecycle': {
    youtubeId: '0ZJgJwR445A',
    title: 'React Lifecycle & Hook Cleanup Explained',
  },
  cleanup: {
    youtubeId: '0ZJgJwR445A',
    title: 'React useEffect Cleanup Functions Demystified',
  },
  hooks: {
    youtubeId: 'TNhaISOUy6Q',
    title: 'React Hooks Explained Simply',
  },
  usestate: {
    youtubeId: 'O6P86uwfdR0',
    title: 'React useState Hook Tutorial',
  },
  react: {
    youtubeId: 'bMknfKXIFA8',
    title: 'React Course - Beginner to Advanced Tutorial',
  },
  closure: {
    youtubeId: 'vKJpN5FAeF4',
    title: 'JavaScript Closures Explained in 5 Minutes',
  },
  promise: {
    youtubeId: 'DHvZLI7Db8E',
    title: 'JavaScript Promises in 10 Minutes',
  },
  'event loop': {
    youtubeId: '8zKuNo4ay8E',
    title: 'What the heck is the event loop anyway? | Philip Roberts',
  },
  async: {
    youtubeId: 'V_Kr9OSfDeU',
    title: 'Async/Await JavaScript Tutorial – How to Wait for a Function',
  },
  javascript: {
    youtubeId: 'W6NZfCO5SIk',
    title: 'JavaScript Tutorial for Beginners: Learn JavaScript in 1 Hour',
  },
  python: {
    youtubeId: '_uQrJ0TkZlc',
    title: 'Python for Beginners - Full Course',
  },
  'data structures': {
    youtubeId: 'RBSGKlAvoiM',
    title: 'Data Structures and Algorithms for Beginners',
  },
  'binary tree': {
    youtubeId: 'fAAZ23Xd6aC',
    title: 'Binary Tree Algorithms for Technical Interviews',
  },
  recursion: {
    youtubeId: 'Mv9NEXX1VHc',
    title: 'Recursion in 100 Seconds',
  },
  sql: {
    youtubeId: 'HXV3zeRR3h4',
    title: 'SQL Tutorial - Full Database Course for Beginners',
  },
  git: {
    youtubeId: 'RGOj5yH7evk',
    title: 'Git and GitHub for Beginners - Crash Course',
  },
  docker: {
    youtubeId: 'fqMOX6JJhGo',
    title: 'Docker Tutorial for Beginners',
  },
  'system design': {
    youtubeId: 'm8Icp_Cid5o',
    title: 'System Design Interview – Step By Step Guide',
  },
};

function resolveVideoForConcept(concept: string, topic: string, query?: string | null) {
  const norm = `${concept} ${topic} ${query || ''}`.toLowerCase();
  for (const [key, val] of Object.entries(CURATED_CONCEPT_VIDEOS)) {
    if (norm.includes(key)) {
      return {
        id: `vid_${val.youtubeId}`,
        youtubeId: val.youtubeId,
        title: val.title,
      };
    }
  }

  // Fallback to cloudStore library
  const fallback = getVideoForTopic(concept || topic);
  return {
    id: fallback.id || `vid_${fallback.youtube_id}`,
    youtubeId: fallback.youtube_id,
    title: fallback.title,
  };
}

export const CONFUSION_PATTERNS = [
  /don'?t\s+understand/i,
  /don'?t\s+get\s+it/i,
  /can'?t\s+understand/i,
  /can'?t\s+get/i,
  /can'?t\s+visualize/i,
  /confus(?:ed|ing)/i,
  /what\s+does\s+(?:that|this)\s+mean/i,
  /how\s+does\s+(?:that|this)\s+work/i,
  /what\s+do\s+you\s+mean/i,
  /can\s+you\s+explain/i,
  /can\s+you\s+clarify/i,
  /hard\s+to\s+(?:follow|understand|visualize|picture|grasp)/i,
  /(?:i'?m|am)\s+(?:still\s+)?(?:lost|stuck|confused)/i,
  /not\s+clear/i,
  /still\s+(?:don'?t|unclear|lost|stuck|confused|not\s+clear|struggling|hard)/i,
  /explain\s+differently/i,
  /explain\s+again/i,
  /need\s+(?:a\s+)?(?:video|visual)/i,
  /video\s+didn'?t\s+help/i,
  /puriyala/i,
  /vilangala/i,
  /innum\s+purila/i,
  /@ai/i,
  /hey\s+ai/i,
  /ai\s+help/i,
];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      sessionId = 'global_collab',
      topic = 'Software Engineering',
      recentMessages = [],
      senderId = '',
      action = 'check_chat',
      videoId,
      postQuizScore,
      reason = 'Not helpful / inappropriate',
    } = body;

    // Handle student reporting video ("Not helpful / inappropriate")
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
      return NextResponse.json({
        success: true,
        effectiveness: effect,
        adaptationNeeded: score < 70,
        adaptationReason: score < 70 ? `Learner scored ${score}% on post-video quiz.` : '',
        score,
      });
    }

    // ─── Fast Debounce Check ──────────────────────────────────────
    const now = Date.now();
    const lastTime = lastInterventionTimes[sessionId] || 0;
    const cooldownMs = 2500; // 2.5s rapid response for interactive conversation

    const textMessages = Array.isArray(recentMessages) ? recentMessages : [];
    const last10 = textMessages.slice(-10);
    const latestMsg = last10[last10.length - 1] || {};
    const latestText = String(latestMsg.text || latestMsg.content || '').trim();

    const isDirectAi = /@ai|@copilot|hey ai|ask ai|ai help|ai:/i.test(latestText);

    if (!isDirectAi && now - lastTime < cooldownMs) {
      return NextResponse.json({
        topic,
        concept: topic,
        confusionDetected: false,
        confusionCount: 0,
        action: 'NONE',
        explanation: null,
        youtubeQuery: null,
        video: null,
        reason: 'Rate limit active (cooldown)',
      });
    }

    // ─── Check previous AI interventions in recent history ────────
    const previousAiMsgs = last10.filter(
      (m: any) =>
        m.type === 'study_assistant' ||
        m.type === 'ai_rephrase' ||
        m.type === 'ai_fallback' ||
        (m.senderName && m.senderName.includes('AI'))
    );
    const lastAiMsg = previousAiMsgs[previousAiMsgs.length - 1];

    let previousStage = 0;
    if (lastAiMsg) {
      if (lastAiMsg.aiStage) {
        previousStage = Number(lastAiMsg.aiStage);
      } else if (lastAiMsg.aiAction === 'RECOMMEND_CALL' || /call/i.test(lastAiMsg.text || '')) {
        previousStage = 4;
      } else if (lastAiMsg.aiAction === 'RECOMMEND_YOUTUBE' || /video|youtube/i.test(lastAiMsg.text || '')) {
        previousStage = 3;
      } else if (lastAiMsg.aiAction === 'EXPLAIN_DIFFERENTLY' || /analogy|example|quick check/i.test(lastAiMsg.text || '')) {
        previousStage = 2;
      } else if (lastAiMsg.aiAction === 'EXPLAIN' || lastAiMsg.type === 'study_assistant' || lastAiMsg.type === 'ai_rephrase') {
        previousStage = 1;
      }
    }

    // Check if the latest message expresses confusion
    const hasConfusionKeyword = CONFUSION_PATTERNS.some((p) => p.test(latestText));

    // Fast exit if normal chatting with zero confusion indicators
    const isAcknowledgement = /^(thanks|thank you|got it|makes sense|cool|awesome|ok|okay|let'?s do (?:this|it)|understood|great|nice|perfect)[!.]*$/i.test(
      latestText
    );
    if (isAcknowledgement && !isDirectAi) {
      return NextResponse.json({
        topic,
        concept: topic,
        confusionDetected: false,
        confusionCount: 0,
        action: 'NONE',
        explanation: null,
        youtubeQuery: null,
        video: null,
      });
    }

    // ─── Gemini 2.0 Flash Analysis ────────────────────────────────
    let analysisResult: {
      topic: string;
      concept: string;
      confusionDetected: boolean;
      confusionCount: number;
      action: 'NONE' | 'EXPLAIN' | 'EXPLAIN_DIFFERENTLY' | 'RECOMMEND_YOUTUBE' | 'RECOMMEND_CALL';
      explanation: string | null;
      youtubeQuery: string | null;
    } | null = null;

    if (process.env.GEMINI_API_KEY) {
      try {
        const transcriptSnippet = last10
          .map((m: any) => `${m.senderName || (m.sender === 'me' ? 'Student' : 'Peer')}: ${m.text || m.content || ''}`)
          .join('\n');

        const prompt = `You are the AI Learning Assistant embedded in SYNAPSE, a peer-learning platform.
Two students (peers) are having a learning conversation in chat.

CURRENT CONVERSATION EXCERPT:
${transcriptSnippet || 'No messages yet.'}

LAST MESSAGE SENT:
"${latestText}"

PREVIOUS AI STAGE IN CONVERSATION: Stage ${previousStage} (0 = none, 1 = initial explanation, 2 = alternative analogy, 3 = video recommended, 4 = call recommended)

TASK:
Analyze the conversation and determine:
1. "topic": Overall subject being discussed (e.g., "Neural Networks", "React", "Python").
2. "concept": The specific technical concept or subtopic (e.g., "Gradients in Backpropagation", "useEffect cleanup", "Recursion base cases").
3. "confusionDetected": Boolean. Is there confusion, misunderstanding, or a direct question in the latest message(s)? If peers are conversing normally without struggle, false.
4. "confusionCount": Integer 0 to 4 based on the 4-Stage Escalation Flow:
   - If no confusion -> 0
   - If user asks an unrelated or new question -> reset to 1 for that new concept.
   - If confusion exists and previousStage == 0 -> Stage 1
   - If confusion persists after Stage 1 (e.g. "still don't understand", "still confused", "what does that mean") -> Stage 2
   - If confusion persists after Stage 2 (e.g. "still don't get it", "need visual", "hard to visualize") -> Stage 3
   - If confusion persists after Stage 3 (e.g. "video didn't help", "still stuck") -> Stage 4
5. "action": One of "NONE", "EXPLAIN", "EXPLAIN_DIFFERENTLY", "RECOMMEND_YOUTUBE", "RECOMMEND_CALL" corresponding to confusionCount (0 -> NONE, 1 -> EXPLAIN, 2 -> EXPLAIN_DIFFERENTLY, 3 -> RECOMMEND_YOUTUBE, 4 -> RECOMMEND_CALL).
6. "explanation":
   - For Stage 0: null
   - For Stage 1: 2 to 3 clear, contextual sentences explaining the confusing concept directly in the context of what the peers were discussing.
   - For Stage 2: Completely different explanation style. Use plain beginner-friendly language, a clear real-world analogy, a tiny code/concrete example, and end with "Quick Check: [1 simple conceptual question]?".
   - For Stage 3: A friendly 1-2 sentence recommendation introducing the visual video breakdown.
   - For Stage 4: "Would you like to explain this directly with your peer? Talking through it in real-time over a voice or video call is often the quickest way to get unstuck."
7. "youtubeQuery":
   - For Stage 3: A concise, highly targeted YouTube search query for this concept (e.g. "backpropagation gradient descent visual 3blue1brown").
   - For other stages: null.

CRITICAL INSTRUCTIONS:
- Do NOT output markdown code blocks.
- Return ONLY a raw valid JSON object.`;

        const response = await ai.models.generateContent({
          model: 'gemini-2.0-flash',
          contents: prompt,
        });

        if (response.text) {
          const cleanText = response.text.replace(/```json/gi, '').replace(/```/g, '').trim();
          analysisResult = JSON.parse(cleanText);
        }
      } catch (geminiErr) {
        console.warn('[study-assistant] Gemini analysis error, falling back to heuristic engine:', geminiErr);
      }
    }

    // ─── Fallback Heuristic Engine if Gemini Unavailable ──────────
    if (!analysisResult) {
      if (!hasConfusionKeyword && !isDirectAi) {
        return NextResponse.json({
          topic,
          concept: topic,
          confusionDetected: false,
          confusionCount: 0,
          action: 'NONE',
          explanation: null,
          youtubeQuery: null,
          video: null,
        });
      }

      // Check if user switched to a new/unrelated concept (Reset Rule)
      const isNewTopic = /(?:switch\s+to|different\s+topic|unrelated|another\s+question|how\s+does\s+sql|databases?|instead)/i.test(latestText);
      let nextStage = 1;
      if (!isNewTopic) {
        if (previousStage === 1) nextStage = 2;
        else if (previousStage === 2) nextStage = 3;
        else if (previousStage >= 3) nextStage = 4;
      }

      const actions: Record<number, 'EXPLAIN' | 'EXPLAIN_DIFFERENTLY' | 'RECOMMEND_YOUTUBE' | 'RECOMMEND_CALL'> = {
        1: 'EXPLAIN',
        2: 'EXPLAIN_DIFFERENTLY',
        3: 'RECOMMEND_YOUTUBE',
        4: 'RECOMMEND_CALL',
      };

      let extractedConcept = topic || 'this concept';
      const conceptMatch = latestText.match(/(?:understand|about|on|how|what\s+is)\s+([a-zA-Z\s]{3,30})/i);
      if (conceptMatch && conceptMatch[1]) {
        const candidate = conceptMatch[1].trim().replace(/[?.!].*$/, '').trim();
        if (candidate.length > 2 && candidate.length < 35) {
          extractedConcept = candidate;
        }
      }

      let fallbackExplanation = `Let's clarify **${extractedConcept}**: In simple terms, it guides the process step by step to ensure correct and predictable behavior.`;
      if (nextStage === 2) {
        fallbackExplanation = `Think of **${extractedConcept}** like following a GPS route: whenever you drift off-course, it calculates the direction and distance back to your goal.\n\nQuick Check: If you take a step in the opposite direction of the gradient, does your error increase or decrease?`;
      } else if (nextStage === 3) {
        fallbackExplanation = `Since visual intuition makes **${extractedConcept}** much easier to grasp, here is an intuitive video breakdown:`;
      } else if (nextStage === 4) {
        fallbackExplanation = `Would you like to explain this directly with your peer? Talking through it in real-time over voice or video call is often the fastest way to get on the same page.`;
      }

      analysisResult = {
        topic: isNewTopic ? extractedConcept : topic,
        concept: extractedConcept,
        confusionDetected: true,
        confusionCount: nextStage,
        action: actions[nextStage] || 'EXPLAIN',
        explanation: fallbackExplanation,
        youtubeQuery: `${extractedConcept} visual explanation tutorial`,
      };
    }

    // If no confusion detected, return early
    if (!analysisResult.confusionDetected || analysisResult.action === 'NONE') {
      return NextResponse.json({
        topic: analysisResult.topic || topic,
        concept: analysisResult.concept || topic,
        confusionDetected: false,
        confusionCount: 0,
        action: 'NONE',
        explanation: null,
        youtubeQuery: null,
        video: null,
      });
    }

    // Record intervention time for debounce
    lastInterventionTimes[sessionId] = now;

    // Attach video data if Stage 3 (RECOMMEND_YOUTUBE)
    let videoData: { id: string; youtubeId: string; title: string } | null = null;
    if (analysisResult.action === 'RECOMMEND_YOUTUBE' || analysisResult.confusionCount === 3) {
      videoData = resolveVideoForConcept(
        analysisResult.concept,
        analysisResult.topic,
        analysisResult.youtubeQuery
      );
    }

    logAgentActivity(
      'StudyAssistant',
      `escalation_stage_${analysisResult.confusionCount}`,
      `AI In-Chat Escalation [Stage ${analysisResult.confusionCount}]: ${analysisResult.action} for concept "${analysisResult.concept}" (Topic: ${analysisResult.topic}).`,
      {
        concept: analysisResult.concept,
        stage: analysisResult.confusionCount,
        action: analysisResult.action,
        hasVideo: Boolean(videoData),
      }
    );

    return NextResponse.json({
      success: true,
      topic: analysisResult.topic || topic,
      concept: analysisResult.concept || topic,
      confusionDetected: true,
      confusionCount: analysisResult.confusionCount,
      action: analysisResult.action,
      explanation: analysisResult.explanation,
      youtubeQuery: analysisResult.youtubeQuery || null,
      video: videoData,
      tier: analysisResult.confusionCount,
      triggered: true,
      message: analysisResult.explanation,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}
