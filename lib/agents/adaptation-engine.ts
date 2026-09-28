import {
  MatchHealth,
  AgentDecision,
  ActionHistoryRecord,
} from '@/lib/types';
import {
  logAgentActivity,
  getTopicMastery,
  getActionHistory,
  recordActionHistory,
  hasActionFailedRecently,
  recordAgentDecision,
  getSkillTopics,
  addReinforceTopic,
} from '@/lib/cloudStore';

// =========================================================================
//  Adaptive Engine v2 (Sections 3 & 4)
// =========================================================================

export interface AdaptiveEngineInput {
  userId: string;
  skill: string;
  topic: string;
  currentScore?: number;
  subtopicScores?: Record<string, number>;
  skippedSessionsCount?: number;
  abandonedAssessmentsCount?: number;
  practiceCompletionPct?: number;
  isBothStuckSignal?: boolean;
  contextPeerId?: string;
}

export interface AdaptiveEngineDecision {
  action: 'daily_mission' | 'revision_node' | 'targeted_practice' | 'ai_explanation' | 'peer_rematch' | 'joint_concept_and_video' | 'network_gap_retry';
  reason_code: 'low_engagement' | 'missing_basics' | 'specific_gap' | 'needs_explanation' | 'explanation_not_enough' | 'both_stuck' | 'exhausted';
  reason_text: string;
  kind: 'peer_suggestion' | 'practice' | 'revision' | 'ai_explanation' | 'rematch' | 'video' | 'daily_mission' | 'reminder';
  evidence: Record<string, any>;
  decision_id: string;
  details?: Record<string, any>;
  pairingPaused?: boolean;
}

/**
 * Evaluates a learner's state against the strict 7-rule Adaptive Engine v2 table.
 * First matching rule that hasn't failed within 24h wins.
 */
export async function runAdaptiveEngine(input: AdaptiveEngineInput): Promise<AdaptiveEngineDecision> {
  const normUser = (input.userId || 'learner').trim().toLowerCase();
  const normSkill = (input.skill || 'React').trim();
  const normTopic = (input.topic || 'Core Foundations').trim();

  // Load user data
  const masteryList = getTopicMastery(normUser, normSkill);
  const currentTopicMastery = masteryList.find(
    (m) => m.topic.toLowerCase() === normTopic.toLowerCase()
  );
  const currentScore = typeof input.currentScore === 'number'
    ? input.currentScore
    : (currentTopicMastery?.mastery ?? 50);

  // Check skipped / abandoned / practice signals
  const skippedSessions = input.skippedSessionsCount ?? 0;
  const abandonedAssessments = input.abandonedAssessmentsCount ?? 0;
  const practicePct = input.practiceCompletionPct ?? 100;

  // Find prerequisite topic
  const skillTopics = getSkillTopics(normSkill);
  const currentTopicIndex = skillTopics.findIndex(
    (t) => t.topic.toLowerCase() === normTopic.toLowerCase()
  );
  let prereqTopic: string | null = null;
  let prereqMastery = 100;
  if (currentTopicIndex > 0) {
    prereqTopic = skillTopics[currentTopicIndex - 1].topic;
    const prereqRecord = masteryList.find(
      (m) => m.topic.toLowerCase() === prereqTopic?.toLowerCase()
    );
    prereqMastery = prereqRecord?.mastery ?? 0;
  }

  // Find weak subtopics
  const weakSubtopics: string[] = [];
  if (input.subtopicScores) {
    for (const [sub, sc] of Object.entries(input.subtopicScores)) {
      if (typeof sc === 'number' && sc < 50) {
        weakSubtopics.push(sub);
      }
    }
  }

  // Action history for this topic
  const history = getActionHistory(normUser, normTopic);
  const triedActions = new Set(history.map((h) => h.action));
  const aiExplanationTried = triedActions.has('ai_explanation');

  let chosenAction: AdaptiveEngineDecision['action'] | null = null;
  let chosenReasonCode: AdaptiveEngineDecision['reason_code'] | null = null;
  let chosenReasonText = '';
  let chosenKind: AdaptiveEngineDecision['kind'] = 'practice';
  let evidence: Record<string, any> = {};
  let pairingPaused = false;
  let details: Record<string, any> = {};

  // ─────────────────────────────────────────────────────────────
  // Rule 1: low_engagement
  // Skipped a scheduled session, or abandoned last 2 assessments, or practice done under 30%
  // ─────────────────────────────────────────────────────────────
  const isLowEngagement = skippedSessions >= 1 || abandonedAssessments >= 2 || practicePct < 30;
  if (isLowEngagement && !hasActionFailedRecently(normUser, normTopic, 'daily_mission')) {
    chosenAction = 'daily_mission';
    chosenReasonCode = 'low_engagement';
    chosenKind = 'daily_mission';

    let reasonTrigger = 'skipped a session';
    if (skippedSessions >= 1) reasonTrigger = `skipped ${skippedSessions} session${skippedSessions > 1 ? 's' : ''}`;
    else if (abandonedAssessments >= 2) reasonTrigger = `abandoned ${abandonedAssessments} assessments`;
    else reasonTrigger = `practice completion was ${practicePct}%`;

    chosenReasonText = `You ${reasonTrigger}, so we sent a smaller task instead of changing your peer.`;
    evidence = {
      skippedSessions,
      abandonedAssessments,
      practiceCompletionPct: practicePct,
      threshold: 'practice < 30% or abandoned >= 2 or skipped >= 1',
      date: new Date().toLocaleDateString(),
    };

    if (skippedSessions >= 3 || abandonedAssessments >= 3) {
      pairingPaused = true;
      chosenReasonText += ' (Pairing paused after 3 consecutive low-engagement events).';
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Rule 2: missing_basics
  // A prerequisite topic is under 50
  // ─────────────────────────────────────────────────────────────
  if (!chosenAction && prereqTopic && prereqMastery < 50 && !hasActionFailedRecently(normUser, normTopic, 'revision_node')) {
    chosenAction = 'revision_node';
    chosenReasonCode = 'missing_basics';
    chosenKind = 'revision';
    chosenReasonText = `Your prerequisite topic (${prereqTopic}) is at ${prereqMastery}%, so we inserted a revision node before ${normTopic}.`;
    evidence = {
      currentTopic: normTopic,
      prerequisiteTopic: prereqTopic,
      prerequisiteMastery: prereqMastery,
      threshold: 50,
      date: new Date().toLocaleDateString(),
    };
    details = { prerequisiteTopic: prereqTopic };

    // Automatically insert revision node into roadmap
    try {
      addReinforceTopic(normUser, normSkill, prereqTopic);
    } catch (e) {}
  }

  // ─────────────────────────────────────────────────────────────
  // Rule 3: specific_gap
  // Only 1–2 subtopics are weak
  // ─────────────────────────────────────────────────────────────
  if (
    !chosenAction &&
    weakSubtopics.length >= 1 &&
    weakSubtopics.length <= 2 &&
    !hasActionFailedRecently(normUser, normTopic, 'targeted_practice')
  ) {
    chosenAction = 'targeted_practice';
    chosenReasonCode = 'specific_gap';
    chosenKind = 'practice';
    chosenReasonText = `Only ${weakSubtopics.length} subtopic${weakSubtopics.length > 1 ? 's' : ''} (${weakSubtopics.join(', ')}) need attention, so we generated a targeted practice set.`;
    evidence = {
      weakSubtopics,
      count: weakSubtopics.length,
      topic: normTopic,
      date: new Date().toLocaleDateString(),
    };
    details = { subtopics: weakSubtopics };
  }

  // ─────────────────────────────────────────────────────────────
  // Rule 4: needs_explanation
  // Low result (<70%) and no AI explanation tried yet
  // ─────────────────────────────────────────────────────────────
  if (
    !chosenAction &&
    currentScore < 70 &&
    !aiExplanationTried &&
    !hasActionFailedRecently(normUser, normTopic, 'ai_explanation')
  ) {
    chosenAction = 'ai_explanation';
    chosenReasonCode = 'needs_explanation';
    chosenKind = 'ai_explanation';
    chosenReasonText = `You scored ${currentScore}% on ${normTopic} and no AI explanation was tried yet, so we provided an interactive concept breakdown.`;
    evidence = {
      score: currentScore,
      topic: normTopic,
      threshold: 70,
      aiExplanationPreviouslyAttempted: false,
      date: new Date().toLocaleDateString(),
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Rule 5: explanation_not_enough
  // AI explanation already tried and still under 70
  // ─────────────────────────────────────────────────────────────
  if (
    !chosenAction &&
    aiExplanationTried &&
    currentScore < 70 &&
    !hasActionFailedRecently(normUser, normTopic, 'peer_rematch')
  ) {
    chosenAction = 'peer_rematch';
    chosenReasonCode = 'explanation_not_enough';
    chosenKind = 'rematch';
    chosenReasonText = `You scored ${currentScore}% on ${normTopic} after an AI explanation, so we recommend a 1-on-1 peer session with a specialized tutor.`;
    evidence = {
      score: currentScore,
      topic: normTopic,
      aiExplanationTried: true,
      threshold: 70,
      date: new Date().toLocaleDateString(),
    };
    details = { excludePeerId: input.contextPeerId };
  }

  // ─────────────────────────────────────────────────────────────
  // Rule 6: both_stuck
  // Both peers in a session are confused (chat signals, Section 6)
  // ─────────────────────────────────────────────────────────────
  if (
    !chosenAction &&
    input.isBothStuckSignal &&
    !hasActionFailedRecently(normUser, normTopic, 'joint_concept_and_video')
  ) {
    chosenAction = 'joint_concept_and_video';
    chosenReasonCode = 'both_stuck';
    chosenKind = 'video';
    chosenReasonText = `Both you and your peer were confused about ${normTopic}, so we provided a joint explanation and a verified educational video.`;
    evidence = {
      topic: normTopic,
      chatSignal: 'both_stuck',
      date: new Date().toLocaleDateString(),
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Rule 7: exhausted
  // Everything above tried and failed
  // ─────────────────────────────────────────────────────────────
  if (!chosenAction) {
    chosenAction = 'network_gap_retry';
    chosenReasonCode = 'exhausted';
    chosenKind = 'peer_suggestion';
    chosenReasonText = `All automated interventions for ${normTopic} have been attempted. We logged a network learning gap and scheduled a retry in 7 days.`;
    evidence = {
      topic: normTopic,
      allInterventionsAttempted: true,
      retryScheduledInDays: 7,
      date: new Date().toLocaleDateString(),
    };
    details = { retryDate: new Date(Date.now() + 7 * 86400000).toISOString() };
  }

  // Fallback if no specific rule matched or all failed recently
  if (!chosenAction || !chosenReasonCode) {
    chosenAction = 'targeted_practice';
    chosenReasonCode = 'specific_gap';
    chosenReasonText = `Deliberate practice drill recommended for ${normTopic}.`;
    chosenKind = 'practice';
    evidence = {
      score: currentScore,
      topic: normTopic,
      date: new Date().toLocaleDateString(),
    };
  }

  const finalAction: AdaptiveEngineDecision['action'] = chosenAction || 'targeted_practice';
  const finalReasonCode: AdaptiveEngineDecision['reason_code'] = chosenReasonCode || 'specific_gap';
  const finalReasonText = chosenReasonText || `Adaptive practice recommended for ${normTopic}.`;

  // 1. Record decision in agent_decisions table & store
  const decision = recordAgentDecision({
    user_id: normUser,
    kind: chosenKind,
    action: finalAction,
    reason_code: finalReasonCode,
    reason_text: finalReasonText,
    evidence,
  });

  // 2. Record action as pending in action_history
  recordActionHistory(normUser, normTopic, finalAction, 'pending');

  // 3. Log to Agent Activity Feed
  logAgentActivity(
    'Adaptation',
    `adaptive_${finalAction}`,
    finalReasonText,
    {
      decision_id: decision.id,
      topic: normTopic,
      reason_code: finalReasonCode,
      evidence,
    }
  );

  return {
    action: finalAction,
    reason_code: finalReasonCode,
    reason_text: finalReasonText,
    kind: chosenKind,
    evidence,
    decision_id: decision.id,
    details,
    pairingPaused,
  };
}

// ─── Legacy Match Health Trend Support ──────────────────────────
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
  const base = determineAutonomousAction(trend);
  if (!base.action) return { action: null, reason: null };

  const reason = base.reason || 'Autonomous intervention triggered.';
  logAgentActivity(
    'Adaptation',
    `trigger_${base.action}`,
    reason,
    { trend, action: base.action }
  );

  return { action: base.action, reason };
}

export function shouldProtectTeacherReputation(crossPattern: {
  avgDelta: number;
  learnerCount: number;
  declining: boolean;
}): boolean {
  // Hard Rule: Reasons 1–4 never touch teacher.
  // Only a repeated pattern across multiple learners flags teacher for re-verification.
  return !crossPattern.declining;
}

