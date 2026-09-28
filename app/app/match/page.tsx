'use client';

import React, { useState, useEffect, useRef } from 'react';
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

const MATCH_SKILL_TAGS = [
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

export default function MatchPage() {
  const router = useRouter();
  const supabase = createClient();

  const [studentName, setStudentName] = useState('Learner');
  const [studentEmail, setStudentEmail] = useState('');
  const [domain, setDomain] = useState('React');
  const [userLevel, setUserLevel] = useState<any>('intermediate');
  const [isDemo, setIsDemo] = useState(false);

  // Peer Exchange Profile State (Powers Connection Section)
  const [canTeach, setCanTeach] = useState<string[]>(['React', 'Problem Solving']);
  const [seekingGuidance, setSeekingGuidance] = useState<string[]>(['Python', 'Algorithms']);
  const [isEditingSkills, setIsEditingSkills] = useState(false);
  const [draftCanTeach, setDraftCanTeach] = useState<string[]>([]);
  const [draftSeeking, setDraftSeeking] = useState<string[]>([]);

  // Tab State: Matches vs Connection Requests
  const [activeTab, setActiveTab] = useState<'matches' | 'requests'>('matches');

  // In-Match Chat State (Chat directly inside Match section)
  const [activeChatPeer, setActiveChatPeer] = useState<{
    id: string;
    name: string;
    role?: string;
    skill?: string;
    score?: number;
    initials?: string;
  } | null>(null);
  const [matchChatMessages, setMatchChatMessages] = useState<Array<{ id: string | number; text: string; sender: 'me' | 'peer'; time: string; senderName?: string }>>([]);
  const [matchChatInput, setMatchChatInput] = useState('');
  const [isMatchChatTyping, setIsMatchChatTyping] = useState(false);
  const chatMessagesEndRef = useRef<HTMLDivElement>(null);
  const chatMessagesContainerRef = useRef<HTMLDivElement>(null);

  // Agent State
  const [agentMatches, setAgentMatches] = useState<PeerMatchResult[]>([]);
  const [agentLogs, setAgentLogs] = useState<AgentActivityLog[]>([]);
  const [emptyStateReason, setEmptyStateReason] = useState<string | null>(null);
  const [expandedBreakdown, setExpandedBreakdown] = useState<Record<string, boolean>>({});

  // Connections State
  const [incomingRequests, setIncomingRequests] = useState<any[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<any[]>([]);
  const [activeConnections, setActiveConnections] = useState<any[]>([]);
  const [pendingOutgoing, setPendingOutgoing] = useState<Record<string, boolean>>({});

  const [connectToast, setConnectToast] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showJuryPipelineModal, setShowJuryPipelineModal] = useState(false);

  useEffect(() => {
    const channel = supabase
      .channel('realtime_connections_channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'connections' },
        () => {
          const emailToPoll = studentEmail || localStorage.getItem('synapse_user_email') || '';
          if (emailToPoll) fetchConnections(emailToPoll);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [studentEmail]);

  useEffect(() => {
    let currentEmail = '';
    let currentName = 'Learner';
    let currentDomain = 'React';
    let currentLevel: any = 'intermediate';
    let currentTeach = ['React', 'Problem Solving'];
    let currentSeek = ['Python', 'Algorithms'];

    try {
      const saved = localStorage.getItem('synapse_study_data');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.name) currentName = parsed.name;
        if (parsed.domain) currentDomain = parsed.domain;
        if (parsed.level) currentLevel = parsed.level;
        if (parsed.email) currentEmail = parsed.email;
        if (Array.isArray(parsed.canTeach) && parsed.canTeach.length > 0) {
          currentTeach = parsed.canTeach;
        } else {
          currentTeach = [currentDomain, 'Problem Solving'];
        }
        if (Array.isArray(parsed.seekingGuidance) && parsed.seekingGuidance.length > 0) {
          currentSeek = parsed.seekingGuidance;
        } else {
          currentSeek = [currentDomain === 'React' ? 'Python' : 'React', 'Algorithms'];
        }
      } else {
        const cachedName = localStorage.getItem('synapse_user_name');
        if (cachedName) currentName = cachedName;
      }

      setCanTeach(currentTeach);
      setSeekingGuidance(currentSeek);

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

    // Fetch peers and run matching agent with active skills
    fetchAndMatchPeers(currentEmail, currentName, currentDomain, currentLevel, currentTeach, currentSeek);
    fetchConnections(currentEmail);

    // Auto-poll incoming connection requests every 3 seconds so new requests appear in real time without refreshing
    const pollTimer = setInterval(() => {
      const activeEmail = currentEmail || localStorage.getItem('synapse_user_email') || '';
      if (activeEmail) {
        fetchConnections(activeEmail);
      }
    }, 3000);

    return () => clearInterval(pollTimer);
  }, []);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    const emailToPoll = (studentEmail || localStorage.getItem('synapse_user_email') || '').trim();
    try {
      await Promise.all([
        fetchConnections(emailToPoll),
        fetchAndMatchPeers(emailToPoll, studentName, domain, userLevel, canTeach, seekingGuidance),
      ]);
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const fetchConnections = async (email: string) => {
    if (!email) return;
    try {
      const res = await fetch(`/api/connections?userId=${encodeURIComponent(email)}`);
      if (res.ok) {
        const data = await res.json();
        setIncomingRequests(data.pendingIncoming || []);
        setOutgoingRequests(data.pendingOutgoing || []);
        setActiveConnections(data.active || []);

        const outgoingMap: Record<string, boolean> = {};
        (data.pendingOutgoing || []).forEach((c: any) => {
          outgoingMap[(c.recipientId || '').toLowerCase()] = true;
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
    lvl: any,
    customOffers?: string[],
    customNeeds?: string[]
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
              verified_level: p.verified_level,
              verified: p.verified,
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

    // Use ONLY real discovered peers from network & database (No example/mock peers)
    const peersPool = discoveredPeers;

    // Step 1 to 14: Execute the Autonomous Peer Matching Agent
    const activeOffers = customOffers && customOffers.length > 0 ? customOffers : canTeach;
    const activeNeeds = customNeeds && customNeeds.length > 0 ? customNeeds : seekingGuidance;

    let userVerifiedLevel: number | null = null;
    try {
      const saved = localStorage.getItem('synapse_study_data');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.declarations)) {
          const dec = parsed.declarations.find(
            (d: any) => d.skill?.toLowerCase() === currentDomain.toLowerCase() && d.status === 'verified'
          );
          if (dec && dec.verified_level) userVerifiedLevel = dec.verified_level;
        }
      }
    } catch (e) {}

    let userWeakTopics: string[] = [];
    try {
      const tmRes = await fetch(`/api/topic-mastery?userId=${encodeURIComponent(currentEmail)}&skill=${encodeURIComponent(currentDomain)}`);
      if (tmRes.ok) {
        const tmData = await tmRes.json();
        if (Array.isArray(tmData.weakTopics)) {
          userWeakTopics = tmData.weakTopics;
        }
      }
    } catch (e) {}

    const currentUserObj = {
      id: currentEmail || 'current_user',
      name: currentName,
      email: currentEmail,
      domain: currentDomain,
      level: lvl,
      verified_level: userVerifiedLevel,
      weakTopics: userWeakTopics,
      offers: activeOffers.length > 0 ? activeOffers : [currentDomain, 'Problem Solving'],
      needs: activeNeeds.length > 0 ? activeNeeds : [currentDomain === 'React' ? 'Python' : 'React', 'Algorithms'],
    };

    const agentResult = runPeerMatchingAgent(currentUserObj, peersPool);

    setAgentMatches(agentResult.matches);
    setAgentLogs(agentResult.activityLogs);
    setEmptyStateReason(agentResult.emptyStateReason || null);
    setIsScanning(false);
  };

  const handleSaveSkillPreferences = async () => {
    const updatedTeach = draftCanTeach.length > 0 ? draftCanTeach : [domain, 'Problem Solving'];
    const updatedSeek = draftSeeking.length > 0 ? draftSeeking : [domain === 'React' ? 'Python' : 'React', 'Algorithms'];

    setCanTeach(updatedTeach);
    setSeekingGuidance(updatedSeek);
    setIsEditingSkills(false);

    try {
      const saved = localStorage.getItem('synapse_study_data');
      const parsed = saved ? JSON.parse(saved) : {};
      parsed.canTeach = updatedTeach;
      parsed.seekingGuidance = updatedSeek;
      localStorage.setItem('synapse_study_data', JSON.stringify(parsed));
      if (studentEmail) {
        localStorage.setItem(`synapse_study_data_${studentEmail.toLowerCase()}`, JSON.stringify(parsed));
      }

      // Broadcast updated offers and needs to live multi-device peer network
      await fetch('/api/peer-network', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: studentName,
          email: studentEmail || 'learner@synapse.edu',
          domain: domain,
          level: userLevel,
          offers: updatedTeach,
          needs: updatedSeek,
        }),
      });

      // Sync to cloud profile
      await fetch('/api/user-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: studentName,
          email: studentEmail || 'learner@synapse.edu',
          domain: domain,
          level: userLevel,
          canTeach: updatedTeach,
          seekingGuidance: updatedSeek,
        }),
      });
    } catch (e) {}

    // Immediately recalculate connection matches with updated skills
    fetchAndMatchPeers(studentEmail, studentName, domain, userLevel, updatedTeach, updatedSeek);
    setConnectToast('Peer Exchange skills updated! Connection matches recalculated.');
    setTimeout(() => setConnectToast(null), 4000);
  };

  const handleSendConnectionRequest = async (match: PeerMatchResult) => {
    const myId = (studentEmail || studentName).trim().toLowerCase();
    const peerNorm = match.peerId.trim().toLowerCase();
    const updatedPending = { ...pendingOutgoing, [peerNorm]: true };
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
          recipientId: peerNorm,
          recipientName: match.peerName,
          skillArea: match.primarySkill,
        }),
      });

      if (res.ok) {
        setConnectToast(`Connection request sent to ${match.peerName}! Chat unlocks once accepted.`);
        setTimeout(() => setConnectToast(null), 4500);
        fetchConnections(studentEmail);
      }
    } catch (e) {
      setConnectToast(`Request recorded locally for ${match.peerName}`);
      setTimeout(() => setConnectToast(null), 3000);
    }
  };

  const handleCancelRequest = async (peerId: string) => {
    const myId = (studentEmail || studentName).trim().toLowerCase();
    const peerNorm = peerId.trim().toLowerCase();
    const updatedPending = { ...pendingOutgoing };
    delete updatedPending[peerNorm];
    setPendingOutgoing(updatedPending);
    localStorage.setItem('synapse_pending_outgoing', JSON.stringify(updatedPending));

    try {
      await fetch('/api/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'cancel',
          requesterId: myId,
          recipientId: peerNorm,
        }),
      });
      setConnectToast('Connection request cancelled.');
      setTimeout(() => setConnectToast(null), 3000);
      fetchConnections(studentEmail);
    } catch (e) {}
  };

  const handleAcceptRequest = async (conn: any) => {
    try {
      const res = await fetch('/api/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'accept',
          connectionId: conn.id,
          requesterId: conn.requesterId,
          recipientId: conn.recipientId,
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
        fetchConnections(studentEmail);
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
      fetchConnections(studentEmail);
    } catch (e) {}
  };

  const handleOpenInPageChat = (peer: {
    id: string;
    name: string;
    role?: string;
    skill?: string;
    score?: number;
  }) => {
    const initials = peer.name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2);

    setActiveChatPeer({ ...peer, initials });

    // Seed initial welcome message if empty
    setMatchChatMessages([
      {
        id: 'init-1',
        text: `Hey ${studentName}! I noticed our ${peer.score ? peer.score + '% ' : ''}match on ${peer.skill || domain}. Excited to study and collaborate!`,
        sender: 'peer',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        senderName: peer.name,
      },
    ]);

    // Save active peer to localStorage for persistence
    localStorage.setItem(
      'synapse_active_peer',
      JSON.stringify({
        id: peer.id,
        name: peer.name,
        domain: peer.skill || domain,
        isReal: !peer.id.includes('demo') && !peer.id.includes('mock'),
      })
    );
  };

  // Poll for live messages when chat drawer is open (Scoped strictly to this peer pair)
  useEffect(() => {
    if (!activeChatPeer) return;
    let isSubscribed = true;

    const myEmailLower = (studentEmail || 'learner').trim().toLowerCase();
    const peerLower = (activeChatPeer.id || 'peer').trim().toLowerCase();
    const pairSessionId = `pair__${[myEmailLower, peerLower].sort().join('__')}`;

    const poll = async () => {
      try {
        const res = await fetch(`/api/messages?threadId=${encodeURIComponent(pairSessionId)}&limit=50`);
        if (res.ok && isSubscribed) {
          const data = await res.json();
          if (Array.isArray(data.messages)) {
            setMatchChatMessages((prev) => {
              const existingIds = new Set(prev.map((m) => m.id));
              const newIncoming = data.messages
                .filter((m: any) => !existingIds.has(m.id) && (m.thread_id === pairSessionId || !m.thread_id))
                .map((m: any) => ({
                  id: m.id,
                  text: m.content || m.text || '',
                  sender: (m.sender_email || m.senderId || '').trim().toLowerCase() === myEmailLower ? ('me' as const) : ('peer' as const),
                  time: m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now',
                  senderName: m.sender_name || m.senderName,
                }));

              if (newIncoming.length > 0) {
                return [...prev, ...newIncoming];
              }
              return prev;
            });
          }
        }
      } catch (e) {}
    };

    poll();
    const interval = setInterval(poll, 2500);
    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [activeChatPeer, studentEmail]);

  useEffect(() => {
    if (activeChatPeer && chatMessagesContainerRef.current) {
      chatMessagesContainerRef.current.scrollTop = chatMessagesContainerRef.current.scrollHeight;
    }
  }, [matchChatMessages, activeChatPeer]);

  const handleSendMatchMessage = async (e?: React.FormEvent, customText?: string) => {
    if (e) e.preventDefault();
    const textToSend = (customText || matchChatInput).trim();
    if (!textToSend || !activeChatPeer) return;

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg = {
      id: 'msg_' + Date.now(),
      text: textToSend,
      sender: 'me' as const,
      time,
      senderName: studentName,
    };

    setMatchChatMessages((prev) => [...prev, userMsg]);
    setMatchChatInput('');

    const mySenderId = (studentEmail || 'user_' + studentName).trim().toLowerCase();
    const peerLower = (activeChatPeer.id || 'peer').trim().toLowerCase();
    const pairSessionId = `pair__${[mySenderId, peerLower].sort().join('__')}`;

    // Post to isolated messages API
    try {
      fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          threadId: pairSessionId,
          threadType: 'pair',
          senderEmail: mySenderId,
          senderName: studentName,
          content: textToSend,
          type: 'text',
        }),
      });
    } catch (e) {}

    // If demo or AI peer, trigger intelligent peer response with Gemini
    setIsMatchChatTyping(true);
    try {
      const res = await fetch('/api/peer-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend,
          track: activeChatPeer.skill || domain,
          peerName: activeChatPeer.name.replace(' (Demo Peer)', ''),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setTimeout(async () => {
          setIsMatchChatTyping(false);
          const replyText = data.reply || "That sounds great! Let's work on this topic together.";
          setMatchChatMessages((prev) => [
            ...prev,
            {
              id: 'reply_' + Date.now(),
              text: replyText,
              sender: 'peer',
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              senderName: activeChatPeer.name,
            },
          ]);
          try {
            await fetch('/api/messages', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                threadId: pairSessionId,
                threadType: 'pair',
                senderEmail: 'ai_copilot@synapse.edu',
                senderName: activeChatPeer.name,
                content: replyText,
                type: 'text',
              }),
            });
          } catch (e) {}
        }, 800);
      } else {
        setIsMatchChatTyping(false);
      }
    } catch (e) {
      setIsMatchChatTyping(false);
    }
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

  const isAlreadyConnected = (peerId: string, peerEmail?: string, peerName?: string) => {
    const normId = (peerId || '').trim().toLowerCase();
    const normEmail = (peerEmail || '').trim().toLowerCase();
    const normName = (peerName || '').trim().toLowerCase();

    // Check localStorage active peer
    try {
      const savedPeer = localStorage.getItem('synapse_active_peer');
      if (savedPeer) {
        const p = JSON.parse(savedPeer);
        const pId = (p.id || '').trim().toLowerCase();
        const pName = (p.name || '').trim().toLowerCase();
        if (pId && (pId === normId || (normEmail && pId === normEmail))) return true;
        if (pName && normName && pName === normName) return true;
      }
    } catch (e) {}

    return activeConnections.some((c) => {
      const rId = (c.requesterId || '').toLowerCase().trim();
      const recId = (c.recipientId || '').toLowerCase().trim();
      const rName = (c.requesterName || '').toLowerCase().trim();
      const recName = (c.recipientName || '').toLowerCase().trim();

      const idMatch = normId && (rId === normId || recId === normId || rId.includes(normId) || recId.includes(normId));
      const emailMatch = normEmail && (rId === normEmail || recId === normEmail || rId.includes(normEmail) || recId.includes(normEmail));
      const nameMatch = normName && (rName === normName || recName === normName);

      return idMatch || emailMatch || nameMatch;
    });
  };

  const isIncomingPending = (peerId: string) => {
    const norm = peerId.trim().toLowerCase();
    return incomingRequests.some(
      (c) => (c.requesterId || '').toLowerCase() === norm
    );
  };

  const isOutgoingPending = (peerId: string) => {
    const norm = peerId.trim().toLowerCase();
    return Boolean(pendingOutgoing[norm]);
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

      {/* Peer Exchange Profile Banner: What are you Eligible to Teach / Help & Seeking Guidance */}
      <div className="bg-card border border-border rounded-[22px] p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-ok/15 text-ok flex items-center justify-center text-xl font-bold">
              🤝
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-serif font-bold text-ink">
                  Your Peer Exchange Profile
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber/10 text-amber font-semibold border border-amber/20">
                  POWERS CONNECTIONS
                </span>
              </div>
              <p className="text-xs text-muted">
                The Connection Section matches you based on what you can teach and what you want to learn.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              if (!isEditingSkills) {
                setDraftCanTeach(canTeach);
                setDraftSeeking(seekingGuidance);
              }
              setIsEditingSkills(!isEditingSkills);
            }}
            className="px-3.5 py-1.5 bg-card-alt border border-border hover:border-amber text-ink rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <span>{isEditingSkills ? '✕ Close Editor' : '✏️ Change Teach / Learn Skills'}</span>
          </button>
        </div>

        {!isEditingSkills ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {/* Can Teach Display */}
            <div className="p-3.5 rounded-xl bg-card-alt border border-border/80 space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-ok flex items-center gap-1.5">
                <span>🎓</span> What you are Eligible to Teach / Help
              </span>
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {canTeach.length > 0 ? (
                  canTeach.map((skill) => (
                    <span
                      key={skill}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-ok/15 text-ok border border-ok/30 flex items-center gap-1"
                    >
                      <span>✓</span> {skill}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-muted">No teaching skills selected</span>
                )}
              </div>
            </div>

            {/* Seeking Guidance Display */}
            <div className="p-3.5 rounded-xl bg-card-alt border border-border/80 space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-amber flex items-center gap-1.5">
                <span>🔍</span> What you are Seeking Guidance in
              </span>
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {seekingGuidance.length > 0 ? (
                  seekingGuidance.map((skill) => (
                    <span
                      key={skill}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber/15 text-amber border border-amber/30 flex items-center gap-1"
                    >
                      <span>⚡</span> {skill}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-muted">No guidance skills selected</span>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Inline Editor for Can Teach & Seeking Guidance */
          <div className="space-y-4 pt-3 border-t border-border animate-fade-in">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-ok flex items-center gap-1.5">
                <span>🎓</span> What are you Eligible to Teach / Help? (Click to toggle)
              </label>
              <div className="flex flex-wrap gap-2">
                {MATCH_SKILL_TAGS.map((tag) => {
                  const isSel = draftCanTeach.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => {
                        setDraftCanTeach(prev =>
                          prev.includes(tag.id) ? prev.filter(t => t !== tag.id) : [...prev, tag.id]
                        );
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer flex items-center gap-1.5 ${
                        isSel
                          ? 'border-ok bg-ok/20 text-ok ring-1 ring-ok/40 font-semibold'
                          : 'border-border bg-card text-muted hover:border-ok/50 hover:text-ink'
                      }`}
                    >
                      <span>{tag.icon}</span>
                      <span>{tag.label}</span>
                      {isSel && <span>✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-amber flex items-center gap-1.5">
                <span>🔍</span> What are you Seeking Guidance in? (Click to toggle)
              </label>
              <div className="flex flex-wrap gap-2">
                {MATCH_SKILL_TAGS.map((tag) => {
                  const isSel = draftSeeking.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => {
                        setDraftSeeking(prev =>
                          prev.includes(tag.id) ? prev.filter(t => t !== tag.id) : [...prev, tag.id]
                        );
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer flex items-center gap-1.5 ${
                        isSel
                          ? 'border-amber bg-amber/20 text-amber ring-1 ring-amber/40 font-semibold'
                          : 'border-border bg-card text-muted hover:border-amber/50 hover:text-ink'
                      }`}
                    >
                      <span>{tag.icon}</span>
                      <span>{tag.label}</span>
                      {isSel && <span>✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleSaveSkillPreferences}
                className="px-5 py-2.5 bg-amber hover:bg-terracotta text-white font-bold text-xs rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-2"
              >
                <span>💾</span>
                <span>Save Skills & Re-calculate Connection Matches</span>
              </button>
              <button
                type="button"
                onClick={() => setIsEditingSkills(false)}
                className="px-4 py-2.5 rounded-xl border border-border text-xs font-medium text-muted hover:text-ink cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Autonomous Peer-Matching Agent: Live Activity Loop Header */}
      <div className="bg-card border border-border rounded-[22px] p-5 sm:p-6 shadow-xs space-y-5">
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
                4-Phase ODAEA loop • 14-step graph matching • 6-factor weighted compatibility formula
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowJuryPipelineModal(true)}
              className="px-3.5 py-1.5 bg-amber hover:bg-terracotta text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-98"
            >
              <span>🎓</span>
              <span>Explain Architecture to Jury</span>
            </button>
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

        {/* 4 Structured Pipeline Phases (Jury-Ready) */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {/* Phase 1 */}
          <div className="p-3.5 rounded-xl bg-card-alt border border-border space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-amber">Phase 1</span>
              <span className="w-2 h-2 rounded-full bg-ok" />
            </div>
            <h4 className="text-xs font-bold text-ink flex items-center gap-1">
              <span>👁️</span> Profiling &amp; Observation
            </h4>
            <p className="text-[11px] text-muted leading-relaxed">
              Ingests verified skill declarations, quiz mastery levels, and student learning goals.
            </p>
            <div className="pt-1 flex flex-wrap gap-1 text-[9px] font-mono text-muted">
              <span className="bg-card px-1.5 py-0.5 rounded border border-border">1. OBSERVE</span>
              <span className="bg-card px-1.5 py-0.5 rounded border border-border">2. UNDERSTAND</span>
              <span className="bg-card px-1.5 py-0.5 rounded border border-border">3. CLASSIFY</span>
            </div>
          </div>

          {/* Phase 2 */}
          <div className="p-3.5 rounded-xl bg-card-alt border border-border space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-amber">Phase 2</span>
              <span className="w-2 h-2 rounded-full bg-ok" />
            </div>
            <h4 className="text-xs font-bold text-ink flex items-center gap-1">
              <span>🕸️</span> Graph Search &amp; Gaps
            </h4>
            <p className="text-[11px] text-muted leading-relaxed">
              Identifies Zone of Proximal Development (ZPD) and maps complementary teacher-learner edges.
            </p>
            <div className="pt-1 flex flex-wrap gap-1 text-[9px] font-mono text-muted">
              <span className="bg-card px-1.5 py-0.5 rounded border border-border">4. IDENTIFY GAPS</span>
              <span className="bg-card px-1.5 py-0.5 rounded border border-border">5. SEARCH</span>
              <span className="bg-card px-1.5 py-0.5 rounded border border-border">6. BUILD MATCHES</span>
            </div>
          </div>

          {/* Phase 3 */}
          <div className="p-3.5 rounded-xl bg-card-alt border border-border space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-amber">Phase 3</span>
              <span className="w-2 h-2 rounded-full bg-ok" />
            </div>
            <h4 className="text-xs font-bold text-ink flex items-center gap-1">
              <span>⚖️</span> 6-Factor Compatibility
            </h4>
            <p className="text-[11px] text-muted leading-relaxed">
              Computes weighted score: Skill (30%), ZPD (20%), Urgency (15%), Availability (15%), Style (10%), Value (10%).
            </p>
            <div className="pt-1 flex flex-wrap gap-1 text-[9px] font-mono text-muted">
              <span className="bg-card px-1.5 py-0.5 rounded border border-border">7. EVALUATE</span>
              <span className="bg-card px-1.5 py-0.5 rounded border border-border">8. CONNECT</span>
              <span className="bg-card px-1.5 py-0.5 rounded border border-border">9. EXPLAIN</span>
            </div>
          </div>

          {/* Phase 4 */}
          <div className="p-3.5 rounded-xl bg-card-alt border border-border space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-amber">Phase 4</span>
              <span className="w-2 h-2 rounded-full bg-ok" />
            </div>
            <h4 className="text-xs font-bold text-ink flex items-center gap-1">
              <span>🔄</span> Feedback &amp; Rematch Loop
            </h4>
            <p className="text-[11px] text-muted leading-relaxed">
              Monitors match health deltas post-session. Triggers autonomous reclassification and adaptive rematching.
            </p>
            <div className="pt-1 flex flex-wrap gap-1 text-[9px] font-mono text-muted">
              <span className="bg-card px-1.5 py-0.5 rounded border border-border">10. MONITOR</span>
              <span className="bg-card px-1.5 py-0.5 rounded border border-border">11. RECLASSIFY</span>
              <span className="bg-card px-1.5 py-0.5 rounded border border-border">12. REMATCH</span>
            </div>
          </div>
        </div>

        {/* Live Loop Stage Terminal View */}
        <div className="pt-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono uppercase font-bold text-muted tracking-wider flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber animate-ping" /> Live Agent Execution Logs
            </span>
            <span className="text-[10px] text-muted font-mono">{agentLogs.length} events logged</span>
          </div>
          <div className="p-3 bg-card-alt rounded-xl border border-border text-[11px] font-mono space-y-1 max-h-24 overflow-y-auto">
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
                  onClick={() => {
                    setActiveTab('matches');
                    fetchAndMatchPeers(studentEmail, studentName, domain, userLevel);
                  }}
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
                  onClick={() => {
                    setActiveTab('requests');
                    fetchConnections(studentEmail);
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'requests'
                      ? 'bg-amber text-white shadow-xs'
                      : 'bg-card-alt text-muted border border-border hover:text-ink'
                  }`}
                >
                  <span>Incoming Requests</span>
                  {incomingRequests.length > 0 && (
                    <span className="w-4 h-4 rounded-full bg-bad text-white text-[10px] flex items-center justify-center font-bold animate-pulse">
                      {incomingRequests.length}
                    </span>
                  )}
                </button>

                {/* Quick Reload Button (No Page Reload Needed) */}
                <button
                  type="button"
                  onClick={handleManualRefresh}
                  disabled={isRefreshing}
                  title="Check for new requests and updates without reloading the page"
                  className="px-3 py-2 rounded-xl text-xs font-semibold bg-card-alt border border-border hover:border-amber text-ink hover:text-amber transition-all cursor-pointer flex items-center gap-1.5 shadow-xs shrink-0"
                >
                  <span className={isRefreshing ? 'animate-spin' : ''}>🔄</span>
                  <span>{isRefreshing ? 'Checking...' : 'Refresh'}</span>
                </button>
              </div>

              <span className="text-xs font-semibold px-2.5 py-1 bg-card-alt border border-border rounded-lg text-ink">
                {activeTab === 'matches' ? `${agentMatches.length} Matches Ranked` : `${incomingRequests.length} Pending`}
              </span>
            </div>

            {/* TAB 1: Matched Peers Content */}
            {activeTab === 'matches' && (() => {
              const connectedMatches = agentMatches.filter((m) =>
                isAlreadyConnected(m.peerId, (m as any).email, m.peerName)
              );
              const candidateMatches = agentMatches.filter(
                (m) => !isAlreadyConnected(m.peerId, (m as any).email, m.peerName)
              );

              return (
                <div className="space-y-6">
                  {/* Connected Learning Partners (No Connect Button Here Ever) */}
                  {connectedMatches.length > 0 && (
                    <div className="p-4 sm:p-5 rounded-2xl bg-ok/10 border border-ok/30 space-y-3 animate-fade-in">
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-ok/20">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">🤝</span>
                          <h3 className="text-sm font-serif font-bold text-ink">
                            Your Connected Learning Partners ({connectedMatches.length})
                          </h3>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-ok/25 text-ok font-bold uppercase tracking-wider">
                            Connected ✓
                          </span>
                        </div>
                        <span className="text-[11px] text-muted font-medium">Already connected — ready for 1-on-1 collaborative pairing</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        {connectedMatches.map((match) => (
                          <div
                            key={'conn_' + match.matchId}
                            className="p-3.5 rounded-xl bg-card border border-ok/30 flex items-center justify-between gap-3 shadow-xs hover:border-ok transition-colors"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-ok to-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
                                {match.peerName
                                  .split(' ')
                                  .map((n) => n[0])
                                  .join('')
                                  .slice(0, 2)}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <h4 className="font-semibold text-ink text-xs truncate">{match.peerName}</h4>
                                  <span className="text-[9px] px-1.5 py-0.2 bg-ok/15 text-ok font-bold rounded">
                                    {match.peerRole}
                                  </span>
                                </div>
                                <p className="text-[10px] text-muted truncate">{match.primarySkill} • {match.score}% Fit</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() =>
                                  handleOpenInPageChat({
                                    id: match.peerId,
                                    name: match.peerName,
                                    role: match.peerRole,
                                    skill: match.primarySkill,
                                    score: match.score,
                                  })
                                }
                                className="py-1.5 px-2.5 bg-card-alt hover:bg-card border border-border text-ink rounded-lg text-xs font-semibold cursor-pointer"
                              >
                                💬 Chat
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenChat(match.peerName, match.peerId, match.primarySkill)}
                                className="py-1.5 px-3 bg-amber hover:bg-terracotta text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
                              >
                                Open Session →
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Candidate Peer Matches Available for Pairing */}
                  <div>
                    <div className="flex items-center justify-between mb-3 px-1">
                      <h3 className="text-xs font-serif font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
                        <span>🎯</span> Candidate Matches ({candidateMatches.length})
                      </h3>
                      <span className="text-[11px] text-muted">Ranked by 6-Factor Autonomous Compatibility</span>
                    </div>

                    {candidateMatches.length === 0 ? (
                      /* Step 11: Honest Dead-End State */
                      <div className="p-8 rounded-2xl border-2 border-dashed border-border bg-card-alt flex flex-col items-center text-center gap-3 animate-fade-in my-2">
                        <span className="text-3xl">📡</span>
                        <h3 className="text-base font-serif font-bold text-ink">
                          {connectedMatches.length > 0 ? 'All Active Matches Connected' : 'No Suitable Peer Currently Available'}
                        </h3>
                        <p className="text-xs text-muted max-w-md leading-relaxed">
                          {connectedMatches.length > 0
                            ? 'All discovered peers in this cycle are already in your active learning network! You can start a live collaborative session with your partners above or re-scan for new members.'
                            : emptyStateReason ||
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
                        {candidateMatches.map((match) => {
                          const isConnected = isAlreadyConnected(match.peerId, (match as any).email, match.peerName);
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
                                      {(match as any).verified ? (
                                        <span className="text-[9px] px-1.5 py-0.5 rounded font-bold border border-ok/30 bg-ok/10 text-ok">
                                          ✅ Verified
                                        </span>
                                      ) : (
                                        <span className="text-[9px] px-1.5 py-0.5 rounded font-bold border border-muted/30 bg-card-alt text-muted">
                                          ⚠️ Unverified
                                        </span>
                                      )}
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
                            <div className="my-2.5 p-2.5 bg-card rounded-xl border border-border/80 text-xs text-muted leading-relaxed space-y-1.5">
                              <span className="font-bold text-ink block mb-0.5 text-[10px] uppercase tracking-wider">
                                Agent Match Rationale:
                              </span>
                              <p>{match.plainExplanation}</p>
                              {match.topicOverlap && match.topicOverlap.length > 0 && (
                                <div className="pt-1 flex items-center gap-1.5 flex-wrap">
                                  <span className="text-[10px] font-bold text-amber bg-amber/10 border border-amber/25 px-2 py-0.5 rounded-md flex items-center gap-1">
                                    🎯 Strong in your weak topic{match.topicOverlap.length > 1 ? 's' : ''}: {match.topicOverlap.join(', ')}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* What Peer Teaches vs Seeks */}
                            <div className="my-2.5 grid grid-cols-2 gap-2 text-[11px]">
                              <div className="p-2 rounded-xl bg-card border border-border">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-ok block mb-1 flex items-center gap-1">
                                  <span>🎓</span> They Can Teach:
                                </span>
                                <div className="flex flex-wrap gap-1">
                                  {match.canTeach && match.canTeach.length > 0 ? (
                                    match.canTeach.map((s) => (
                                      <span key={s} className="px-1.5 py-0.5 rounded-md bg-ok/10 text-ok border border-ok/20 font-semibold text-[10px]">
                                        {s}
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-muted text-[10px]">{match.primarySkill}</span>
                                  )}
                                </div>
                              </div>
                              <div className="p-2 rounded-xl bg-card border border-border">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-amber block mb-1 flex items-center gap-1">
                                  <span>🔍</span> They Want to Learn:
                                </span>
                                <div className="flex flex-wrap gap-1">
                                  {match.wantsToLearn && match.wantsToLearn.length > 0 ? (
                                    match.wantsToLearn.map((s) => (
                                      <span key={s} className="px-1.5 py-0.5 rounded-md bg-amber/10 text-amber border border-amber/20 font-semibold text-[10px]">
                                        {s}
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-muted text-[10px]">Various Skills</span>
                                  )}
                                </div>
                              </div>
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

                          {/* Action Buttons with In-Match Chat */}
                          <div className="pt-3 mt-1 border-t border-border/60">
                            {isConnected ? (
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleOpenInPageChat({
                                      id: match.peerId,
                                      name: match.peerName,
                                      role: match.peerRole,
                                      skill: match.primarySkill,
                                      score: match.score,
                                    })
                                  }
                                  className="flex-1 py-2.5 px-3 bg-amber hover:bg-terracotta text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-98"
                                >
                                  <span>💬</span>
                                  <span>Message</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenChat(match.peerName, match.peerId, match.primarySkill)}
                                  className="py-2.5 px-3.5 bg-card-alt hover:bg-card border border-border text-ink font-semibold text-xs rounded-xl transition-colors cursor-pointer flex items-center gap-1"
                                >
                                  <span>💻</span>
                                  <span>IDE</span>
                                </button>
                              </div>
                            ) : isIncomingPending(match.peerId) ? (
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const conn = incomingRequests.find((r) => (r.requesterId || '').toLowerCase() === match.peerId.toLowerCase());
                                    if (conn) handleAcceptRequest(conn);
                                  }}
                                  className="flex-1 py-2 px-3 bg-ok hover:bg-emerald-600 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
                                >
                                  ✓ Accept
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const conn = incomingRequests.find((r) => (r.requesterId || '').toLowerCase() === match.peerId.toLowerCase());
                                    if (conn) handleDeclineRequest(conn.id);
                                  }}
                                  className="py-2 px-3 bg-card hover:bg-border text-xs text-muted hover:text-bad border border-border rounded-xl transition-colors cursor-pointer"
                                >
                                  Decline
                                </button>
                              </div>
                            ) : isOutgoingPending(match.peerId) ? (
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex-1 py-2 px-3 bg-amber/10 border border-amber/30 text-amber font-bold text-xs rounded-xl flex items-center justify-center gap-1.5">
                                  <span>Requested ✓</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleCancelRequest(match.peerId)}
                                  className="py-2 px-2 text-[11px] text-muted hover:text-bad hover:underline cursor-pointer transition-colors"
                                >
                                  Cancel request
                                </button>
                              </div>
                            ) : (
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleOpenInPageChat({
                                      id: match.peerId,
                                      name: match.peerName,
                                      role: match.peerRole,
                                      skill: match.primarySkill,
                                      score: match.score,
                                    })
                                  }
                                  className="py-2.5 px-3 bg-card-alt hover:bg-card border border-border text-ink font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-98"
                                >
                                  <span>💬</span>
                                  <span>Chat</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSendConnectionRequest(match)}
                                  className="flex-1 py-2.5 px-3.5 bg-amber hover:bg-terracotta text-white text-xs font-bold rounded-xl shadow-xs transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-1.5"
                                >
                                  <span>🤝</span>
                                  <span>Connect</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* TAB 2: Connection Requests Content */}
            {activeTab === 'requests' && (
              <div className="space-y-6">
                {incomingRequests.length === 0 && outgoingRequests.length === 0 ? (
                  <div className="p-8 rounded-2xl border-2 border-dashed border-border bg-card-alt flex flex-col items-center text-center gap-3 animate-fade-in">
                    <span className="text-3xl">📬</span>
                    <h3 className="text-base font-serif font-bold text-ink">No Pending Requests</h3>
                    <p className="text-xs text-muted max-w-sm">
                      When peers send you a connection invite or you send one out, they will appear here. The system also syncs automatically!
                    </p>
                    <button
                      type="button"
                      onClick={handleManualRefresh}
                      disabled={isRefreshing}
                      className="mt-2 px-4 py-2 bg-amber hover:bg-terracotta text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5 active:scale-98"
                    >
                      <span className={isRefreshing ? 'animate-spin' : ''}>🔄</span>
                      <span>{isRefreshing ? 'Checking Cloud...' : 'Refresh Requests'}</span>
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Incoming Section */}
                    {incomingRequests.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between px-1 text-xs text-muted">
                          <span className="font-bold text-ink">Incoming Invitations ({incomingRequests.length})</span>
                          <button
                            type="button"
                            onClick={handleManualRefresh}
                            disabled={isRefreshing}
                            className="text-xs text-amber hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            <span className={isRefreshing ? 'animate-spin' : ''}>🔄</span>
                            <span>Refresh</span>
                          </button>
                        </div>
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
                                Accept
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

                    {/* Outgoing Section */}
                    {outgoingRequests.length > 0 && (
                      <div className="space-y-3 pt-2">
                        <div className="flex items-center justify-between px-1 text-xs text-muted">
                          <span className="font-bold text-ink">Sent Requests ({outgoingRequests.length})</span>
                        </div>
                        {outgoingRequests.map((req) => (
                          <div
                            key={req.id}
                            className="p-4 rounded-2xl bg-card-alt border border-border flex flex-wrap items-center justify-between gap-3 shadow-xs"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-amber/20 text-amber flex items-center justify-center font-bold text-sm border border-amber/30">
                                {req.recipientName ? req.recipientName.slice(0, 2).toUpperCase() : 'PE'}
                              </div>
                              <div>
                                <h4 className="font-semibold text-ink text-sm">{req.recipientName}</h4>
                                <p className="text-xs text-muted">
                                  Awaiting response for <strong>{req.skillArea || 'Study Session'}</strong>
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-amber bg-amber/10 border border-amber/25 px-2.5 py-1 rounded-lg">
                                Requested ✓
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCancelRequest(req.recipientId)}
                                className="px-3 py-2 bg-card hover:bg-border text-xs text-muted hover:text-bad border border-border rounded-xl transition-colors cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* IN-MATCH INTERACTIVE CHAT DRAWER / FLOATING MESSENGER     */}
      {/* ======================================================== */}
      {activeChatPeer && (
        <div className="fixed bottom-4 right-4 z-50 w-full max-w-[380px] sm:max-w-[420px] bg-card border-2 border-amber/40 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-slide-up transition-all">
          {/* Drawer Header */}
          <div className="p-4 bg-gradient-to-r from-card-alt to-card border-b border-border flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber to-terracotta text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
                {activeChatPeer.initials || '👥'}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-serif font-bold text-ink text-sm truncate">{activeChatPeer.name}</h3>
                  <span className="w-2 h-2 rounded-full bg-ok animate-pulse shrink-0" title="Online now" />
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-muted">
                  <span className="text-amber font-semibold">{activeChatPeer.skill || domain}</span>
                  {activeChatPeer.score && (
                    <span>• {activeChatPeer.score}% Match</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => handleOpenChat(activeChatPeer.name, activeChatPeer.id, activeChatPeer.skill || domain)}
                className="px-2.5 py-1 text-[11px] bg-amber/15 text-amber hover:bg-amber hover:text-white font-bold rounded-lg border border-amber/30 transition-all cursor-pointer"
                title="Launch Collaborative IDE"
              >
                IDE →
              </button>
              <button
                type="button"
                onClick={() => setActiveChatPeer(null)}
                className="w-7 h-7 rounded-lg bg-card-alt border border-border text-muted hover:text-ink flex items-center justify-center text-xs font-bold transition-colors cursor-pointer"
                title="Close chat"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Messages Stream */}
          <div ref={chatMessagesContainerRef} className="p-4 h-[300px] overflow-y-auto space-y-3 bg-canvas/40 flex flex-col">
            {matchChatMessages.map((msg) => {
              const isMe = msg.sender === 'me';
              return (
                <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  <div className="flex items-center gap-1.5 mb-0.5 px-1">
                    <span className="text-[10px] font-semibold text-muted">
                      {isMe ? 'You' : msg.senderName || activeChatPeer.name}
                    </span>
                    <span className="text-[9px] text-muted">{msg.time}</span>
                  </div>
                  <div
                    className={`max-w-[85%] px-3.5 py-2 rounded-2xl text-xs leading-relaxed ${
                      isMe
                        ? 'bg-amber text-white rounded-br-xs shadow-xs'
                        : 'bg-card border border-border text-ink rounded-bl-xs shadow-2xs'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              );
            })}

            {isMatchChatTyping && (
              <div className="flex items-center gap-2 text-xs text-muted p-2 bg-card rounded-xl border border-border w-fit animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-amber animate-ping" />
                <span>{activeChatPeer.name} is typing...</span>
              </div>
            )}
            <div ref={chatMessagesEndRef} />
          </div>

          {/* Quick Prompts */}
          <div className="px-3 pt-2 pb-1 bg-card border-t border-border flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {[
              '👋 Ready to pair?',
              '💡 Can you explain this concept?',
              '🎯 Let’s solve today’s challenge!',
            ].map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => handleSendMatchMessage(undefined, prompt)}
                className="text-[10px] px-2.5 py-1 rounded-full bg-card-alt border border-border text-muted hover:text-ink hover:border-amber transition-colors whitespace-nowrap cursor-pointer shrink-0"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Message Input Bar */}
          <form onSubmit={handleSendMatchMessage} className="p-3 bg-card flex items-center gap-2">
            <input
              type="text"
              value={matchChatInput}
              onChange={(e) => setMatchChatInput(e.target.value)}
              placeholder={`Message ${activeChatPeer.name}...`}
              className="flex-1 px-3.5 py-2 text-xs bg-card-alt border border-border rounded-xl text-ink focus:outline-none focus:border-amber transition-colors"
            />
            <button
              type="submit"
              disabled={!matchChatInput.trim()}
              className="px-3.5 py-2 bg-amber hover:bg-terracotta disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer shrink-0"
            >
              Send
            </button>
          </form>
        </div>
      )}

      {/* ======================================================== */}
      {/* JURY ARCHITECTURE & ACTIVE PIPELINE EXPLANATION MODAL     */}
      {/* ======================================================== */}
      {showJuryPipelineModal && (
        <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fade-in">
          <div className="bg-card border border-border rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-7 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-3">
                <span className="text-3xl">🎓</span>
                <div>
                  <h3 className="font-serif font-bold text-lg text-ink">
                    Autonomous Peer-Matching Agent Architecture
                  </h3>
                  <p className="text-xs text-muted">Jury Presentation Guide &amp; Technical Breakdown</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowJuryPipelineModal(false)}
                className="w-8 h-8 rounded-full bg-card-alt border border-border text-muted hover:text-ink flex items-center justify-center text-sm font-bold cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Quick 30-Second Elevator Pitch */}
            <div className="p-4 rounded-2xl bg-amber/10 border border-amber/30 space-y-1.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber">
                🎯 30-Second Pitch to the Judges:
              </h4>
              <p className="text-xs text-ink leading-relaxed font-serif">
                &ldquo;Synapse does not rely on static directory lists or random roulette pairing. We built an autonomous 4-phase ODAEA agent loop that ingests real proctored quiz mastery, maps Zone of Proximal Development (ZPD) skill gaps in an empirical graph, evaluates pairs across a 6-factor weighted compatibility formula, and autonomously monitors match health deltas to trigger remediation rematching when needed.&rdquo;
              </p>
            </div>

            {/* 4 Architectural Phases Detailed */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted">
                The 4 Architectural Phases:
              </h4>

              <div className="p-3.5 rounded-xl bg-card-alt border border-border space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-ink">1. Observation &amp; Skill Profiling</span>
                  <span className="text-[10px] font-mono text-amber font-bold">ODAEA Steps 1–3</span>
                </div>
                <p className="text-xs text-muted leading-relaxed">
                  Ingests verified skill declarations, proctored quiz scores, and learning goals. Classifies users into Certified Teachers (Level &ge; 3), Peer Helpers (Level 2), or Learners.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-card-alt border border-border space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-ink">2. Graph Search &amp; ZPD Gap Analysis</span>
                  <span className="text-[10px] font-mono text-amber font-bold">ODAEA Steps 4–6</span>
                </div>
                <p className="text-xs text-muted leading-relaxed">
                  Calculates the Zone of Proximal Development. An optimal match occurs when the Teacher is exactly 1–2 levels ahead of the Learner, maximizing peer scaffolding while preventing cognitive overload.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-card-alt border border-border space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-ink">3. The 6-Factor Weighted Compatibility Formula</span>
                  <span className="text-[10px] font-mono text-amber font-bold">ODAEA Steps 7–9</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 font-mono text-[11px]">
                  <span className="bg-card p-1.5 rounded border border-border text-center">🎯 Skill Fit: 30%</span>
                  <span className="bg-card p-1.5 rounded border border-border text-center">📈 ZPD Delta: 20%</span>
                  <span className="bg-card p-1.5 rounded border border-border text-center">⚡ Need Urgency: 15%</span>
                  <span className="bg-card p-1.5 rounded border border-border text-center">⏰ Availability: 15%</span>
                  <span className="bg-card p-1.5 rounded border border-border text-center">🧠 Style Fit: 10%</span>
                  <span className="bg-card p-1.5 rounded border border-border text-center">🌐 Network Value: 10%</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-card-alt border border-border space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-ink">4. Autonomous Feedback &amp; Rematch Loop</span>
                  <span className="text-[10px] font-mono text-amber font-bold">ODAEA Steps 10–12</span>
                </div>
                <p className="text-xs text-muted leading-relaxed">
                  Post-session quizzes calculate empirical score delta ($post\_score - pre\_score$). If delta is low across 2 consecutive sessions, Match Health alerts the agent to autonomously reclassify and suggest a new peer match.
                </p>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowJuryPipelineModal(false)}
                className="px-5 py-2.5 bg-amber hover:bg-terracotta text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
              >
                Close Walkthrough
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
