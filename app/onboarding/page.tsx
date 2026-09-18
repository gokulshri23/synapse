'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import ProctoredQuiz from '@/components/proctor/ProctoredQuiz';
import ThemeToggle from '@/components/ui/ThemeToggle';

const AVAILABLE_DOMAINS = [
  { id: 'React', name: 'React', desc: 'Components, Hooks, State & Next.js', icon: '⚛️' },
  { id: 'Python', name: 'Python', desc: 'Core Syntax, OOP, Data Science & APIs', icon: '🐍' },
  { id: 'Machine Learning', name: 'Machine Learning', desc: 'Math, Neural Networks, PyTorch & Sklearn', icon: '🧠' },
  { id: 'JavaScript', name: 'JavaScript', desc: 'Modern ES6+, DOM, Async & Node.js', icon: '⚡' },
  { id: 'Data Structures', name: 'Data Structures', desc: 'Arrays, Trees, Graphs & Dynamic Programming', icon: '🌲' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [domain, setDomain] = useState('React');
  const [level, setLevel] = useState<'beginner' | 'intermediate' | 'advanced'>('intermediate');
  const [goal, setGoal] = useState('30-day sprint to skill mastery');
  const [quizStarted, setQuizStarted] = useState(false);
  const [quizScore, setQuizScore] = useState<number | null>(null);
  const [email, setEmail] = useState('');

  useEffect(() => {
    async function loadUser() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setEmail(user.email || '');
          setName(user.user_metadata?.full_name || user.email?.split('@')[0] || '');
        }
        const cachedEmail = localStorage.getItem('synapse_user_email');
        if (cachedEmail) setEmail(cachedEmail);
        const cachedName = localStorage.getItem('synapse_user_name');
        if (cachedName) setName(cachedName);
      } catch (e) {}
    }
    loadUser();
  }, [supabase]);

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setStep(2);
  };

  const handleQuizComplete = (result: {
    score: number;
    skill: string;
    level: string;
    violationsCount: number;
  }) => {
    setQuizScore(result.score);
    setStep(3);
  };

  const handleFinishOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();

    const normalizedEmail = (email || localStorage.getItem('synapse_user_email') || 'learner@synapse.edu').trim().toLowerCase();
    const studyData = {
      name: name.trim() || 'Learner',
      email: normalizedEmail,
      bio: bio.trim() || 'Excited to learn and collaborate with peers.',
      domain,
      level,
      goal: goal.trim() || '30-day sprint to skill mastery',
      score: quizScore ?? 80,
      completed_at: new Date().toISOString(),
    };

    // Save to localStorage for active session and user-specific key
    localStorage.setItem('synapse_study_data', JSON.stringify(studyData));
    localStorage.setItem(`synapse_study_data_${normalizedEmail}`, JSON.stringify(studyData));
    localStorage.setItem('synapse_user_name', studyData.name);
    localStorage.setItem('synapse_user_email', normalizedEmail);
    const isDemo = normalizedEmail.includes('demo');
    localStorage.setItem('synapse_demo_active', isDemo ? 'true' : 'false');
    document.cookie = 'synapse_demo_session=true; path=/; max-age=86400';

    // Save to unified cloud profile API so any other device has immediate access
    try {
      await fetch('/api/user-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: studyData.name,
          email: normalizedEmail,
          bio: studyData.bio,
          domain: studyData.domain,
          level: studyData.level,
          goal: studyData.goal,
          score: studyData.score,
          completed_at: studyData.completed_at,
          onboarding_complete: true,
        }),
      });
    } catch (e) {}

    // Broadcast registration to peer network so multi-device discovery works instantly
    try {
      await fetch('/api/peer-network', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: studyData.name,
          email: normalizedEmail,
          domain: studyData.domain,
          level: studyData.level,
          score: studyData.score,
        })
      });
    } catch (e) {}

    // Attempt to persist to Supabase if connected
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('profiles').upsert({
          id: user.id,
          email: user.email || normalizedEmail,
          full_name: studyData.name,
          skill_level: studyData.level,
          learning_goal: studyData.goal,
          onboarding_complete: true,
        });

        // Insert initial assessment
        await supabase.from('assessments').insert({
          user_id: user.id,
          skill_name: studyData.domain,
          score: studyData.score,
        });
      }
    } catch (err) {
      console.warn('Supabase onboarding save note:', err);
    }

    router.push('/app/skills');
  };

  return (
    <main className="min-h-screen bg-canvas flex flex-col items-center justify-center p-4 sm:p-6 animate-fade-in relative">
      {/* Top Header Controls */}
      <div className="w-full max-w-2xl flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber to-terracotta flex items-center justify-center text-white text-xs font-bold shadow-xs">
            S
          </span>
          <span className="font-serif font-bold text-ink text-lg">Synapse Onboarding</span>
        </div>
        <ThemeToggle />
      </div>

      <div className="w-full max-w-2xl">
        {/* Step Indicator */}
        <div className="flex justify-center mb-8 gap-3">
          {[
            { num: 1, label: 'Profile' },
            { num: 2, label: 'AI Assessment' },
            { num: 3, label: 'Goal & Roadmap' }
          ].map((s) => (
            <div key={s.num} className="flex-1 flex flex-col items-center gap-1.5">
              <div
                className={`h-2 w-full rounded-full transition-all duration-300 ${
                  step >= s.num ? 'bg-amber' : 'bg-border'
                }`}
              />
              <span className={`text-[11px] font-medium transition-colors ${
                step >= s.num ? 'text-amber' : 'text-muted'
              }`}>
                {s.num}. {s.label}
              </span>
            </div>
          ))}
        </div>

        {/* Card Container */}
        <div className="bg-card p-6 sm:p-8 rounded-[24px] border border-border shadow-md">
          {/* STEP 1: Profile Information */}
          {step === 1 && (
            <form onSubmit={handleProfileSubmit} className="space-y-5 animate-fade-in">
              <div>
                <h2 className="text-2xl font-serif font-bold text-ink">Set up your profile</h2>
                <p className="text-sm text-muted mt-1">Tell peers who you are and what you're passionate about.</p>
              </div>

              <div className="flex items-center gap-4 py-2">
                <div className="w-14 h-14 rounded-2xl bg-amber text-white flex items-center justify-center text-2xl font-serif font-bold shadow-sm">
                  {name ? name.charAt(0).toUpperCase() : 'U'}
                </div>
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted block">Avatar</span>
                  <span className="text-xs text-ink">Generated from your initials</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted ml-1">
                  Full Name
                </label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Alex Morgan"
                  className="w-full p-3.5 rounded-xl bg-card-alt border border-border text-ink text-sm outline-none focus:border-amber focus:ring-2 focus:ring-amber/20"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted ml-1">
                  Bio & Focus Areas
                </label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="e.g. Studying Computer Science, preparing for tech interviews, excited to collaborate on real projects."
                  className="w-full p-3.5 rounded-xl bg-card-alt border border-border text-ink text-sm outline-none focus:border-amber focus:ring-2 focus:ring-amber/20 h-24"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3.5 bg-amber hover:bg-terracotta text-white font-semibold rounded-xl text-sm transition-all shadow-sm cursor-pointer"
              >
                Continue to AI Assessment →
              </button>
            </form>
          )}

          {/* STEP 2: Domain Selection & Proctored Quiz */}
          {step === 2 && (
            <div className="space-y-6 animate-fade-in">
              {!quizStarted ? (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-2xl font-serif font-bold text-ink">Choose your primary skill domain</h2>
                    <p className="text-sm text-muted mt-1">
                      Our autonomous AI ecosystem will benchmark your knowledge and curate your personal roadmap.
                    </p>
                  </div>

                  {/* Domain Selector Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {AVAILABLE_DOMAINS.map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => setDomain(d.id)}
                        className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                          domain === d.id
                            ? 'border-amber bg-amber/10 shadow-xs ring-1 ring-amber'
                            : 'border-border bg-card-alt hover:border-amber/50'
                        }`}
                      >
                        <span className="text-2xl">{d.icon}</span>
                        <div>
                          <h4 className="text-sm font-semibold text-ink">{d.name}</h4>
                          <p className="text-xs text-muted mt-0.5">{d.desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Level Selector */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted">
                      Your Self-Assessed Level
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      {(['beginner', 'intermediate', 'advanced'] as const).map((l) => (
                        <button
                          key={l}
                          type="button"
                          onClick={() => setLevel(l)}
                          className={`py-3 px-2 rounded-xl border text-center capitalize text-xs font-semibold transition-all cursor-pointer ${
                            level === l
                              ? 'border-amber bg-amber/10 text-amber'
                              : 'border-border bg-card-alt text-ink hover:border-amber/50'
                          }`}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Anti-Cheating Notice */}
                  <div className="p-3.5 rounded-xl bg-card-alt border border-border text-xs text-muted flex items-center gap-3">
                    <span className="text-xl">🛡️</span>
                    <div>
                      <span className="font-semibold text-ink block">Proctored Assessment Notice</span>
                      <span>The upcoming quiz enables webcam monitoring to detect external devices/notebooks and prohibits tab switching.</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setQuizStarted(true)}
                    className="w-full py-3.5 bg-amber hover:bg-terracotta text-white font-semibold rounded-xl text-sm transition-all shadow-sm cursor-pointer"
                  >
                    Start Proctored Assessment for {domain} →
                  </button>
                </div>
              ) : (
                <ProctoredQuiz
                  skill={domain}
                  level={level}
                  onComplete={handleQuizComplete}
                />
              )}
            </div>
          )}

          {/* STEP 3: Learning Goal & Launch */}
          {step === 3 && (
            <form onSubmit={handleFinishOnboarding} className="space-y-6 animate-fade-in">
              <div>
                <h2 className="text-2xl font-serif font-bold text-ink">Set your learning goal</h2>
                <p className="text-sm text-muted mt-1">
                  How would you like to pace your study in <span className="font-semibold text-ink">{domain}</span>?
                </p>
              </div>

              {/* Goal Presets */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { title: '30-Day Sprint', desc: 'Accelerated mastery with daily missions' },
                  { title: '60-Day Deep Dive', desc: 'Thorough project-based progression' },
                  { title: '90-Day Mastery', desc: 'Comprehensive coverage & peer teaching' },
                ].map((preset) => (
                  <button
                    key={preset.title}
                    type="button"
                    onClick={() => setGoal(preset.title)}
                    className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                      goal.toLowerCase().includes(preset.title.toLowerCase().slice(0, 6))
                        ? 'border-amber bg-amber/10 text-ink shadow-xs ring-1 ring-amber'
                        : 'border-border bg-card-alt text-ink hover:border-amber/50'
                    }`}
                  >
                    <span className="font-semibold text-sm block text-ink">{preset.title}</span>
                    <span className="text-xs text-muted block mt-1">{preset.desc}</span>
                  </button>
                ))}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted ml-1">
                  Custom Goal Description
                </label>
                <input
                  required
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder="e.g. Master algorithms and build 3 full-stack applications"
                  className="w-full p-3.5 rounded-xl bg-card-alt border border-border text-ink text-sm outline-none focus:border-amber focus:ring-2 focus:ring-amber/20"
                />
              </div>

              {/* Summary Pill Card */}
              <div className="p-4 bg-card-alt rounded-xl border border-border flex justify-between items-center text-xs">
                <div>
                  <span className="text-muted block">Benchmark Score</span>
                  <span className="text-base font-bold text-ok">{quizScore}%</span>
                </div>
                <div>
                  <span className="text-muted block">Curated Roadmap</span>
                  <span className="text-sm font-semibold text-ink">{domain}</span>
                </div>
                <div>
                  <span className="text-muted block">Target Pace</span>
                  <span className="text-sm font-semibold text-amber">{goal.slice(0, 15)}...</span>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-4 bg-amber hover:bg-terracotta text-white font-bold rounded-xl text-sm transition-all shadow-md active:scale-[0.99] cursor-pointer"
              >
                🚀 Generate My Dynamic Dashboard & Begin →
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
