'use client';

import React, { useState, useEffect } from 'react';
import { generateSkillTree } from '@/lib/agents/learning-planner';
import { Skill } from '@/lib/types';
import ProctoredQuiz from '@/components/proctor/ProctoredQuiz';

export default function SkillsPage() {
  const [studentName, setStudentName] = useState('Learner');
  const [domain, setDomain] = useState('React');
  const [level, setLevel] = useState('intermediate');
  const [score, setScore] = useState(85);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [missionDone, setMissionDone] = useState(false);
  const [missionToast, setMissionToast] = useState(false);
  const [userXp, setUserXp] = useState(350);
  const [selectedOdaeaStep, setSelectedOdaeaStep] = useState<string | null>(null);

  // College-style Skill Test Modal State
  const [activeTestSkill, setActiveTestSkill] = useState<string | null>(null);
  const [showTestSuccessModal, setShowTestSuccessModal] = useState<{
    skill: string;
    score: number;
    xpGained: number;
    oldGrade: string;
    newGrade: string;
  } | null>(null);

  useEffect(() => {
    // Read tailored onboarding study data
    let userDomain = 'React';
    let userLevel = 'intermediate';
    let userScore = 85;
    let userName = 'Learner';

    try {
      const saved = localStorage.getItem('synapse_study_data');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.name) userName = parsed.name;
        if (parsed.domain) userDomain = parsed.domain;
        if (parsed.level) userLevel = parsed.level;
        if (typeof parsed.score === 'number') userScore = parsed.score;
      } else {
        const cachedName = localStorage.getItem('synapse_user_name');
        if (cachedName) userName = cachedName;
      }
      const savedXp = localStorage.getItem('synapse_user_xp');
      if (savedXp) setUserXp(parseInt(savedXp, 10));
      const savedMission = localStorage.getItem('synapse_mission_done');
      if (savedMission === 'true') setMissionDone(true);
    } catch (e) {}

    setStudentName(userName);
    setDomain(userDomain);
    setLevel(userLevel);
    setScore(userScore);

    // Generate dynamic skill nodes based on domain and assessed score
    const baseTree = generateSkillTree(userDomain, userLevel);
    const customized = baseTree.map((s, idx) => {
      if (userScore >= 80) {
        if (idx === 0) return { ...s, status: 'mastered' as const, mastery_pct: 100 };
        if (idx === 1) return { ...s, status: 'mastered' as const, mastery_pct: 88 };
        if (idx === 2) return { ...s, status: 'active' as const, mastery_pct: 60 };
        return { ...s, status: 'locked' as const, mastery_pct: 0 };
      } else if (userScore >= 50) {
        if (idx === 0) return { ...s, status: 'mastered' as const, mastery_pct: 85 };
        if (idx === 1) return { ...s, status: 'active' as const, mastery_pct: 45 };
        return { ...s, status: 'locked' as const, mastery_pct: 0 };
      } else {
        if (idx === 0) return { ...s, status: 'active' as const, mastery_pct: 30 };
        return { ...s, status: 'locked' as const, mastery_pct: 0 };
      }
    });

    setSkills(customized);
  }, []);

  // Compute College Grade & GPA
  const computeCollegeGrade = (pct: number) => {
    if (pct >= 90) return { letter: 'A+', gpa: '4.0 / 4.0', label: 'Summa Cum Laude' };
    if (pct >= 80) return { letter: 'A', gpa: '3.8 / 4.0', label: 'Magna Cum Laude' };
    if (pct >= 70) return { letter: 'B+', gpa: '3.3 / 4.0', label: 'Dean’s Honors' };
    if (pct >= 60) return { letter: 'B', gpa: '3.0 / 4.0', label: 'Satisfactory' };
    return { letter: 'C', gpa: '2.5 / 4.0', label: 'Passing' };
  };

  const avgMastery = skills.length > 0
    ? Math.round(skills.reduce((acc, curr) => acc + curr.mastery_pct, 0) / skills.length)
    : 45;

  const currentCollegeGrade = computeCollegeGrade(avgMastery);

  const handleCompleteMission = () => {
    if (missionDone) return;
    const nextXp = userXp + 50;
    const nextScore = Math.min(100, score + 3);
    setUserXp(nextXp);
    setScore(nextScore);
    setMissionDone(true);
    setMissionToast(true);

    localStorage.setItem('synapse_user_xp', nextXp.toString());
    localStorage.setItem('synapse_mission_done', 'true');

    try {
      const saved = localStorage.getItem('synapse_study_data');
      if (saved) {
        const parsed = JSON.parse(saved);
        parsed.score = nextScore;
        localStorage.setItem('synapse_study_data', JSON.stringify(parsed));
      }
    } catch (e) {}

    setTimeout(() => setMissionToast(false), 3500);
  };

  // Handle Completing a Proctored Skill Quiz Test
  const handleSkillTestComplete = (result: {
    score: number;
    skill: string;
    level: string;
    violationsCount: number;
    passed: boolean;
  }) => {
    const oldGrade = currentCollegeGrade.letter;
    const earnedXp = 100;
    const nextXp = userXp + earnedXp;
    setUserXp(nextXp);
    localStorage.setItem('synapse_user_xp', nextXp.toString());

    // Update Skill Tree Mastery
    let nextAvgMastery = avgMastery;
    setSkills(prev => {
      const updated = prev.map((s, idx) => {
        if (s.name === result.skill || idx === prev.findIndex(item => item.name === result.skill)) {
          const newMastery = Math.max(s.mastery_pct, result.score);
          return {
            ...s,
            mastery_pct: newMastery,
            status: newMastery >= 75 ? ('mastered' as const) : ('active' as const)
          };
        }
        return s;
      });

      // Unlock next locked skill if current is mastered
      const masteredIndex = updated.findIndex(item => item.name === result.skill);
      if (masteredIndex !== -1 && masteredIndex + 1 < updated.length && updated[masteredIndex].status === 'mastered') {
        if (updated[masteredIndex + 1].status === 'locked') {
          updated[masteredIndex + 1].status = 'active';
          updated[masteredIndex + 1].mastery_pct = Math.max(updated[masteredIndex + 1].mastery_pct, 25);
        }
      }

      nextAvgMastery = Math.round(updated.reduce((acc, curr) => acc + curr.mastery_pct, 0) / updated.length);
      return updated;
    });

    const newScore = Math.min(100, Math.round((score * 0.5) + (result.score * 0.5)));
    setScore(newScore);

    // Persist updated study data
    try {
      const saved = localStorage.getItem('synapse_study_data');
      if (saved) {
        const parsed = JSON.parse(saved);
        parsed.score = newScore;
        localStorage.setItem('synapse_study_data', JSON.stringify(parsed));
      }
    } catch (e) {}

    const newGrade = computeCollegeGrade(nextAvgMastery).letter;

    // Show celebratory modal
    setShowTestSuccessModal({
      skill: result.skill,
      score: result.score,
      xpGained: earnedXp,
      oldGrade,
      newGrade
    });

    setActiveTestSkill(null);
  };

  const odaeaDetails: Record<string, { title: string; icon: string; desc: string }> = {
    Observe: {
      title: '1. Observe Phase',
      icon: '👁️',
      desc: 'Real-time observation logs assessment quiz metrics, code artifacts, and study session interactions to model your skill frontier.'
    },
    Decide: {
      title: '2. Decide Phase',
      icon: '🧠',
      desc: 'The Learning Planner compares your mastery against the prerequisite DAG to select the highest-leverage next challenge.'
    },
    Act: {
      title: '3. Act Phase',
      icon: '⚡',
      desc: 'Daily missions, peer code pairing, and targeted micro-challenges are activated to build deliberate practice habits.'
    },
    Evaluate: {
      title: '4. Evaluate Phase',
      icon: '🤖',
      desc: 'Gemini 3.6 Flash reviews your submitted artifacts for logic correctness, architectural quality, and actionable improvements.'
    },
    Adapt: {
      title: '5. Adapt Phase',
      icon: '🔄',
      desc: 'Autonomous threshold rules trigger acceleration for fast mastery or insert targeted review modules when plateaus occur.'
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-8 relative">
      {/* Toast Notification for Completed Mission */}
      {missionToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] max-w-md w-[90%] bg-card border border-ok text-ink p-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-slide-down pointer-events-none">
          <span className="text-2xl shrink-0">🎉</span>
          <div>
            <p className="text-sm font-bold">Daily Mission Completed!</p>
            <p className="text-xs text-muted">+50 XP Awarded • College Transcript Updated</p>
          </div>
        </div>
      )}

      {/* Test Success Celebratory Modal */}
      {showTestSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md bg-card border-2 border-ok rounded-3xl p-7 shadow-2xl text-center flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-ok/20 text-ok border-2 border-ok flex items-center justify-center text-3xl mb-4 animate-bounce">
              🎓
            </div>
            <span className="text-xs uppercase font-bold text-ok tracking-wider">
              College Skill Test Passed
            </span>
            <h3 className="text-2xl font-serif font-bold text-ink mt-1">
              Score: {showTestSuccessModal.score}%
            </h3>
            <p className="text-xs text-muted mt-1 mb-4">
              Module: <strong>{showTestSuccessModal.skill}</strong>
            </p>

            <div className="w-full bg-card-alt p-4 rounded-2xl border border-border text-xs space-y-2.5 mb-5 text-left">
              <div className="flex justify-between items-center">
                <span className="text-muted">Reputation XP Earned:</span>
                <span className="font-bold text-amber">+{showTestSuccessModal.xpGained} XP</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted">College Letter Grade:</span>
                <span className="font-bold text-ink">
                  {showTestSuccessModal.oldGrade} → <span className="text-ok font-extrabold">{showTestSuccessModal.newGrade}</span>
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted">Proctor Status:</span>
                <span className="font-semibold text-ok">Verified by AI Vision</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowTestSuccessModal(null)}
              className="w-full py-3 px-6 bg-amber hover:bg-terracotta text-white font-bold rounded-xl text-sm transition-all shadow-sm cursor-pointer"
            >
              Back to Roadmap &amp; Next Challenge →
            </button>
          </div>
        </div>
      )}

      {/* Proctored Quiz Modal Overlay — Highest z-index, properly padded from top to never clip behind navbar */}
      {activeTestSkill && (
        <div className="fixed inset-0 z-[9999] overflow-y-auto bg-black/85 backdrop-blur-md p-3 sm:p-6 flex flex-col items-center justify-start pt-4 sm:pt-8 pb-20 animate-fade-in">
          <div className="w-full max-w-3xl bg-card border border-border rounded-3xl p-4 sm:p-8 shadow-2xl relative my-2 sm:my-4">
            {/* Top Close / Dismiss bar */}
            <div className="flex justify-between items-center pb-3 mb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-ok animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-wider text-ink">
                  Proctored Examination Room • {activeTestSkill}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveTestSkill(null)}
                className="px-3 py-1 text-xs font-semibold text-muted hover:text-bad bg-card-alt border border-border rounded-lg transition-colors cursor-pointer"
              >
                ✕ Close Exam
              </button>
            </div>
            <ProctoredQuiz
              skill={activeTestSkill}
              level={level}
              onComplete={handleSkillTestComplete}
              onCancel={() => setActiveTestSkill(null)}
            />
          </div>
        </div>
      )}

      {/* College Academic Transcript Header Banner */}
      <div className="bg-card border border-border rounded-[22px] p-6 shadow-xs flex flex-wrap items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-amber">
              College of Engineering &amp; Computing
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-ok/15 text-ok font-bold border border-ok/30">
              Verified Student
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-ink">
            {studentName}&apos;s Academic Transcript
          </h1>
          <p className="text-xs text-muted mt-1">
            Track: <strong className="text-ink">{domain}</strong> • Standing: <strong className="text-ink">{level}</strong> • Real-time AI Proctor Surveillance
          </p>
        </div>

        {/* Grade Highlights */}
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="text-center p-3 bg-card-alt border border-border rounded-2xl min-w-[90px]">
            <span className="text-[10px] uppercase font-bold text-muted block">Semester Grade</span>
            <span className="text-2xl font-serif font-bold text-ok">{currentCollegeGrade.letter}</span>
            <span className="text-[9px] text-muted block">{currentCollegeGrade.label}</span>
          </div>

          <div className="text-center p-3 bg-card-alt border border-border rounded-2xl min-w-[90px]">
            <span className="text-[10px] uppercase font-bold text-muted block">GPA Equivalent</span>
            <span className="text-2xl font-serif font-bold text-ink">{currentCollegeGrade.gpa.split(' ')[0]}</span>
            <span className="text-[9px] text-muted block">Scale 4.0</span>
          </div>

          <div className="text-center p-3 bg-card-alt border border-border rounded-2xl min-w-[90px]">
            <span className="text-[10px] uppercase font-bold text-muted block">Total XP</span>
            <span className="text-2xl font-serif font-bold text-amber">{userXp}</span>
            <span className="text-[9px] text-muted block">Reputation</span>
          </div>
        </div>
      </div>

      {/* Main Bento Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Card 1: Skill Roadmap (2 Cols) */}
        <div className="lg:col-span-2 bg-card border border-border rounded-[22px] p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div>
                <h2 className="text-xl font-serif font-bold text-ink">Skill Mastery Roadmap</h2>
                <p className="text-xs text-muted">Take proctored quizzes on each topic to increase your grade &amp; unlock next modules.</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTestSkill(domain)}
                className="px-3.5 py-1.5 bg-amber hover:bg-terracotta text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
              >
                <span>📝</span>
                <span>Take General {domain} Test</span>
              </button>
            </div>

            {/* ODAEA Loop Badges */}
            <div className="flex flex-wrap gap-2 mb-6 pb-4 border-b border-border">
              {['Observe', 'Decide', 'Act', 'Evaluate', 'Adapt'].map((step, idx) => (
                <button
                  key={step}
                  type="button"
                  onClick={() => setSelectedOdaeaStep(selectedOdaeaStep === step ? null : step)}
                  className={`text-xs px-3 py-1 rounded-full font-semibold border transition-all cursor-pointer ${
                    selectedOdaeaStep === step
                      ? 'bg-amber text-white border-amber shadow-xs scale-105'
                      : 'bg-card-alt text-muted border-border hover:border-amber hover:text-ink'
                  }`}
                >
                  {idx + 1}. {step}
                </button>
              ))}
            </div>

            {/* Interactive ODAEA Step Modal Card */}
            {selectedOdaeaStep && odaeaDetails[selectedOdaeaStep] && (
              <div className="mb-6 p-4 rounded-2xl bg-card-alt border border-amber/30 animate-fade-in shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 font-semibold text-ink text-sm">
                    <span className="text-lg">{odaeaDetails[selectedOdaeaStep].icon}</span>
                    <span>{odaeaDetails[selectedOdaeaStep].title}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedOdaeaStep(null)}
                    className="text-xs text-muted hover:text-ink cursor-pointer"
                  >
                    ✕ Close
                  </button>
                </div>
                <p className="text-xs text-muted leading-relaxed">
                  {odaeaDetails[selectedOdaeaStep].desc}
                </p>
              </div>
            )}

            {/* Vertical Skill Nodes Timeline */}
            <div className="space-y-4">
              {skills.map((node, idx) => {
                const isMastered = node.status === 'mastered';
                const isActive = node.status === 'active';

                return (
                  <div key={node.id || idx} className="flex gap-4 items-start">
                    {/* Circle Node Icon */}
                    <div className="flex flex-col items-center pt-1">
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs transition-all shadow-xs ${
                          isMastered
                            ? 'bg-ok text-white ring-4 ring-ok/20'
                            : isActive
                            ? 'bg-amber text-white ring-4 ring-amber/20'
                            : 'bg-card-alt border border-border text-muted'
                        }`}
                      >
                        {isMastered ? '✓' : idx + 1}
                      </div>
                      {idx < skills.length - 1 && (
                        <div className="w-0.5 h-16 bg-border my-1" />
                      )}
                    </div>

                    {/* Skill Details Card with Action */}
                    <div
                      className={`flex-1 p-4 sm:p-5 rounded-2xl border transition-all ${
                        isMastered
                          ? 'border-ok/40 bg-ok/5'
                          : isActive
                          ? 'border-amber bg-card-alt shadow-xs ring-1 ring-amber/20'
                          : 'border-border bg-card-alt/60 opacity-60'
                      }`}
                    >
                      <div className="flex flex-wrap justify-between items-start gap-2 mb-1.5">
                        <div>
                          <span className="text-[10px] font-mono uppercase text-muted block mb-0.5">
                            Module {idx + 1} • Level {node.level}
                          </span>
                          <h3 className="text-base font-semibold text-ink">{node.name}</h3>
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                              isMastered
                                ? 'bg-ok/20 text-ok border border-ok/30'
                                : isActive
                                ? 'bg-amber/20 text-amber border border-amber/30'
                                : 'bg-muted/20 text-muted'
                            }`}
                          >
                            {node.status}
                          </span>

                          {(isActive || isMastered) && (
                            <button
                              type="button"
                              onClick={() => setActiveTestSkill(node.name)}
                              className="px-2.5 py-1 bg-amber hover:bg-terracotta text-white font-bold text-[11px] rounded-lg shadow-xs transition-all cursor-pointer flex items-center gap-1"
                            >
                              <span>📝</span>
                              <span>{isMastered ? 'Retake' : 'Take Test'}</span>
                            </button>
                          )}
                        </div>
                      </div>

                      <p className="text-xs text-muted leading-relaxed mb-3">{node.description}</p>

                      {/* Progress Bar */}
                      <div className="flex items-center gap-3">
                        <div className="h-2 flex-1 bg-border rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ${
                              isMastered ? 'bg-ok' : 'bg-amber'
                            }`}
                            style={{ width: `${node.mastery_pct}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-ink shrink-0">
                          {node.mastery_pct}%
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Mission & Metrics (1 Col) */}
        <div className="space-y-6">
          {/* Card 2: Daily Mission */}
          <div className="bg-card border border-border rounded-[22px] p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-serif font-bold text-ink">Daily Mission</h3>
                <span className="text-xs px-2 py-0.5 rounded-md bg-amber/10 text-amber font-bold border border-amber/20">
                  +50 XP
                </span>
              </div>

              <div className="p-4 bg-card-alt rounded-xl border border-border mb-4">
                <span className="text-[11px] uppercase tracking-wider text-muted block mb-1">
                  Active Challenge • {domain}
                </span>
                <h4 className="text-sm font-semibold text-ink mb-1.5">
                  {domain === 'Python' ? 'Refactor OOP Class with Generics' :
                   domain === 'Machine Learning' ? 'Implement Loss Function & Backprop' :
                   domain === 'Data Structures' ? 'Optimize Tree Traversal Complexity' :
                   domain === 'JavaScript' ? 'Create Debounced Event Listener' :
                   'Build Custom useLocalStorage Hook'}
                </h4>
                <p className="text-xs text-muted leading-relaxed">
                  Focus on architectural clarity, error edge cases, and clean typing. Submit your artifact or discuss with a matched peer.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCompleteMission}
              disabled={missionDone}
              className={`w-full py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                missionDone
                  ? 'bg-ok/20 text-ok border border-ok/30 cursor-default'
                  : 'bg-amber hover:bg-terracotta text-white shadow-xs active:scale-98'
              }`}
            >
              {missionDone ? (
                <>
                  <span>✓</span>
                  <span>Mission Completed (+50 XP Earned)</span>
                </>
              ) : (
                <>
                  <span>🎯</span>
                  <span>Complete Today&apos;s Mission</span>
                </>
              )}
            </button>
          </div>

          {/* Card 3: Overall College Mastery */}
          <div className="bg-card border border-border rounded-[22px] p-6 shadow-xs">
            <h3 className="text-lg font-serif font-bold text-ink mb-4">College Transcript</h3>
            <div className="flex items-center justify-center my-3">
              <div className="relative w-28 h-28 rounded-full border-4 border-amber/20 flex flex-col items-center justify-center text-center shadow-xs">
                <div
                  className="absolute inset-0 rounded-full border-4 border-amber transition-all duration-1000"
                  style={{
                    clipPath: `polygon(0 0, 100% 0, 100% ${avgMastery}%, 0 ${avgMastery}%)`
                  }}
                />
                <span className="text-2xl font-serif font-bold text-ink">{avgMastery}%</span>
                <span className="text-[10px] uppercase font-semibold text-muted tracking-wider">Overall</span>
              </div>
            </div>

            <div className="space-y-2 text-xs pt-2">
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted">Academic Grade:</span>
                <span className="font-bold text-ok">{currentCollegeGrade.letter} ({currentCollegeGrade.label})</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted">GPA Equivalent:</span>
                <span className="font-semibold text-ink">{currentCollegeGrade.gpa}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted">Domain Track:</span>
                <span className="font-semibold text-ink">{domain}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted">Assessed Level:</span>
                <span className="font-semibold text-ink capitalize">{level}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted">Total Reputation:</span>
                <span className="font-bold text-amber">{userXp} XP</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
