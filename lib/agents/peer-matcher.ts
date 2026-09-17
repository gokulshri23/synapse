import { Skill, PeerMatch, PeerProfile, Profile } from '@/lib/types';
import { MOCK_PEERS } from '@/lib/constants';

export function findMatches(userSkills: Skill[], userProfile: Profile): PeerMatch[] {
  const peers: PeerProfile[] = MOCK_PEERS;

  const matches: PeerMatch[] = peers.map((peer, index) => {
    // Compute compatibility based on skill gaps
    const userWeakSkills = userSkills.filter(s => s.mastery_pct < 50).map(s => s.name.toLowerCase());
    const userStrongSkills = userSkills.filter(s => s.mastery_pct >= 60).map(s => s.name.toLowerCase());
    const peerStrongSkills = peer.offers.map(s => s.toLowerCase());
    const peerWeakSkills = peer.needs.map(s => s.toLowerCase());

    // Peer can teach user (peer strong in user's weak areas)
    const teachMatches = userWeakSkills.filter(s =>
      peerStrongSkills.some(ps => ps.includes(s) || s.includes(ps))
    ).length;

    // User can teach peer (user strong in peer's weak areas)
    const learnMatches = userStrongSkills.filter(s =>
      peerWeakSkills.some(ps => ps.includes(s) || s.includes(ps))
    ).length;

    const totalSkills = Math.max(userSkills.length, 3);
    const rawCompat = ((teachMatches + learnMatches) / totalSkills) * 100;
    // Add deterministic variance per peer
    const variance = (index * 7 + 13) % 20;
    const compatibility = Math.min(98, Math.max(45, Math.round(rawCompat + 40 + variance)));

    return {
      id: crypto.randomUUID(),
      user_a_id: userProfile.id || 'user',
      user_b_id: peer.id,
      compatibility_pct: compatibility,
      skill_area: peer.offers[0] || 'General',
      status: 'pending',
      peer_profile: peer,
      created_at: new Date().toISOString(),
    };
  });

  return matches.sort((a, b) => b.compatibility_pct - a.compatibility_pct).slice(0, 5);
}

export function getMatchExplanation(match: PeerMatch): string {
  const peer = match.peer_profile;
  if (!peer) return 'Compatible learning partner based on skill analysis.';
  const offers = peer.offers.join(', ');
  const needs = peer.needs.join(', ');
  return `${peer.name} excels in ${offers} and wants to learn ${needs}. A ${match.compatibility_pct}% match based on complementary skill gaps.`;
}
