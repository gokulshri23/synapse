'use client';

import React, { useEffect, useState, useRef } from 'react';

// ─── PART 2: Call Screens with Warm Design System ─────────────────
// Palette: canvas #F4F1EA, card #FCFAF6, border #E8E3D8, ink #1C1917,
// muted #78716C, amber #D97706, terracotta #B45309, ok #2ee6a8, bad #ff4d6a

// ─── 1. Outgoing Call Screen ──────────────────────────────────────
interface OutgoingCallScreenProps {
  friendName: string;
  friendAvatar?: string;
  mode: 'voice' | 'video';
  onCancel: () => void;
  onRetry: () => void;
  onSendMessage: () => void;
}

export function OutgoingCallScreen({
  friendName,
  friendAvatar,
  mode,
  onCancel,
  onRetry,
  onSendMessage,
}: OutgoingCallScreenProps) {
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsElapsed((s) => {
        if (s + 1 >= 30) {
          setTimedOut(true);
        }
        return s + 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const initials = friendName
    ? friendName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'P';

  return (
    <div className="fixed inset-0 z-[140] bg-ink/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in select-none">
      <div className="bg-card border border-border rounded-[24px] max-w-md w-full p-8 shadow-2xl text-center space-y-6 relative overflow-hidden">
        {/* Soft background ambient gradient */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-amber/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-terracotta/10 rounded-full blur-3xl pointer-events-none" />

        {/* Avatar with pulsing ring */}
        <div className="relative mx-auto w-28 h-28 flex items-center justify-center">
          {!timedOut && (
            <div className="absolute inset-0 rounded-full border-2 border-amber/50 animate-ping motion-reduce:hidden opacity-40" />
          )}
          {friendAvatar ? (
            <img
              src={friendAvatar}
              alt={friendName}
              className="w-24 h-24 rounded-full object-cover shadow-xl border-2 border-amber"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-amber to-terracotta text-white flex items-center justify-center text-3xl font-serif font-bold shadow-xl border-2 border-white/40">
              {initials}
            </div>
          )}
        </div>

        {/* Headings & Status */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber font-mono">
            {mode === 'voice' ? '🎙️ Voice Call' : '📹 Video Call'}
          </span>
          <h2 className="text-2xl font-serif font-bold text-ink">
            {timedOut ? `${friendName} didn't answer` : `Calling ${friendName}...`}
          </h2>
          <p className="text-xs text-muted">
            {timedOut
              ? 'They might be away or learning right now.'
              : `Waiting for ${friendName} to accept (${30 - secondsElapsed}s)`}
          </p>
        </div>

        {/* Action Buttons */}
        {timedOut ? (
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              onClick={onRetry}
              className="w-full sm:w-auto px-5 py-2.5 rounded-full bg-amber hover:bg-amber-600 text-ink font-bold text-xs shadow-md transition-colors cursor-pointer"
            >
              🔄 Try Again
            </button>
            <button
              onClick={onSendMessage}
              className="w-full sm:w-auto px-5 py-2.5 rounded-full bg-card-alt border border-border hover:border-amber text-ink font-semibold text-xs shadow-xs transition-colors cursor-pointer"
            >
              💬 Send a Message
            </button>
            <button
              onClick={onCancel}
              className="w-full sm:w-auto px-4 py-2.5 text-muted hover:text-ink text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="pt-2">
            <button
              onClick={onCancel}
              className="px-6 py-2.5 rounded-full bg-bad hover:bg-red-700 text-white font-bold text-xs shadow-lg transition-colors cursor-pointer inline-flex items-center gap-1.5"
            >
              <span>✕</span> Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 2. Incoming Call Screen ──────────────────────────────────────
interface IncomingCallScreenProps {
  callerName: string;
  callerAvatar?: string;
  mode: 'voice' | 'video';
  onAccept: () => void;
  onDecline: () => void;
}

export function IncomingCallScreen({
  callerName,
  callerAvatar,
  mode,
  onAccept,
  onDecline,
}: IncomingCallScreenProps) {
  // Mobile vibration and tab title update
  useEffect(() => {
    const originalTitle = typeof document !== 'undefined' ? document.title : '';
    if (typeof document !== 'undefined') {
      document.title = `📞 ${callerName} is calling...`;
    }

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([200, 100, 200, 100, 200]);
    }

    return () => {
      if (typeof document !== 'undefined') {
        document.title = originalTitle;
      }
    };
  }, [callerName]);

  const initials = callerName
    ? callerName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'C';

  return (
    <div className="fixed inset-0 z-[150] bg-ink/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in select-none">
      <div className="bg-card border border-border rounded-[28px] max-w-sm w-full p-8 shadow-2xl text-center space-y-6 relative overflow-hidden">
        {/* Soft background pulse */}
        <div className="absolute inset-0 bg-radial from-amber/15 via-transparent to-transparent pointer-events-none" />

        {/* Pulsing Avatar */}
        <div className="relative mx-auto w-28 h-28 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-2 border-emerald-400 animate-ping motion-reduce:hidden opacity-50" />
          {callerAvatar ? (
            <img
              src={callerAvatar}
              alt={callerName}
              className="w-24 h-24 rounded-full object-cover shadow-2xl border-2 border-emerald-400"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-amber to-terracotta text-white flex items-center justify-center text-3xl font-serif font-bold shadow-2xl border-2 border-white/40">
              {initials}
            </div>
          )}
        </div>

        {/* Headings */}
        <div className="space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 font-mono">
            {mode === 'voice' ? 'Incoming Voice Call' : 'Incoming Video Call'}
          </span>
          <h2 className="text-2xl font-serif font-bold text-ink">{callerName}</h2>
          <p className="text-xs text-muted">is calling you right now...</p>
        </div>

        {/* Large thumb-friendly 64px round action buttons */}
        <div className="flex items-center justify-center gap-8 pt-2">
          {/* Decline Button */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              onClick={onDecline}
              className="w-16 h-16 rounded-full bg-bad hover:bg-red-700 text-white text-2xl shadow-xl flex items-center justify-center transition-transform hover:scale-105 active:scale-95 cursor-pointer border border-bad/40"
              title="Decline Call"
            >
              ✕
            </button>
            <span className="text-[11px] font-semibold text-bad">Decline</span>
          </div>

          {/* Accept Button */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              onClick={onAccept}
              className="w-16 h-16 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white text-2xl shadow-xl flex items-center justify-center transition-transform hover:scale-105 active:scale-95 cursor-pointer border border-emerald-400 animate-pulse motion-reduce:animate-none"
              title="Accept Call"
            >
              📞
            </button>
            <span className="text-[11px] font-semibold text-emerald-600">Accept</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 3. In-Call Shell (Header, Drawer Toggle, Leave Confirm) ───────
interface InCallShellProps {
  friendName: string;
  topic?: string;
  callDuration: number;
  connectionQuality?: 'good' | 'low' | 'very-low' | 'unknown';
  isChatOpen: boolean;
  onToggleChat: () => void;
  onLeaveCall: () => void;
  children: React.ReactNode;
  chatDrawer?: React.ReactNode;
}

export function InCallShell({
  friendName,
  topic,
  callDuration,
  connectionQuality = 'good',
  isChatOpen,
  onToggleChat,
  onLeaveCall,
  children,
  chatDrawer,
}: InCallShellProps) {
  const [showConfirmLeave, setShowConfirmLeave] = useState(false);

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getQualityDot = () => {
    switch (connectionQuality) {
      case 'good':
        return <span className="w-2 h-2 rounded-full bg-emerald-400" title="Connection: Good" />;
      case 'low':
        return <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" title="Connection: Low" />;
      case 'very-low':
        return <span className="w-2 h-2 rounded-full bg-bad animate-pulse" title="Connection: Poor" />;
      default:
        return <span className="w-2 h-2 rounded-full bg-emerald-400" title="Connected" />;
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#1C1917] rounded-2xl overflow-hidden relative select-none">
      {/* Slim Top Bar */}
      <header className="h-12 bg-zinc-950/80 border-b border-white/10 px-4 flex items-center justify-between z-30 shrink-0 backdrop-blur-md">
        <div className="flex items-center gap-2">
          {getQualityDot()}
          <span className="font-serif font-bold text-white text-xs truncate max-w-[140px] sm:max-w-xs">
            {friendName} {topic ? `• ${topic}` : ''}
          </span>
          <span className="text-[10px] text-emerald-400 font-mono font-bold bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-500/20">
            {formatTimer(callDuration)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Thread Chat Toggle Button */}
          <button
            onClick={onToggleChat}
            className={`px-3 py-1 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
              isChatOpen
                ? 'bg-amber text-ink'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            <span>💬</span>
            <span className="hidden sm:inline">Thread Chat</span>
          </button>

          {/* Leave Button */}
          <button
            onClick={() => setShowConfirmLeave(true)}
            className="px-3 py-1 rounded-xl bg-bad/80 hover:bg-bad text-white text-xs font-bold transition-colors cursor-pointer"
          >
            Leave
          </button>
        </div>
      </header>

      {/* Main Body: Stage + Chat Drawer */}
      <div className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 w-full h-full relative overflow-hidden flex flex-col">
          {children}
        </div>

        {/* Desktop Right Drawer / Mobile Bottom Sheet for Thread Chat */}
        {isChatOpen && (
          <div className="absolute sm:relative inset-y-0 right-0 w-full sm:w-80 md:w-96 bg-card border-l border-border z-40 flex flex-col shadow-2xl animate-slide-left">
            <div className="p-3 border-b border-border flex items-center justify-between">
              <span className="font-serif font-bold text-xs text-ink">
                Chat with {friendName}
              </span>
              <button
                onClick={onToggleChat}
                className="text-muted hover:text-ink text-sm font-bold cursor-pointer px-2"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-hidden">{chatDrawer}</div>
          </div>
        )}
      </div>

      {/* Confirm Leave Modal */}
      {showConfirmLeave && (
        <div className="absolute inset-0 z-50 bg-ink/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-card border border-border rounded-2xl max-w-xs w-full p-5 shadow-2xl text-center space-y-4">
            <h3 className="font-serif font-bold text-base text-ink">Leave call?</h3>
            <p className="text-xs text-muted">
              Are you sure you want to end this live session with {friendName}?
            </p>
            <div className="flex items-center justify-center gap-2 pt-1">
              <button
                onClick={() => setShowConfirmLeave(false)}
                className="px-4 py-2 bg-card-alt border border-border text-ink text-xs font-semibold rounded-xl hover:border-muted cursor-pointer"
              >
                Stay
              </button>
              <button
                onClick={() => {
                  setShowConfirmLeave(false);
                  onLeaveCall();
                }}
                className="px-4 py-2 bg-bad text-white text-xs font-bold rounded-xl hover:bg-red-700 cursor-pointer shadow-md"
              >
                Yes, Leave
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 4. After-Call Wrap-Up Screen ──────────────────────────────────
interface PostCallWrapUpProps {
  friendName: string;
  durationSeconds: number;
  onTakeQuiz: () => void;
  onClose: () => void;
  onRetryCall: () => void;
  wasMissed?: boolean;
}

export function PostCallWrapUpModal({
  friendName,
  durationSeconds,
  onTakeQuiz,
  onClose,
  onRetryCall,
  wasMissed,
}: PostCallWrapUpProps) {
  const [rating, setRating] = useState(5);
  const [feedback, setFeedback] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${s}s`;
  };

  const eligibleForQuiz = durationSeconds >= 60;

  return (
    <div className="fixed inset-0 z-[150] bg-ink/75 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in select-none">
      <div className="bg-card border border-border rounded-[24px] max-w-md w-full p-6 sm:p-8 shadow-2xl space-y-5 relative">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber font-mono">
              Session Summary
            </span>
            <h3 className="font-serif font-bold text-lg text-ink">
              {wasMissed ? 'Call Ended' : `Call with ${friendName}`}
            </h3>
          </div>
          {!wasMissed && (
            <span className="text-xs font-mono font-bold text-amber bg-amber/10 px-2.5 py-1 rounded-full border border-amber/20">
              {formatTimer(durationSeconds)}
            </span>
          )}
        </div>

        {wasMissed ? (
          <div className="text-center py-4 space-y-4">
            <p className="text-xs text-muted">
              The call with {friendName} was not connected or was declined.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={onRetryCall}
                className="px-5 py-2.5 bg-amber hover:bg-amber-600 text-ink font-bold text-xs rounded-xl shadow-md cursor-pointer"
              >
                🔄 Try Again
              </button>
              <button
                onClick={onClose}
                className="px-5 py-2.5 bg-card-alt border border-border hover:border-amber text-ink font-semibold text-xs rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* 5-star rating */}
            <div className="space-y-1.5 text-center">
              <label className="text-xs font-semibold text-ink block">How was the call audio & video quality?</label>
              <div className="flex items-center justify-center gap-1.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setRating(star)}
                    className={`text-2xl transition-transform hover:scale-110 cursor-pointer ${
                      star <= rating ? 'text-amber' : 'text-zinc-300'
                    }`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>

            {/* Optional notes */}
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Add quick notes on what you discussed or shared (optional)..."
              rows={2}
              className="w-full text-xs p-3 bg-card-alt border border-border rounded-xl text-ink placeholder-muted/60 outline-none focus:border-amber resize-none"
            />

            {/* Action Buttons */}
            <div className="flex flex-col gap-2 pt-2">
              {eligibleForQuiz ? (
                <button
                  onClick={onTakeQuiz}
                  className="w-full py-2.5 bg-amber hover:bg-amber-600 text-ink font-bold text-xs rounded-xl shadow-md transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span>📝</span> Take Quick Post-Call Quiz (+25 XP)
                </button>
              ) : (
                <p className="text-[11px] text-muted text-center italic">
                  Calls under 1 minute do not require a post-call quiz.
                </p>
              )}

              <button
                onClick={onClose}
                className="w-full py-2 bg-card-alt border border-border hover:border-amber text-ink font-semibold text-xs rounded-xl cursor-pointer"
              >
                {submitted ? '✓ Saved' : 'Done & Return to Chat'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
