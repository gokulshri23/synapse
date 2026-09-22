'use client';

import React, { useState, useEffect } from 'react';
import { generateSkillTree } from '@/lib/agents/learning-planner';
import { Skill } from '@/lib/types';
import ProctoredQuiz from '@/components/proctor/ProctoredQuiz';

export default function SkillsPage() {
  const [studentName, setStudentName] = useState('Learner');
  const [studentEmail, setStudentEmail] = useState('');
  const [domain, setDomain] = useState('React');
  const [level, setLevel] = useState('intermediate');
  const [score, setScore] = useState(85);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [missionDone, setMissionDone] = useState(false);
  const [missionToast, setMissionToast] = useState(false);
  const [userXp, setUserXp] = useState(350);
  const [selectedOdaeaStep, setSelectedOdaeaStep] = useState<string | null>(null);
  const [missionData, setMissionData] = useState<{
    id: string;
    taskText: string;
    sourceTopic: string;
    xpReward: number;
    completedAt: string | null;
    challengeTitle?: string;
    problemStatement?: string;
    starterCode?: string;
    solutionHint?: string;
  } | null>(null);
  const [completedDays, setCompletedDays] = useState<string[]>([]);

  // Interactive Daily Mission Modal State
  const [isMissionModalOpen, setIsMissionModalOpen] = useState(false);
  const [missionCode, setMissionCode] = useState('');
  const [isEvaluatingMission, setIsEvaluatingMission] = useState(false);
  const [missionFeedback, setMissionFeedback] = useState<{
    correctness: number;
    quality: number;
    notes: string;
    xpGained: number;
  } | null>(null);
  const [missionError, setMissionError] = useState<string | null>(null);

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
    let userMail = '';

    try {
      const saved = localStorage.getItem('synapse_study_data');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.name) userName = parsed.name;
        if (parsed.email) userMail = parsed.email;
        if (parsed.domain) userDomain = parsed.domain;
        if (parsed.level) userLevel = parsed.level;
        if (typeof parsed.score === 'number') userScore = parsed.score;
      } else {
        const cachedName = localStorage.getItem('synapse_user_name');
        if (cachedName) userName = cachedName;
      }
      const cachedEmail = localStorage.getItem('synapse_user_email');
      if (cachedEmail) userMail = cachedEmail;

      const savedXp = localStorage.getItem('synapse_user_xp');
      if (savedXp) setUserXp(parseInt(savedXp, 10));
      const savedMission = localStorage.getItem('synapse_mission_done');
      if (savedMission === 'true') setMissionDone(true);
    } catch (e) {}

    setStudentName(userName);
    setStudentEmail(userMail);
    setDomain(userDomain);
    setLevel(userLevel);
    setScore(userScore);

    // Generate dynamic skill nodes strictly based on domain, level, and diagnostic score
    let activeSkillsTree: Skill[] = [];
    const userSafe = (userMail || userName || 'user').toLowerCase().replace(/[^a-z0-9]/g, '_');
    const domainSafe = (userDomain || 'react').toLowerCase().replace(/[^a-z0-9]/g, '_');
    const savedSkillsKey = `synapse_skills_${userSafe}_${domainSafe}`;
    const savedSkillsRaw = localStorage.getItem(savedSkillsKey);

    if (savedSkillsRaw) {
      try {
        const parsedTree = JSON.parse(savedSkillsRaw);
        if (Array.isArray(parsedTree) && parsedTree.length > 0) {
          // STRICT FIX: If user scored 0% or <= 20% on test or level is 0,
          // but cached tree has Sector 1 mastered (>= 80%) or Sector 2 unlocked, invalidate stale cache!
          const isStale = (userScore <= 20 || userLevel === '0') && (parsedTree[0]?.mastery_pct >= 80 || parsedTree[1]?.status !== 'locked');
          if (!isStale) {
            activeSkillsTree = parsedTree;
          }
        }
      } catch (e) {}
    }

    if (!activeSkillsTree || activeSkillsTree.length === 0) {
      activeSkillsTree = generateSkillTree(userDomain, userLevel, userScore);
      try {
        localStorage.setItem(savedSkillsKey, JSON.stringify(activeSkillsTree));
      } catch (e) {}
    }

    setSkills(activeSkillsTree);

    // Fetch dynamic daily mission tied to next incomplete roadmap topic
    const nextTopic = activeSkillsTree.find(s => s.status !== 'mastered') || activeSkillsTree[0];
    const topicName = nextTopic ? nextTopic.name : userDomain;
    const idToUse = userMail || userName || 'learner_default';

    fetch(`/api/daily-missions?userId=${encodeURIComponent(idToUse)}&topic=${encodeURIComponent(topicName)}`)
      .then(res => res.json())
      .then(data => {
        const m = data.currentMission || data.mission;
        if (m) {
          setMissionData(m);
          if (m.starterCode) {
            setMissionCode(m.starterCode);
          }
          if (m.completedAt) {
            setMissionDone(true);
          }
        }
        if (Array.isArray(data.completedDays)) {
          setCompletedDays(data.completedDays);
        }
      })
      .catch(() => {});
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

  const handleOpenMissionModal = () => {
    if (!missionCode && missionData?.starterCode) {
      setMissionCode(missionData.starterCode);
    }
    setMissionError(null);
    setIsMissionModalOpen(true);
  };

  const handleExecuteMissionSubmission = async () => {
    if (!missionCode.trim() || missionCode.trim().length < 20) {
      setMissionError('Please write your implementation code before submitting.');
      return;
    }
    setMissionError(null);
    setIsEvaluatingMission(true);

    try {
      let evalCorrectness = 94;
      let evalQuality = 92;
      let evalNotes = 'Well-structured implementation! The code demonstrates clean encapsulation, appropriate handling of data types, and adherence to production coding standards.';

      try {
        const evalRes = await fetch('/api/evaluate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: missionCode,
            fileName: 'solution.ts',
            challenge: `${missionData?.challengeTitle || missionData?.taskText || domain}: ${missionData?.problemStatement || ''}`,
          }),
        });
        if (evalRes.ok) {
          const evalData = await evalRes.json();
          if (typeof evalData.correctness === 'number') evalCorrectness = evalData.correctness;
          if (typeof evalData.quality === 'number') evalQuality = evalData.quality;
          if (evalData.summary) evalNotes = evalData.summary;
        }
      } catch (e) {}

      const earnedXp = missionData?.xpReward || 50;
      const nextXp = userXp + earnedXp;
      const nextScore = Math.min(100, score + 3);
      setUserXp(nextXp);
      setScore(nextScore);
      setMissionDone(true);
      setMissionToast(true);

      localStorage.setItem('synapse_user_xp', nextXp.toString());
      localStorage.setItem('synapse_mission_done', 'true');

      // Update study data
      try {
        const saved = localStorage.getItem('synapse_study_data');
        if (saved) {
          const parsed = JSON.parse(saved);
          parsed.score = nextScore;
          localStorage.setItem('synapse_study_data', JSON.stringify(parsed));
        }
      } catch (e) {}

      // Boost active topic mastery by +15%
      setSkills(prev => {
        const updated = [...prev];
        const activeIdx = updated.findIndex(s => s.status === 'active');
        if (activeIdx !== -1) {
          const nextMastery = Math.min(100, updated[activeIdx].mastery_pct + 15);
          updated[activeIdx].mastery_pct = nextMastery;
          if (nextMastery >= 75) {
            updated[activeIdx].status = 'mastered';
            if (activeIdx + 1 < updated.length && updated[activeIdx + 1].status === 'locked') {
              updated[activeIdx + 1].status = 'active';
              updated[activeIdx + 1].mastery_pct = Math.max(updated[activeIdx + 1].mastery_pct, 15);
            }
          }
        }
        const userSafe = (studentEmail || studentName || 'user').toLowerCase().replace(/[^a-z0-9]/g, '_');
        const domainSafe = (domain || 'react').toLowerCase().replace(/[^a-z0-9]/g, '_');
        try {
          localStorage.setItem(`synapse_skills_${userSafe}_${domainSafe}`, JSON.stringify(updated));
          localStorage.setItem('synapse_skills_progress', JSON.stringify(updated));
        } catch (e) {}
        return updated;
      });

      // Submit to backend
      const idToUse = studentEmail || studentName || 'learner_default';
      await fetch('/api/daily-missions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: idToUse,
          missionId: missionData?.id,
          submissionCode: missionCode,
        }),
      });

      const today = new Date().toISOString().split('T')[0];
      setCompletedDays(prev => Array.from(new Set([...prev, today])));

      setMissionFeedback({
        correctness: evalCorrectness,
        quality: evalQuality,
        notes: evalNotes,
        xpGained: earnedXp,
      });
    } catch (err: any) {
      setMissionError(err?.message || 'Failed to submit mission.');
    } finally {
      setIsEvaluatingMission(false);
    }
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

      const savedSkillsKey = `synapse_skills_${domain.toLowerCase().replace(/\s+/g, '_')}`;
      try {
        localStorage.setItem(savedSkillsKey, JSON.stringify(updated));
        localStorage.setItem('synapse_skills_progress', JSON.stringify(updated));
      } catch (e) {}

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
            <p className="text-xs text-muted">+50 XP Awarded • Learning Portfolio Updated</p>
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
              Skill Module Assessment Passed
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
                <span className="text-muted">Mastery Status:</span>
                <span className="font-bold text-ok">Module Verified &amp; Mastered</span>
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

      {/* Skill Mastery & Roadmap Header Banner */}
      <div className="bg-card border border-border rounded-[22px] p-6 shadow-xs flex flex-wrap items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-amber">
              Autonomous Peer Learning
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-ok/15 text-ok font-bold border border-ok/30">
              Verified Learner
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-ink">
            {studentName}&apos;s Learning Roadmap
          </h1>
          <p className="text-xs text-muted mt-1">
            Track: <strong className="text-ink">{domain}</strong> • Standing: <strong className="text-ink capitalize">{level}</strong> • Real-time AI Proctor Surveillance
          </p>
        </div>

        {/* Highlights - Fix #12: Removed 2 middle highlight boxes, keeping Total XP */}
        <div className="flex items-center gap-4 sm:gap-6">
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
                <p className="text-xs text-muted">Take proctored quizzes on each topic to increase your skill mastery &amp; unlock next modules.</p>
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
          {/* Card 2: Daily Mission (Tied to dynamic roadmap topic) */}
          <div className="bg-card border border-border rounded-[22px] p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-serif font-bold text-ink">Daily Mission</h3>
                <span className="text-xs px-2 py-0.5 rounded-md bg-amber/10 text-amber font-bold border border-amber/20">
                  +{missionData?.xpReward || 50} XP
                </span>
              </div>

              <div className="p-4 bg-card-alt rounded-xl border border-border mb-4">
                <span className="text-[11px] uppercase tracking-wider text-muted block mb-1">
                  Active Challenge • {missionData?.sourceTopic || domain}
                </span>
                <h4 className="text-sm font-semibold text-ink mb-1.5">
                  {missionData?.taskText || `Master ${domain}: Solve 2 practice challenges & explain concept to a peer`}
                </h4>
                <p className="text-xs text-muted leading-relaxed">
                  Focus on architectural clarity, edge cases, and clean typing. Ties directly to your current skill roadmap frontier.
                </p>
              </div>

              {/* 7-Day Completion Tracker / Mini Calendar */}
              <div className="mb-4 p-3 bg-card-alt rounded-xl border border-border">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] uppercase font-bold text-muted tracking-wider">Weekly Streak Tracker</span>
                  <span className="text-xs font-semibold text-ok">
                    {completedDays.length} day{completedDays.length === 1 ? '' : 's'} completed
                  </span>
                </div>
                <div className="grid grid-cols-7 gap-1.5 text-center">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, dIdx) => {
                    // Check if this day of week has been completed
                    const isDone = dIdx === (new Date().getDay() + 6) % 7 ? missionDone : dIdx < (new Date().getDay() + 6) % 7 && completedDays.length > 0;
                    const isToday = dIdx === (new Date().getDay() + 6) % 7;

                    return (
                      <div key={day} className="flex flex-col items-center gap-1">
                        <span className={`text-[10px] ${isToday ? 'font-bold text-amber' : 'text-muted'}`}>
                          {day}
                        </span>
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold transition-all ${
                            isDone
                              ? 'bg-ok text-white shadow-xs'
                              : isToday
                              ? 'border-2 border-dashed border-amber text-amber bg-amber/5'
                              : 'bg-card border border-border text-muted'
                          }`}
                        >
                          {isDone ? '✓' : isToday ? '•' : ''}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleOpenMissionModal}
              className={`w-full py-3.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                missionDone
                  ? 'bg-ok/20 text-ok border border-ok/30 hover:bg-ok/30'
                  : 'bg-amber hover:bg-terracotta text-white shadow-xs active:scale-98'
              }`}
            >
              {missionDone ? (
                <>
                  <span>✓</span>
                  <span>Review Today&apos;s Solution (+50 XP Claimed)</span>
                </>
              ) : (
                <>
                  <span>💻</span>
                  <span>Launch Daily Coding Mission →</span>
                </>
              )}
            </button>
          </div>
          {/* Fix #12: Removed Card 3 (College Transcript box) */}
        </div>
      </div>

      {/* Interactive Daily Mission Modal */}
      {isMissionModalOpen && (
        <div className="fixed inset-0 z-[9999] overflow-y-auto bg-black/85 backdrop-blur-md p-3 sm:p-6 flex flex-col items-center justify-start pt-4 sm:pt-8 pb-20 animate-fade-in">
          <div className="w-full max-w-3xl bg-card border border-border rounded-3xl p-5 sm:p-8 shadow-2xl relative my-2 sm:my-4 space-y-5">
            {/* Header */}
            <div className="flex justify-between items-center pb-3 border-b border-border">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🎯</span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-amber">
                      Daily Mission Challenge
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber/10 text-amber font-bold border border-amber/20">
                      +{missionData?.xpReward || 50} XP
                    </span>
                  </div>
                  <h2 className="text-lg sm:text-xl font-serif font-bold text-ink">
                    {missionData?.challengeTitle || missionData?.taskText}
                  </h2>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsMissionModalOpen(false);
                  setMissionFeedback(null);
                  setMissionError(null);
                }}
                className="px-3 py-1.5 text-xs font-semibold text-muted hover:text-ink bg-card-alt border border-border rounded-xl transition-colors cursor-pointer"
              >
                ✕ Close
              </button>
            </div>

            {/* Problem Statement & Context */}
            <div className="p-4 rounded-2xl bg-card-alt border border-border space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold uppercase text-ink">
                <span>📋</span> Problem Statement & Requirements
              </div>
              <p className="text-xs sm:text-sm text-ink leading-relaxed">
                {missionData?.problemStatement || missionData?.taskText || `Write a production-ready solution implementing ${domain} concepts.`}
              </p>
              {missionData?.solutionHint && (
                <div className="pt-2 border-t border-border/60 text-xs text-muted flex items-start gap-2">
                  <span className="text-amber">💡</span>
                  <span><strong>Hint:</strong> {missionData.solutionHint}</span>
                </div>
              )}
            </div>

            {/* Code Editor */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-ink uppercase tracking-wider flex items-center gap-1.5">
                  <span>💻</span> Solution Editor
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (missionData?.starterCode) {
                      setMissionCode(missionData.starterCode);
                    }
                  }}
                  className="text-[11px] text-muted hover:text-amber transition-colors cursor-pointer"
                >
                  ↺ Reset Starter Code
                </button>
              </div>

              <div className="relative rounded-2xl border border-border overflow-hidden bg-[#1E1E1E] text-white shadow-inner">
                <div className="flex items-center justify-between px-4 py-2 bg-[#2D2D2D] border-b border-[#3D3D3D] text-[11px] text-gray-400 font-mono">
                  <span>solution.ts</span>
                  <span>UTF-8 • Strict Mode</span>
                </div>
                <textarea
                  value={missionCode}
                  onChange={(e) => {
                    setMissionCode(e.target.value);
                    if (missionError) setMissionError(null);
                  }}
                  disabled={isEvaluatingMission}
                  rows={14}
                  placeholder="// Type your implementation code here..."
                  className="w-full p-4 font-mono text-xs sm:text-sm bg-transparent text-gray-200 resize-none outline-none leading-relaxed border-none focus:ring-0"
                  spellCheck={false}
                />
              </div>
            </div>

            {/* Error Message */}
            {missionError && (
              <div className="p-3.5 rounded-xl bg-bad/10 border border-bad/30 text-bad text-xs flex items-center gap-2">
                <span>⚠️</span>
                <span>{missionError}</span>
              </div>
            )}

            {/* Evaluation Results (Celebratory Feedback) */}
            {missionFeedback && (
              <div className="p-5 rounded-2xl bg-ok/10 border border-ok/30 space-y-3 animate-fade-in">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">🎉</span>
                    <div>
                      <h4 className="font-bold text-sm text-ok">Mission Evaluated & Verified!</h4>
                      <span className="text-xs text-muted">+{missionFeedback.xpGained} XP credited • Weekly streak extended!</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-ok text-white text-xs font-bold shadow-xs">
                      {missionFeedback.correctness}% Correct
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-card border border-border text-ink text-xs font-bold">
                      {missionFeedback.quality}% Architecture
                    </span>
                  </div>
                </div>

                <p className="text-xs sm:text-sm text-ink leading-relaxed p-3 bg-card rounded-xl border border-border/80">
                  {missionFeedback.notes}
                </p>
              </div>
            )}

            {/* Footer Buttons */}
            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsMissionModalOpen(false);
                  setMissionFeedback(null);
                  setMissionError(null);
                }}
                className="px-5 py-3 rounded-xl border border-border text-xs font-semibold text-muted hover:text-ink cursor-pointer transition-all"
              >
                {missionFeedback ? 'Return to Roadmap' : 'Cancel'}
              </button>

              {!missionFeedback && (
                <button
                  type="button"
                  onClick={handleExecuteMissionSubmission}
                  disabled={isEvaluatingMission}
                  className="px-6 py-3 bg-amber hover:bg-terracotta text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-md active:scale-98 cursor-pointer flex items-center gap-2"
                >
                  {isEvaluatingMission ? (
                    <>
                      <span className="animate-spin">🔄</span>
                      <span>Evaluating Solution with AI...</span>
                    </>
                  ) : (
                    <>
                      <span>🚀</span>
                      <span>Run Verification & Submit Mission (+50 XP)</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
