import { MatchHealth } from '@/lib/types';

export function analyzeMatchHealthTrend(sessions: MatchHealth[]): { trend: 'improving' | 'flat' | 'declining', avgDelta: number, consecutiveDeclines: number } {
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

export function determineAutonomousAction(trend: { trend: 'improving' | 'flat' | 'declining', avgDelta: number, consecutiveDeclines: number }): { action: string | null, reason: string | null } {
  if (trend.consecutiveDeclines >= 4) {
    return { action: 'auto_rematch', reason: 'Finding a teacher with a different teaching style' };
  } else if (trend.consecutiveDeclines === 3) {
    return { action: 'alternate_explanation', reason: 'Trying a different explanation approach' };
  } else if (trend.consecutiveDeclines === 2) {
    return { action: 'prerequisite_check', reason: 'Checking if prerequisite knowledge needs strengthening' };
  }
  
  return { action: null, reason: null };
}

export function shouldProtectTeacherReputation(crossPattern: { avgDelta: number, learnerCount: number, declining: boolean }): boolean {
  // Only penalize teacher if declining is true 
  return !crossPattern.declining;
}
