'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MOCK_PEERS } from '@/lib/constants';
import { createClient } from '@/lib/supabase/client';
import {
  runPeerMatchingAgent,
  PeerMatchResult,
  AgentActivityLog,
  PROFICIENCY_LABELS,
  parseProficiency,
  PeerRole,
} from '@/lib/agents/peer-matching-agent';

export default function MatchPage() {
  const router = useRouter();
  const supabase = createClient();

  const [studentName, setStudentName] = useState('Learner');
  const [studentEmail, setStudentEmail] = useState('');
  const [domain, setDomain] = useState('React');
  const [userLevel, setUserLevel] = useState<any>('intermediate');
  const [isDemo, setIsDemo] = useState(false);

  // Tab State: Matches vs Connection Requests
  const [activeTab, setActiveTab] = useState<'matches' | 'requests'>('matches');

  // Agent State
  const [agentMatches, setAgentMatches] = useState<PeerMatchResult[]>([]);
  const [agentLogs, setAgentLogs] = useState<AgentActivityLog[]>([]);
  const [emptyStateReason, setEmptyStateReason] = useState<string | null>(null);
  const [expandedBreakdown, setExpandedBreakdown] = useState<Record<string, boolean>>({});

  // Connections State
  const [incomingRequests, setIncomingRequests] = useState<any[]>([]);
  const [activeConnections, setActiveConnections] = useState<any[]>([]);
  const [pendingOutgoing, setPendingOutgoing] = useState<Record<string, boolean>>({});

  const [connectToast, setConnectToast] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    let currentEmail = '';
    let currentName = 'Learner';
    let currentDomain = 'React';
    let currentLevel: any = 'intermediate';

    try {
      const saved = localStorage.getItem('synapse_study_data');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.name) currentName = parsed.name;
        if (parsed.domain) currentDomain = parsed.domain;
        if (parsed.level) currentLevel = parsed.level;
        if (parsed.email) currentEmail = parsed.email;
      } else {
        const cachedName = localStorage.getItem('synapse_user_name');
        if (cachedName) currentName = cachedName;
      }

      const cachedEmail = localStorage.getItem('synapse_user_email');
      if (cachedEmail) currentEmail = cachedEmail;

      setStudentName(currentName);
      setStudentEmail(currentEmail);
      setDomain(currentDomain);
      setUserLevel(currentLevel);

      const demoActive = localStorage.getItem('synapse_demo_active') === 'true' || currentEmail.includes('demo');
      setIsDemo(demoActive);

      const savedOutgoing = localStorage.getItem('synapse_pending_outgoing');
      if (savedOutgoing) setPendingOutgoing(JSON.parse(savedOutgoing));
    } catch (e) {}

    // Fetch peers and run matching agent
    fetchAndMatchPeers(currentEmail, currentName, currentDomain, currentLevel);
    fetchConnections(currentEmail);
  }, []);

  const fetchConnections = async (email: string) => {
    if (!email) return;
    try {
      const res = await fetch(`/api/connections?userId=${encodeURIComponent(email)}`);
      if (res.ok) {
        const data = await res.json();
        setIncomingRequests(data.pendingIncoming || []);
        setActiveConnections(data.active || []);

        const outgoingMap: Record<string, boolean> = {};
        (data.pendingOutgoing || []).forEach((c: any) => {
          outgoingMap[c.recipientId] = true;
        });
        setPendingOutgoing(outgoingMap);
        localStorage.setItem('synapse_pending_outgoing', JSON.stringify(outgoingMap));
      }
    } catch (e) {}
  };

  const fetchAndMatchPeers = async (
    currentEmail: string,
    currentName: string,
    currentDomain: string,
    lvl: any
  ) => {
    setIsScanning(true);
    const discoveredPeers: any[] = [];

    try {
      // 1. Fetch from live multi-device peer network (filtered by onboarding_complete = true)
      const res = await fetch(`/api/peer-network?excludeEmail=${encodeURIComponent(currentEmail)}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.peers)) {
          data.peers.forEach((p: any) => {
            discoveredPeers.push({
              id: p.id || p.email,
              name: p.name || p.email.split('@')[0],
              email: p.email,
              avatar: p.avatar,
              domain: p.domain || 'React',
              level: p.numeric_level ?? p.level ?? 2,
              numeric_level: p.numeric_level ?? 2,
              offers: p.offers || [p.domain, 'Problem Solving'],
              needs: p.needs || ['Architecture', 'Optimization'],
              onboarding_complete: p.onboarding_complete !== false,
            });
          });
        }
      }
    } catch (err) {}

    try {
      // 2. Query Supabase profiles
      const { data: dbProfiles } = await supabase
        .from('profiles')
        .select('*')
        .neq('email', currentEmail)
        .eq('onboarding_complete', true)
        .limit(10);

      if (dbProfiles && dbProfiles.length > 0) {
        dbProfiles.forEach((p: any) => {
          if (!discoveredPeers.some((dp) => dp.email === p.email)) {
            discoveredPeers.push({
              id: p.id,
              name: p.full_name || p.email.split('@')[0],
              email: p.email,
              avatar: p.avatar_url,
              domain: p.skill_level || 'React',
              level: p.skill_level || 2,
              offers: [p.skill_level || 'React', 'Problem Solving'],
              needs: ['System Design', 'Algorithms'],
              onboarding_complete: true,
            });
          }
        });
      }
    } catch (e) {}

    // Add mock peers pool if in demo mode or if no real peers discovered yet
    const demoActive = localStorage.getItem('synapse_demo_active') === 'true' || currentEmail.includes('demo');
    const peersPool = discoveredPeers.length > 0
      ? discoveredPeers
      : MOCK_PEERS.map((mp, i) => ({
          id: mp.id,
          name: mp.name,
          email: `${mp.name.toLowerCase().replace(' ', '.')}@synapse.edu`,
          avatar: mp.avatar_url,
          domain: mp.offers[0] || 'React',
          level: (i % 3) + 2,
          numeric_level: (i % 3) + 2,
          offers: mp.offers,
          needs: mp.needs,
          onboarding_complete: true,
        }));

    // Step 1 to 14: Execute the Autonomous Peer Matching Agent
    const currentUserObj = {
      id: currentEmail || 'current_user',
      name: currentName,
      email: currentEmail,
      domain: currentDomain,
      level: lvl,
      offers: [currentDomain, 'Problem Solving'],
      needs: [currentDomain === 'React' ? 'Python' : 'React', 'Architecture'],
    };

    const agentResult = runPeerMatchingAgent(currentUserObj, peersPool);

    setAgentMatches(agentResult.matches);
    setAgentLogs(agentResult.activityLogs);
    setEmptyStateReason(agentResult.emptyStateReason || null);
    setIsScanning(false);
  };

  const handleSendConnectionRequest = async (match: PeerMatchResult) => {
    const myId = (studentEmail || studentName).trim().toLowerCase();
    const updatedPending = { ...pendingOutgoing, [match.peerId]: true };
    setPendingOutgoing(updatedPending);
    localStorage.setItem('synapse_pending_outgoing', JSON.stringify(updatedPending));

    try {
      const res = await fetch('/api/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          requesterId: myId,
          requesterName: studentName,
          recipientId: match.peerId,
          recipientName: match.peerName,
          skillArea: match.primarySkill,
        }),
      });

      if (res.ok) {
        setConnectToast(`Connection request sent to ${match.peerName}! Chat unlocks once accepted.`);
        setTimeout(() => setConnectToast(null), 4500);
      }
    } catch (e) {
      setConnectToast(`Request recorded locally for ${match.peerName}`);
      setTimeout(() => setConnectToast(null), 3000);
    }
  };

  const handleAcceptRequest = async (conn: any) => {
    try {
      const res = await fetch('/api/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'accept',
          connectionId: conn.id,
        }),
      });

      if (res.ok) {
        setIncomingRequests((prev) => prev.filter((r) => r.id !== conn.id));
        setActiveConnections((prev) => [...prev, { ...conn, status: 'accepted' }]);

        // Save active peer for immediate collaboration
        const activePeerObj = {
          id: conn.requesterId,
          name: conn.requesterName,
          domain: conn.skillArea,
          isReal: true,
        };
        localStorage.setItem('synapse_active_peer', JSON.stringify(activePeerObj));

        setConnectToast(`Accepted request from ${conn.requesterName}! Chat is now unlocked.`);
        setTimeout(() => setConnectToast(null), 4000);
      }
    } catch (e) {}
  };

  const handleDeclineRequest = async (connId: string) => {
    try {
      await fetch('/api/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'decline',
          connectionId: connId,
        }),
      });
      setIncomingRequests((prev) => prev.filter((r) => r.id !== connId));
    } catch (e) {}
  };

  const handleOpenChat = (peerName: string, peerId: string, skill: string) => {
    localStorage.setItem(
      'synapse_active_peer',
      JSON.stringify({
        id: peerId,
        name: peerName,
        domain: skill,
        isReal: true,
      })
    );
    router.push('/app/sessions');
  };

  const getRoleBadgeStyle = (role: PeerRole) => {
    switch (role) {
      case 'TEACHER':
        return 'bg-ok/15 text-ok border-ok/30';
      case 'PEER HELPER':
        return 'bg-amber/15 text-amber border-amber/30';
      case 'TEACHER + LEARNER':
        return 'bg-blue-500/15 text-blue-600 border-blue-500/30';
      case 'MENTOR':
        return 'bg-purple-500/15 text-purple-600 border-purple-500/30';
      default:
        return 'bg-muted/15 text-muted border-border';
    }
  };

  const isAlreadyConnected = (peerId: string) => {
    const norm = peerId.trim().toLowerCase();
    return activeConnections.some(
      (c) => c.requesterId === norm || c.recipientId === norm
    );
  };

  return (
    <div className="space-y-6 animate-fade-in pb-8 relative">
      {/* Toast Notification */}
      {connectToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] max-w-md w-[90%] bg-card border border-amber text-ink p-4 rounded-2xl shadow-2xl flex items-center justify-between gap-4 animate-slide-down pointer-events-none">
          <div className="flex items-center gap-3">
            <span className="text-2xl shrink-0">🤝</span>
            <div>
              <p className="text-xs font-bold text-amber uppercase tracking-wider">Peer Network</p>
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

      {/* Autonomous Peer-Matching Agent: Live Activity Loop Header */}
      <div className="bg-card border border-border rounded-[22px] p-5 sm:p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber/10 border border-amber/30 flex items-center justify-center text-xl">
              🤖
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-serif font-bold text-ink">
                  Autonomous Peer-Matching Agent
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-ok/15 text-ok font-bold border border-ok/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-ok animate-pulse" /> ACTIVE PIPELINE
                </span>
              </div>
              <p className="text-xs text-muted">
                14-step graph matching • Multi-hop learning chains • 6-factor weighted compatibility
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fetchAndMatchPeers(studentEmail, studentName, domain, userLevel)}
              disabled={isScanning}
              className="px-3.5 py-1.5 bg-card-alt border border-border hover:border-amber text-ink rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span className={isScanning ? 'animate-spin' : ''}>🔄</span>
              <span>{isScanning ? 'Executing Loop...' : 'Re-run Matching Loop'}</span>
            </button>
          </div>
        </div>

        {/* Live Loop Stage Indicators */}
        <div className="pt-4">
          <div className="flex items-center justify-between overflow-x-auto pb-2 gap-2 text-[10px] sm:text-xs font-mono">
            {[
              'OBSERVE',
              'UNDERSTAND',
              'CLASSIFY',
              'IDENTIFY GAPS',
              'SEARCH',
              'BUILD MATCHES',
              'EVALUATE NETWORK',
              'CREATE CONNECTIONS',
              'EXPLAIN',
            ].map((step, idx) => (
              <div key={step} className="flex items-center gap-1.5 shrink-0">
                <span className="px-2 py-1 bg-amber/10 border border-amber/25 text-amber font-semibold rounded-md">
                  {idx + 1}. {step}
                </span>
                {idx < 8 && <span className="text-muted/60">→</span>}
              </div>
            ))}
          </div>

          {/* Recent Loop Logs Terminal View */}
          <div className="mt-3 p-3 bg-card-alt rounded-xl border border-border text-[11px] font-mono space-y-1 max-h-28 overflow-y-auto">
            {agentLogs.length === 0 ? (
              <p className="text-muted">Agent initializing observation phase...</p>
            ) : (
              agentLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-2">
                  <span className="text-muted shrink-0">[{log.timestamp}]</span>
                  <span className="font-bold text-amber shrink-0">{log.step}:</span>
                  <span className="text-ink">{log.detail}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Main Bento Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Your Profile & Skill Frontier (1 Col) */}
        <div className="bg-card border border-border rounded-[22px] p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-serif font-bold text-ink">{studentName}&apos;s Profile</h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber/10 text-amber font-semibold border border-amber/20">
                {domain} Track
              </span>
            </div>

            <div className="p-3.5 bg-card-alt rounded-xl border border-border mb-5 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-muted">Assessed Level:</span>
                <span className="font-bold text-ink capitalize">
                  Level {parseProficiency(userLevel)} ({PROFICIENCY_LABELS[parseProficiency(userLevel)]})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Teaching Status:</span>
                <span className="font-semibold text-ok">
                  {parseProficiency(userLevel) >= 3
                    ? 'Certified Primary Teacher'
                    : parseProficiency(userLevel) === 2
                    ? 'Certified Peer Helper'
                    : 'Active Learner'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Target Objective:</span>
                <span className="font-semibold text-amber">Level {Math.min(5, parseProficiency(userLevel) + 2)} Mastery</span>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-ok mb-2 flex items-center gap-1.5">
                  <span>🎓</span> Eligible to Teach / Help
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  <span className="px-3 py-1 bg-ok/10 text-ok border border-ok/30 rounded-full text-xs font-semibold">
                    {domain} Fundamentals
                  </span>
                  <span className="px-3 py-1 bg-ok/10 text-ok border border-ok/30 rounded-full text-xs font-semibold">
                    Problem Solving
                  </span>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-amber mb-2 flex items-center gap-1.5">
                  <span>🎯</span> Seeking Guidance In
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  <span className="px-3 py-1 bg-amber/10 text-amber border border-amber/30 rounded-full text-xs font-semibold">
                    Advanced Concurrency
                  </span>
                  <span className="px-3 py-1 bg-amber/10 text-amber border border-amber/30 rounded-full text-xs font-semibold">
                    System Architecture
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

        {/* Right Column: Tabbed View (Matches vs Requests) (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card border border-border rounded-[22px] p-6 shadow-xs">
            {/* Tab Selector Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-4 border-b border-border">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('matches')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'matches'
                      ? 'bg-amber text-white shadow-xs'
                      : 'bg-card-alt text-muted border border-border hover:text-ink'
                  }`}
                >
                  Matched Peers ({agentMatches.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('requests')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'requests'
                      ? 'bg-amber text-white shadow-xs'
                      : 'bg-card-alt text-muted border border-border hover:text-ink'
                  }`}
                >
                  <span>Incoming Requests</span>
                  {incomingRequests.length > 0 && (
                    <span className="w-4 h-4 rounded-full bg-bad text-white text-[10px] flex items-center justify-center font-bold">
                      {incomingRequests.length}
                    </span>
                  )}
                </button>
              </div>

              <span className="text-xs font-semibold px-2.5 py-1 bg-card-alt border border-border rounded-lg text-ink">
                {activeTab === 'matches' ? `${agentMatches.length} Matches Ranked` : `${incomingRequests.length} Pending`}
              </span>
            </div>

            {/* TAB 1: Matched Peers Content */}
            {activeTab === 'matches' && (
              <div>
                {agentMatches.length === 0 ? (
                  /* Step 11: Honest Dead-End State */
                  <div className="p-8 rounded-2xl border-2 border-dashed border-border bg-card-alt flex flex-col items-center text-center gap-3 animate-fade-in my-2">
                    <span className="text-3xl">📡</span>
                    <h3 className="text-base font-serif font-bold text-ink">No Suitable Peer Currently Available</h3>
                    <p className="text-xs text-muted max-w-md leading-relaxed">
                      {emptyStateReason ||
                        "No peer currently matches your exact skill gap and target proficiency. We've queued your profile and will pair you the moment a suitable peer joins."}
                    </p>
                    <button
                      type="button"
                      onClick={() => fetchAndMatchPeers(studentEmail, studentName, domain, userLevel)}
                      className="mt-2 px-4 py-2 bg-amber hover:bg-terracotta text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-2"
                    >
                      <span>🔄</span>
                      <span>Scan Network Again</span>
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {agentMatches.map((match) => {
                      const isConnected = isAlreadyConnected(match.peerId);
                      const isPending = !!pendingOutgoing[match.peerId];
                      const isExpanded = !!expandedBreakdown[match.matchId];

                      return (
                        <div
                          key={match.matchId}
                          className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                            isConnected
                              ? 'border-ok/40 bg-ok/5'
                              : isPending
                              ? 'border-amber/40 bg-amber/5'
                              : 'border-border bg-card-alt hover:border-amber/60 hover:shadow-xs'
                          }`}
                        >
                          <div>
                            {/* Peer Header */}
                            <div className="flex justify-between items-start mb-3">
                              <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-amber to-terracotta text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
                                  {match.peerName
                                    .split(' ')
                                    .map((n) => n[0])
                                    .join('')
                                    .slice(0, 2)}
                                </div>
                                <div>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <h3 className="font-semibold text-ink text-sm leading-tight">{match.peerName}</h3>
                                    <span
                                      className={`text-[9px] px-1.5 py-0.5 rounded font-bold border ${getRoleBadgeStyle(
                                        match.peerRole
                                      )}`}
                                    >
                                      {match.peerRole}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-muted line-clamp-1">{match.primarySkill} Specialist</p>
                                </div>
                              </div>

                              <div className="text-right shrink-0">
                                <span className="px-2.5 py-1 bg-amber/10 border border-amber/25 text-amber text-xs font-bold rounded-lg block">
                                  {match.score}% Match
                                </span>
                              </div>
                            </div>

                            {/* Multi-Hop Chain Indicator */}
                            {match.matchType === 'multihop_chain' && match.multiHopChain && (
                              <div className="my-2.5 p-2 bg-blue-500/10 border border-blue-500/30 rounded-xl text-[10px]">
                                <span className="font-bold text-blue-600 block mb-1">🔄 3-Party Learning Circle</span>
                                <div className="space-y-0.5 text-ink">
                                  {match.multiHopChain.map((step, sIdx) => (
                                    <div key={sIdx} className="flex items-center gap-1">
                                      <span className="font-semibold">{step.userName}</span>
                                      <span className="text-muted">teaches {step.teachesSkill} to</span>
                                      <span className="font-semibold">{step.toUserName}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Plain-Language Agent Explanation */}
                            <div className="my-2.5 p-2.5 bg-card rounded-xl border border-border/80 text-xs text-muted leading-relaxed">
                              <span className="font-bold text-ink block mb-0.5 text-[10px] uppercase tracking-wider">
                                Agent Match Rationale:
                              </span>
                              {match.plainExplanation}
                            </div>

                            {/* Step 10: Expandable Formula Breakdown */}
                            <div className="my-2">
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedBreakdown((prev) => ({
                                    ...prev,
                                    [match.matchId]: !prev[match.matchId],
                                  }))
                                }
                                className="text-[10px] text-amber hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                              >
                                <span>{isExpanded ? '▼ Hide Match Score Formula' : '▶ Show Match Score Formula'}</span>
                              </button>

                              {isExpanded && (
                                <div className="mt-2 p-2.5 bg-card rounded-xl border border-border text-[10px] space-y-1.5 animate-fade-in font-mono">
                                  <div className="flex justify-between">
                                    <span className="text-muted">Skill Fit (30%):</span>
                                    <span className="font-bold text-ink">{(match.breakdown.skillScore * 100).toFixed(0)}%</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted">Zone of Proximal Dev (20%):</span>
                                    <span className="font-bold text-ink">{(match.breakdown.proficiencyScore * 100).toFixed(0)}%</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted">Need Urgency (15%):</span>
                                    <span className="font-bold text-ink">{(match.breakdown.needScore * 100).toFixed(0)}%</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted">Availability (15%):</span>
                                    <span className="font-bold text-ink">{(match.breakdown.availabilityScore * 100).toFixed(0)}%</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted">Learning Style (10%):</span>
                                    <span className="font-bold text-ink">{(match.breakdown.preferenceScore * 100).toFixed(0)}%</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted">Network Value (10%):</span>
                                    <span className="font-bold text-ink">{(match.breakdown.networkScore * 100).toFixed(0)}%</span>
                                  </div>
                                  <div className="pt-1 border-t border-border text-muted truncate">
                                    {match.breakdown.formulaString}
                                  </div>
                                </div>
                              )}
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
                                  onClick={() => handleOpenChat(match.peerName, match.peerId, match.primarySkill)}
                                  className="py-2 px-4 bg-amber hover:bg-terracotta text-white font-semibold text-xs rounded-xl transition-colors cursor-pointer"
                                >
                                  Chat →
                                </button>
                              </div>
                            ) : isPending ? (
                              <span className="w-full py-2.5 px-4 text-center text-xs font-semibold text-amber bg-amber/15 border border-amber/30 rounded-xl flex items-center justify-center gap-1.5">
                                <span>⏳</span> Request Pending Acceptance
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleSendConnectionRequest(match)}
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
            )}

            {/* TAB 2: Connection Requests Content */}
            {activeTab === 'requests' && (
              <div>
                {incomingRequests.length === 0 ? (
                  <div className="p-8 rounded-2xl border-2 border-dashed border-border bg-card-alt flex flex-col items-center text-center gap-2 animate-fade-in">
                    <span className="text-3xl">📬</span>
                    <h3 className="text-base font-serif font-bold text-ink">No Pending Requests</h3>
                    <p className="text-xs text-muted max-w-sm">
                      When peers on another device send you a connection invite, it will appear here instantly.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {incomingRequests.map((req) => (
                      <div
                        key={req.id}
                        className="p-4 rounded-2xl bg-card-alt border border-border flex flex-wrap items-center justify-between gap-3 shadow-xs"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-amber text-white flex items-center justify-center font-bold text-sm">
                            {req.requesterName ? req.requesterName.slice(0, 2).toUpperCase() : 'PR'}
                          </div>
                          <div>
                            <h4 className="font-semibold text-ink text-sm">{req.requesterName}</h4>
                            <p className="text-xs text-muted">
                              Wants to collaborate on <strong>{req.skillArea || 'Programming'}</strong>
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleAcceptRequest(req)}
                            className="px-4 py-2 bg-ok hover:bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer transition-all"
                          >
                            Accept &amp; Unlock Chat
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeclineRequest(req.id)}
                            className="px-3 py-2 bg-card border border-border hover:text-bad font-semibold text-xs rounded-xl cursor-pointer transition-colors"
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
