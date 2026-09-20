'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import ThemeToggle from '@/components/ui/ThemeToggle';

export default function SettingsPage() {
  const supabase = createClient();
  const router = useRouter();

  const [fullName, setFullName] = useState('Alex Morgan');
  const [email, setEmail] = useState('alex.morgan@synapse.edu');
  const [bio, setBio] = useState('Full-stack learner exploring deliberate peer practice.');
  const [studyDomain, setStudyDomain] = useState('React');
  const [studyLevel, setStudyLevel] = useState('intermediate');
  const [studyScore, setStudyScore] = useState(85);
  const [studyGoal, setStudyGoal] = useState('30-day sprint to skill mastery');
  const [learningStyle, setLearningStyle] = useState('Practical (Code & Projects)');
  const [availability, setAvailability] = useState('Evenings & Weekends');
  
  const [notifications, setNotifications] = useState({
    matches: true,
    messages: true,
    reports: false,
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('synapse_study_data');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.name) setFullName(parsed.name);
        if (parsed.email) setEmail(parsed.email);
        if (parsed.bio) setBio(parsed.bio);
        if (parsed.domain) setStudyDomain(parsed.domain);
        if (parsed.level) setStudyLevel(parsed.level);
        if (typeof parsed.score === 'number') setStudyScore(parsed.score);
        if (parsed.goal) setStudyGoal(parsed.goal);
      } else {
        const cachedName = localStorage.getItem('synapse_user_name');
        if (cachedName) setFullName(cachedName);
        const cachedEmail = localStorage.getItem('synapse_user_email');
        if (cachedEmail) setEmail(cachedEmail);
      }
    } catch (e) {}
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const saved = localStorage.getItem('synapse_study_data');
      const existing = saved ? JSON.parse(saved) : {};
      const updated = {
        ...existing,
        name: fullName.trim(),
        bio: bio.trim(),
        domain: studyDomain,
      };
      localStorage.setItem('synapse_study_data', JSON.stringify(updated));
      localStorage.setItem('synapse_user_name', fullName.trim());
      if (email) {
        localStorage.setItem(`synapse_study_data_${email.toLowerCase()}`, JSON.stringify(updated));
      }

      // Sync to cloud profile API for multi-device consistency
      if (email) {
        fetch('/api/user-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: fullName.trim(),
            email: email.toLowerCase(),
            bio: bio.trim(),
            domain: studyDomain,
            level: studyLevel,
            score: studyScore,
            goal: studyGoal,
            onboarding_complete: true,
          }),
        }).catch(() => {});
      }

      // Attempt Supabase save
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('profiles').upsert({
          id: user.id,
          full_name: fullName.trim(),
          bio: bio.trim(),
        });
      }

      showToast('Profile and study details saved successfully!');
    } catch (err) {
      showToast('Settings saved locally.');
    }
  };

  const toggleNotification = (key: keyof typeof notifications) => {
    setNotifications(prev => ({ ...prev, [key]: !prev[key] }));
    showToast('Notification preference updated.');
  };

  const handleRetakeQuiz = () => {
    // Clear completion marker so user goes through assessment wizard
    if (email) {
      localStorage.removeItem(`synapse_study_data_${email.toLowerCase()}`);
    }
    router.push('/onboarding');
  };

  const handleLogout = async () => {
    try {
      document.cookie = 'synapse_demo_session=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      localStorage.removeItem('synapse_study_data');
      localStorage.removeItem('synapse_user_name');
      localStorage.removeItem('synapse_user_email');
      localStorage.removeItem('synapse_demo_active');
      localStorage.removeItem('synapse_active_peer');
      localStorage.removeItem('synapse_connected_peers');
      localStorage.removeItem('synapse_mission_done');
      localStorage.removeItem('synapse_user_xp');
      sessionStorage.clear();
      await supabase.auth.signOut();
    } catch (e) {}
    router.push('/login');
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in pb-12">
      {/* Centered Top Floating Toast */}
      {toastMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] max-w-md w-[90%] bg-card border border-ok text-ink p-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-slide-down">
          <span className="text-xl shrink-0">✅</span>
          <p className="text-xs sm:text-sm font-semibold">{toastMessage}</p>
        </div>
      )}

      <div>
        <h1 className="text-2xl sm:text-3xl font-serif font-bold text-ink">Settings & Profile</h1>
        <p className="text-sm text-muted mt-1">Manage your student details, active study track, theme, and peer pairing preferences.</p>
      </div>

      {/* Card 1: Student Study & Assessment Profile (Prominent at top) */}
      <div className="bg-card border border-border rounded-[22px] p-6 shadow-xs space-y-4">
        <div className="flex justify-between items-start">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-amber block mb-1">
              Active Study Plan
            </span>
            <h2 className="text-lg font-serif font-bold text-ink">Student Learning Profile</h2>
          </div>
          <span className="px-3 py-1 bg-amber/10 text-amber border border-amber/25 rounded-full text-xs font-bold">
            {studyDomain} Track
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 text-xs">
          <div className="p-3 bg-card-alt rounded-xl border border-border">
            <span className="text-muted block text-[10px] uppercase font-semibold">Student Name</span>
            <span className="font-bold text-ink text-sm truncate block mt-0.5">{fullName}</span>
          </div>
          <div className="p-3 bg-card-alt rounded-xl border border-border">
            <span className="text-muted block text-[10px] uppercase font-semibold">Track & Domain</span>
            <span className="font-bold text-ink text-sm block mt-0.5">{studyDomain}</span>
          </div>
          <div className="p-3 bg-card-alt rounded-xl border border-border">
            <span className="text-muted block text-[10px] uppercase font-semibold">Quiz Score</span>
            <span className="font-bold text-ok text-sm block mt-0.5">{studyScore}%</span>
          </div>
          <div className="p-3 bg-card-alt rounded-xl border border-border">
            <span className="text-muted block text-[10px] uppercase font-semibold">Assessed Level</span>
            <span className="font-bold text-ink text-sm capitalize block mt-0.5">{studyLevel}</span>
          </div>
        </div>

        <div className="p-3.5 bg-card-alt rounded-xl border border-border text-xs flex items-center justify-between gap-3">
          <div>
            <span className="text-muted block text-[10px] uppercase font-semibold">Current Goal</span>
            <span className="font-medium text-ink">{studyGoal}</span>
          </div>
          <button
            type="button"
            onClick={handleRetakeQuiz}
            className="px-4 py-2 bg-amber hover:bg-terracotta text-white font-bold rounded-xl text-xs transition-colors shrink-0 shadow-xs cursor-pointer"
          >
            📝 Retake Assessment Quiz
          </button>
        </div>
      </div>

      {/* Card 2: Appearance & Theme */}
      <div className="bg-card border border-border rounded-[22px] p-6 shadow-xs">
        <h2 className="text-lg font-serif font-bold text-ink mb-1">Appearance</h2>
        <p className="text-xs text-muted mb-4">Toggle between warm paper-and-ink light theme and obsidian dark bento grid.</p>

        <div className="flex items-center justify-between p-4 bg-card-alt rounded-2xl border border-border">
          <div>
            <span className="text-sm font-semibold text-ink block">Theme Mode</span>
            <span className="text-xs text-muted">Switch color scheme across all sections</span>
          </div>
          <ThemeToggle />
        </div>
      </div>

      {/* Card 3: Personal Profile Details Form */}
      <form onSubmit={handleSaveProfile} className="bg-card border border-border rounded-[22px] p-6 shadow-xs space-y-4">
        <h2 className="text-lg font-serif font-bold text-ink mb-1">Personal Details</h2>
        <p className="text-xs text-muted mb-4">Information shown across peer matching and collaborative rooms.</p>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted ml-1">
            Display Name
          </label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            className="w-full p-3.5 rounded-xl bg-card-alt border border-border text-ink text-sm outline-none focus:border-amber focus:ring-2 focus:ring-amber/20"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted ml-1">
            Email Address (Read-only)
          </label>
          <input
            type="email"
            value={email}
            disabled
            className="w-full p-3.5 rounded-xl bg-card-alt border border-border text-muted text-sm opacity-70 cursor-not-allowed"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted ml-1">
            Bio & Study Interests
          </label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="w-full p-3.5 rounded-xl bg-card-alt border border-border text-ink text-sm outline-none focus:border-amber focus:ring-2 focus:ring-amber/20 h-24"
          />
        </div>

        <button
          type="submit"
          className="py-3 px-6 bg-amber hover:bg-terracotta text-white rounded-xl text-xs font-bold transition-all shadow-xs active:scale-98 cursor-pointer"
        >
          Save Profile Changes
        </button>
      </form>

      {/* Card 4: Notification Preferences */}
      <div className="bg-card border border-border rounded-[22px] p-6 shadow-xs space-y-4">
        <h2 className="text-lg font-serif font-bold text-ink mb-1">Notification Preferences</h2>
        <p className="text-xs text-muted mb-4">Control study alerts and session invite notifications.</p>

        <div className="space-y-3">
          {[
            { key: 'matches' as const, label: 'Peer Match Alerts', desc: 'Notify me when a high-compatibility peer is found' },
            { key: 'messages' as const, label: 'Chat & Session Messages', desc: 'Instant alerts when peers reply in session rooms' },
            { key: 'reports' as const, label: 'Weekly Mastery Reports', desc: 'Summary of unlocked skills and ODAEA adaptation updates' },
          ].map((item) => {
            const isChecked = notifications[item.key];
            return (
              <div
                key={item.key}
                onClick={() => toggleNotification(item.key)}
                className="flex items-center justify-between p-3.5 bg-card-alt rounded-xl border border-border cursor-pointer hover:border-amber/40 transition-colors"
              >
                <div>
                  <span className="text-xs font-semibold text-ink block">{item.label}</span>
                  <span className="text-[11px] text-muted">{item.desc}</span>
                </div>
                <div className={`w-11 h-6 rounded-full relative transition-colors duration-200 ${isChecked ? 'bg-amber' : 'bg-border'}`}>
                  <div className={`absolute top-1 bg-white w-4 h-4 rounded-full shadow-xs transition-transform duration-200 ${isChecked ? 'right-1' : 'left-1'}`} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Card 5: Peer Preferences */}
      <div className="bg-card border border-border rounded-[22px] p-6 shadow-xs space-y-4">
        <h2 className="text-lg font-serif font-bold text-ink mb-1">Pairing Preferences</h2>
        <p className="text-xs text-muted mb-4">Fine-tune the autonomous peer-matching algorithm.</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted ml-1">
              Preferred Learning Style
            </label>
            <select
              value={learningStyle}
              onChange={(e) => { setLearningStyle(e.target.value); showToast('Learning style updated.'); }}
              className="w-full p-3.5 rounded-xl bg-card-alt border border-border text-ink text-xs font-medium outline-none focus:border-amber"
            >
              <option>Practical (Code & Projects)</option>
              <option>Visual (Diagrams & Architecture)</option>
              <option>Theoretical (Deep-dive specs)</option>
              <option>Interview Prep (Speed & Algorithms)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted ml-1">
              Availability Window
            </label>
            <select
              value={availability}
              onChange={(e) => { setAvailability(e.target.value); showToast('Availability updated.'); }}
              className="w-full p-3.5 rounded-xl bg-card-alt border border-border text-ink text-xs font-medium outline-none focus:border-amber"
            >
              <option>Evenings & Weekends</option>
              <option>Morning Sprints</option>
              <option>Flexible / Asynchronous</option>
            </select>
          </div>
        </div>
      </div>

      {/* Card 6: Account & Logout */}
      <div className="bg-card border border-border rounded-[22px] p-6 shadow-xs flex items-center justify-between">
        <div>
          <span className="text-sm font-semibold text-ink block">Session & Account</span>
          <span className="text-xs text-muted">Sign out of this device</span>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="py-2.5 px-5 bg-bad/10 hover:bg-bad/20 text-bad font-semibold rounded-xl text-xs transition-colors cursor-pointer border border-bad/20"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
