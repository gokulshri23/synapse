import { NextResponse } from 'next/server';
import { getCloudProfile, saveCloudProfile } from '@/lib/cloudStore';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json({ success: false, error: 'Email parameter required' }, { status: 400 });
    }

    const normalized = email.trim().toLowerCase();
    let profile = getCloudProfile(normalized);

    // If not in cloud cache, check Supabase profiles
    if (!profile) {
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

        if (data && !error) {
          profile = saveCloudProfile({
            name: data.full_name || normalized.split('@')[0],
            email: normalized,
            domain: data.skill_level || 'React',
            level: data.skill_level || 'intermediate',
            goal: data.learning_goal || '30-day sprint to skill mastery',
            score: 85,
            onboarding_complete: Boolean(data.onboarding_complete),
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
      canTeach: canTeach || offers,
      seekingGuidance: seekingGuidance || needs,
    });

    // Also attempt remote sync to Supabase if connected
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      await supabase.from('profiles').upsert({
        email: saved.email,
        full_name: saved.name,
        skill_level: saved.level,
        learning_goal: saved.goal,
        onboarding_complete: true,
      });
    } catch (e) {}

    return NextResponse.json({ success: true, profile: saved });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message }, { status: 500 });
  }
}
