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

const SKILL_TAGS = [
  { id: 'React', label: 'React', icon: '⚛️' },
  { id: 'Python', label: 'Python', icon: '🐍' },
  { id: 'JavaScript', label: 'JavaScript', icon: '⚡' },
  { id: 'Machine Learning', label: 'Machine Learning', icon: '🧠' },
  { id: 'Data Structures', label: 'Data Structures', icon: '🌲' },
  { id: 'System Design', label: 'System Design', icon: '🏗️' },
  { id: 'Algorithms', label: 'Algorithms', icon: '🧩' },
  { id: 'Web Development', label: 'Web Development', icon: '🌐' },
  { id: 'Databases', label: 'Databases', icon: '🗄️' },
  { id: 'DevOps', label: 'DevOps & Cloud', icon: '☁️' },
  { id: 'Problem Solving', label: 'Problem Solving', icon: '💡' },
  { id: 'Mobile Development', label: 'Mobile Dev', icon: '📱' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [domain, setDomain] = useState('React');
  const [goal, setGoal] = useState('30-day sprint to skill mastery');
  const [email, setEmail] = useState('');
  
  // New Flow state
  const [teachingIntents, setTeachingIntents] = useState<string[]>([]);
  const [learningIntents, setLearningIntents] = useState<string[]>([]);
  const [declarations, setDeclarations] = useState<any[]>([]);
  const [currentDeclarationIndex, setCurrentDeclarationIndex] = useState(0);
  const [level, setLevel] = useState('0'); // default for learning intents
  const [quizScore, setQuizScore] = useState<number>(0);

  // Teaching Challenge State
  const [isChallengeMode, setIsChallengeMode] = useState(false);
  const [challengePrompt, setChallengePrompt] = useState('');
  const [challengeExplanation, setChallengeExplanation] = useState('');
  const [isChallengeLoading, setIsChallengeLoading] = useState(false);
  const [isChallengeEvaluating, setIsChallengeEvaluating] = useState(false);
  const [challengeFeedback, setChallengeFeedback] = useState<any>(null);

  // Placement Diagnostic State
  const [diagnosticQuestions, setDiagnosticQuestions] = useState<any[]>([]);
  const [diagnosticAnswers, setDiagnosticAnswers] = useState<number[]>([]);
  const [currentDiagnosticQuestion, setCurrentDiagnosticQuestion] = useState(0);
  const [isDiagnosticLoading, setIsDiagnosticLoading] = useState(false);
  const [isDiagnosticSubmitting, setIsDiagnosticSubmitting] = useState(false);

  // Proctored Quiz State
  const [showConsentScreen, setShowConsentScreen] = useState(false);
  const [quizStarted, setQuizStarted] = useState(false);
  const [proctoredInvalidatedMessage, setProctoredInvalidatedMessage] = useState<string | null>(null);

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

  const normalizedEmail = (
    email ||
    (typeof window !== 'undefined' ? localStorage.getItem('synapse_user_email') : '') ||
    'learner@synapse.edu'
  ).trim().toLowerCase();

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setStep(2);
  };

  const handleStep2Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const decs = [];
    
    // Create teaching declarations
    for (const skill of teachingIntents) {
      const res = await fetch('/api/skill-declarations', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', userId: normalizedEmail, skill, intent: 'teach' }) 
      });
      if (res.ok) {
        const data = await res.json();
        decs.push(data.declaration);
      }
    }

    // Create learning declarations
    for (const skill of learningIntents) {
      const res = await fetch('/api/skill-declarations', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', userId: normalizedEmail, skill, intent: 'learn' }) 
      });
      if (res.ok) {
        const data = await res.json();
        decs.push(data.declaration);
      }
    }

    setDeclarations(decs);
    setCurrentDeclarationIndex(0);
    if (decs.length > 0) {
      setStep(3);
    } else {
      setStep(4);
    }
  };

  const advanceDeclaration = () => {
    if (currentDeclarationIndex < declarations.length - 1) {
      setCurrentDeclarationIndex(prev => prev + 1);
      // Reset modes
      setIsChallengeMode(false);
      setChallengePrompt('');
      setChallengeExplanation('');
      setChallengeFeedback(null);
      setDiagnosticQuestions([]);
      setDiagnosticAnswers([]);
      setCurrentDiagnosticQuestion(0);
      setQuizStarted(false);
      setShowConsentScreen(false);
      setProctoredInvalidatedMessage(null);
    } else {
      setStep(4);
    }
  };

  // --- Teaching Handlers ---
  const handleProctoredComplete = async (result: {
    score: number;
    skill: string;
    level: string;
    violationsCount: number;
    passed: boolean;
    invalidated?: boolean;
    reason?: string;
  }) => {
    if (result.invalidated || result.score === -1) {
      setProctoredInvalidatedMessage('Attempt invalidated due to integrity violations. You can retake in 24 hours.');
      return;
    }

    const currentDec = declarations[currentDeclarationIndex];
    const res = await fetch('/api/skill-declarations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'submit-quiz', declarationId: currentDec.id, quizScore: result.score, intent: 'teach' })
    });
    
    if (res.ok) {
      const { declaration } = await res.json();
      const newDecs = [...declarations];
      newDecs[currentDeclarationIndex] = declaration;
      setDeclarations(newDecs);
    }

    advanceDeclaration();
  };

  const startTeachingChallenge = async (skill: string) => {
    setIsChallengeMode(true);
    setIsChallengeLoading(true);
    try {
      const res = await fetch('/api/teaching-challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate', skill })
      });
      const data = await res.json();
      setChallengePrompt(data.challengePrompt || `Explain ${skill} to a complete beginner.`);
    } catch (e) {
      setChallengePrompt(`Explain ${skill} to a complete beginner in under 200 words using a concrete example.`);
    } finally {
      setIsChallengeLoading(false);
    }
  };

  const submitTeachingChallenge = async () => {
    if (!challengeExplanation.trim()) return;
    setIsChallengeEvaluating(true);
    const currentDec = declarations[currentDeclarationIndex];
    
    try {
      const res = await fetch('/api/teaching-challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'evaluate', 
          declarationId: currentDec.id, 
          skill: currentDec.skill, 
          explanation: challengeExplanation 
        })
      });
      const data = await res.json();
      setChallengeFeedback(data.result);
      
      if (data.result) {
        const updatedRes = await fetch('/api/skill-declarations?userId=' + normalizedEmail);
        if (updatedRes.ok) {
          const { declarations: updatedDecs } = await updatedRes.json();
          const me = updatedDecs.find((d: any) => d.id === currentDec.id);
          if (me) {
            const newDecs = [...declarations];
            newDecs[currentDeclarationIndex] = me;
            setDeclarations(newDecs);
          }
        }
      }
    } catch (e) {
    } finally {
      setIsChallengeEvaluating(false);
    }
  };

  // --- Learning Handlers ---
  const startDiagnostic = async (skill: string) => {
    setIsDiagnosticLoading(true);
    try {
      const res = await fetch('/api/assess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'placement-diagnostic', skill })
      });
      const data = await res.json();
      if (data.questions && data.questions.length > 0) {
        setDiagnosticQuestions(data.questions);
        setDiagnosticAnswers(new Array(data.questions.length).fill(-1));
      } else {
        // Fallback
        setDiagnosticQuestions([{ question: `What is ${skill}?`, options: ['Option A', 'Option B', 'Option C', 'Option D'], answerIndex: 0 }]);
        setDiagnosticAnswers([-1]);
      }
    } catch (e) {
    } finally {
      setIsDiagnosticLoading(false);
    }
  };

  const submitDiagnostic = async () => {
    setIsDiagnosticSubmitting(true);
    let correct = 0;
    diagnosticQuestions.forEach((q, idx) => {
      if (diagnosticAnswers[idx] === q.answerIndex) correct++;
    });
    const score = Math.round((correct / Math.max(diagnosticQuestions.length, 1)) * 100);
    
    const currentDec = declarations[currentDeclarationIndex];
    try {
      const res = await fetch('/api/skill-declarations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'submit-quiz', declarationId: currentDec.id, quizScore: score, intent: 'learn' })
      });
      
      if (res.ok) {
        const { declaration } = await res.json();
        const newDecs = [...declarations];
        newDecs[currentDeclarationIndex] = declaration;
        setDeclarations(newDecs);
        
        if (declaration.skill === domain) {
          setLevel(declaration.verified_level?.toString() || '0');
          setQuizScore(score);
        }
      }
    } catch (e) {
    } finally {
      setIsDiagnosticSubmitting(false);
      advanceDeclaration();
    }
  };

  const handleFinishOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();

    const studyData = {
      name: name.trim() || 'Learner',
      email: normalizedEmail,
      bio: bio.trim() || 'Excited to learn and collaborate with peers.',
      domain,
      level: level,
      goal: goal.trim() || '30-day sprint to skill mastery',
      score: quizScore,
      completed_at: new Date().toISOString(),
      canTeach: teachingIntents,
      seekingGuidance: learningIntents,
    };

    localStorage.setItem('synapse_study_data', JSON.stringify(studyData));
    localStorage.setItem(`synapse_study_data_${normalizedEmail}`, JSON.stringify(studyData));
    localStorage.setItem('synapse_user_name', studyData.name);
    localStorage.setItem('synapse_user_email', normalizedEmail);

    const userSafe = (normalizedEmail || 'user').toLowerCase().replace(/[^a-z0-9]/g, '_');
    const domainSafe = (domain || 'react').toLowerCase().replace(/[^a-z0-9]/g, '_');
    localStorage.removeItem(`synapse_skills_${userSafe}_${domainSafe}`);
    localStorage.removeItem('synapse_skills_progress');

    const isDemo = normalizedEmail.includes('demo');
    localStorage.setItem('synapse_demo_active', isDemo ? 'true' : 'false');
    document.cookie = 'synapse_demo_session=true; path=/; max-age=86400';

    try {
      await fetch('/api/user-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...studyData,
          onboarding_complete: true,
        }),
      });
    } catch (e) {}

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
          offers: studyData.canTeach,
          needs: studyData.seekingGuidance,
        })
      });
    } catch (e) {}

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

        await supabase.from('assessments').insert({
          user_id: user.id,
          skill_name: studyData.domain,
          score: studyData.score,
        });
      }
    } catch (err) {}

    router.push('/app/skills');
  };

  const currentDeclaration = declarations[currentDeclarationIndex];

  return (
    <main className="min-h-screen bg-canvas flex flex-col items-center justify-center p-4 sm:p-6 animate-fade-in relative">
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
        <div className="flex justify-center mb-8 gap-3">
          {[
            { num: 1, label: 'Profile' },
            { num: 2, label: 'Domain & Intent' },
            { num: 3, label: 'Verification' },
            { num: 4, label: 'Summary' }
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
                Continue to Domain & Intent →
              </button>
            </form>
          )}

          {/* STEP 2: Domain & Intent Selection */}
          {step === 2 && (
            <form onSubmit={handleStep2Submit} className="space-y-6 animate-fade-in">
              <div>
                <h2 className="text-2xl font-serif font-bold text-ink">Choose your domain & intents</h2>
                <p className="text-sm text-muted mt-1">Select your primary domain, and declare what you want to teach or learn.</p>
              </div>

              {/* Primary Domain */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted">Primary Domain</label>
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
              </div>
              
              {/* Learning Goal */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted">Learning Goal</label>
                <input
                  required
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder="e.g. Master algorithms and build 3 full-stack applications"
                  className="w-full p-3.5 rounded-xl bg-card-alt border border-border text-ink text-sm outline-none focus:border-amber focus:ring-2 focus:ring-amber/20"
                />
              </div>

              {/* Teaching Intents */}
              <div className="space-y-2 p-4 rounded-xl border border-border bg-card-alt">
                <label className="text-xs font-semibold uppercase tracking-wider text-ok flex items-center gap-1.5">
                  🎓 Skills I want to TEACH
                </label>
                <p className="text-xs text-muted">Select topics you are confident in to help peers.</p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {SKILL_TAGS.map((tag) => {
                    const isSelected = teachingIntents.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => {
                          setTeachingIntents(prev =>
                            prev.includes(tag.id) ? prev.filter(t => t !== tag.id) : [...prev, tag.id]
                          );
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                          isSelected
                            ? 'border-ok bg-ok/15 text-ok ring-1 ring-ok'
                            : 'border-border bg-card text-muted hover:border-ok/50'
                        }`}
                      >
                        {tag.icon} {tag.label} {isSelected && '✓'}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Learning Intents */}
              <div className="space-y-2 p-4 rounded-xl border border-border bg-card-alt">
                <label className="text-xs font-semibold uppercase tracking-wider text-amber flex items-center gap-1.5">
                  🔍 Skills I want to LEARN
                </label>
                <p className="text-xs text-muted">Select topics you want to learn from the community.</p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {SKILL_TAGS.map((tag) => {
                    const isSelected = learningIntents.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => {
                          setLearningIntents(prev =>
                            prev.includes(tag.id) ? prev.filter(t => t !== tag.id) : [...prev, tag.id]
                          );
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                          isSelected
                            ? 'border-amber bg-amber/15 text-amber ring-1 ring-amber'
                            : 'border-border bg-card text-muted hover:border-amber/50'
                        }`}
                      >
                        {tag.icon} {tag.label} {isSelected && '✓'}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="py-3.5 px-5 rounded-xl border border-border text-xs font-semibold text-muted hover:text-ink cursor-pointer transition-all"
                >
                  ← Back
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3.5 bg-amber hover:bg-terracotta text-white font-bold rounded-xl text-sm transition-all shadow-sm cursor-pointer"
                >
                  Continue to Verifications →
                </button>
              </div>
            </form>
          )}

          {/* STEP 3: Verifications */}
          {step === 3 && currentDeclaration && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-serif font-bold text-ink">
                    Verify {currentDeclaration.skill}
                  </h2>
                  <p className="text-sm text-muted mt-1">
                    {currentDeclaration.intent === 'teach' 
                      ? "You declared you want to teach this. Let's verify your mastery."
                      : "You declared you want to learn this. Let's find your starting point."}
                  </p>
                </div>
                <div className="text-xs font-semibold text-muted">
                  {currentDeclarationIndex + 1} / {declarations.length}
                </div>
              </div>

              {proctoredInvalidatedMessage ? (
                <div className="p-5 rounded-xl bg-bad/10 border border-bad text-bad">
                  <h3 className="font-bold text-lg mb-2">Invalidated Attempt</h3>
                  <p className="text-sm">{proctoredInvalidatedMessage}</p>
                  <button 
                    onClick={advanceDeclaration}
                    className="mt-4 px-4 py-2 bg-bad text-white rounded-lg text-sm font-semibold cursor-pointer"
                  >
                    Continue to Next Skill
                  </button>
                </div>
              ) : currentDeclaration.intent === 'teach' ? (
                // TEACHING FLOW
                quizStarted ? (
                  <ProctoredQuiz
                    skill={currentDeclaration.skill}
                    level="advanced"
                    onComplete={handleProctoredComplete}
                    onCancel={() => {
                      setQuizStarted(false);
                      setShowConsentScreen(false);
                    }}
                  />
                ) : showConsentScreen ? (
                  <div className="space-y-5">
                    <h3 className="text-xl font-serif font-bold">Proctored Quiz Consent</h3>
                    <p className="text-sm text-muted">This is a strict exam. Ensure you are alone and visible.</p>
                    <div className="flex gap-3">
                      <button onClick={() => setShowConsentScreen(false)} className="px-4 py-2 border rounded-lg">Cancel</button>
                      <button onClick={() => setQuizStarted(true)} className="px-4 py-2 bg-amber text-white rounded-lg">I Agree, Start</button>
                    </div>
                  </div>
                ) : isChallengeMode ? (
                  <div className="space-y-4 p-5 border rounded-xl">
                    <h3 className="font-semibold text-lg">Teaching Challenge</h3>
                    {isChallengeLoading ? (
                      <p className="text-sm text-muted animate-pulse">Generating challenge...</p>
                    ) : challengeFeedback ? (
                      <div className="space-y-3">
                        <div className={`p-4 rounded-lg text-sm font-medium ${challengeFeedback.passed ? 'bg-ok/10 text-ok' : 'bg-bad/10 text-bad'}`}>
                          {challengeFeedback.passed ? `Verified as Level ${challengeFeedback.assignedLevel} Teacher!` : 'Not verified for teaching yet.'}
                        </div>
                        <p className="text-sm text-ink">{challengeFeedback.feedback}</p>
                        <button onClick={advanceDeclaration} className="px-4 py-2 bg-amber text-white rounded-lg">Next</button>
                      </div>
                    ) : (
                      <>
                        <div className="p-3 bg-card-alt rounded-lg text-sm italic">{challengePrompt}</div>
                        <textarea
                          value={challengeExplanation}
                          onChange={(e) => setChallengeExplanation(e.target.value)}
                          placeholder="Your explanation here..."
                          className="w-full h-32 p-3 border rounded-lg bg-card-alt text-sm"
                        />
                        <div className="flex gap-3">
                          <button onClick={() => setIsChallengeMode(false)} className="px-4 py-2 border rounded-lg">Cancel</button>
                          <button onClick={submitTeachingChallenge} disabled={isChallengeEvaluating} className="px-4 py-2 bg-amber text-white rounded-lg flex items-center gap-2">
                            {isChallengeEvaluating ? 'Evaluating...' : 'Submit Explanation'}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    <button onClick={() => setShowConsentScreen(true)} className="p-5 border rounded-xl hover:border-amber text-left">
                      <h4 className="font-bold text-ink">Take Proctored Quiz</h4>
                      <p className="text-xs text-muted">A standard multiple-choice assessment.</p>
                    </button>
                    <button onClick={() => startTeachingChallenge(currentDeclaration.skill)} className="p-5 border rounded-xl hover:border-amber text-left">
                      <h4 className="font-bold text-ink">Teaching Challenge</h4>
                      <p className="text-xs text-muted">Write an explanation to prove your teaching ability.</p>
                    </button>
                    <button onClick={advanceDeclaration} className="text-xs text-muted underline text-center mt-2 cursor-pointer">Skip for now</button>
                  </div>
                )
              ) : (
                // LEARNING FLOW
                diagnosticQuestions.length > 0 ? (
                  <div className="space-y-4 p-5 border rounded-xl bg-card-alt">
                    <h3 className="font-semibold text-sm text-amber">Placement Diagnostic</h3>
                    <div className="flex items-center gap-2 mb-2">
                       <span className="text-xs font-medium">{currentDiagnosticQuestion + 1} / {diagnosticQuestions.length}</span>
                    </div>
                    <p className="text-sm font-medium">{diagnosticQuestions[currentDiagnosticQuestion].question}</p>
                    <div className="space-y-2">
                      {diagnosticQuestions[currentDiagnosticQuestion].options.map((opt: string, idx: number) => (
                        <button
                          key={idx}
                          onClick={() => {
                            const newAns = [...diagnosticAnswers];
                            newAns[currentDiagnosticQuestion] = idx;
                            setDiagnosticAnswers(newAns);
                          }}
                          className={`w-full text-left p-3 rounded-lg border text-sm ${diagnosticAnswers[currentDiagnosticQuestion] === idx ? 'border-amber bg-amber/10 text-amber' : 'border-border hover:border-amber/50'}`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                    <div className="flex justify-between mt-4">
                      <button 
                        disabled={currentDiagnosticQuestion === 0}
                        onClick={() => setCurrentDiagnosticQuestion(p => p - 1)}
                        className="px-4 py-2 border rounded-lg text-sm disabled:opacity-50"
                      >
                        Prev
                      </button>
                      {currentDiagnosticQuestion < diagnosticQuestions.length - 1 ? (
                        <button 
                          onClick={() => setCurrentDiagnosticQuestion(p => p + 1)}
                          className="px-4 py-2 bg-amber text-white rounded-lg text-sm"
                        >
                          Next
                        </button>
                      ) : (
                        <button 
                          disabled={diagnosticAnswers.includes(-1) || isDiagnosticSubmitting}
                          onClick={submitDiagnostic}
                          className="px-4 py-2 bg-amber text-white rounded-lg text-sm disabled:opacity-50"
                        >
                          {isDiagnosticSubmitting ? 'Scoring...' : 'Submit Diagnostic'}
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    <button onClick={() => startDiagnostic(currentDeclaration.skill)} disabled={isDiagnosticLoading} className="p-5 border rounded-xl hover:border-amber text-left">
                      <h4 className="font-bold text-ink">{isDiagnosticLoading ? 'Loading Questions...' : 'Start Placement Diagnostic'}</h4>
                      <p className="text-xs text-muted">A gentle, unproctored quiz to find your level.</p>
                    </button>
                    <button onClick={advanceDeclaration} className="text-xs text-muted underline text-center mt-2 cursor-pointer">Skip for now (Assigns Level 0)</button>
                  </div>
                )
              )}
            </div>
          )}

          {/* STEP 4: Summary & Finish */}
          {step === 4 && (
            <form onSubmit={handleFinishOnboarding} className="space-y-6 animate-fade-in">
              <div>
                <h2 className="text-2xl font-serif font-bold text-ink">Your Learning Profile</h2>
                <p className="text-sm text-muted mt-1">Review your verified skills before launching your dashboard.</p>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {declarations.map((dec, i) => (
                  <div key={i} className="p-4 bg-card-alt rounded-2xl border border-border flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-ink flex items-center gap-2">
                        {dec.skill}
                        {dec.intent === 'teach' && dec.status === 'verified' && (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] text-white ${dec.verified_level >= 4 ? 'bg-ok' : 'bg-amber'}`}>
                            L{dec.verified_level} Teacher
                          </span>
                        )}
                        {dec.intent === 'learn' && (
                          <span className="px-2 py-0.5 rounded-full bg-border text-ink text-[10px]">
                            Level {dec.verified_level || 0}
                          </span>
                        )}
                      </span>
                      <span className="text-xs text-muted capitalize block mt-0.5">Intent: {dec.intent}</span>
                    </div>
                    {dec.quiz_score !== undefined && (
                      <span className="font-mono text-sm font-bold text-ink">{dec.quiz_score}%</span>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 py-4 bg-amber hover:bg-terracotta text-white font-bold rounded-xl text-sm transition-all shadow-md active:scale-[0.99] cursor-pointer"
                >
                  🚀 Generate Dashboard & Find Peer Matches →
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
