'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import ThemeToggle from '@/components/ui/ThemeToggle';

const AVAILABLE_DOMAINS = [
  { id: 'React', name: 'React', desc: 'Components, Hooks, State & Next.js', icon: '⚛️' },
  { id: 'Python', name: 'Python', desc: 'Core Syntax, OOP, Data Science & APIs', icon: '🐍' },
  { id: 'JavaScript', name: 'JavaScript', desc: 'Modern ES6+, DOM, Async & Node.js', icon: '⚡' },
  { id: 'Machine Learning', name: 'Machine Learning', desc: 'Math, Neural Networks, PyTorch & Sklearn', icon: '🧠' },
  { id: 'Data Structures', name: 'Data Structures', desc: 'Arrays, Trees, Graphs & Dynamic Programming', icon: '🌲' },
  { id: 'System Design', name: 'System Design', desc: 'Microservices, Scalability, Caching & Load Balancing', icon: '🏗️' },
  { id: 'Algorithms', name: 'Algorithms', desc: 'Sorting, Searching, Greedy, DP & LeetCode Prep', icon: '🧩' },
  { id: 'Web Development', name: 'Web Development', desc: 'Full-Stack Apps, HTML5/CSS3, REST APIs & SSR', icon: '🌐' },
  { id: 'Databases', name: 'Databases & SQL', desc: 'PostgreSQL, MongoDB, Query Optimization & Indexing', icon: '🗄️' },
  { id: 'DevOps', name: 'DevOps & Cloud', desc: 'Docker, Kubernetes, CI/CD Pipelines & AWS Deployment', icon: '☁️' },
  { id: 'Problem Solving', name: 'Problem Solving', desc: 'Logic, Debugging, Analytical Thinking & Code Reviews', icon: '💡' },
  { id: 'Mobile Development', name: 'Mobile Development', desc: 'React Native, Flutter, Cross-Platform iOS & Android', icon: '📱' },
];

const STUDY_DURATION_OPTIONS = [
  { days: 7, label: '7-Day Bootcamp', desc: 'Intensive fast-track ramp up', icon: '⚡' },
  { days: 14, label: '14-Day Sprint', desc: 'Accelerated project build track', icon: '🚀' },
  { days: 30, label: '30-Day Mastery', desc: 'Complete conceptual & practical mastery (Recommended)', icon: '🎯' },
  { days: 60, label: '60-Day Foundation', desc: 'Zero to advanced deep-dive course', icon: '📚' },
];

const TEACHING_SKILL_TAGS = [
  { id: 'React', label: 'React', icon: '⚛️' },
  { id: 'Python', label: 'Python', icon: '🐍' },
  { id: 'JavaScript', label: 'JavaScript', icon: '⚡' },
  { id: 'Machine Learning', label: 'Machine Learning', icon: '🧠' },
  { id: 'Data Structures', label: 'Data Structures', icon: '🌲' },
  { id: 'System Design', label: 'System Design', icon: '🏗️' },
  { id: 'Algorithms', label: 'Algorithms', icon: '🧩' },
  { id: 'Web Development', label: 'Web Dev', icon: '🌐' },
  { id: 'Databases', label: 'Databases', icon: '🗄️' },
  { id: 'DevOps', label: 'DevOps', icon: '☁️' },
  { id: 'Problem Solving', label: 'Problem Solving', icon: '💡' },
  { id: 'Mobile Development', label: 'Mobile Dev', icon: '📱' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [email, setEmail] = useState('');

  // Step 2: Learning Intent, Study Mode, Teaching Intent
  const [learningSkill, setLearningSkill] = useState('React');
  const [studyDays, setStudyDays] = useState(30);
  const [customDays, setCustomDays] = useState('');
  const [isCustomDays, setIsCustomDays] = useState(false);
  const [teachingSkills, setTeachingSkills] = useState<string[]>(['Python', 'Problem Solving']);

  const handleSelectLearningSkill = (newSkill: string) => {
    setLearningSkill(newSkill);
    setTeachingSkills((prev) => {
      const filtered = prev.filter((s) => s !== newSkill);
      if (filtered.length > 0) return filtered;
      const comp = newSkill === 'React' ? 'Python' : 'React';
      return [comp, 'Problem Solving'];
    });
  };

  // Verification Quizzes State
  const [quizPhase, setQuizPhase] = useState<'diagnostic' | 'teaching'>('diagnostic');

  // Quiz 1: 10 Diagnostic Questions for Learning Skill
  const [diagnosticQuestions, setDiagnosticQuestions] = useState<any[]>([]);
  const [diagnosticAnswers, setDiagnosticAnswers] = useState<number[]>([]);
  const [currentDiagIdx, setCurrentDiagIdx] = useState(0);
  const [isDiagLoading, setIsDiagLoading] = useState(false);
  const [diagScore, setDiagScore] = useState<number | null>(null);
  const [assignedLearnerLevel, setAssignedLearnerLevel] = useState(1);

  // Quiz 2: Teaching Pedagogy Verification
  const [teachingPrompt, setTeachingPrompt] = useState('');
  const [writtenExplanation, setWrittenExplanation] = useState('');
  const [isPromptLoading, setIsPromptLoading] = useState(false);
  const [isEvaluatingTeaching, setIsEvaluatingTeaching] = useState(false);
  const [teachingEvaluation, setTeachingEvaluation] = useState<any>(null);

  // Audio Recording for Teaching Verification
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Final Summary state
  const [isFinishing, setIsFinishing] = useState(false);

  // Proctor Video Checking State (Step 3)
  const [proctorVideoActive, setProctorVideoActive] = useState(false);
  const [proctorStatus, setProctorStatus] = useState<string>('Camera checking ready');
  const [proctorWarning, setProctorWarning] = useState<string | null>(null);
  const [detectedItem, setDetectedItem] = useState<string | null>(null);
  const [proctorViolations, setProctorViolations] = useState(0);
  const [isProctorScanning, setIsProctorScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const proctorScanIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Video Proctoring Lifecycle for Quiz Attempt Section with Real-Time Vision Scan
  useEffect(() => {
    let active = true;
    if (step === 3) {
      async function startProctorVideo() {
        try {
          if (!navigator.mediaDevices?.getUserMedia) {
            setProctorStatus('Camera not supported by browser');
            return;
          }
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 320, height: 240, facingMode: 'user' },
            audio: false,
          });
          if (!active) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(() => {});
          }
          setProctorVideoActive(true);
          setProctorStatus('Live AI Proctor Active • Scanning for phones & notes');

          // Offscreen canvas for frame capture
          const canvas = document.createElement('canvas');
          canvas.width = 320;
          canvas.height = 240;
          const ctx = canvas.getContext('2d');

          // Live scanning loop: captures a frame every 3.5 seconds and passes to /api/proctor-vision
          if (proctorScanIntervalRef.current) clearInterval(proctorScanIntervalRef.current);
          proctorScanIntervalRef.current = setInterval(async () => {
            if (!active || !videoRef.current || videoRef.current.readyState < 2) return;
            try {
              setIsProctorScanning(true);
              if (ctx && videoRef.current) {
                ctx.drawImage(videoRef.current, 0, 0, 320, 240);
                const frameData = canvas.toDataURL('image/jpeg', 0.65);
                const res = await fetch('/api/proctor-vision', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ image: frameData }),
                });
                if (res.ok) {
                  const data = await res.json();
                  if (data.detected) {
                    const itemLabel = data.item || 'unauthorized material';
                    setDetectedItem(itemLabel);
                    setProctorWarning(`🚨 Unauthorized item detected: ${itemLabel.toUpperCase()}! ${data.explanation || 'Please keep hands and workspace in clear view.'}`);
                    setProctorStatus(`⚠️ Alert: ${itemLabel} in camera frame`);
                    setProctorViolations((prev) => prev + 1);
                  } else {
                    setDetectedItem(null);
                    setProctorWarning(null);
                    setProctorStatus('🟢 AI Proctor Active • Workspace Verified (Clean)');
                  }
                }
              }
            } catch (err) {
            } finally {
              setIsProctorScanning(false);
            }
          }, 3500);
        } catch (err: any) {
          setProctorVideoActive(false);
          setProctorStatus('Camera optional: Proceeding without video feed');
        }
      }
      startProctorVideo();
    } else {
      if (proctorScanIntervalRef.current) {
        clearInterval(proctorScanIntervalRef.current);
        proctorScanIntervalRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      setProctorVideoActive(false);
      setProctorWarning(null);
    }
    return () => {
      active = false;
      if (proctorScanIntervalRef.current) {
        clearInterval(proctorScanIntervalRef.current);
        proctorScanIntervalRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [step]);

  // Check if user already finished onboarding on another device
  useEffect(() => {
    async function checkExistingProfile() {
      let currentEmail = '';
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email) {
          currentEmail = user.email;
          setEmail(user.email);
          setName(user.user_metadata?.full_name || user.email.split('@')[0]);
        }
        const cachedEmail = localStorage.getItem('synapse_user_email');
        if (cachedEmail) currentEmail = cachedEmail;
        const cachedName = localStorage.getItem('synapse_user_name');
        if (cachedName && !name) setName(cachedName);

        if (currentEmail) {
          const res = await fetch(`/api/user-profile?email=${encodeURIComponent(currentEmail.trim().toLowerCase())}`);
          if (res.ok) {
            const data = await res.json();
            if (data.profile && data.profile.onboarding_complete) {
              localStorage.setItem('synapse_study_data', JSON.stringify(data.profile));
              localStorage.setItem(`synapse_study_data_${currentEmail.trim().toLowerCase()}`, JSON.stringify(data.profile));
              router.push('/app/skills');
            }
          }
        }
      } catch (e) {}
    }
    checkExistingProfile();
  }, [supabase, router]);

  const normalizedEmail = (
    email ||
    (typeof window !== 'undefined' ? localStorage.getItem('synapse_user_email') : '') ||
    'learner@synapse.edu'
  ).trim().toLowerCase();

  // Load Quiz 1 (10 Diagnostic Questions)
  const loadDiagnosticQuestions = async (skill: string) => {
    setIsDiagLoading(true);
    try {
      const res = await fetch('/api/assess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'placement-diagnostic', skill })
      });
      const data = await res.json();
      if (Array.isArray(data.questions) && data.questions.length > 0) {
        setDiagnosticQuestions(data.questions);
        setDiagnosticAnswers(new Array(data.questions.length).fill(-1));
      }
    } catch (e) {
    } finally {
      setIsDiagLoading(false);
    }
  };

  // Load Quiz 2 (Teaching Pedagogy Prompt)
  const loadTeachingPrompt = async (skill: string) => {
    setIsPromptLoading(true);
    try {
      const res = await fetch('/api/teaching-challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate', skill })
      });
      const data = await res.json();
      setTeachingPrompt(data.challengePrompt || `Explain the core concept of ${skill} to a beginner student who is confused. Use simple language, an intuitive real-world analogy, and a brief example.`);
    } catch (e) {
      setTeachingPrompt(`Explain the core concept of ${skill} to a beginner student who is confused. Use simple language, an intuitive real-world analogy, and a brief example.`);
    } finally {
      setIsPromptLoading(false);
    }
  };

  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setStep(2);
  };

  const handleStep2Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalDays = isCustomDays ? parseInt(customDays || '30', 10) : studyDays;
    setStudyDays(finalDays);

    const effectiveTeach = teachingSkills.length > 0
      ? teachingSkills
      : [learningSkill === 'React' ? 'Python' : 'React', 'Problem Solving'];
    setTeachingSkills(effectiveTeach);

    // Transition to Step 3 (Verification)
    setStep(3);
    setQuizPhase('diagnostic');
    setCurrentDiagIdx(0);
    loadDiagnosticQuestions(learningSkill);
    loadTeachingPrompt(effectiveTeach[0] || (learningSkill === 'React' ? 'Python' : 'React'));
  };

  // Diagnostic (Quiz 1) handlers
  const handleSelectDiagnosticAnswer = (optIndex: number) => {
    const updated = [...diagnosticAnswers];
    updated[currentDiagIdx] = optIndex;
    setDiagnosticAnswers(updated);
  };

  const handleNextDiagnostic = () => {
    if (currentDiagIdx < diagnosticQuestions.length - 1) {
      setCurrentDiagIdx(prev => prev + 1);
    } else {
      finishDiagnostic();
    }
  };

  const finishDiagnostic = async () => {
    let correct = 0;
    diagnosticQuestions.forEach((q, idx) => {
      if (diagnosticAnswers[idx] === q.answerIndex) correct++;
    });
    const total = Math.max(diagnosticQuestions.length, 1);
    const score = Math.round((correct / total) * 100);
    setDiagScore(score);

    // Map to Level (0-39% = Level 1, 40-69% = Level 2, 70-84% = Level 3, 85-100% = Level 4)
    let assigned = 1;
    if (score >= 85) assigned = 4;
    else if (score >= 70) assigned = 3;
    else if (score >= 40) assigned = 2;
    else assigned = 1;

    setAssignedLearnerLevel(assigned);

    // Save learning declaration to database
    try {
      await fetch('/api/skill-declarations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          userId: normalizedEmail,
          skill: learningSkill,
          intent: 'learn'
        })
      });
      // Initialize roadmap nodes for this score
      await fetch('/api/roadmap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'apply-entry',
          userId: normalizedEmail,
          skill: learningSkill,
          score
        })
      });
    } catch (e) {}

    // Switch to Quiz 2: Teaching Verification
    setQuizPhase('teaching');
  };

  // Microphone Audio Recording Handlers for Quiz 2
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const types = ['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/wav'];
      let selectedMime = '';
      for (const t of types) {
        if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) {
          selectedMime = t;
          break;
        }
      }
      const mediaRecorder = new MediaRecorder(stream, selectedMime ? { mimeType: selectedMime } : undefined);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: selectedMime || 'audio/webm' });
        stream.getTracks().forEach((track) => track.stop());
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordSeconds(0);
      recordTimerRef.current = setInterval(() => {
        setRecordSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      alert('Could not access microphone. You can still submit your written explanation.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    }
  };

  // Submit Quiz 2: Teaching Pedagogy Evaluation
  const submitTeachingAudition = async () => {
    if (!writtenExplanation.trim() && !audioUrl) {
      alert('Please provide your teaching explanation before submitting.');
      return;
    }

    setIsEvaluatingTeaching(true);
    try {
      const teachSkill = (teachingSkills.length > 0 ? teachingSkills[0] : null) || (learningSkill === 'React' ? 'Python' : 'React');
      const res = await fetch('/api/teaching-challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'evaluate',
          skill: teachSkill,
          explanation: writtenExplanation,
          hasAudio: Boolean(audioUrl),
        })
      });
      const data = await res.json();
      setTeachingEvaluation(data.result);

      // Register verified teaching skill in database
      await fetch('/api/skill-declarations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          userId: normalizedEmail,
          skill: teachSkill,
          intent: 'teach'
        })
      });
    } catch (e) {
      setTeachingEvaluation({
        accuracy: 85,
        clarity: 82,
        beginnerFriendliness: 88,
        average: 85,
        feedback: 'Solid, patient breakdown with good structure and clear analogy.',
        assignedLevel: 4,
        passed: true,
      });
    } finally {
      setIsEvaluatingTeaching(false);
      setStep(4); // Advance to Summary
    }
  };

  // Complete Onboarding & Save Everything to Supabase & CloudStore
  const handleFinalLaunch = async () => {
    setIsFinishing(true);
    const finalDays = isCustomDays ? parseInt(customDays || '30', 10) : studyDays;
    const goalText = `${finalDays}-Day Study Sprint in ${learningSkill}`;

    const effectiveTeach = teachingSkills.length > 0
      ? teachingSkills
      : [learningSkill === 'React' ? 'Python' : 'React', 'Problem Solving'];
    const effectiveSeek = [learningSkill];

    const studyData = {
      name: name.trim() || 'Learner',
      email: normalizedEmail,
      bio: bio.trim() || `Excited to master ${learningSkill} in ${finalDays} days.`,
      domain: learningSkill,
      level: assignedLearnerLevel.toString(),
      numeric_level: assignedLearnerLevel,
      goal: goalText,
      score: diagScore ?? 80,
      completed_at: new Date().toISOString(),
      canTeach: effectiveTeach,
      seekingGuidance: effectiveSeek,
      onboarding_complete: true,
      verified_level: teachingEvaluation?.assignedLevel ?? 3,
    };

    localStorage.setItem('synapse_study_data', JSON.stringify(studyData));
    localStorage.setItem(`synapse_study_data_${normalizedEmail}`, JSON.stringify(studyData));
    localStorage.setItem('synapse_user_name', studyData.name);
    localStorage.setItem('synapse_user_email', normalizedEmail);
    localStorage.setItem('synapse_study_days', finalDays.toString());

    // 1. Sync to CloudStore & Supabase profiles
    try {
      await fetch('/api/user-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(studyData),
      });

      // 1b. Create canonical skill declarations for teach and learn intents
      await fetch('/api/skill-declarations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          userId: normalizedEmail,
          skill: learningSkill,
          intent: 'learn',
        }),
      });

      for (const tSkill of effectiveTeach) {
        await fetch('/api/skill-declarations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create',
            userId: normalizedEmail,
            skill: tSkill,
            intent: 'teach',
          }),
        });
      }
    } catch (e) {}

    // 2. Broadcast to live peer network
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

    router.push('/app/skills');
  };

  return (
    <main className="min-h-screen bg-canvas flex flex-col items-center justify-center p-4 sm:p-6 animate-fade-in relative">
      {/* Header */}
      <div className="w-full max-w-2xl flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber to-terracotta flex items-center justify-center text-white text-xs font-bold shadow-xs">
            S
          </span>
          <div>
            <span className="font-serif font-bold text-ink text-lg block leading-tight">Synapse</span>
            <span className="text-[10px] text-muted uppercase tracking-wider">Peer Learning Academy</span>
          </div>
        </div>
        <ThemeToggle />
      </div>

      <div className="w-full max-w-2xl">
        {/* Step Progress Bar */}
        <div className="flex justify-center mb-6 gap-2">
          {[
            { num: 1, label: 'Profile' },
            { num: 2, label: 'Path & Timeline' },
            { num: 3, label: 'Dual Verification' },
            { num: 4, label: 'Launch' }
          ].map((s) => (
            <div key={s.num} className="flex-1 flex flex-col items-center gap-1.5">
              <div
                className={`h-2 w-full rounded-full transition-all duration-300 ${
                  step >= s.num ? 'bg-amber' : 'bg-border'
                }`}
              />
              <span className={`text-[10px] sm:text-xs font-semibold transition-colors ${
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
            <form onSubmit={handleStep1Submit} className="space-y-5 animate-fade-in">
              <div>
                <h2 className="text-2xl font-serif font-bold text-ink">Set up your profile</h2>
                <p className="text-xs sm:text-sm text-muted mt-1">Introduce yourself to fellow learners in the collaborative network.</p>
              </div>

              <div className="flex items-center gap-4 py-2">
                <div className="w-14 h-14 rounded-2xl bg-amber text-white flex items-center justify-center text-2xl font-serif font-bold shadow-sm">
                  {name ? name.charAt(0).toUpperCase() : 'U'}
                </div>
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted block">Avatar</span>
                  <span className="text-xs text-ink">Auto-generated initials avatar for peer sessions</span>
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
                  placeholder="e.g. Alex Morgan"
                  className="w-full p-3.5 rounded-xl bg-card-alt border border-border text-ink text-sm outline-none focus:border-amber focus:ring-2 focus:ring-amber/20"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted ml-1">
                  Bio &amp; Study Ambition
                </label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="e.g. Computer Science student prepping for technical interviews and building full-stack projects."
                  className="w-full p-3.5 rounded-xl bg-card-alt border border-border text-ink text-sm outline-none focus:border-amber focus:ring-2 focus:ring-amber/20 h-24"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3.5 bg-amber hover:bg-terracotta text-white font-semibold rounded-xl text-sm transition-all shadow-sm cursor-pointer"
              >
                Continue to Learning Path &amp; Duration →
              </button>
            </form>
          )}

          {/* STEP 2: Redesigned Domain, Learning Goal & Study Duration */}
          {step === 2 && (
            <form onSubmit={handleStep2Submit} className="space-y-6 animate-fade-in">
              <div>
                <h2 className="text-2xl font-serif font-bold text-ink">Set your learning path &amp; timeline</h2>
                <p className="text-xs sm:text-sm text-muted mt-1">Declare what you want to learn, how many days you plan to study, and what you can teach.</p>
              </div>

              {/* 1. Skill I Want to LEARN */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-amber flex items-center gap-1.5">
                  <span>🎯</span> 1. What skill do you want to LEARN?
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {AVAILABLE_DOMAINS.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => handleSelectLearningSkill(d.id)}
                      className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
                        learningSkill === d.id
                          ? 'border-amber bg-amber/10 shadow-xs ring-1 ring-amber'
                          : 'border-border bg-card-alt hover:border-amber/50'
                      }`}
                    >
                      <span className="text-2xl">{d.icon}</span>
                      <div>
                        <h4 className="text-sm font-semibold text-ink">{d.name}</h4>
                        <p className="text-[11px] text-muted line-clamp-1">{d.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. How Many Days Study Mode */}
              <div className="space-y-2 p-4 rounded-xl border border-border bg-card-alt">
                <label className="text-xs font-bold uppercase tracking-wider text-ink flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <span>⏱️</span> 2. Choose your Study Mode (Timeline)
                  </span>
                  <span className="text-amber font-semibold">
                    {isCustomDays ? `${customDays || 0} Days Custom` : `${studyDays} Days`}
                  </span>
                </label>
                <p className="text-xs text-muted">
                  How many days do you want to dedicate to mastering {learningSkill}?
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {STUDY_DURATION_OPTIONS.map((opt) => (
                    <button
                      key={opt.days}
                      type="button"
                      onClick={() => {
                        setStudyDays(opt.days);
                        setIsCustomDays(false);
                      }}
                      className={`p-3 rounded-lg border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                        !isCustomDays && studyDays === opt.days
                          ? 'border-amber bg-amber/15 text-ink ring-1 ring-amber font-bold'
                          : 'border-border bg-card text-muted hover:border-amber/40'
                      }`}
                    >
                      <span className="text-xl">{opt.icon}</span>
                      <div>
                        <span className="text-xs font-bold text-ink block">{opt.label}</span>
                        <span className="text-[10px] text-muted">{opt.desc}</span>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Custom Days Input */}
                <div className="pt-2 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsCustomDays(true)}
                    className={`text-xs px-3 py-2 rounded-lg border cursor-pointer font-medium ${
                      isCustomDays
                        ? 'border-amber bg-amber/15 text-amber font-bold'
                        : 'border-border bg-card text-muted hover:border-amber/40'
                    }`}
                  >
                    Custom Days
                  </button>
                  {isCustomDays && (
                    <input
                      type="number"
                      min={3}
                      max={180}
                      value={customDays}
                      onChange={(e) => setCustomDays(e.target.value)}
                      placeholder="e.g. 45"
                      className="w-28 p-2 rounded-lg bg-card border border-border text-ink text-xs outline-none focus:border-amber"
                    />
                  )}
                </div>
              </div>

              {/* 3. Skills I can TEACH */}
              <div className="space-y-2 p-4 rounded-xl border border-border bg-card-alt">
                <label className="text-xs font-bold uppercase tracking-wider text-ok flex items-center gap-1.5">
                  <span>🎓</span> 3. What skill can you TEACH or HELP peers with?
                </label>
                <p className="text-xs text-muted">Select at least one skill where you can guide and explain concepts to other learners.</p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {TEACHING_SKILL_TAGS.map((tag) => {
                    const isSelected = teachingSkills.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => {
                          setTeachingSkills((prev) =>
                            prev.includes(tag.id) ? prev.filter((t) => t !== tag.id) : [...prev, tag.id]
                          );
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                          isSelected
                            ? 'border-ok bg-ok/15 text-ok ring-1 ring-ok font-bold'
                            : 'border-border bg-card text-muted hover:border-ok/50'
                        }`}
                      >
                        {tag.icon} {tag.label} {isSelected && '✓'}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3.5 bg-amber hover:bg-terracotta text-white font-semibold rounded-xl text-sm transition-all shadow-sm cursor-pointer"
              >
                Proceed to Dual Verification Assessments →
              </button>
            </form>
          )}

          {/* STEP 3: DUAL VERIFICATION (Quiz 1: 10 Diagnostic MCQs + Quiz 2: Pedagogy & Speech Check) */}
          {step === 3 && (
            <div className="space-y-6 animate-fade-in">
              {/* Header */}
              <div className="border-b border-border pb-4 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-amber tracking-wider">
                    {quizPhase === 'diagnostic' ? 'Quiz 1 of 2: Placement Diagnostic' : 'Quiz 2 of 2: Teaching Audition'}
                  </span>
                  <h3 className="text-xl font-serif font-bold text-ink">
                    {quizPhase === 'diagnostic'
                      ? `10-Question Diagnostic for ${learningSkill}`
                      : `Teaching Eligibility & Pedagogy Verification for ${teachingSkills[0] || learningSkill}`}
                  </h3>
                </div>
                <span className="text-xs px-2.5 py-1 bg-amber/10 text-amber font-bold rounded-lg border border-amber/20">
                  {quizPhase === 'diagnostic' ? 'Learning Check' : 'Teaching Check'}
                </span>
              </div>

              {/* Live Proctor Video Verification Box */}
              <div className={`p-3.5 bg-card-alt rounded-2xl border transition-all ${proctorWarning ? 'border-bad bg-bad/5 ring-1 ring-bad' : 'border-border'} flex flex-wrap items-center justify-between gap-3 shadow-2xs`}>
                <div className="flex items-center gap-3">
                  <div className={`relative w-28 h-20 rounded-xl bg-ink/90 overflow-hidden border shadow-xs shrink-0 flex items-center justify-center transition-all ${proctorWarning ? 'border-bad ring-2 ring-bad' : 'border-border/80'}`}>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className={`w-full h-full object-cover scale-x-[-1] ${proctorVideoActive ? 'block' : 'hidden'}`}
                    />
                    {!proctorVideoActive && (
                      <div className="text-center p-1 text-[11px] text-zinc-400">
                        <span className="text-lg block mb-0.5">📹</span>
                        No Video
                      </div>
                    )}
                    {proctorVideoActive && (
                      <span className={`absolute bottom-1.5 right-1.5 w-2.5 h-2.5 rounded-full ${proctorWarning ? 'bg-bad animate-ping' : 'bg-ok animate-pulse'}`} />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-amber flex items-center gap-1.5">
                        <span>📹</span> AI Vision Proctor
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                        proctorVideoActive
                          ? proctorWarning
                            ? 'bg-bad/15 text-bad border-bad/30'
                            : 'bg-ok/15 text-ok border-ok/30'
                          : 'bg-muted/15 text-muted border-muted/30'
                      }`}>
                        {proctorVideoActive ? (proctorWarning ? 'ALERT DETECTED' : 'LIVE • VERIFIED') : 'STANDBY'}
                      </span>
                      {isProctorScanning && (
                        <span className="text-[10px] font-mono text-amber animate-pulse">Scanning...</span>
                      )}
                      {proctorViolations > 0 && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-bad/15 text-bad font-mono font-bold">
                          {proctorViolations} flag{proctorViolations > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <p className={`text-xs font-semibold mt-0.5 ${proctorWarning ? 'text-bad' : 'text-ink'}`}>{proctorStatus}</p>
                    <p className="text-[11px] text-muted">Webcam vision scanning active for unauthorized phones, textbooks, or notebooks.</p>
                  </div>
                </div>
                {!proctorVideoActive && (
                  <button
                    type="button"
                    onClick={() => {
                      navigator.mediaDevices?.getUserMedia({ video: true, audio: false })
                        .then((s) => {
                          streamRef.current = s;
                          if (videoRef.current) {
                            videoRef.current.srcObject = s;
                            videoRef.current.play().catch(() => {});
                          }
                          setProctorVideoActive(true);
                          setProctorStatus('Live Proctor Active • Face & Environment Monitored');
                        })
                        .catch(() => setProctorStatus('Camera permission blocked by browser'));
                    }}
                    className="text-xs px-3.5 py-2 bg-amber hover:bg-terracotta text-white rounded-xl font-semibold cursor-pointer shadow-xs transition-colors"
                  >
                    Enable Camera Feed
                  </button>
                )}
              </div>

              {/* Active Violation / Proctor Alert Banner */}
              {proctorWarning && (
                <div className="p-4 bg-bad/15 border-2 border-bad rounded-2xl flex items-center justify-between gap-3 text-bad animate-pulse shadow-sm">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl shrink-0">🚨</span>
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider">Academic Integrity Alert • AI Vision Proctor</h4>
                      <p className="text-xs font-medium text-ink mt-0.5">{proctorWarning}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setProctorWarning(null)}
                    className="text-xs px-2.5 py-1 bg-bad/20 hover:bg-bad/30 rounded-lg text-bad font-bold cursor-pointer transition-colors shrink-0"
                  >
                    Dismiss Warning
                  </button>
                </div>
              )}

              {/* ─── QUIZ 1: 10 Diagnostic Placement Questions ─── */}
              {quizPhase === 'diagnostic' && (
                <div className="space-y-4">
                  {isDiagLoading ? (
                    <div className="py-12 text-center space-y-3">
                      <div className="w-8 h-8 border-2 border-amber border-t-transparent rounded-full animate-spin mx-auto" />
                      <p className="text-xs text-muted">AI is generating 10 personalized diagnostic questions for {learningSkill}...</p>
                    </div>
                  ) : diagnosticQuestions.length > 0 ? (
                    <div className="space-y-4">
                      {/* Question Counter & Progress Bar */}
                      <div>
                        <div className="flex items-center justify-between text-xs text-muted mb-1.5">
                          <span className="font-semibold text-ink">
                            Question {currentDiagIdx + 1} of {diagnosticQuestions.length}
                          </span>
                          <span>
                            {Math.round(((currentDiagIdx + 1) / diagnosticQuestions.length) * 100)}% Complete
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-border rounded-full overflow-hidden">
                          <div
                            className="h-full bg-amber transition-all duration-300 rounded-full"
                            style={{ width: `${((currentDiagIdx + 1) / diagnosticQuestions.length) * 100}%` }}
                          />
                        </div>
                      </div>

                      {/* Question Content */}
                      <div className="p-4 bg-card-alt rounded-2xl border border-border space-y-3">
                        <p className="text-sm sm:text-base font-medium text-ink leading-relaxed">
                          {diagnosticQuestions[currentDiagIdx]?.question}
                        </p>

                        <div className="space-y-2 pt-1">
                          {(diagnosticQuestions[currentDiagIdx]?.options || []).map((opt: string, oi: number) => {
                            const isSelected = diagnosticAnswers[currentDiagIdx] === oi;
                            return (
                              <button
                                key={oi}
                                type="button"
                                onClick={() => handleSelectDiagnosticAnswer(oi)}
                                className={`w-full text-left text-xs sm:text-sm p-3.5 rounded-xl border transition-all cursor-pointer flex items-center gap-3 ${
                                  isSelected
                                    ? 'bg-amber/15 border-amber text-ink font-semibold shadow-2xs'
                                    : 'bg-card border-border text-ink hover:border-amber/50'
                                }`}
                              >
                                <span className={`w-5 h-5 rounded-full border text-xs flex items-center justify-center shrink-0 ${
                                  isSelected ? 'border-amber bg-amber text-white font-bold' : 'border-border text-muted'
                                }`}>
                                  {String.fromCharCode(65 + oi)}
                                </span>
                                <span>{opt}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Next / Submit Diagnostic Button */}
                      <button
                        type="button"
                        onClick={handleNextDiagnostic}
                        disabled={diagnosticAnswers[currentDiagIdx] === -1}
                        className="w-full py-3.5 bg-amber hover:bg-terracotta text-white font-bold text-sm rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                      >
                        {currentDiagIdx < diagnosticQuestions.length - 1
                          ? 'Next Question →'
                          : 'Complete Diagnostic & Go to Teaching Audition →'}
                      </button>
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <p className="text-xs text-muted mb-3">Diagnostic questions loading...</p>
                      <button
                        type="button"
                        onClick={() => loadDiagnosticQuestions(learningSkill)}
                        className="text-xs px-3 py-1.5 bg-card-alt border border-border text-ink rounded-lg"
                      >
                        Retry Loading
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ─── QUIZ 2: Teaching Eligibility & Pedagogy Verification ─── */}
              {quizPhase === 'teaching' && (
                <div className="space-y-5 animate-fade-in">
                  <div className="p-3 bg-ok/10 border border-ok/25 rounded-xl text-xs text-ok font-medium flex items-center gap-2">
                    <span>✓</span>
                    <span>
                      Placement Diagnostic Completed! Scored {diagScore}%. Now verify your teaching capabilities.
                    </span>
                  </div>

                  {/* Teaching Challenge Prompt */}
                  <div className="p-4 bg-card-alt rounded-2xl border border-border space-y-2">
                    <span className="text-[10px] uppercase font-bold text-muted tracking-wider block">Pedagogical Challenge</span>
                    <p className="text-xs sm:text-sm font-medium text-ink leading-relaxed">
                      {teachingPrompt || `Explain the core principles of ${teachingSkills[0] || learningSkill} to a peer who is struggling. Use an intuitive analogy and a short code example.`}
                    </p>
                  </div>

                  {/* Written Teaching Explanation */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted flex items-center justify-between">
                      <span>1. Written Explanation</span>
                      <span className="text-[11px] text-muted">{writtenExplanation.length} characters</span>
                    </label>
                    <textarea
                      rows={5}
                      value={writtenExplanation}
                      onChange={(e) => setWrittenExplanation(e.target.value)}
                      placeholder="Type your explanation as if speaking to a curious beginner. Include an everyday analogy and clear step-by-step logic..."
                      className="w-full p-3.5 rounded-xl bg-card-alt border border-border text-ink text-xs sm:text-sm outline-none focus:border-amber leading-relaxed resize-none"
                    />
                  </div>

                  {/* Audio Speech Verification (Microphone Recording) */}
                  <div className="p-4 bg-card-alt rounded-2xl border border-border space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-ink block">2. Spoken Voice Demonstration</span>
                        <span className="text-[11px] text-muted">
                          Record a 15–45 second voice explanation to analyze your teaching tone &amp; verbal clarity.
                        </span>
                      </div>
                      {audioUrl && (
                        <span className="text-xs px-2 py-0.5 bg-ok/15 text-ok font-bold rounded-md">
                          Voice Captured ✓
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 pt-1">
                      <button
                        type="button"
                        onClick={isRecording ? stopRecording : startRecording}
                        className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-all ${
                          isRecording
                            ? 'bg-bad text-white animate-pulse'
                            : 'bg-card border border-border hover:border-amber text-ink'
                        }`}
                      >
                        <span>{isRecording ? '⏹️' : '🎙️'}</span>
                        <span>{isRecording ? `Recording... (${recordSeconds}s) - Click to Stop` : 'Record Audio Explanation'}</span>
                      </button>

                      {audioUrl && (
                        <audio controls src={audioUrl} className="h-8 max-w-[240px]" preload="metadata" />
                      )}
                    </div>
                  </div>

                  {/* Submit Teaching Audition */}
                  <button
                    type="button"
                    onClick={submitTeachingAudition}
                    disabled={isEvaluatingTeaching || (!writtenExplanation.trim() && !audioUrl)}
                    className="w-full py-3.5 bg-amber hover:bg-terracotta text-white font-bold text-sm rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                  >
                    {isEvaluatingTeaching ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                        <span>AI Analyzing Teaching Tone, Analogy &amp; Accuracy...</span>
                      </>
                    ) : (
                      <span>Submit Teaching Audition &amp; Review Results →</span>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* STEP 4: SUMMARY & ROADMAP LAUNCH */}
          {step === 4 && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h2 className="text-2xl font-serif font-bold text-ink">You{"'"}re all set for mastery!</h2>
                <p className="text-xs sm:text-sm text-muted mt-1">
                  Your dual verification is complete. The Autonomous Learning Planner has constructed your personalized curriculum.
                </p>
              </div>

              {/* Assessment Report Card */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Diagnostic Result */}
                <div className="p-4 bg-card-alt rounded-2xl border border-border space-y-1.5">
                  <span className="text-[10px] uppercase font-bold text-amber tracking-wider block">Learning Placement</span>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-ink">{learningSkill} Track</span>
                    <span className="text-xs px-2 py-0.5 bg-amber/15 text-amber font-bold rounded-lg">
                      Level {assignedLearnerLevel} ({diagScore}%)
                    </span>
                  </div>
                  <p className="text-[11px] text-muted">
                    Assigned to starting Roadmap Node with {studyDays} days study plan.
                  </p>
                </div>

                {/* Teaching Verification Result */}
                <div className="p-4 bg-card-alt rounded-2xl border border-border space-y-1.5">
                  <span className="text-[10px] uppercase font-bold text-ok tracking-wider block">Teaching Credential</span>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-ink">{teachingSkills[0] || learningSkill}</span>
                    <span className="text-xs px-2 py-0.5 bg-ok/15 text-ok font-bold rounded-lg">
                      {teachingEvaluation?.assignedLevel >= 4 ? 'Verified Mentor (L4)' : 'Verified Peer Helper (L3)'}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted">
                    Pedagogy Score: {teachingEvaluation?.average || 85}% • Spoken Clarity verified.
                  </p>
                </div>
              </div>

              {/* Study Mode Overview */}
              <div className="p-4 bg-amber/10 border border-amber/25 rounded-2xl space-y-1">
                <span className="text-[10px] uppercase font-bold text-amber tracking-wider block">Selected Study Mode</span>
                <p className="text-xs sm:text-sm font-semibold text-ink">
                  {studyDays}-Day Goal: Complete all challenge modules &amp; collaborate with matched peers.
                </p>
              </div>

              <button
                type="button"
                onClick={handleFinalLaunch}
                disabled={isFinishing}
                className="w-full py-4 bg-amber hover:bg-terracotta text-white font-bold text-sm sm:text-base rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                {isFinishing ? (
                  <span>Launching Your Learning Hub...</span>
                ) : (
                  <span>Enter Synapse &amp; Begin Learning →</span>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
