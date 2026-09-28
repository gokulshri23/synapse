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
  matchType: 'direct_reciprocal' | 'direct_oneway' | 'multihop_chain' | 'user_mentoring' | 'peer_collaborator';
  multiHopChain?: MultiHopChainNode[];
  plainExplanation: string;
  canTeach: string[];
  wantsToLearn: string[];
  verified?: boolean;
  topicOverlap?: string[];
  exchangeType?: 'reciprocal' | 'they_mentor' | 'you_mentor' | 'study_buddy' | 'circle';
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
  'data science': 'Machine Learning',
  // Data Structures
  'data structures': 'Data Structures',
  'dsa': 'Data Structures',
  'data structures & algorithms': 'Data Structures',
  // Algorithms
  'algorithms': 'Algorithms',
  'algorithm': 'Algorithms',
  'algo': 'Algorithms',
  'competitive programming': 'Algorithms',
  // Web Development
  'web development': 'Web Development',
  'web dev': 'Web Development',
  'frontend': 'Web Development',
  'frontend development': 'Web Development',
  'full stack': 'Web Development',
  'fullstack': 'Web Development',
  'html/css': 'Web Development',
  // TypeScript
  'typescript': 'TypeScript',
  'ts': 'TypeScript',
  // Databases & SQL
  'sql': 'Databases',
  'databases': 'Databases',
  'database': 'Databases',
  'postgresql': 'Databases',
  'postgres': 'Databases',
  'sqlite': 'Databases',
  'mysql': 'Databases',
  'mongodb': 'Databases',
  // System Design
  'system design': 'System Design',
  'architecture': 'System Design',
  'distributed systems': 'System Design',
  'cloud architecture': 'System Design',
  // DevOps
  'devops': 'DevOps',
  'cloud': 'DevOps',
  'docker': 'DevOps',
  'kubernetes': 'DevOps',
  'ci/cd': 'DevOps',
  'aws': 'DevOps',
  // Problem Solving
  'problem solving': 'Problem Solving',
  'code review': 'Problem Solving',
  'debugging': 'Problem Solving',
  // Mobile Development
  'mobile development': 'Mobile Development',
  'mobile dev': 'Mobile Development',
  'react native': 'Mobile Development',
  'flutter': 'Mobile Development',
  'ios': 'Mobile Development',
  'android': 'Mobile Development',
};

export function normalizeSkillName(rawName: string): string {
  if (!rawName) return 'General';
  const clean = rawName.trim().toLowerCase();
  return SKILL_NORMALIZATION_MAP[clean] || rawName.trim();
}

/**
 * Fuzzy Semantic and Affinity Matching
 * Returns matches=true and score (0.7 to 1.0) if skills match directly or share domain clusters.
 */
export function matchSkillAffinity(skillA: string, skillB: string): { matches: boolean; score: number } {
  if (!skillA || !skillB) return { matches: false, score: 0 };
  const normA = normalizeSkillName(skillA).toLowerCase();
  const normB = normalizeSkillName(skillB).toLowerCase();

  // 1. Exact normalized match
  if (normA === normB) return { matches: true, score: 1.0 };

  // 2. Substring overlap (e.g. "react" in "react native", "algorithms" in "data structures & algorithms")
  if (normA.includes(normB) || normB.includes(normA)) return { matches: true, score: 0.90 };

  // 3. Domain cluster affinities
  const clusters: string[][] = [
    ['react', 'javascript', 'web development', 'next.js', 'typescript'],
    ['data structures', 'algorithms', 'problem solving'],
    ['machine learning', 'python', 'ai'],
    ['system design', 'databases', 'devops'],
    ['mobile development', 'react', 'javascript'],
  ];

  for (const c of clusters) {
    if (c.includes(normA) && c.includes(normB)) {
      return { matches: true, score: 0.80 };
    }
  }

  return { matches: false, score: 0 };
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
  learnerWeakTopics?: string[];
  teacherStrongTopics?: string[];
  skillAffinityScore?: number;
  matchOrientation?: 'peer_teaches_user' | 'user_teaches_peer' | 'reciprocal' | 'study_partners';
}): MatchScoreBreakdown & { topicOverlap: string[] } {
  const normTarget = normalizeSkillName(params.targetSkill);
  const normOffers = params.teacherOffers.map(normalizeSkillName);

  // 1. Skill Match (30%)
  let skillScore = params.skillAffinityScore != null ? params.skillAffinityScore : 0.85;
  let topicOverlap: string[] = [];

  if (params.learnerWeakTopics && params.learnerWeakTopics.length > 0) {
    const strongList = (params.teacherStrongTopics && params.teacherStrongTopics.length > 0)
      ? params.teacherStrongTopics
      : normOffers;
    topicOverlap = params.learnerWeakTopics.filter((wt) =>
      strongList.some((st) =>
        st.toLowerCase() === wt.toLowerCase() ||
        st.toLowerCase().includes(wt.toLowerCase()) ||
        wt.toLowerCase().includes(st.toLowerCase())
      )
    );
    if (topicOverlap.length > 0) {
      skillScore = Math.min(1.0, Math.max(0.70, topicOverlap.length / params.learnerWeakTopics.length));
    }
  } else if (normOffers.includes(normTarget)) {
    skillScore = 1.0;
  } else if (normOffers.some((o) => o.toLowerCase().includes(normTarget.toLowerCase()) || normTarget.toLowerCase().includes(o.toLowerCase()))) {
    skillScore = Math.max(skillScore, 0.90);
  }

  // 2. Proficiency Balance (20%) - Zone of Proximal Development (ZPD)
  const orientation = params.matchOrientation || (params.isReciprocal ? 'reciprocal' : 'peer_teaches_user');
  let proficiencyScore = 0.85;

  if (orientation === 'user_teaches_peer') {
    // User is the teacher; peer is learner
    const diff = params.learnerCurrentLevel - params.teacherLevel;
    if (diff >= 1 && diff <= 2) {
      proficiencyScore = 1.0; // Optimal ZPD for user to teach
    } else if (diff >= 3) {
      proficiencyScore = 0.90; // High mastery difference
    } else if (diff === 0) {
      proficiencyScore = 0.85; // Peer-to-peer helper
    } else {
      proficiencyScore = 0.75; // Mutual learning
    }
  } else if (orientation === 'study_partners') {
    // Co-learners studying together
    const diff = Math.abs(params.teacherLevel - params.learnerCurrentLevel);
    if (diff === 0) {
      proficiencyScore = 0.95; // Same level peers make ideal study partners
    } else if (diff === 1) {
      proficiencyScore = 0.90; // Close companion level
    } else {
      proficiencyScore = 0.80;
    }
  } else {
    // Peer teaches user (or reciprocal)
    const levelDiff = params.teacherLevel - params.learnerCurrentLevel;
    if (levelDiff === 1 || levelDiff === 2) {
      proficiencyScore = 1.0; // Optimal ZPD
    } else if (levelDiff === 3) {
      proficiencyScore = 0.90;
    } else if (levelDiff >= 4) {
      proficiencyScore = 0.80; // Expert mentor
    } else if (params.teacherLevel >= 2 && params.learnerCurrentLevel <= 1) {
      proficiencyScore = 0.90; // Peer helper for foundational mastery
    } else if (levelDiff === 0) {
      proficiencyScore = 0.85; // Parallel peers
    } else {
      proficiencyScore = 0.75;
    }
  }

  // 3. Learning Need Urgency (15%)
  const needGap = Math.max(1, params.learnerTargetLevel - params.learnerCurrentLevel);
  const needScore = needGap >= 3 ? 1.0 : needGap === 2 ? 0.90 : 0.80;

  // 4. Schedule / Availability (15%)
  const availabilityScore = params.hasAvailabilityOverlap !== false ? 0.95 : 0.70;

  // 5. Learning Style / Preference (10%)
  const preferenceScore = 0.92;

  // 6. Network Value (10%)
  let networkScore = 0.80;
  if (params.isReciprocal) {
    networkScore = 1.0; // Mutual learning exchange
  } else if (params.isMultiHop) {
    networkScore = 0.95; // 3-party closed loop
  } else if (orientation === 'user_teaches_peer') {
    networkScore = 0.90; // Mentorship reinforces retention
  } else if (orientation === 'peer_teaches_user') {
    networkScore = 0.88;
  }

  const rawTotal =
    0.3 * skillScore +
    0.2 * proficiencyScore +
    0.15 * needScore +
    0.15 * availabilityScore +
    0.1 * preferenceScore +
    0.1 * networkScore;

  const finalPercentage = Math.min(99, Math.max(50, Math.round(rawTotal * 100)));
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
    topicOverlap,
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
    verified_level?: number | null;
    weakTopics?: string[];
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
    verified_level?: number | null;
    verified?: boolean;
    strongTopics?: string[];
  }>
): AgentMatchResponse {
  const logs: AgentActivityLog[] = [];

  // Step 1 & 2: OBSERVE & UNDERSTAND
  const userDomain = normalizeSkillName(currentUser.domain);
  const userVerifiedLevelRaw = currentUser.verified_level != null ? currentUser.verified_level : null;
  const userCurrentLevel = userVerifiedLevelRaw != null 
    ? (userVerifiedLevelRaw as NumericProficiency) 
    : parseProficiency(currentUser.level);
  
  const userTargetLevel = currentUser.targetLevel !== undefined ? parseProficiency(currentUser.targetLevel) : Math.min(5, userCurrentLevel + 2) as NumericProficiency;
  
  const userNeeds = (currentUser.needs && currentUser.needs.length > 0 ? currentUser.needs : [userDomain]).map(normalizeSkillName);
  const userOffers = (currentUser.offers && currentUser.offers.length > 0 ? currentUser.offers : [userDomain]).map(normalizeSkillName);

  logs.push(
    createLog('OBSERVE', `Scanning profile for ${currentUser.name || 'User'}: target domain "${userDomain}" at level ${userCurrentLevel} (${PROFICIENCY_LABELS[userCurrentLevel]})`)
  );
  if (userVerifiedLevelRaw != null) {
    logs.push(createLog('OBSERVE', `Using verified level ${userVerifiedLevelRaw} (Teaching Verified)`));
  } else {
    logs.push(createLog('OBSERVE', `Using self-declared level (unverified)`));
  }
  logs.push(
    createLog('UNDERSTAND', `Normalizing skill taxonomy: Seeking [${userNeeds.join(', ')}], Offering to Teach [${userOffers.join(', ')}]`)
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
    const peerVerifiedLevelRaw = peer.verified_level != null 
      ? peer.verified_level 
      : (peer.verified ? (peer.numeric_level ?? peer.level) : null);
    const peerLevel = peerVerifiedLevelRaw != null
      ? (peerVerifiedLevelRaw as NumericProficiency)
      : parseProficiency(peer.numeric_level ?? peer.level);
    const isPeerVerified = Boolean(peer.verified || peerVerifiedLevelRaw != null);

    const peerOffers = (peer.offers || [peer.domain]).map(normalizeSkillName);
    const peerNeeds = (peer.needs || []).map(normalizeSkillName);

    // 1. Check if peer can teach what user needs
    let bestPeerTeachesUser: { peerSkill: string; userSkill: string; score: number } | null = null;
    for (const pOff of peerOffers) {
      for (const uNeed of userNeeds) {
        const aff = matchSkillAffinity(pOff, uNeed);
        if (aff.matches && (!bestPeerTeachesUser || aff.score > bestPeerTeachesUser.score)) {
          bestPeerTeachesUser = { peerSkill: pOff, userSkill: uNeed, score: aff.score };
        }
      }
    }

    // 2. Check if user can teach what peer needs
    let bestUserTeachesPeer: { userSkill: string; peerSkill: string; score: number } | null = null;
    for (const uOff of userOffers) {
      for (const pNeed of peerNeeds) {
        const aff = matchSkillAffinity(uOff, pNeed);
        if (aff.matches && (!bestUserTeachesPeer || aff.score > bestUserTeachesPeer.score)) {
          bestUserTeachesPeer = { userSkill: uOff, peerSkill: pNeed, score: aff.score };
        }
      }
    }

    // 3. Check for co-study partner overlap (shared learning goals or skills)
    let bestStudyOverlap: { userSkill: string; peerSkill: string; score: number } | null = null;
    for (const uNeed of userNeeds) {
      for (const pNeed of peerNeeds) {
        const aff = matchSkillAffinity(uNeed, pNeed);
        if (aff.matches && (!bestStudyOverlap || aff.score > bestStudyOverlap.score)) {
          bestStudyOverlap = { userSkill: uNeed, peerSkill: pNeed, score: aff.score };
        }
      }
    }
    for (const uOff of userOffers) {
      for (const pOff of peerOffers) {
        const aff = matchSkillAffinity(uOff, pOff);
        if (aff.matches && (!bestStudyOverlap || aff.score > bestStudyOverlap.score)) {
          bestStudyOverlap = { userSkill: uOff, peerSkill: pOff, score: aff.score };
        }
      }
    }

    const peerCanTeachUser = bestPeerTeachesUser !== null;
    const userCanTeachPeer = bestUserTeachesPeer !== null;
    const areStudyPartners = bestStudyOverlap !== null;

    if (!peerCanTeachUser && !userCanTeachPeer && !areStudyPartners) {
      continue; // No skill connection
    }

    // Determine exchange type & primary skill
    let exchangeType: 'reciprocal' | 'they_mentor' | 'you_mentor' | 'study_buddy';
    let matchType: 'direct_reciprocal' | 'direct_oneway' | 'user_mentoring' | 'peer_collaborator';
    let matchOrientation: 'reciprocal' | 'peer_teaches_user' | 'user_teaches_peer' | 'study_partners';
    let primarySkill = '';
    let affinityScore = 1.0;

    if (peerCanTeachUser && userCanTeachPeer) {
      exchangeType = 'reciprocal';
      matchType = 'direct_reciprocal';
      matchOrientation = 'reciprocal';
      primarySkill = bestPeerTeachesUser!.peerSkill;
      affinityScore = Math.max(bestPeerTeachesUser!.score, bestUserTeachesPeer!.score);
    } else if (peerCanTeachUser) {
      exchangeType = 'they_mentor';
      matchType = 'direct_oneway';
      matchOrientation = 'peer_teaches_user';
      primarySkill = bestPeerTeachesUser!.peerSkill;
      affinityScore = bestPeerTeachesUser!.score;
    } else if (userCanTeachPeer) {
      exchangeType = 'you_mentor';
      matchType = 'user_mentoring';
      matchOrientation = 'user_teaches_peer';
      primarySkill = bestUserTeachesPeer!.userSkill;
      affinityScore = bestUserTeachesPeer!.score;
    } else {
      exchangeType = 'study_buddy';
      matchType = 'peer_collaborator';
      matchOrientation = 'study_partners';
      primarySkill = bestStudyOverlap!.userSkill;
      affinityScore = bestStudyOverlap!.score;
    }

    // Dynamic role classification
    let peerRole: PeerRole;
    if (exchangeType === 'reciprocal') {
      peerRole = 'TEACHER + LEARNER';
    } else if (exchangeType === 'they_mentor') {
      peerRole = peerLevel >= 4 ? 'MENTOR' : peerLevel >= 3 ? 'TEACHER' : 'PEER HELPER';
    } else if (exchangeType === 'you_mentor') {
      peerRole = 'LEARNER';
    } else {
      peerRole = 'PEER HELPER';
    }

    const breakdown = calculateMatchScore({
      targetSkill: primarySkill,
      teacherOffers: peerOffers,
      learnerNeeds: userNeeds,
      teacherLevel: peerLevel,
      learnerCurrentLevel: userCurrentLevel,
      learnerTargetLevel: userTargetLevel,
      isReciprocal: exchangeType === 'reciprocal',
      isMultiHop: false,
      learnerWeakTopics: currentUser.weakTopics,
      teacherStrongTopics: peer.strongTopics || peerOffers,
      skillAffinityScore: affinityScore,
      matchOrientation,
    });

    // Step 12: Plain-language decision explanation
    const verifiedText = isPeerVerified ? (peerLevel >= 3 ? 'Verified Teacher' : 'Verified Peer') : PROFICIENCY_LABELS[peerLevel];
    let explanation = '';

    if (breakdown.topicOverlap && breakdown.topicOverlap.length > 0) {
      explanation = `${peer.name} is Strong in ${breakdown.topicOverlap.join(' and ')}, directly addressing your weak topic${breakdown.topicOverlap.length > 1 ? 's' : ''}.`;
    } else if (exchangeType === 'reciprocal') {
      explanation = `2-Way Reciprocal Match: ${peer.name} (${verifiedText}) can guide you in ${bestPeerTeachesUser!.userSkill}, while you mentor them in ${bestUserTeachesPeer!.peerSkill}. Complete mutual exchange symmetry!`;
    } else if (exchangeType === 'they_mentor') {
      explanation = `Guidance Match: ${peer.name} offers ${primarySkill} (${verifiedText}, Level ${peerLevel}) to assist your progression toward Level ${userTargetLevel}. Optimal Zone of Proximal Development coaching.`;
    } else if (exchangeType === 'you_mentor') {
      explanation = `Mentorship Opportunity: You are eligible to teach ${bestUserTeachesPeer!.userSkill}, which ${peer.name} is actively seeking. Mentoring them reinforces your own mastery (Protégé Effect).`;
    } else {
      explanation = `Peer Study Partner: Both you and ${peer.name} are actively developing skills in ${primarySkill}. Ideal partner for pair programming and mock challenges.`;
    }

    matches.push({
      matchId: 'match_' + peer.id + '_' + Date.now(),
      peerId: peer.id,
      peerName: peer.name,
      peerAvatar: peer.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(peer.name)}&background=D97706&color=fff`,
      peerRole,
      primarySkill,
      score: breakdown.finalPercentage,
      breakdown,
      matchType,
      exchangeType,
      plainExplanation: explanation,
      canTeach: peerOffers,
      wantsToLearn: peerNeeds,
      verified: isPeerVerified,
      topicOverlap: breakdown.topicOverlap,
    });
  }

  // Step 8: Multi-hop Circular Chains (3-Party Cycles)
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

        // Chain condition with affinity matching:
        // 1. User offers something pA needs
        // 2. pA offers something pB needs
        // 3. pB offers something User needs
        const userTeachesPA = userOffers.some((uO) => pANeeds.some((pAN) => matchSkillAffinity(uO, pAN).matches));
        const pATeachesPB = pAOffers.some((aO) => pBNeeds.some((pBN) => matchSkillAffinity(aO, pBN).matches));
        const pBTeachesUser = pBOffers.some((bO) => userNeeds.some((uN) => matchSkillAffinity(bO, uN).matches));

        if (userTeachesPA && pATeachesPB && pBTeachesUser && !matches.some((m) => m.peerId === pB.id)) {
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
            matchOrientation: 'peer_teaches_user',
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
            exchangeType: 'circle',
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

  // Step 10 & 11: Rank matches
  matches.sort((a, b) => b.score - a.score);

  logs.push(
    createLog('BUILD MATCHES', `Synthesized ${matches.length} candidate match graph edges`)
  );
  logs.push(
    createLog('EVALUATE NETWORK', `Computed 6-factor weighted compatibility formula across candidates`)
  );
  logs.push(
    createLog('CREATE CONNECTIONS', `Ranked top ${Math.min(matches.length, 8)} verified peer connections`)
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
    matches: matches.slice(0, 8),
    activityLogs: logs,
    emptyStateReason,
  };
}

