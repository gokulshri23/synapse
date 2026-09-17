'use client';

import React, { useState, useEffect } from 'react';

export default function ReputationPage() {
  const [studentName, setStudentName] = useState('Learner');
  const [studentTrack, setStudentTrack] = useState('React');
  const [xp, setXp] = useState(1250);
  const [selectedBadge, setSelectedBadge] = useState<{ name: string; emoji: string; desc: string; unlocked: boolean } | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('synapse_study_data');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.name) setStudentName(parsed.name);
        if (parsed.domain) setStudentTrack(parsed.domain);
      } else {
        const cachedName = localStorage.getItem('synapse_user_name');
        if (cachedName) setStudentName(cachedName);
      }
      const savedXp = localStorage.getItem('synapse_user_xp');
      if (savedXp) setXp(parseInt(savedXp, 10));
    } catch (e) {}
  }, []);

  const level = Math.floor(xp / 100) + 1;
  const xpInLevel = xp % 100;
  const levelProgress = xpInLevel;

  const events = [
    { id: 1, action: 'Completed Daily Mission', xp: '+50', time: 'Today', icon: '🎯' },
    { id: 2, action: 'Evaluated Code Challenge', xp: '+80', time: 'Yesterday', icon: '⚡' },
    { id: 3, action: 'Submitted Peer Review', xp: '+25', time: '2 days ago', icon: '✍️' },
    { id: 4, action: 'Mastered Foundational Concepts', xp: '+150', time: '3 days ago', icon: '🎓' },
  ];

  const badges = [
    { id: 1, name: 'First Steps', emoji: '🌱', desc: 'Completed the AI proctored assessment and created your first learning roadmap.', unlocked: true },
    { id: 2, name: 'Helpful Hand', emoji: '🖐️', desc: 'Conducted a peer review and offered constructive feedback to a study partner.', unlocked: true },
    { id: 3, name: 'Syntax Scholar', emoji: '⚛️', desc: 'Achieved over 80% benchmark mastery on primary domain topics.', unlocked: true },
    { id: 4, name: 'Code Reviewer', emoji: '👀', desc: 'Evaluated 5 peer artifact submissions via Gemini AI Evaluator.', unlocked: false },
    { id: 5, name: 'Master Teacher', emoji: '🧙‍♂️', desc: 'Helped 10 peers master locked nodes in their respective skill trees.', unlocked: false },
  ];

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Badge Detail Modal */}
      {selectedBadge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-6 shadow-2xl text-center flex flex-col items-center">
            <span className="text-5xl mb-3">{selectedBadge.emoji}</span>
            <h3 className="text-xl font-serif font-bold text-ink mb-1">{selectedBadge.name}</h3>
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider mb-3 ${
              selectedBadge.unlocked ? 'bg-ok/15 text-ok' : 'bg-muted/15 text-muted'
            }`}>
              {selectedBadge.unlocked ? 'Unlocked & Verified' : 'Locked Challenge'}
            </span>
            <p className="text-xs text-muted leading-relaxed mb-5">{selectedBadge.desc}</p>
            <button
              type="button"
              onClick={() => setSelectedBadge(null)}
              className="w-full py-2.5 bg-amber hover:bg-terracotta text-white font-semibold text-xs rounded-xl transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: XP & Level (2 Cols) */}
        <div className="md:col-span-2 bg-card border border-border rounded-[22px] p-6 sm:p-8 flex flex-col items-center justify-center text-center shadow-xs">
          <div className="w-full flex justify-between items-center mb-6">
            <h2 className="text-xl font-serif font-bold text-ink text-left">{studentName}'s Reputation & Mastery</h2>
            <span className="text-xs px-2.5 py-1 rounded-full bg-amber/10 text-amber font-bold border border-amber/20">
              {studentTrack} Track
            </span>
          </div>

          <div className="relative w-44 h-44 sm:w-48 sm:h-48 flex flex-col items-center justify-center rounded-full border-8 border-amber/15 mb-6 shadow-inner">
            <div
              className="absolute inset-0 rounded-full border-8 border-amber transition-all duration-1000"
              style={{
                clipPath: `polygon(0 0, 100% 0, 100% ${levelProgress}%, 0 ${levelProgress}%)`
              }}
            />
            <span className="text-xs uppercase font-semibold text-muted tracking-widest mb-0.5">Level</span>
            <span className="text-5xl sm:text-6xl font-serif font-bold text-ink tracking-tight">{level}</span>
          </div>

          <div className="w-full max-w-md space-y-2">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-ink">{xp} Total XP</span>
              <span className="text-muted">{100 - xpInLevel} XP to Level {level + 1}</span>
            </div>
            <div className="h-3 w-full bg-border rounded-full overflow-hidden">
              <div
                className="h-full bg-amber rounded-full transition-all duration-700 shadow-xs"
                style={{ width: `${levelProgress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Card 2: Reputation Activity Ledger (1 Col) */}
        <div className="bg-card border border-border rounded-[22px] p-6 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-serif font-bold text-ink mb-4">Reputation Ledger</h3>
            <div className="space-y-3">
              {events.map((ev) => (
                <div key={ev.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-card-alt border border-border">
                  <div className="text-xl p-2 bg-card rounded-lg border border-border shrink-0 shadow-2xs">
                    {ev.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-ink truncate">{ev.action}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] font-bold text-amber">{ev.xp} XP</span>
                      <span className="text-[10px] text-muted">• {ev.time}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-3 bg-card-alt rounded-xl border border-border text-[11px] text-muted mt-4">
            Teaching peers and submitting code reviews earns 2x bonus XP.
          </div>
        </div>

        {/* Card 3: Earned Badges (2 Cols) */}
        <div className="md:col-span-2 bg-card border border-border rounded-[22px] p-6 shadow-xs">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-serif font-bold text-ink">Earned & Available Badges</h3>
            <span className="text-xs text-muted">Click any badge for criteria</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {badges.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setSelectedBadge(b)}
                className={`p-4 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-between ${
                  b.unlocked
                    ? 'border-amber/40 bg-card-alt hover:border-amber hover:scale-105 shadow-xs'
                    : 'border-border-dashed bg-card-alt/40 opacity-50 grayscale hover:opacity-80'
                }`}
              >
                <span className="text-3xl mb-2">{b.emoji}</span>
                <span className="text-xs font-semibold text-ink leading-tight">{b.name}</span>
                <span className="text-[10px] font-bold text-muted mt-1">
                  {b.unlocked ? 'Unlocked' : 'Locked'}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Card 4: Mentor Status (1 Col) */}
        <div className="bg-card border border-border rounded-[22px] p-6 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-serif font-bold text-ink mb-2">Mentor Status</h3>
            <p className="text-xs text-muted mb-4">Become a Certified Peer Mentor by helping learners in your track.</p>

            <div className="p-4 rounded-xl border border-amber/25 bg-amber/5 text-center">
              <span className="text-3xl block mb-2">🏅</span>
              <h4 className="text-sm font-semibold text-ink mb-1">Mentor Qualification: 75%</h4>
              <p className="text-xs text-muted leading-relaxed mb-3">
                Complete 2 more peer sessions as an instructor to unlock the Mentor badge.
              </p>
              <div className="h-2 w-full bg-border rounded-full overflow-hidden">
                <div className="h-full bg-amber rounded-full" style={{ width: '75%' }} />
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => alert('Mentor Application: Complete 2 more active peer pairing sessions to automatically certify!')}
            className="w-full mt-4 py-2.5 px-4 bg-card-alt hover:bg-card border border-border text-ink rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            Check Mentor Eligibility →
          </button>
        </div>
      </div>
    </div>
  );
}
