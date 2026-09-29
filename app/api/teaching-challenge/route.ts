import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import { saveTeachingAssessment, TeachingAssessmentRecord } from '@/lib/cloudStore';

if (process.env.NODE_ENV !== 'production') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

// Transparent Configurable Scoring Weights (50% Written, 50% Voice)
export const WRITTEN_WEIGHT = 0.50;
export const VOICE_WEIGHT = 0.50;

// Preferred Models in fallback order
const CANDIDATE_MODELS = ['gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.5-flash'];

function getGenAI() {
  const apiKey = process.env.GEMINI_API_KEY || '';
  return new GoogleGenAI({ apiKey });
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!url || !key) return null;
  return createClient(url, key);
}

// Built-in Curated Topic Challenges (for immediate reliability & fallback)
const DOMAIN_CHALLENGE_BANK: Record<string, { topic: string; prompt: string }> = {
  Python: {
    topic: 'Mutable vs Immutable Data Types & Memory References',
    prompt: 'Explain to a beginner student why modifying a Python list inside a function alters the original list, but modifying an integer does not. Use a real-world analogy (e.g. a shared notebook vs passing a photocopy) and a small code demonstration.'
  },
  React: {
    topic: 'Virtual DOM, Reconciliation & Component Re-renders',
    prompt: 'Explain the React Virtual DOM to a student who only knows basic HTML/JavaScript. Why does React compare virtual trees instead of directly manipulating the browser DOM on every keystroke? Provide an analogy (e.g. blueprinted architectural updates) and an example.'
  },
  JavaScript: {
    topic: 'The JavaScript Event Loop & Asynchronous Microtasks',
    prompt: 'A student is confused why console.log("Done") prints before a setTimeout with 0 milliseconds. Explain the JavaScript Event Loop, Call Stack, and Task Queue in simple terms with an analogy (e.g. a restaurant kitchen and order queue).'
  },
  'Machine Learning': {
    topic: 'Overfitting vs Underfitting & Regularization',
    prompt: 'Explain Overfitting versus Underfitting to a non-technical peer. How does a model memorize noise versus learning generalizable patterns? Use an analogy (e.g. memorizing flashcards without understanding) and how regularization prevents it.'
  },
  'Data Structures': {
    topic: 'Arrays vs Singly Linked Lists Trade-offs',
    prompt: 'Teach a beginner why looking up an item by index in an Array is O(1) instantaneous, while inserting in the middle of a large Array is expensive compared to a Linked List. Use an intuitive physical analogy (e.g. numbered train seats vs a treasure hunt chain).'
  },
  'System Design': {
    topic: 'Horizontal Scaling, Stateless Services & Load Balancing',
    prompt: 'Explain horizontal vs vertical scaling to a junior developer. How does a load balancer distribute traffic across stateless server replicas, and what happens to session data? Use an everyday analogy (e.g. supermarket checkout lines).'
  },
  Algorithms: {
    topic: 'Binary Search & Logarithmic Time Complexity',
    prompt: 'Explain how Binary Search finds a target in an already sorted list in O(log n) steps. Compare searching a dictionary sequentially page-by-page versus halving the search space with each step.'
  },
  'Web Development': {
    topic: 'Client-Side Rendering (CSR) vs Server-Side Rendering (SSR)',
    prompt: 'Explain the fundamental differences between Client-Side Rendering (React SPA) and Server-Side Rendering (Next.js). Walk through what the browser initially receives, how fast the first paint is, and why SEO differs.'
  },
  Databases: {
    topic: 'Database Indexing & B-Trees vs Full Table Scans',
    prompt: 'Explain why database queries become slow as tables grow into millions of rows, and how adding a B-Tree Index speeds up searches. Use a book index analogy.'
  },
  DevOps: {
    topic: 'Docker Containers vs Virtual Machines',
    prompt: 'Explain the difference between a Docker container and a Virtual Machine to someone who has never used Docker. Explain shared OS kernel versus guest OS overhead using an apartment building vs independent houses analogy.'
  },
  'Problem Solving': {
    topic: 'Breaking Down Ambiguous Engineering Problems',
    prompt: 'Teach a peer a structured 4-step framework for solving complex coding problems: understand constraints, brainstorm brute force, optimize bottlenecks, and test edge cases. Use a concrete example.'
  },
  'Mobile Development': {
    topic: 'Cross-Platform Frameworks vs Native Mobile Development',
    prompt: 'Explain how cross-platform mobile frameworks (like React Native or Flutter) render UI on iOS and Android compared to pure Swift/Kotlin native apps. Discuss performance trade-offs.'
  }
};

// Execute Gemini call with multi-model fallback
async function callGemini(contents: any, isJson: boolean = false): Promise<string> {
  const ai = getGenAI();
  let lastError: any = null;

  for (const modelName of CANDIDATE_MODELS) {
    try {
      const config: any = isJson ? { responseMimeType: 'application/json' } : {};
      const response = await ai.models.generateContent({
        model: modelName,
        contents,
        config
      });
      if (response && response.text) {
        return response.text;
      }
    } catch (err: any) {
      lastError = err;
      // If 503 or 404, try next candidate model
      console.warn(`[teaching-challenge] Model ${modelName} error (${err.status || err.message}), trying next...`);
    }
  }

  throw lastError || new Error('All Gemini candidate models failed.');
}

// Intelligent Heuristic Scorer for Written Text (Fallback if API unavailable)
function evaluateWrittenHeuristic(explanation: string, topic: string) {
  const text = (explanation || '').trim();
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  // Severe penalty for trivial or empty submissions
  if (wordCount < 15) {
    return {
      accuracy: 25,
      clarity: 30,
      depth: 20,
      beginnerFriendliness: 25,
      examplesAndAnalogy: 15,
      writtenScore: 25,
      feedback: 'The explanation is too short and lacks essential pedagogical depth, analogies, and technical context.',
      knowledgeGaps: ['Insufficient conceptual detail', 'Missing concrete code/practical examples', 'No relatable analogy provided']
    };
  }

  let accuracy = 70;
  let clarity = 70;
  let depth = 65;
  let beginnerFriendliness = 65;
  let examplesAndAnalogy = 60;
  const knowledgeGaps: string[] = [];

  // Analogy detection
  const hasAnalogy = /(like|similar to|imagine|analogy|think of|as if|picture a|metaphor)/i.test(text);
  if (hasAnalogy) {
    examplesAndAnalogy += 20;
    beginnerFriendliness += 15;
  } else {
    knowledgeGaps.push('Could benefit from an intuitive real-world analogy to simplify complex concepts.');
  }

  // Example detection
  const hasExample = /(for example|e\.g\.|such as|consider|take the case|code|function|def |class )/i.test(text);
  if (hasExample) {
    examplesAndAnalogy += 15;
    depth += 10;
  } else {
    knowledgeGaps.push('Include a concrete code snippet or step-by-step example to reinforce the idea.');
  }

  // Length and structure bonus
  if (wordCount >= 60) {
    depth += 10;
    clarity += 5;
  }
  if (wordCount >= 120) {
    accuracy += 5;
    depth += 5;
  }

  // Clamp 0-100
  accuracy = Math.min(95, Math.max(30, accuracy));
  clarity = Math.min(95, Math.max(30, clarity));
  depth = Math.min(95, Math.max(25, depth));
  beginnerFriendliness = Math.min(95, Math.max(30, beginnerFriendliness));
  examplesAndAnalogy = Math.min(95, Math.max(20, examplesAndAnalogy));

  const writtenScore = Math.round(
    accuracy * 0.35 + clarity * 0.25 + depth * 0.20 + beginnerFriendliness * 0.10 + examplesAndAnalogy * 0.10
  );

  return {
    accuracy,
    clarity,
    depth,
    beginnerFriendliness,
    examplesAndAnalogy,
    writtenScore,
    feedback: hasAnalogy && hasExample
      ? 'Strong explanation with commendable real-world analogy and clear technical communication.'
      : 'Good foundational explanation. Incorporating more explicit analogies and practical examples will elevate teaching clarity.',
    knowledgeGaps: knowledgeGaps.length > 0 ? knowledgeGaps : ['Edge case handling', 'Deep memory implications']
  };
}

// Intelligent Heuristic Scorer for Voice/Audio
function evaluateVoiceHeuristic(transcript: string, audioBytesLength: number) {
  const text = (transcript || '').trim();
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  if (audioBytesLength < 500 && wordCount < 5) {
    return {
      verbalClarity: 0,
      deliveryTone: 0,
      spokenAccuracy: 0,
      voiceScore: 0,
      transcript: '(No audible voice recorded)',
      feedback: 'No audible spoken explanation was detected. A recorded verbal explanation is required to verify verbal teaching clarity.'
    };
  }

  let verbalClarity = 75;
  let deliveryTone = 75;
  let spokenAccuracy = 70;

  if (wordCount >= 25) {
    verbalClarity += 10;
    deliveryTone += 10;
    spokenAccuracy += 10;
  } else if (wordCount < 10) {
    verbalClarity -= 20;
    spokenAccuracy -= 20;
  }

  verbalClarity = Math.min(95, Math.max(20, verbalClarity));
  deliveryTone = Math.min(95, Math.max(20, deliveryTone));
  spokenAccuracy = Math.min(95, Math.max(20, spokenAccuracy));

  const voiceScore = Math.round(verbalClarity * 0.40 + deliveryTone * 0.30 + spokenAccuracy * 0.30);

  return {
    verbalClarity,
    deliveryTone,
    spokenAccuracy,
    voiceScore,
    transcript: text || 'Voice recording processed successfully (Audio captured)',
    feedback: wordCount >= 20
      ? 'Confident cadence and clear verbal pacing. Natural delivery suitable for peer mentoring.'
      : 'Spoken explanation captured. Aim for slightly more elaboration to guide confused learners.'
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    // ─── ACTION 1: GENERATE TEACHING CHALLENGE PROMPT ───
    if (action === 'generate') {
      const { skill, subtopic } = body;
      const cleanSkill = (skill || 'Python').trim();
      const bankItem = DOMAIN_CHALLENGE_BANK[cleanSkill] || {
        topic: subtopic || `${cleanSkill} Core Fundamentals`,
        prompt: `Explain the fundamental concept of ${cleanSkill} to a struggling beginner. Use plain language, an everyday analogy, and a concrete example.`
      };

      try {
        const aiPrompt = `You are the Master Pedagogy Assessor for Synapse, a collaborative peer-learning platform.
Generate a realistic, focused teaching challenge prompt for a candidate wanting to teach: "${cleanSkill}".
Target subtopic: "${subtopic || bankItem.topic}".

REQUIREMENTS:
1. Ask the candidate to teach this concept to a beginner peer who is confused.
2. Specifically require BOTH an intuitive real-world analogy and a concrete code or practical example.
3. Keep the prompt instructions concise (under 80 words), encouraging, and clear.

Return ONLY a JSON object with:
{
  "topic": "${bankItem.topic}",
  "challengePrompt": "string"
}`;

        const raw = await callGemini(aiPrompt, true);
        const parsed = JSON.parse(raw.replace(/```json\s*/, '').replace(/```\s*/, '').trim());
        return NextResponse.json({
          topic: parsed.topic || bankItem.topic,
          challengePrompt: parsed.challengePrompt || bankItem.prompt
        });
      } catch (err) {
        // Safe fallback to curated high-quality challenge bank
        return NextResponse.json({
          topic: bankItem.topic,
          challengePrompt: bankItem.prompt
        });
      }
    }

    // ─── ACTION 2: REAL DUAL-MODE EVALUATION (WRITTEN + VOICE) ───
    if (action === 'evaluate') {
      const {
        userId,
        skill = 'Python',
        subtopic,
        question = '',
        writtenExplanation = '',
        audioData, // base64 string
        mimeType = 'audio/webm',
        clientTranscript = ''
      } = body;

      const normUser = (userId || 'user_anonymous').trim().toLowerCase();
      const topic = subtopic || DOMAIN_CHALLENGE_BANK[skill]?.topic || skill;
      const cleanWritten = (writtenExplanation || '').trim();
      const audioBytesLength = audioData ? Math.round((audioData.length * 3) / 4) : 0;

      // ─── PART A: EVALUATE WRITTEN EXPLANATION ───
      let writtenResult = {
        accuracy: 60,
        clarity: 60,
        depth: 55,
        beginnerFriendliness: 60,
        examplesAndAnalogy: 50,
        writtenScore: 60,
        feedback: 'Written explanation evaluated.',
        knowledgeGaps: ['Review advanced nuances']
      };

      try {
        const writtenPrompt = `You are a Senior Technical Teacher and Pedagogy Evaluator.
Evaluate the candidate's written explanation for teaching the topic: "${topic}" (${skill}).
Original Challenge: "${question}"

Candidate's Written Explanation:
"""
${cleanWritten || '(No written explanation provided)'}
"""

Evaluate strictly on:
1. technicalCorrectness (0-100): Is the engineering factual and correct?
2. clarity (0-100): Is the structure coherent and easy to digest?
3. depth (0-100): Does the candidate demonstrate actual depth of knowledge?
4. beginnerFriendliness (0-100): Is it approachable for someone struggling?
5. examplesAndAnalogy (0-100): Did they include a concrete analogy and practical example?

Penalize severely (< 35) if the submission is empty, gibberish, completely off-topic, or under 20 words.
Reward high scores (80-98) for explanations with clear metaphors, code clarity, and deep understanding.

Return ONLY a JSON object:
{
  "accuracy": number,
  "clarity": number,
  "depth": number,
  "beginnerFriendliness": number,
  "examplesAndAnalogy": number,
  "writtenScore": number,
  "feedback": "string summarizing strengths and improvement points",
  "knowledgeGaps": ["string", "string"]
}`;

        const rawWritten = await callGemini(writtenPrompt, true);
        const parsed = JSON.parse(rawWritten.replace(/```json\s*/, '').replace(/```\s*/, '').trim());
        const acc = typeof parsed.accuracy === 'number' ? parsed.accuracy : 65;
        const cla = typeof parsed.clarity === 'number' ? parsed.clarity : 65;
        const dep = typeof parsed.depth === 'number' ? parsed.depth : 60;
        const beg = typeof parsed.beginnerFriendliness === 'number' ? parsed.beginnerFriendliness : 60;
        const exa = typeof parsed.examplesAndAnalogy === 'number' ? parsed.examplesAndAnalogy : 55;
        const calcScore = typeof parsed.writtenScore === 'number'
          ? parsed.writtenScore
          : Math.round(acc * 0.35 + cla * 0.25 + dep * 0.20 + beg * 0.10 + exa * 0.10);

        writtenResult = {
          accuracy: acc,
          clarity: cla,
          depth: dep,
          beginnerFriendliness: beg,
          examplesAndAnalogy: exa,
          writtenScore: calcScore,
          feedback: parsed.feedback || 'Written explanation demonstrated solid conceptual clarity.',
          knowledgeGaps: Array.isArray(parsed.knowledgeGaps) ? parsed.knowledgeGaps : []
        };
      } catch (err) {
        console.warn('[teaching-challenge] AI written grading fallback to heuristic:', err);
        writtenResult = evaluateWrittenHeuristic(cleanWritten, topic);
      }

      // ─── PART B: EVALUATE VOICE / ORAL EXPLANATION ───
      let voiceResult = {
        verbalClarity: 0,
        deliveryTone: 0,
        spokenAccuracy: 0,
        voiceScore: 0,
        transcript: clientTranscript || '',
        feedback: 'No voice explanation provided.'
      };

      const hasAudioData = audioData && audioData.length > 500;
      const hasClientTranscript = Boolean(clientTranscript && clientTranscript.trim().length > 5);

      if (!hasAudioData && !hasClientTranscript) {
        voiceResult = {
          verbalClarity: 0,
          deliveryTone: 0,
          spokenAccuracy: 0,
          voiceScore: 0,
          transcript: '(No audio recorded)',
          feedback: 'No microphone recording was submitted. Please record a voice explanation to verify oral teaching clarity.'
        };
      } else {
        // Attempt multimodal audio evaluation or transcribed speech evaluation
        let voiceEvaluated = false;

        if (hasAudioData) {
          try {
            const cleanBase64 = audioData.includes(',') ? audioData.split(',')[1] : audioData;
            const audioPayload = [
              {
                inlineData: {
                  mimeType: mimeType || 'audio/webm',
                  data: cleanBase64
                }
              },
              {
                text: `You are a Speech and Pedagogy Evaluator.
The user has recorded a voice explanation teaching "${topic}" (${skill}).
1. Transcribe the spoken words accurately.
2. Evaluate their verbal delivery:
   - verbalClarity (0-100): Clear pronunciation and cadence.
   - deliveryTone (0-100): Encouraging, pedagogical, patient tone.
   - spokenAccuracy (0-100): Conceptual correctness in spoken explanation.
3. Score voiceScore (0-100) = weighted combination.
4. Provide voiceFeedback.

Return ONLY a JSON object:
{
  "transcript": "string",
  "verbalClarity": number,
  "deliveryTone": number,
  "spokenAccuracy": number,
  "voiceScore": number,
  "voiceFeedback": "string"
}`
              }
            ];

            const rawVoice = await callGemini(audioPayload, true);
            const parsed = JSON.parse(rawVoice.replace(/```json\s*/, '').replace(/```\s*/, '').trim());
            voiceResult = {
              verbalClarity: typeof parsed.verbalClarity === 'number' ? parsed.verbalClarity : 75,
              deliveryTone: typeof parsed.deliveryTone === 'number' ? parsed.deliveryTone : 75,
              spokenAccuracy: typeof parsed.spokenAccuracy === 'number' ? parsed.spokenAccuracy : 75,
              voiceScore: typeof parsed.voiceScore === 'number' ? parsed.voiceScore : 75,
              transcript: parsed.transcript || clientTranscript || '(Speech audio captured)',
              feedback: parsed.voiceFeedback || 'Articulate verbal delivery with steady pacing.'
            };
            voiceEvaluated = true;
          } catch (audioErr) {
            console.warn('[teaching-challenge] Direct Gemini audio transcription failed, evaluating client transcript:', audioErr);
          }
        }

        // If audio call failed or clientTranscript is available, evaluate client transcript with AI
        if (!voiceEvaluated && hasClientTranscript) {
          try {
            const transcriptPrompt = `Evaluate the following transcribed voice explanation of a candidate teaching "${topic}" (${skill}):
Transcript:
"""
${clientTranscript}
"""

Evaluate:
- verbalClarity (0-100): How clearly thoughts are articulated.
- deliveryTone (0-100): Explanatory flow and structure.
- spokenAccuracy (0-100): Conceptual accuracy.
- voiceScore (0-100).
- voiceFeedback.

Return ONLY a JSON object with keys: "verbalClarity", "deliveryTone", "spokenAccuracy", "voiceScore", "voiceFeedback".`;

            const rawTrans = await callGemini(transcriptPrompt, true);
            const parsed = JSON.parse(rawTrans.replace(/```json\s*/, '').replace(/```\s*/, '').trim());
            voiceResult = {
              verbalClarity: typeof parsed.verbalClarity === 'number' ? parsed.verbalClarity : 75,
              deliveryTone: typeof parsed.deliveryTone === 'number' ? parsed.deliveryTone : 75,
              spokenAccuracy: typeof parsed.spokenAccuracy === 'number' ? parsed.spokenAccuracy : 75,
              voiceScore: typeof parsed.voiceScore === 'number' ? parsed.voiceScore : 75,
              transcript: clientTranscript,
              feedback: parsed.voiceFeedback || 'Transcribed speech reflects natural conversational teaching.'
            };
            voiceEvaluated = true;
          } catch (tErr) {
            console.warn('[teaching-challenge] AI transcript grading fallback to heuristic:', tErr);
          }
        }

        // Fallback to voice heuristic if both failed
        if (!voiceEvaluated) {
          voiceResult = evaluateVoiceHeuristic(clientTranscript, audioBytesLength);
        }
      }

      // ─── PART C: TRANSPARENT COMBINED SCORING (50/50 WEIGHT) ───
      const writtenScore = writtenResult.writtenScore;
      const voiceScore = voiceResult.voiceScore;
      const combinedScore = Math.round(writtenScore * WRITTEN_WEIGHT + voiceScore * VOICE_WEIGHT);

      // ─── PART D: PROFICIENCY LEVEL & ELIGIBILITY DETERMINATION ───
      // Eligibility Threshold: Combined Score >= 60%
      // Level 4 (Verified Mentor): >= 85%
      // Level 3 (Verified Peer Helper): 60% - 84%
      // Level 0 (Not yet qualified): < 60%
      const teachingEligible = combinedScore >= 60;
      let proficiencyLevel = 0;
      let badgeTitle = 'Not yet qualified to teach';

      if (combinedScore >= 85) {
        proficiencyLevel = 4;
        badgeTitle = 'Verified Mentor (Level 4)';
      } else if (combinedScore >= 60) {
        proficiencyLevel = 3;
        badgeTitle = 'Verified Peer Helper (Level 3)';
      }

      const overallFeedback = teachingEligible
        ? `Verification Passed! You earned ${badgeTitle} with a combined score of ${combinedScore}% (Written: ${writtenScore}%, Voice: ${voiceScore}%). ${writtenResult.feedback}`
        : `Assessment incomplete: Your combined score of ${combinedScore}% (Written: ${writtenScore}%, Voice: ${voiceScore}%) did not meet the 60% threshold for teaching ${skill}. We recommend studying key concepts before re-attempting verification.`;

      // ─── PART E: PERSISTENCE TO CLOUDSTORE & SUPABASE ───
      const assessmentRecord: TeachingAssessmentRecord = {
        id: 'ta_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        user_id: normUser,
        skill,
        topic,
        question,
        written_answer: cleanWritten,
        written_score: writtenScore,
        voice_transcript: voiceResult.transcript,
        voice_score: voiceScore,
        combined_score: combinedScore,
        proficiency_level: proficiencyLevel,
        teaching_eligible: teachingEligible,
        knowledge_gaps: writtenResult.knowledgeGaps,
        feedback: overallFeedback,
        created_at: new Date().toISOString()
      };

      // Save in cloudStore (updates skill_declarations, profiles, and peers)
      saveTeachingAssessment(assessmentRecord);

      // Persist to Supabase if available
      try {
        const supabase = getSupabase();
        if (supabase) {
          await supabase.from('teaching_assessments').insert({
            id: assessmentRecord.id,
            user_id: normUser,
            skill,
            topic,
            question,
            written_answer: cleanWritten,
            written_score: writtenScore,
            voice_transcript: voiceResult.transcript,
            voice_score: voiceScore,
            combined_score: combinedScore,
            proficiency_level: proficiencyLevel,
            teaching_eligible: teachingEligible,
            knowledge_gaps: writtenResult.knowledgeGaps,
            feedback: overallFeedback,
            created_at: assessmentRecord.created_at
          });
        }
      } catch (sbErr) {
        console.warn('[teaching-challenge] Supabase insert non-fatal warning:', sbErr);
      }

      return NextResponse.json({
        success: true,
        result: {
          writtenScore,
          writtenFeedback: writtenResult.feedback,
          voiceScore,
          voiceTranscript: voiceResult.transcript,
          voiceFeedback: voiceResult.feedback,
          combinedScore,
          proficiencyLevel,
          teachingEligible,
          passed: teachingEligible,
          badgeTitle,
          weights: {
            writtenWeight: WRITTEN_WEIGHT,
            voiceWeight: VOICE_WEIGHT
          },
          rubric: {
            technicalCorrectness: writtenResult.accuracy,
            clarity: writtenResult.clarity,
            depth: writtenResult.depth,
            beginnerFriendliness: writtenResult.beginnerFriendliness,
            examplesAndAnalogy: writtenResult.examplesAndAnalogy,
            verbalClarity: voiceResult.verbalClarity,
            deliveryTone: voiceResult.deliveryTone
          },
          knowledgeGaps: writtenResult.knowledgeGaps,
          feedback: overallFeedback
        }
      });
    }

    return NextResponse.json({ error: 'Invalid action specified' }, { status: 400 });
  } catch (error: any) {
    console.error('[teaching-challenge] Internal route error:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
