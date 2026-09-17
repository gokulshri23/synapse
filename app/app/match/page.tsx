'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MOCK_PEERS } from '@/lib/constants';
import { createClient } from '@/lib/supabase/client';

interface PeerItem {
  id: string;
  name: string;
  email?: string;
  bio: string;
  domain?: string;
  score?: number;
  offers: string[];
  needs: string[];
  isReal?: boolean;
}

export default function MatchPage() {
  const router = useRouter();
  const supabase = createClient();

  const [studentName, setStudentName] = useState('Learner');
  const [studentEmail, setStudentEmail] = useState('');
  const [domain, setDomain] = useState('React');
  const [isDemo, setIsDemo] = useState(false);
  const [realPeers, setRealPeers] = useState<PeerItem[]>([]);
  const [demoPeers, setDemoPeers] = useState<PeerItem[]>([]);
  const [connectedPeers, setConnectedPeers] = useState<Record<string, boolean>>({});
  const [connectToast, setConnectToast] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    let currentEmail = '';
    try {
      const saved = localStorage.getItem('synapse_study_data');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.name) setStudentName(parsed.name);
        if (parsed.domain) setDomain(parsed.domain);
        if (parsed.email) {
          currentEmail = parsed.email;
          setStudentEmail(parsed.email);
        }
      } else {
        const cachedName = localStorage.getItem('synapse_user_name');
        if (cachedName) setStudentName(cachedName);
      }

      const cachedEmail = localStorage.getItem('synapse_user_email');
      if (cachedEmail) {
        currentEmail = cachedEmail;
        setStudentEmail(cachedEmail);
      }

      const demoActive = localStorage.getItem('synapse_demo_active') === 'true' || currentEmail.includes('demo');
      setIsDemo(demoActive);

      const savedConns = localStorage.getItem('synapse_connected_peers');
      if (savedConns) setConnectedPeers(JSON.parse(savedConns));
    } catch (e) {}

    // Fetch peers
    fetchPeers(currentEmail);
  }, []);

  const fetchPeers = async (currentEmail: string) => {
    setIsScanning(true);
    const discovered: PeerItem[] = [];

    try {
      // 1. Fetch from live multi-device peer-network
      const res = await fetch(`/api/peer-network?excludeEmail=${encodeURIComponent(currentEmail)}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.peers)) {
          data.peers.forEach((p: any) => {
            discovered.push({
              id: p.id || p.email,
              name: p.name || p.email.split('@')[0],
              email: p.email,
              bio: `Verified student • Track: ${p.domain || 'Engineering'} • Benchmark Score: ${p.score || 85}%`,
              domain: p.domain,
              score: p.score,
              offers: p.offers || [p.domain || 'Programming', 'Code Review'],
              needs: p.needs || ['Architecture Review', 'Pair Programming'],
              isReal: true
            });
          });
        }
      }
    } catch (err) {}

    try {
      // 2. Also check Supabase profiles
      const { data: dbProfiles } = await supabase
        .from('profiles')
        .select('*')
        .neq('email', currentEmail)
        .limit(10);

      if (dbProfiles && dbProfiles.length > 0) {
        dbProfiles.forEach((p: any) => {
          if (!discovered.some(rp => rp.email === p.email)) {
            discovered.push({
              id: p.id,
              name: p.full_name || p.email.split('@')[0],
              email: p.email,
              bio: `Registered student • Goal: ${p.learning_goal || 'Mastering full-stack skills'}`,
              domain: p.skill_level || 'General',
              score: 85,
              offers: [p.skill_level || 'Development', 'Debugging'],
              needs: ['System Design', 'Algorithms'],
              isReal: true
            });
          }
        });
      }
    } catch (e) {}

    setRealPeers(discovered);
    setDemoPeers(MOCK_PEERS.map(mp => ({ ...mp, isReal: false })));
    setIsScanning(false);
  };

  const handleConnect = (peer: PeerItem) => {
    const next = { ...connectedPeers, [peer.id]: true };
    setConnectedPeers(next);
    localStorage.setItem('synapse_connected_peers', JSON.stringify(next));
    localStorage.setItem('synapse_active_peer', JSON.stringify(peer));

    setConnectToast(`Connected with ${peer.name}! Live session initiated.`);
    setTimeout(() => {
      setConnectToast(null);
    }, 4000);
  };

  const handleOpenChat = (peer: PeerItem) => {
    localStorage.setItem('synapse_active_peer', JSON.stringify(peer));
    router.push('/app/sessions');
  };

  // Determine which peer list to display:
  // - If isDemo: display demo peers
  // - If Real User (personal login): STRICTLY display realPeers only! NEVER show mock peers!
  const activePeersToDisplay = isDemo ? demoPeers : realPeers;

  return (
    <div className="space-y-6 animate-fade-in pb-8 relative">
      {/* Toast Notification — Centered top */}
      {connectToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] max-w-md w-[90%] bg-card border border-amber text-ink p-4 rounded-2xl shadow-2xl flex items-center justify-between gap-4 animate-slide-down pointer-events-none">
          <div className="flex items-center gap-3">
            <span className="text-2xl shrink-0">🤝</span>
            <div>
              <p className="text-xs font-bold text-amber uppercase tracking-wider">Session Created</p>
              <p className="text-xs sm:text-sm font-medium text-ink">{connectToast}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => router.push('/app/sessions')}
            className="px-3 py-1.5 bg-amber hover:bg-terracotta text-white font-semibold text-xs rounded-xl whitespace-nowrap cursor-pointer shadow-xs pointer-events-auto"
          >
            Chat →
          </button>
        </div>
      )}

      {/* Main Bento Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Your Profile Match Criteria (1 Col) */}
        <div className="bg-card border border-border rounded-[22px] p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-serif font-bold text-ink">{studentName}&apos;s Profile</h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber/10 text-amber font-semibold border border-amber/20">
                {domain} Track
              </span>
            </div>

            <p className="text-xs text-muted mb-6 leading-relaxed">
              Our autonomous peer-matching algorithm pairs you with complementary learners based on your skill assessment gaps and strengths.
            </p>

            <div className="space-y-5">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-ok mb-2 flex items-center gap-1.5">
                  <span>🎓</span> What You Can Teach
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  <span className="px-3 py-1 bg-ok/10 text-ok border border-ok/30 rounded-full text-xs font-semibold">
                    {domain} Fundamentals
                  </span>
                  <span className="px-3 py-1 bg-ok/10 text-ok border border-ok/30 rounded-full text-xs font-semibold">
                    Component Architecture
                  </span>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-amber mb-2 flex items-center gap-1.5">
                  <span>🎯</span> What You Need
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  <span className="px-3 py-1 bg-amber/10 text-amber border border-amber/30 rounded-full text-xs font-semibold">
                    Advanced Concurrency
                  </span>
                  <span className="px-3 py-1 bg-amber/10 text-amber border border-amber/30 rounded-full text-xs font-semibold">
                    Performance Profiling
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-4 border-t border-border">
            <div className="flex items-center justify-between text-xs text-muted">
              <span>Matching Engine:</span>
              <span className="font-semibold text-ok flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-ok animate-pulse" /> Live Multi-Device Network
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Peer Matches (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card border border-border rounded-[22px] p-6 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-xl font-serif font-bold text-ink">
                  {isDemo ? 'Demo Mode: Simulated Peer Matches' : 'Real-Time Peer Matches'}
                </h2>
                <p className="text-xs text-muted mt-0.5">
                  {isDemo
                    ? 'Explore how complementary matching pairs you with peers based on skill gaps.'
                    : 'Showing verified students currently active across devices on your network.'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fetchPeers(studentEmail)}
                  disabled={isScanning}
                  className="px-3 py-1 bg-card-alt border border-border hover:border-amber text-ink rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <span className={isScanning ? 'animate-spin' : ''}>🔄</span>
                  <span>{isScanning ? 'Scanning...' : 'Scan Network'}</span>
                </button>
                <span className="text-xs font-semibold px-2.5 py-1 bg-card-alt border border-border rounded-lg text-ink">
                  {activePeersToDisplay.length} Available
                </span>
              </div>
            </div>

            {/* REAL USER WITH 0 PEERS YET: Show True Waiting Radar, NOT Fake Users */}
            {!isDemo && activePeersToDisplay.length === 0 ? (
              <div className="p-8 sm:p-10 rounded-2xl border-2 border-dashed border-border bg-card-alt flex flex-col items-center text-center gap-4 animate-fade-in my-2">
                <div className="relative w-16 h-16 rounded-full bg-amber/10 border border-amber/30 flex items-center justify-center text-3xl">
                  <span className="animate-pulse">📡</span>
                  <div className="absolute inset-0 rounded-full border border-amber/40 animate-ping" />
                </div>

                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-ok flex items-center justify-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-ok animate-pulse" /> Live Multi-Device Network Online
                  </span>
                  <h3 className="text-lg font-serif font-bold text-ink mt-1">
                    Waiting for Peer Connection on Another Device
                  </h3>
                  <p className="text-xs text-muted mt-1 max-w-md mx-auto leading-relaxed">
                    You are logged in with your real account (<strong>{studentEmail || studentName}</strong>).
                    To connect live with a peer, open Synapse on your <strong>second mobile phone or tablet</strong> and log in with another account.
                  </p>
                </div>

                <div className="w-full max-w-md p-4 bg-card rounded-xl border border-border text-left text-xs space-y-2">
                  <div className="flex justify-between items-center text-muted">
                    <span>1. Open on Mobile Device:</span>
                    <span className="font-mono text-ink font-semibold">http://0.0.0.0:3000</span>
                  </div>
                  <div className="flex justify-between items-center text-muted">
                    <span>2. Sign in with Peer Account:</span>
                    <span className="font-semibold text-ink">e.g. classmate@college.edu</span>
                  </div>
                  <div className="flex justify-between items-center text-muted">
                    <span>3. Automatic Discovery:</span>
                    <span className="font-bold text-ok">Appears here instantly!</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => fetchPeers(studentEmail)}
                  className="px-5 py-2.5 bg-amber hover:bg-terracotta text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-2"
                >
                  <span>🔄</span>
                  <span>Refresh Peer Network</span>
                </button>
              </div>
            ) : (
              /* Peers Grid (Displays Real Peers if Real User, or Demo Peers if Demo) */
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {activePeersToDisplay.map((peer, idx) => {
                  const isConnected = !!connectedPeers[peer.id];
                  const matchPct = 95 - (idx * 3);

                  return (
                    <div
                      key={peer.id}
                      className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                        isConnected
                          ? 'border-ok/40 bg-ok/5'
                          : 'border-border bg-card-alt hover:border-amber/60 hover:shadow-xs'
                      }`}
                    >
                      <div>
                        {/* Peer Header */}
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-amber to-terracotta text-white flex items-center justify-center font-bold text-sm shadow-xs">
                              {peer.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <h3 className="font-semibold text-ink text-sm leading-tight">{peer.name}</h3>
                                {peer.isReal && (
                                  <span className="text-[9px] px-1.5 py-0.5 bg-ok/15 text-ok font-bold rounded">
                                    LIVE
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-muted line-clamp-1">{peer.bio}</p>
                            </div>
                          </div>

                          <span className="px-2.5 py-1 bg-amber/10 border border-amber/25 text-amber text-xs font-bold rounded-lg shrink-0">
                            {matchPct}% Match
                          </span>
                        </div>

                        {/* Offers / Needs Tags */}
                        <div className="space-y-2.5 my-3 text-xs">
                          <div>
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted block mb-1">
                              Can Teach You:
                            </span>
                            <div className="flex flex-wrap gap-1">
                              {peer.offers.map((o) => (
                                <span
                                  key={o}
                                  className="px-2 py-0.5 bg-amber/15 text-amber border border-amber/30 rounded-md text-[11px] font-medium"
                                >
                                  {o}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div>
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted block mb-1">
                              Wants To Learn:
                            </span>
                            <div className="flex flex-wrap gap-1">
                              {peer.needs.map((n) => (
                                <span
                                  key={n}
                                  className="px-2 py-0.5 bg-card border border-border text-muted rounded-md text-[11px]"
                                >
                                  {n}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Action Button */}
                      <div className="pt-3 mt-1 border-t border-border/60">
                        {isConnected ? (
                          <div className="flex gap-2">
                            <span className="flex-1 py-2 px-3 text-center text-xs font-bold text-ok bg-ok/15 border border-ok/30 rounded-xl flex items-center justify-center gap-1.5">
                              <span>✓</span> Connected
                            </span>
                            <button
                              type="button"
                              onClick={() => handleOpenChat(peer)}
                              className="py-2 px-4 bg-amber hover:bg-terracotta text-white font-semibold text-xs rounded-xl transition-colors cursor-pointer"
                            >
                              Chat →
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleConnect(peer)}
                            className="w-full py-2.5 px-4 bg-amber hover:bg-terracotta text-white text-xs font-bold rounded-xl shadow-xs transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-2"
                          >
                            <span>🤝</span>
                            <span>Connect &amp; Pair</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Explanatory Info Card */}
          <div className="bg-card border border-border rounded-[22px] p-6 shadow-xs">
            <h3 className="text-lg font-serif font-bold text-ink mb-3">Multi-Device Live Pairing</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-muted">
              <div className="p-3 bg-card-alt rounded-xl border border-border">
                <span className="text-base block mb-1">📱</span>
                <span className="font-semibold text-ink block mb-0.5">Multi-Device Sync</span>
                <span>Open Synapse on 2 different phones or laptops. Each account will automatically discover the other here.</span>
              </div>
              <div className="p-3 bg-card-alt rounded-xl border border-border">
                <span className="text-base block mb-1">💬</span>
                <span className="font-semibold text-ink block mb-0.5">Real-Time Chat</span>
                <span>Send code snippets and messages back and forth in real-time across your connected devices.</span>
              </div>
              <div className="p-3 bg-card-alt rounded-xl border border-border">
                <span className="text-base block mb-1">🤖</span>
                <span className="font-semibold text-ink block mb-0.5">Gemini 3.6 AI Review</span>
                <span>Submit collaborative code challenges to Gemini 3.6 Flash for instant objective evaluation and scoring.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
