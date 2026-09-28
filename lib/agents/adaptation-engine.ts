import { MatchHealth } from '@/lib/types';
import { GoogleGenAI } from '@google/genai';
import { logAgentActivity } from '@/lib/cloudStore';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export function analyzeMatchHealthTrend(sessions: MatchHealth[]): {
  trend: 'improving' | 'flat' | 'declining';
  avgDelta: number;
  consecutiveDeclines: number;
} {
  if (!sessions || sessions.length === 0) {
    return { trend: 'flat', avgDelta: 0, consecutiveDeclines: 0 };
  }

  let totalDelta = 0;
  for (const session of sessions) {
    totalDelta += session.delta;
  }
  const avgDelta = totalDelta / sessions.length;

  let consecutiveDeclines = 0;
  for (let i = sessions.length - 1; i >= 0; i--) {
    if (sessions[i].delta <= 0) {
      consecutiveDeclines++;
    } else {
      break;
    }
  }

  let trend: 'improving' | 'flat' | 'declining' = 'flat';
  if (avgDelta < -5 || consecutiveDeclines >= 2) {
    trend = 'declining';
  } else if (avgDelta > 5) {
    trend = 'improving';
  }

  return { trend, avgDelta, consecutiveDeclines };
}

export function determineAutonomousAction(trend: {
  trend: 'improving' | 'flat' | 'declining';
  avgDelta: number;
  consecutiveDeclines: number;
}): { action: string | null; reason: string | null } {
  if (trend.consecutiveDeclines >= 4) {
    return { action: 'auto_rematch', reason: 'Finding a teacher with a different teaching style' };
  } else if (trend.consecutiveDeclines === 3) {
    return { action: 'alternate_explanation', reason: 'Trying a different explanation approach' };
  } else if (trend.consecutiveDeclines === 2) {
    return { action: 'prerequisite_check', reason: 'Checking if prerequisite knowledge needs strengthening' };
  }

  return { action: null, reason: null };
}

/**
 * PART 4: Real AI-powered adaptation reason generation with rule-based fallback
 */
export async function determineAutonomousActionWithAI(
  trend: {
    trend: 'improving' | 'flat' | 'declining';
    avgDelta: number;
    consecutiveDeclines: number;
  },
  context?: {
    skill?: string;
    learnerName?: string;
    teacherName?: string;
  }
): Promise<{ action: string | null; reason: string | null }> {
  // Deterministic action selection based on trend
  const base = determineAutonomousAction(trend);
  if (!base.action) {
    return { action: null, reason: null };
  }

  let reason = base.reason;

  if (process.env.GEMINI_API_KEY) {
    try {
      const prompt = `You are the Autonomous Adaptation Agent for an educational platform.
Context:
- Action triggered: ${base.action}
- Consecutive declining sessions: ${trend.consecutiveDeclines}
- Average score delta: ${trend.avgDelta}%
- Skill topic: ${context?.skill || 'General'}
- Learner: ${context?.learnerName || 'Learner'}

Write a SINGLE, compassionate, transparent one-sentence reason explaining why this autonomous adaptation occurred.
Do NOT mention test algorithms or internal mechanics. Explain how this helps the student learn better.
Example: "Switching to interactive visual examples to reinforce prerequisite concepts before proceeding."`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt,
      });

      if (response.text) {
        reason = response.text.trim().replace(/^["']|["']$/g, '');
      }
    } catch (e) {
      console.warn('[adaptation-agent] AI reason generation fallback:', e);
    }
  }

  logAgentActivity(
    'Adaptation',
    `trigger_${base.action}`,
    reason || 'Autonomous intervention triggered.',
    { trend, action: base.action }
  );

  return { action: base.action, reason };
}

export function shouldProtectTeacherReputation(crossPattern: {
  avgDelta: number;
  learnerCount: number;
  declining: boolean;
}): boolean {
  // Only penalize teacher if declining is true across multiple learners
  return !crossPattern.declining;
}
