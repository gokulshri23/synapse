'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FALLBACK_QUESTIONS } from '@/lib/constants';

interface ProctoredQuizProps {
  skill: string;
  level: string;
  onComplete: (result: {
    score: number;
    skill: string;
    level: string;
    violationsCount: number;
    passed: boolean;
  }) => void;
  onCancel?: () => void;
}

export default function ProctoredQuiz({ skill, level, onComplete, onCancel }: ProctoredQuizProps) {
  // Questions State
  const [questions, setQuestions] = useState<Array<{ question: string; options: string[]; answerIndex: number }>>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [quizFinished, setQuizFinished] = useState(false);
  const [finalScore, setFinalScore] = useState(0);

  // Proctoring: Camera & Vision State
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const internalCanvasRef = useRef<HTMLCanvasElement>(null);
  const isAnalyzingRef = useRef(false);
  const alertTimeoutRef = useRef<any>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [proctorStatus, setProctorStatus] = useState<'normal' | 'scanning' | 'alert'>('normal');
  const [alertReason, setAlertReason] = useState<string | null>(null);
  const [detectedItem, setDetectedItem] = useState<string | null>(null);

  // Proctoring: Tab Switch Anti-Cheating
  const [tabViolations, setTabViolations] = useState(0);
  const [showViolationModal, setShowViolationModal] = useState(false);
  const [proctorLogs, setProctorLogs] = useState<Array<{ time: string; msg: string; type: 'info' | 'warn' | 'ok' }>>([]);
  const [isWarmedUp, setIsWarmedUp] = useState(false);
  const [warmupSeconds, setWarmupSeconds] = useState(3);

  // Audio Alert Sound (Web Audio API)
  const playAlertSound = useCallback(() => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(700, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(320, audioCtx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.3);
    } catch (e) {}
  }, []);

  const addLog = (msg: string, type: 'info' | 'warn' | 'ok' = 'info') => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setProctorLogs(prev => [{ time, msg, type }, ...prev.slice(0, 6)]);
  };

  // 1. Initialize Questions based on chosen skill
  useEffect(() => {
    const domainQuestions = FALLBACK_QUESTIONS[skill] || FALLBACK_QUESTIONS['React'] || FALLBACK_QUESTIONS['Programming'];
    setQuestions(domainQuestions);
    setSelectedAnswers(new Array(domainQuestions.length).fill(-1));
    addLog(`Assessment initialized for ${skill} (${level})`, 'info');
  }, [skill, level]);

  // Helper: Trigger cheating alert with bounding box
  const triggerCheatingAlert = useCallback((item: string, confidence: number, explanation?: string, box?: number[]) => {
    playAlertSound();
    setProctorStatus('alert');
    setDetectedItem(item);
    const msg = explanation || `Unauthorized ${item} detected (${confidence}%)`;
    setAlertReason(msg);
    addLog(`🚨 CHEAT ALERT: ${item} (${confidence}%)`, 'warn');

    // Draw alert box on overlay canvas
    const overlay = overlayCanvasRef.current;
    if (overlay) {
      const ctx = overlay.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, overlay.width, overlay.height);
        const [x, y, w, h] = box || [30, 20, overlay.width - 60, overlay.height - 40];
        ctx.strokeStyle = '#ff4d6a';
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, w, h);

        ctx.fillStyle = 'rgba(255, 77, 106, 0.9)';
        ctx.fillRect(x, Math.max(0, y - 24), Math.max(w, 140), 24);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px system-ui, sans-serif';
        ctx.fillText(`🚨 ${item.toUpperCase()} (${confidence}%)`, x + 6, Math.max(16, y - 7));
      }
    }

    if (alertTimeoutRef.current) clearTimeout(alertTimeoutRef.current);
    alertTimeoutRef.current = setTimeout(() => {
      setProctorStatus('normal');
      setAlertReason(null);
      setDetectedItem(null);
      if (overlay) {
        const ctx = overlay.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, overlay.width, overlay.height);
      }
    }, 4500);
  }, [playAlertSound]);

  // 2. High-Performance Instant Camera Initialization with 3s Grace Warm-up
  useEffect(() => {
    let stream: MediaStream | null = null;
    let isActive = true;
    let warmupInterval: any = null;

    async function initCamera() {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
            audio: false
          });

          if (!isActive) {
            stream.getTracks().forEach(t => t.stop());
            return;
          }

          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.onloadedmetadata = () => {
              if (videoRef.current) {
                videoRef.current.play().catch(() => {});
                setCameraActive(true);
                setProctorStatus('normal');
                addLog('Webcam live feed engaged. 3-second grace calibration started.', 'ok');

                // 3-second warm-up grace period: never evaluate before stream is confirmed live
                let remaining = 3;
                warmupInterval = setInterval(() => {
                  remaining -= 1;
                  setWarmupSeconds(remaining);
                  if (remaining <= 0) {
                    clearInterval(warmupInterval);
                    setIsWarmedUp(true);
                    addLog('Proctor vision surveillance fully armed', 'ok');
                  }
                }, 1000);
              }
            };
          }
        } else {
          setCameraError('Camera API unavailable');
          setCameraActive(true);
          setIsWarmedUp(true);
        }
      } catch (err: any) {
        console.warn('Camera access note:', err);
        setCameraError('Webcam permission not granted or in use. Virtual proctor ready.');
        setCameraActive(true);
        setIsWarmedUp(true);
        addLog('Virtual AI camera mode ready', 'info');
      }
    }

    initCamera();

    return () => {
      isActive = false;
      if (warmupInterval) clearInterval(warmupInterval);
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (alertTimeoutRef.current) clearTimeout(alertTimeoutRef.current);
    };
  }, []);

  // 3. Tab-Switch Anti-Cheating Detection (Strictly visibilitychange — NO blur listener to avoid false strikes)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && !quizFinished) {
        triggerTabViolation('Tab switched or browser minimized');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [quizFinished]);

  const triggerTabViolation = (reason: string) => {
    playAlertSound();
    setTabViolations(prev => {
      const next = prev + 1;
      setShowViolationModal(true);
      setProctorStatus('alert');
      setAlertReason(`Unauthorized tab switch (${next}/3 strikes)`);
      addLog(`Violation: ${reason} (Strike ${next}/3)`, 'warn');
      return next;
    });
  };

  // 4. Intelligent Non-Blocking Cloud Vision Proctoring (Gemini 3.6 Flash)
  // ONLY runs AFTER the 3-second grace calibration has completed!
  useEffect(() => {
    if (!cameraActive || !isWarmedUp || quizFinished) return;

    let scanTimer: any = null;

    const runProctorCloudInspection = async () => {
      if (isAnalyzingRef.current) return;
      isAnalyzingRef.current = true;

      try {
        const video = videoRef.current;
        const canvas = internalCanvasRef.current;

        if (video && video.readyState >= 2 && canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, 320, 240);
            const base64 = canvas.toDataURL('image/jpeg', 0.55);

            const res = await fetch('/api/proctor-vision', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ image: base64 })
            });

            if (res.ok) {
              const data = await res.json();
              if (data.detected && data.item) {
                // Legitimate detection from Gemini 3.6 Flash
                triggerCheatingAlert(data.item, data.confidence || 92, data.explanation);
              }
            }
          }
        }
      } catch (err) {
      } finally {
        isAnalyzingRef.current = false;
      }
    };

    // Periodic deep inspection every 4.5s
    scanTimer = setInterval(runProctorCloudInspection, 4500);

    return () => {
      if (scanTimer) clearInterval(scanTimer);
    };
  }, [cameraActive, isWarmedUp, quizFinished, triggerCheatingAlert]);

  const handleSelectOption = (index: number) => {
    const updated = [...selectedAnswers];
    updated[currentQuestionIndex] = index;
    setSelectedAnswers(updated);
  };

  const handleSubmitQuiz = () => {
    setIsSubmitting(true);
    let correct = 0;
    questions.forEach((q, idx) => {
      if (selectedAnswers[idx] === q.answerIndex) {
        correct++;
      }
    });

    const calculatedScore = Math.round((correct / Math.max(questions.length, 1)) * 100);
    setFinalScore(calculatedScore);
    setQuizFinished(true);
    setIsSubmitting(false);
    addLog(`Assessment completed with score ${calculatedScore}%`, 'ok');
  };

  const handleContinue = () => {
    onComplete({
      score: finalScore,
      skill,
      level,
      violationsCount: tabViolations,
      passed: finalScore >= 50,
    });
  };

  const currentQuestion = questions[currentQuestionIndex];
  const allAnswered = selectedAnswers.every(ans => ans !== -1 && ans !== undefined);

  return (
    <div className="relative flex flex-col gap-5">
      {/* Hidden processing canvas */}
      <canvas ref={internalCanvasRef} width={320} height={240} className="hidden" />

      {/* Violation Alert Modal Popup */}
      {showViolationModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md bg-card border-2 border-bad rounded-3xl p-6 shadow-2xl text-center flex flex-col items-center">
            <div className="w-14 h-14 rounded-full bg-bad/15 text-bad flex items-center justify-center text-3xl mb-3 animate-bounce">
              ⚠️
            </div>
            <h3 className="text-xl font-serif font-bold text-ink mb-1">
              Tab Switch Denied!
            </h3>
            <p className="text-sm text-bad font-medium mb-2">
              Warning Strike {tabViolations} of 3
            </p>
            <p className="text-xs text-muted leading-relaxed mb-5">
              Anti-cheating protocols are active. Switching tabs, opening secondary windows, or minimizing the quiz is strictly recorded.
            </p>
            <button
              onClick={() => {
                setShowViolationModal(false);
                setProctorStatus('normal');
              }}
              className="w-full py-2.5 px-4 bg-amber hover:bg-terracotta text-white font-bold text-sm rounded-xl transition-all cursor-pointer"
            >
              I Understand — Return to Exam
            </button>
          </div>
        </div>
      )}

      {/* PROMINENT LIVE CAMERA PROCTOR BAR — Positioned cleanly at top */}
      <div className={`p-4 rounded-2xl border transition-all ${
        proctorStatus === 'alert'
          ? 'bg-bad/15 border-bad ring-2 ring-bad/40 animate-pulse'
          : 'bg-card-alt border-border'
      }`}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          {/* Live Camera View with Canvas Overlay */}
          <div className={`relative w-full h-44 md:h-36 rounded-2xl overflow-hidden bg-black border flex items-center justify-center transition-all ${
            proctorStatus === 'alert' ? 'border-bad ring-4 ring-bad/50' : 'border-border'
          }`}>
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className="w-full h-full object-cover"
            />
            {/* Real-time Bounding Box Canvas Overlay */}
            <canvas
              ref={overlayCanvasRef}
              width={320}
              height={240}
              className="absolute inset-0 w-full h-full pointer-events-none"
            />

            {cameraError && (
              <div className="absolute inset-0 bg-ink/85 flex flex-col items-center justify-center p-2 text-center">
                <span className="text-2xl mb-1">📷</span>
                <span className="text-xs text-amber font-semibold">Webcam Virtual Mode</span>
                <span className="text-[10px] text-muted mt-0.5">Use buttons below to test alerts</span>
              </div>
            )}

            {/* HUD Overlay / Scanning Grid */}
            <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-2">
              <div className="flex justify-between items-center text-[10px] font-mono">
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-black/75 text-ok font-bold">
                  <span className={`w-2 h-2 rounded-full ${isWarmedUp ? 'bg-ok animate-pulse' : 'bg-amber animate-ping'}`} />
                  {isWarmedUp ? 'LIVE PROCTOR' : `CALIBRATING (${warmupSeconds}s)`}
                </span>
                <span className="text-white/90 px-1.5 py-0.5 rounded bg-black/60 font-semibold">
                  GEMINI 3.6 VISION
                </span>
              </div>

              {proctorStatus === 'alert' && (
                <div className="bg-bad text-white text-xs font-bold p-1.5 rounded-lg text-center shadow-xl animate-bounce">
                  🚨 {alertReason || 'Suspicious Object Detected!'}
                </div>
              )}

              <div className="flex justify-between items-center text-[9px] text-white/90 font-mono bg-black/60 px-2 py-0.5 rounded">
                <span>DETECT: PHONES / NOTES</span>
                <span className={proctorStatus === 'alert' ? 'text-bad font-extrabold' : 'text-ok'}>
                  {proctorStatus === 'alert' ? '⚠️ VIOLATION!' : 'STATUS: CLEAR'}
                </span>
              </div>
            </div>
          </div>

          {/* Proctoring Status, Instructions, and Test Triggers */}
          <div className="md:col-span-2 flex flex-col justify-between h-full gap-2">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🛡️</span>
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-ink block">
                      AI Proctor Vision Active
                    </span>
                    <span className="text-[11px] text-muted">
                      Continuously monitoring for mobile devices, textbooks, and notes
                    </span>
                  </div>
                </div>
                <span className={`text-[11px] px-2.5 py-1 rounded-full font-bold ${
                  tabViolations > 0 ? 'bg-bad/15 text-bad border border-bad/30' : 'bg-ok/15 text-ok border border-ok/30'
                }`}>
                  {tabViolations === 0 ? '0 Strikes' : `${tabViolations}/3 Strikes`}
                </span>
              </div>

              <p className="text-xs text-muted leading-relaxed">
                Exam security enabled. Hold your <strong>mobile phone</strong> or <strong>notebook</strong> up to the camera or use the buttons below to verify bounding box detection.
              </p>
            </div>

            {/* Test Buttons for Instant Demonstration */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
              <span className="text-[10px] font-semibold text-muted">Demonstrate Detection:</span>
              <button
                type="button"
                onClick={() => triggerCheatingAlert('Mobile Phone', 96, 'Smartphone held up in front of camera', [80, 25, 90, 150])}
                className="text-[11px] px-2.5 py-1 bg-card border border-border hover:border-bad text-ink rounded-lg font-medium transition-colors cursor-pointer"
              >
                📱 Test Phone Alert
              </button>
              <button
                type="button"
                onClick={() => triggerCheatingAlert('Notebook / Study Material', 94, 'Notebook with handwritten notes in view', [40, 35, 170, 130])}
                className="text-[11px] px-2.5 py-1 bg-card border border-border hover:border-bad text-ink rounded-lg font-medium transition-colors cursor-pointer"
              >
                📖 Test Notebook Alert
              </button>
              <button
                type="button"
                onClick={() => triggerTabViolation('Manual Tab Switch Test')}
                className="text-[11px] px-2.5 py-1 bg-card border border-border hover:border-amber text-ink rounded-lg font-medium transition-colors cursor-pointer"
              >
                🚫 Test Tab Deny
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Quiz Content or Results */}
      {!quizFinished ? (
        <div className="bg-card p-5 sm:p-6 rounded-2xl border border-border flex flex-col gap-4">
          {/* Progress Header */}
          <div className="flex justify-between items-center">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-amber">
                {skill} College Assessment Quiz
              </span>
              <h3 className="text-lg font-serif font-bold text-ink">
                Question {currentQuestionIndex + 1} of {questions.length}
              </h3>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted font-medium">
              <span>{Math.round(((currentQuestionIndex + 1) / questions.length) * 100)}%</span>
            </div>
          </div>

          {/* Question Text */}
          {currentQuestion ? (
            <div className="flex flex-col gap-4">
              <p className="text-sm sm:text-base font-medium text-ink leading-snug">
                {currentQuestion.question}
              </p>

              {/* Options */}
              <div className="flex flex-col gap-2.5">
                {currentQuestion.options.map((opt, oIdx) => {
                  const isSelected = selectedAnswers[currentQuestionIndex] === oIdx;
                  return (
                    <button
                      key={oIdx}
                      type="button"
                      onClick={() => handleSelectOption(oIdx)}
                      className={`w-full p-3.5 rounded-xl border text-left text-xs sm:text-sm font-medium transition-all flex items-center gap-3 cursor-pointer ${
                        isSelected
                          ? 'border-amber bg-amber/10 text-amber shadow-xs'
                          : 'border-border bg-card-alt text-ink hover:border-amber/50'
                      }`}
                    >
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                        isSelected ? 'bg-amber text-white' : 'bg-card border border-border text-muted'
                      }`}>
                        {String.fromCharCode(65 + oIdx)}
                      </span>
                      <span className="flex-1">{opt}</span>
                    </button>
                  );
                })}
              </div>

              {/* Navigation Between Questions */}
              <div className="flex justify-between items-center pt-2">
                <button
                  type="button"
                  disabled={currentQuestionIndex === 0}
                  onClick={() => setCurrentQuestionIndex(prev => prev - 1)}
                  className="px-4 py-2 bg-card-alt border border-border text-ink rounded-xl text-xs font-semibold hover:border-amber transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  ← Previous
                </button>

                {currentQuestionIndex < questions.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => setCurrentQuestionIndex(prev => prev + 1)}
                    className="px-5 py-2.5 bg-amber hover:bg-terracotta text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Next Question →
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={!allAnswered || isSubmitting}
                    onClick={handleSubmitQuiz}
                    className="px-6 py-2.5 bg-amber hover:bg-terracotta text-white rounded-xl text-xs font-semibold shadow-sm transition-all disabled:opacity-50 cursor-pointer flex items-center gap-2"
                  >
                    {isSubmitting && <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                    <span>Submit & Calculate Grade</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted text-sm">
              Loading assessment questions...
            </div>
          )}
        </div>
      ) : (
        /* Final Score & Grade Reveal */
        <div className="bg-card p-6 sm:p-8 rounded-2xl border border-border flex flex-col items-center text-center gap-5 animate-fade-in">
          <div className="w-20 h-20 rounded-full bg-ok/15 border-2 border-ok text-ok flex items-center justify-center text-4xl shadow-sm">
            ✓
          </div>

          <div>
            <span className="text-xs uppercase font-semibold text-muted tracking-wider">
              College Assessment Completed
            </span>
            <h3 className="text-2xl sm:text-3xl font-serif font-bold text-ink mt-1">
              Score: {finalScore}%
            </h3>
            <p className="text-sm text-muted mt-1 max-w-md">
              {finalScore >= 80
                ? `Grade: A+ (Outstanding). You demonstrated skill mastery in ${skill}!`
                : finalScore >= 60
                ? `Grade: A (Good). Solid comprehension in ${skill}.`
                : `Grade: B. Keep practicing core patterns in ${skill}.`}
            </p>
          </div>

          <div className="w-full max-w-sm p-4 bg-card-alt rounded-xl border border-border text-left text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-muted">Subject / Skill:</span>
              <span className="font-semibold text-ink">{skill}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Calculated Level:</span>
              <span className="font-semibold text-ink capitalize">{level}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Exam Proctor Integrity:</span>
              <span className={`font-semibold ${tabViolations === 0 ? 'text-ok' : 'text-amber'}`}>
                {tabViolations === 0 ? '100% Clean (Zero Violations)' : `${tabViolations} Warning(s)`}
              </span>
            </div>
            <div className="flex justify-between border-t border-border pt-2">
              <span className="text-muted">Mastery Boost:</span>
              <span className="font-bold text-ok">+{Math.round(finalScore * 0.25)}% Mastery (+100 XP)</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleContinue}
            className="w-full max-w-sm py-3 px-6 bg-amber hover:bg-terracotta text-white font-semibold rounded-xl text-sm transition-all shadow-sm cursor-pointer"
          >
            Apply Score &amp; Update Transcript →
          </button>
        </div>
      )}

      {/* Live Proctor Activity Log */}
      <div className="p-3 bg-card-alt rounded-xl border border-border text-[11px] font-mono">
        <div className="flex justify-between items-center text-muted mb-1 font-sans text-xs">
          <span>AI Vision Surveillance Logs</span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-ok animate-pulse" /> Monitoring
          </span>
        </div>
        <div className="space-y-1 max-h-20 overflow-y-auto">
          {proctorLogs.map((log, idx) => (
            <div key={idx} className="flex gap-2">
              <span className="text-muted shrink-0">{log.time}</span>
              <span className={log.type === 'warn' ? 'text-bad font-semibold' : log.type === 'ok' ? 'text-ok' : 'text-ink'}>
                {log.msg}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
