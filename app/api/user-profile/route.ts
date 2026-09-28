import { NextResponse } from 'next/server';
import { getCloudProfile, saveCloudProfile, getSkillDeclarations } from '@/lib/cloudStore';
import { createClient } from '@supabase/supabase-js';

function encodeGoalMetadata(goal: string, domain: string, canTeach?: string[], seekingGuidance?: string[]): string {
  const meta = {
    g: goal,
    d: domain,
    t: canTeach || [],
    s: seekingGuidance || [],
  };
  return `SYNAPSE_META::${JSON.stringify(meta)}`;
}

function decodeGoalMetadata(rawGoal: string | null | undefined): { goal: string; domain?: string; canTeach?: string[]; seekingGuidance?: string[] } {
  if (!rawGoal) return { goal: '30-day sprint to skill mastery' };
  if (rawGoal.startsWith('SYNAPSE_META::')) {
    try {
      const parsed = JSON.parse(rawGoal.substring('SYNAPSE_META::'.length));
      return {
        goal: parsed.g || '30-day sprint to skill mastery',
        domain: parsed.d,
        canTeach: Array.isArray(parsed.t) ? parsed.t : undefined,
        seekingGuidance: Array.isArray(parsed.s) ? parsed.s : undefined,
      };
    } catch (e) {}
  }
  const lower = rawGoal.toLowerCase();
  let detectedDomain: string | undefined = undefined;
  if (lower.includes('python')) detectedDomain = 'Python';
  else if (lower.includes('react')) detectedDomain = 'React';
  else if (lower.includes('machine learning') || lower.includes('ml')) detectedDomain = 'Machine Learning';
  else if (lower.includes('data structures') || lower.includes('dsa')) detectedDomain = 'Data Structures';
  else if (lower.includes('javascript') || lower.includes('js')) detectedDomain = 'JavaScript';
  else if (lower.includes('system design')) detectedDomain = 'System Design';

  return {
    goal: rawGoal,
    domain: detectedDomain,
  };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json({ success: false, error: 'Email parameter required' }, { status: 400 });
    }

    const normalized = email.trim().toLowerCase();
    let profile = getCloudProfile(normalized);

    // If not in cloud cache or onboarding not complete in cache, check Supabase profiles
    if (!profile || !profile.onboarding_complete || !profile.canTeach || profile.canTeach.length === 0) {
      try {
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('email', normalized)
          .maybeSingle();

        if (data && !error && data.onboarding_complete) {
          const decoded = decodeGoalMetadata(data.learning_goal);
          const decls = getSkillDeclarations(normalized);
          const declTeach = decls.filter((d) => d.intent === 'teach').map((d) => d.skill);
          const declLearn = decls.filter((d) => d.intent === 'learn').map((d) => d.skill);

          const resolvedDomain = decoded.domain || (data.skill_level && !['beginner', 'intermediate', 'advanced'].includes(data.skill_level.toLowerCase()) ? data.skill_level : 'React');
          const resolvedTeach = (decoded.canTeach && decoded.canTeach.length > 0)
            ? decoded.canTeach
            : declTeach.length > 0
            ? declTeach
            : [(resolvedDomain === 'React' ? 'Python' : 'React'), 'Problem Solving'];
          const resolvedSeek = (decoded.seekingGuidance && decoded.seekingGuidance.length > 0)
            ? decoded.seekingGuidance
            : declLearn.length > 0
            ? declLearn
            : [resolvedDomain];

          profile = saveCloudProfile({
            name: data.full_name || normalized.split('@')[0],
            email: normalized,
            domain: resolvedDomain,
            level: data.skill_level || 'intermediate',
            goal: decoded.goal || '30-day sprint to skill mastery',
            score: 85,
            onboarding_complete: true,
            canTeach: resolvedTeach,
            seekingGuidance: resolvedSeek,
          });
        }
      } catch (err) {}
    }

    return NextResponse.json({
      success: true,
      profile: profile || null,
      found: Boolean(profile),
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email, bio, domain, level, goal, score, completed_at, onboarding_complete, canTeach, seekingGuidance, offers, needs } = body;

    if (!email) {
      return NextResponse.json({ success: false, error: 'Email is required' }, { status: 400 });
    }

    const effectiveTeach = canTeach || offers;
    const effectiveSeek = seekingGuidance || needs;

    const saved = saveCloudProfile({
      name: name || email.split('@')[0],
      email,
      bio,
      domain: domain || 'React',
      level: level || 'intermediate',
      goal: goal || '30-day sprint to skill mastery',
      score: typeof score === 'number' ? score : 85,
      completed_at: completed_at || new Date().toISOString(),
      onboarding_complete: onboarding_complete ?? true,
      canTeach: effectiveTeach,
      seekingGuidance: effectiveSeek,
    });

    // Resilient sync to Supabase: encode rich metadata into learning_goal
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const encodedGoal = encodeGoalMetadata(saved.goal, saved.domain, saved.canTeach, saved.seekingGuidance);

      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', saved.email)
        .maybeSingle();

      if (existing?.id) {
        await supabase
          .from('profiles')
          .update({
            full_name: saved.name,
            skill_level: saved.level,
            learning_goal: encodedGoal,
            onboarding_complete: true,
          })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('profiles')
          .upsert({
            email: saved.email,
            full_name: saved.name,
            skill_level: saved.level,
            learning_goal: encodedGoal,
            onboarding_complete: true,
          });
      }
    } catch (e) {
      console.warn('[user-profile] Supabase sync notice:', e);
    }

    return NextResponse.json({ success: true, profile: saved });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message }, { status: 500 });
  }
}
