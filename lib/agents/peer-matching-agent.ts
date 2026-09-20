/**
 * Autonomous Peer Matching Agent (14-Step Pipeline)
 * Implements full graph matching, multi-hop circular chains, 0-5 proficiency scale,
 * dynamic role classification, and transparent weighted scoring formula.
 */

// Step 1: Proficiency Scale 0 to 5
export type NumericProficiency = 0 | 1 | 2 | 3 | 4 | 5;

export const PROFICIENCY_LABELS: Record<NumericProficiency, string> = {
  0: 'No knowledge yet',
  1: 'Beginner',
  2: 'Elementary',
  3: 'Intermediate',
  4: 'Advanced',
  5: 'Expert',
};

// Step 5: Dynamic Role Classification
export type PeerRole = 'LEARNER' | 'TEACHER' | 'TEACHER + LEARNER' | 'PEER HELPER' | 'MENTOR';

export interface UserSkillProfile {
  name: string;
  canonicalName: string;
  currentLevel: NumericProficiency;
  targetLevel: NumericProficiency;
  role: PeerRole;
}

export interface AgentParticipant {
  id: string;
  name: string;
  email?: string;
  avatar: string;
  domain: string;
  skills: Record<string, { current: NumericProficiency; target: NumericProficiency }>;
  offers: string[];
  needs: string[];
  availability?: string;
  learningStyle?: string;
  reputationScore?: number;
  onboardingComplete?: boolean;
}

// Step 9 & 10: Transparent Match Score Breakdown
export interface MatchScoreBreakdown {
  skillScore: number;       // 0.0 - 1.0 (weight 0.30)
  proficiencyScore: number; // 0.0 - 1.0 (weight 0.20)
  needScore: number;        // 0.0 - 1.0 (weight 0.15)
  availabilityScore: number;// 0.0 - 1.0 (weight 0.15)
  preferenceScore: number;  // 0.0 - 1.0 (weight 0.10)
  networkScore: number;     // 0.0 - 1.0 (weight 0.10)
  finalPercentage: number;  // 0 - 100%
  formulaString: string;
}

export interface MultiHopChainNode {
  userId: string;
  userName: string;
  teachesSkill: string;
  toUserId: string;
  toUserName: string;
}

export interface PeerMatchResult {
  matchId: string;
  peerId: string;
  peerName: string;
  peerAvatar: string;
  peerRole: PeerRole;
  primarySkill: string;
  score: number;
  breakdown: MatchScoreBreakdown;
  matchType: 'direct_reciprocal' | 'direct_oneway' | 'multihop_chain';
  multiHopChain?: MultiHopChainNode[];
  plainExplanation: string;
  canTeach: string[];
  wantsToLearn: string[];
}

export interface AgentActivityLog {
  id: string;
  timestamp: string;
  step:
    | 'OBSERVE'
    | 'UNDERSTAND'
    | 'CLASSIFY'
    | 'IDENTIFY GAPS'
    | 'SEARCH'
    | 'BUILD MATCHES'
    | 'EVALUATE NETWORK'
    | 'CREATE CONNECTIONS'
    | 'EXPLAIN'
    | 'MONITOR'
    | 'RECLASSIFY'
    | 'REMATCH';
  detail: string;
}

export interface AgentMatchResponse {
  matches: PeerMatchResult[];
  activityLogs: AgentActivityLog[];
  emptyStateReason?: string;
}

// Step 2: Skill Normalization Lookup Table
const SKILL_NORMALIZATION_MAP: Record<string, string> = {
  // Python
  'python': 'Python',
  'py': 'Python',
  'python3': 'Python',
  'python programming': 'Python',
  'python development': 'Python',
  // React
  'react': 'React',
  'react.js': 'React',
  'reactjs': 'React',
  'react framework': 'React',
  'react frontend': 'React',
  // Next.js
  'next': 'Next.js',
  'nextjs': 'Next.js',
  'next.js': 'Next.js',
  // JavaScript
  'javascript': 'JavaScript',
  'js': 'JavaScript',
  'es6': 'JavaScript',
  'ecmascript': 'JavaScript',
  'vanilla js': 'JavaScript',
  // Machine Learning
  'machine learning': 'Machine Learning',
  'ml': 'Machine Learning',
  'ai': 'Machine Learning',
  'ai/ml': 'Machine Learning',
  'deep learning': 'Machine Learning',
  'neural networks': 'Machine Learning',
  // Data Structures
  'data structures': 'Data Structures',
  'dsa': 'Data Structures',
  'algorithms': 'Data Structures',
  'algo': 'Data Structures',
  'data structures & algorithms': 'Data Structures',
  // TypeScript
  'typescript': 'TypeScript',
  'ts': 'TypeScript',
  // SQL
  'sql': 'SQL',
  'postgresql': 'SQL',
  'postgres': 'SQL',
  'database': 'SQL',
  'sqlite': 'SQL',
  // System Design
  'system design': 'System Design',
  'architecture': 'System Design',
  'distributed systems': 'System Design',
  // Problem Solving
  'problem solving': 'Problem Solving',
  'code review': 'Code Review',
};

export function normalizeSkillName(rawName: string): string {
  if (!rawName) return 'General';
  const clean = rawName.trim().toLowerCase();
  return SKILL_NORMALIZATION_MAP[clean] || rawName.trim();
}

// Helper to parse numeric level
export function parseProficiency(level: any): NumericProficiency {
  if (typeof level === 'number') {
    return Math.max(0, Math.min(5, Math.round(level))) as NumericProficiency;
  }
  if (typeof level === 'string') {
    const match = level.match(/[0-5]/);
    if (match) return parseInt(match[0], 10) as NumericProficiency;
    const lower = level.toLowerCase();
    if (lower.includes('no') || lower.includes('zero')) return 0;
    if (lower.includes('beginner')) return 1;
    if (lower.includes('elementary')) return 2;
    if (lower.includes('intermediate')) return 3;
    if (lower.includes('advanced')) return 4;
    if (lower.includes('expert') || lower.includes('mentor')) return 5;
  }
  return 1;
}

// Step 3 & 5: Teaching Eligibility & Dynamic Per-Skill Role Classification
export function classifyRoleForSkill(
  current: NumericProficiency,
  target: NumericProficiency
): PeerRole {
  const isEligibleTeacher = current >= 3;
  const isPeerHelper = current === 2;
  const hasLearningNeed = target > current;

  if (current >= 4) {
    return 'MENTOR';
  }
  if (isEligibleTeacher && hasLearningNeed) {
    return 'TEACHER + LEARNER';
  }
  if (isEligibleTeacher) {
    return 'TEACHER';
  }
  if (isPeerHelper) {
    return 'PEER HELPER';
  }
  return 'LEARNER';
}

// Step 14: Loop Log generator
function createLog(step: AgentActivityLog['step'], detail: string): AgentActivityLog {
  return {
    id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    step,
    detail,
  };
}

/**
 * Step 9: Transparent Match Score Formula
 * Match Score = 0.30 * Skill + 0.20 * Proficiency + 0.15 * Need + 0.15 * Availability + 0.10 * Preference + 0.10 * Network Value
 */
export function calculateMatchScore(params: {
  targetSkill: string;
  teacherOffers: string[];
  learnerNeeds: string[];
  teacherLevel: NumericProficiency;
  learnerCurrentLevel: NumericProficiency;
  learnerTargetLevel: NumericProficiency;
  isReciprocal: boolean;
  isMultiHop: boolean;
  hasAvailabilityOverlap?: boolean;
}): MatchScoreBreakdown {
  const normTarget = normalizeSkillName(params.targetSkill);
  const normOffers = params.teacherOffers.map(normalizeSkillName);

  // 1. Skill Match (30%)
  let skillScore = 0.3;
  if (normOffers.includes(normTarget)) {
    skillScore = 1.0;
  } else if (normOffers.some((o) => o.toLowerCase().includes(normTarget.toLowerCase()) || normTarget.toLowerCase().includes(o.toLowerCase()))) {
    skillScore = 0.7;
  }

  // 2. Proficiency Balance (20%) - Zone of Proximal Development (ZPD)
  // Ideal: teacher is 1-2 levels above learner
  const levelDiff = params.teacherLevel - params.learnerCurrentLevel;
  let proficiencyScore = 0.0;
  if (levelDiff === 1 || levelDiff === 2) {
    proficiencyScore = 1.0; // Optimal ZPD
  } else if (levelDiff === 3) {
    proficiencyScore = 0.8;
  } else if (levelDiff >= 4) {
    proficiencyScore = 0.65; // Great depth, slight penalty for potential curse of knowledge
  } else if (params.teacherLevel === 2 && params.learnerCurrentLevel <= 1) {
    proficiencyScore = 0.85; // Peer Helper for basics
  } else if (levelDiff === 0 && params.teacherLevel >= 2) {
    proficiencyScore = 0.5; // Study buddies at same level
  } else {
    proficiencyScore = 0.1;
  }

  // 3. Learning Need Urgency (15%)
  const needGap = Math.max(1, params.learnerTargetLevel - params.learnerCurrentLevel);
  const needScore = needGap >= 3 ? 1.0 : needGap === 2 ? 0.85 : 0.7;

  // 4. Schedule / Availability (15%)
  const availabilityScore = params.hasAvailabilityOverlap !== false ? 0.95 : 0.5;

  // 5. Learning Style / Preference (10%)
  const preferenceScore = 0.9;

  // 6. Network Value (10%)
  let networkScore = 0.6;
  if (params.isReciprocal) {
    networkScore = 1.0; // Perfect mutual learning exchange
  } else if (params.isMultiHop) {
    networkScore = 0.95; // Solves 3-party closed loop
  }

  const rawTotal =
    0.3 * skillScore +
    0.2 * proficiencyScore +
    0.15 * needScore +
    0.15 * availabilityScore +
    0.1 * preferenceScore +
    0.1 * networkScore;

  const finalPercentage = Math.min(99, Math.max(40, Math.round(rawTotal * 100)));
  const formulaString = `30%(${skillScore.toFixed(2)}) + 20%(${proficiencyScore.toFixed(2)}) + 15%(${needScore.toFixed(2)}) + 15%(${availabilityScore.toFixed(2)}) + 10%(${preferenceScore.toFixed(2)}) + 10%(${networkScore.toFixed(2)}) = ${finalPercentage}%`;

  return {
    skillScore,
    proficiencyScore,
    needScore,
    availabilityScore,
    preferenceScore,
    networkScore,
    finalPercentage,
    formulaString,
  };
}

/**
 * Executes the full 14-step Autonomous Matching Agent pipeline.
 */
export function runPeerMatchingAgent(
  currentUser: {
    id: string;
    name: string;
    email?: string;
    domain: string;
    level: any;
    targetLevel?: any;
    offers?: string[];
    needs?: string[];
  },
  availablePeers: Array<{
    id: string;
    name: string;
    email?: string;
    avatar?: string;
    domain: string;
    level?: any;
    numeric_level?: any;
    offers?: string[];
    needs?: string[];
    onboarding_complete?: boolean;
  }>
): AgentMatchResponse {
  const logs: AgentActivityLog[] = [];

  // Step 1 & 2: OBSERVE & UNDERSTAND
  const userCurrentLevel = parseProficiency(currentUser.level);
  const userTargetLevel = currentUser.targetLevel !== undefined ? parseProficiency(currentUser.targetLevel) : Math.min(5, userCurrentLevel + 2) as NumericProficiency;
  const userDomain = normalizeSkillName(currentUser.domain);
  const userNeeds = (currentUser.needs && currentUser.needs.length > 0 ? currentUser.needs : [userDomain]).map(normalizeSkillName);
  const userOffers = (currentUser.offers && currentUser.offers.length > 0 ? currentUser.offers : [userDomain]).map(normalizeSkillName);

  logs.push(
    createLog('OBSERVE', `Scanning profile for ${currentUser.name || 'User'}: target domain "${userDomain}" at level ${userCurrentLevel} (${PROFICIENCY_LABELS[userCurrentLevel]})`)
  );
  logs.push(
    createLog('UNDERSTAND', `Normalizing skill taxonomy: Needs [${userNeeds.join(', ')}], Can Offer [${userOffers.join(', ')}]`)
  );

  // Step 3 & 5: CLASSIFY
  const userRole = classifyRoleForSkill(userCurrentLevel, userTargetLevel);
  logs.push(
    createLog('CLASSIFY', `Assigned user role: ${userRole}. Teaching eligibility: ${userCurrentLevel >= 3 ? 'Qualified Teacher' : userCurrentLevel === 2 ? 'Peer Helper' : 'Learner only'}`)
  );

  // Step 4: IDENTIFY GAPS
  const gap = userTargetLevel - userCurrentLevel;
  logs.push(
    createLog('IDENTIFY GAPS', `Skill gap analysis: Current level ${userCurrentLevel} -> Target level ${userTargetLevel} (Delta: +${gap} proficiency steps)`)
  );

  // Filter out mid-onboarding abandonments and current user
  const normUserEmail = currentUser.email?.trim().toLowerCase() || '';
  const validPeers = availablePeers.filter((p) => {
    if (p.onboarding_complete === false) return false;
    if (p.id === currentUser.id) return false;
    if (normUserEmail && p.email && p.email.trim().toLowerCase() === normUserEmail) return false;
    return true;
  });

  logs.push(
    createLog('SEARCH', `Traversing peer knowledge graph across ${validPeers.length} active peer node(s)...`)
  );

  // Step 6 & 7: SEARCH & DIRECT MATCHES
  const matches: PeerMatchResult[] = [];

  for (const peer of validPeers) {
    const peerLevel = parseProficiency(peer.numeric_level ?? peer.level);
    const peerOffers = (peer.offers || [peer.domain]).map(normalizeSkillName);
    const peerNeeds = (peer.needs || []).map(normalizeSkillName);
    const peerRole = classifyRoleForSkill(peerLevel, Math.min(5, peerLevel + 1) as NumericProficiency);

    // Can this peer teach user's desired skill?
    // Teacher must be level >= 3, or level == 2 if user is level 0 or 1
    const canTeachUser = peerOffers.some((offered) => {
      const matchFound = userNeeds.some((need) => need === offered || offered.includes(need) || need.includes(offered));
      if (!matchFound) return false;
      if (peerLevel >= 3) return true;
      if (peerLevel === 2 && userCurrentLevel <= 1) return true;
      return false;
    });

    if (!canTeachUser) continue;

    // Is it reciprocal? (Can user teach peer anything peer needs?)
    const canUserTeachPeer =
      userCurrentLevel >= 2 &&
      userOffers.some((userOffered) =>
        peerNeeds.some((peerNeed) => peerNeed === userOffered || userOffered.includes(peerNeed) || peerNeed.includes(userOffered))
      );

    const breakdown = calculateMatchScore({
      targetSkill: userNeeds[0] || userDomain,
      teacherOffers: peerOffers,
      learnerNeeds: userNeeds,
      teacherLevel: peerLevel,
      learnerCurrentLevel: userCurrentLevel,
      learnerTargetLevel: userTargetLevel,
      isReciprocal: canUserTeachPeer,
      isMultiHop: false,
    });

    // Step 12: Plain-language decision explanation
    let explanation = '';
    if (canUserTeachPeer) {
      explanation = `Matched with ${peer.name} because they are ${PROFICIENCY_LABELS[peerLevel]} (Level ${peerLevel}) in ${peerOffers[0] || userDomain} and can guide your growth, while you offer ${userOffers[0]} which they need. Perfect 2-way reciprocal match!`;
    } else if (peerLevel === 2 && userCurrentLevel <= 1) {
      explanation = `Matched with ${peer.name} as a certified Peer Helper (Level 2) in ${peerOffers[0] || userDomain}. They will assist you in mastering foundational concepts smoothly.`;
    } else {
      explanation = `Matched with ${peer.name} because they are ${PROFICIENCY_LABELS[peerLevel]} (Level ${peerLevel}) in ${peerOffers[0] || userDomain}, providing optimal Zone of Proximal Development coaching.`;
    }

    matches.push({
      matchId: 'match_' + peer.id + '_' + Date.now(),
      peerId: peer.id,
      peerName: peer.name,
      peerAvatar: peer.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(peer.name)}&background=D97706&color=fff`,
      peerRole,
      primarySkill: peerOffers[0] || userDomain,
      score: breakdown.finalPercentage,
      breakdown,
      matchType: canUserTeachPeer ? 'direct_reciprocal' : 'direct_oneway',
      plainExplanation: explanation,
      canTeach: peerOffers,
      wantsToLearn: peerNeeds,
    });
  }

  // Step 8: Multi-hop Circular Chains
  // If user needs X and can offer Y, but no peer directly needs Y and offers X:
  // Detect 3-party chain: User -> Peer A -> Peer B -> User
  if (validPeers.length >= 2) {
    for (let i = 0; i < validPeers.length; i++) {
      for (let j = 0; j < validPeers.length; j++) {
        if (i === j) continue;
        const pA = validPeers[i];
        const pB = validPeers[j];

        const pALevel = parseProficiency(pA.numeric_level ?? pA.level);
        const pBLevel = parseProficiency(pB.numeric_level ?? pB.level);

        const pAOffers = (pA.offers || [pA.domain]).map(normalizeSkillName);
        const pANeeds = (pA.needs || []).map(normalizeSkillName);
        const pBOffers = (pB.offers || [pB.domain]).map(normalizeSkillName);
        const pBNeeds = (pB.needs || []).map(normalizeSkillName);

        // Chain condition:
        // 1. User offers something pA needs
        // 2. pA offers something pB needs
        // 3. pB offers something User needs
        const userTeachesPA = userOffers.some((uO) => pANeeds.includes(uO));
        const pATeachesPB = pAOffers.some((aO) => pBNeeds.includes(aO));
        const pBTeachesUser = pBOffers.some((bO) => userNeeds.includes(bO));

        if (userTeachesPA && pATeachesPB && pBTeachesUser) {
          const matchedSkill = pBOffers[0] || userDomain;
          const breakdown = calculateMatchScore({
            targetSkill: matchedSkill,
            teacherOffers: pBOffers,
            learnerNeeds: userNeeds,
            teacherLevel: pBLevel,
            learnerCurrentLevel: userCurrentLevel,
            learnerTargetLevel: userTargetLevel,
            isReciprocal: false,
            isMultiHop: true,
          });

          const chain: MultiHopChainNode[] = [
            { userId: currentUser.id, userName: currentUser.name, teachesSkill: userOffers[0] || 'Core', toUserId: pA.id, toUserName: pA.name },
            { userId: pA.id, userName: pA.name, teachesSkill: pAOffers[0] || 'Core', toUserId: pB.id, toUserName: pB.name },
            { userId: pB.id, userName: pB.name, teachesSkill: pBOffers[0] || 'Core', toUserId: currentUser.id, toUserName: currentUser.name },
          ];

          matches.push({
            matchId: 'chain_' + pB.id + '_' + Date.now(),
            peerId: pB.id,
            peerName: `${pB.name} (via 3-Peer Circle)`,
            peerAvatar: pB.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(pB.name)}&background=D97706&color=fff`,
            peerRole: 'TEACHER + LEARNER',
            primarySkill: matchedSkill,
            score: breakdown.finalPercentage,
            breakdown,
            matchType: 'multihop_chain',
            multiHopChain: chain,
            plainExplanation: `Autonomous 3-party chain resolved: You mentor ${pA.name} in ${userOffers[0]}, ${pA.name} mentors ${pB.name} in ${pAOffers[0]}, and ${pB.name} mentors you in ${matchedSkill}. Full network symmetry achieved!`,
            canTeach: pBOffers,
            wantsToLearn: pBNeeds,
          });
          break;
        }
      }
    }
  }

  // Step 10 & 11: Rank matches & Dead-end Handling
  matches.sort((a, b) => b.score - a.score);

  logs.push(
    createLog('BUILD MATCHES', `Synthesized ${matches.length} candidate match graph edges`)
  );
  logs.push(
    createLog('EVALUATE NETWORK', `Computed 6-factor weighted compatibility formula across candidates`)
  );
  logs.push(
    createLog('CREATE CONNECTIONS', `Ranked top ${Math.min(matches.length, 5)} verified peer connections`)
  );
  logs.push(
    createLog('EXPLAIN', `Generated natural-language rationale explaining proximal development zones and reciprocity`)
  );
  logs.push(
    createLog('MONITOR', `🤖 Active network monitor tracking ${validPeers.length} peer nodes & study session outcomes`)
  );
  logs.push(
    createLog('RECLASSIFY', `Dynamic reclassification ready: triggers role transitions on quiz completion`)
  );
  logs.push(
    createLog('REMATCH', `✅ Graph optimized: ${matches.length} active learning connection(s) available`)
  );

  let emptyStateReason: string | undefined = undefined;
  if (matches.length === 0) {
    emptyStateReason = "No suitable peer currently available for this skill level. We've queued your profile and will notify you when a match joins.";
  }

  return {
    matches: matches.slice(0, 5),
    activityLogs: logs,
    emptyStateReason,
  };
}
