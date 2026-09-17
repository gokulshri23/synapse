import { Skill, Reputation, AdaptationAction } from '@/lib/types';

export function evaluateAdaptation(skills: Skill[], reputation: Reputation): AdaptationAction[] {
  const actions: AdaptationAction[] = [];
  const now = new Date().toISOString();

  // Check for mastery achievements
  skills.forEach(skill => {
    if (skill.mastery_pct >= 85 && skill.status === 'active') {
      actions.push({
        type: 'MASTERY_ACHIEVED',
        skill_name: skill.name,
        description: `Mastery achieved in ${skill.name}! Unlocking next skills and granting mentor status.`,
        timestamp: now,
      });
    }
  });

  // Check for plateaus (simulate with low mastery active skills)
  skills.forEach(skill => {
    if (skill.status === 'active' && skill.mastery_pct > 20 && skill.mastery_pct < 50) {
      actions.push({
        type: 'SUGGEST_PEER_SESSION',
        skill_name: skill.name,
        description: `Progress in ${skill.name} has slowed. A peer teaching session could help breakthrough.`,
        timestamp: now,
      });
    }
  });

  // Check for drops (low mastery on previously-active skills)
  skills.forEach(skill => {
    if (skill.status === 'active' && skill.mastery_pct < 20 && skill.mastery_pct > 0) {
      actions.push({
        type: 'INSERT_REVIEW',
        skill_name: skill.name,
        description: `Mastery in ${skill.name} has dropped. Adding review exercises to reinforce concepts.`,
        timestamp: now,
      });
    }
  });

  // Overall progress assessment
  const avgMastery = skills.length > 0
    ? skills.reduce((sum, s) => sum + s.mastery_pct, 0) / skills.length
    : 0;

  if (avgMastery > 60 && reputation.xp > 200) {
    actions.push({
      type: 'ACCELERATE',
      skill_name: 'Overall',
      description: 'Excellent progress detected! Accelerating to more advanced content.',
      timestamp: now,
    });
  } else if (avgMastery < 30 && skills.filter(s => s.status === 'active').length > 0) {
    actions.push({
      type: 'DECELERATE',
      skill_name: 'Overall',
      description: 'Additional practice exercises added to strengthen foundational understanding.',
      timestamp: now,
    });
  }

  return actions.slice(0, 5);
}

export function applyAdaptation(action: AdaptationAction, skills: Skill[]): Skill[] {
  return skills.map(skill => {
    if (action.type === 'MASTERY_ACHIEVED' && skill.name === action.skill_name) {
      return { ...skill, status: 'mastered' as const };
    }
    // Unlock next locked skill after mastery
    if (action.type === 'MASTERY_ACHIEVED' && skill.status === 'locked') {
      const masteredIndex = skills.findIndex(s => s.name === action.skill_name);
      if (skill.order_index === masteredIndex + 1) {
        return { ...skill, status: 'active' as const };
      }
    }
    return skill;
  });
}
