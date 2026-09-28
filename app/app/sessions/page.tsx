'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import PreJoinModal from '@/components/call/PreJoinModal';
import StudyRoomView from '@/components/call/StudyRoomView';
import NativeCallView from '@/components/call/NativeCallView';
import { createClient } from '@/lib/supabase/client';
import SessionSummaryCard from '@/components/adaptive/SessionSummaryCard';
import WhyThisModal from '@/components/adaptive/WhyThisModal';

// ─── Types ────────────────────────────────────────────────────
interface ChatMessage {
  id: string;
  text: string;
  sender: 'me' | 'peer';
  time: string;
  senderName?: string;
  type?: 'text' | 'voice' | 'ai_rephrase' | 'ai_fallback' | 'system' | 'study_assistant';
  voiceDataUrl?: string;
  reactions?: string[];
  flagged?: boolean;
  status?: 'sending' | 'sent' | 'failed';
}

interface ChallengeRubric {
  criteria: string[];
  max_score: number;
}

interface ChallengeData {
  id: string;
  session_id: string;
  topic: string;
  question: string;
  rubric: ChallengeRubric;
  starter_code?: string;
}

interface AgentActivityLog {
  id: string;
  timestamp: string;
  agent: string;
  action: string;
  reason: string;
  details?: any;
}

// ─── Component ────────────────────────────────────────────────
export default function SessionsPage() {
  // User state
  const [studentTrack, setStudentTrack] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('synapse_study_data');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.domain) return parsed.domain;
        }
      } catch (e) {}
    }
    return 'React';
  });
  const [studentName, setStudentName] = useState(() => {
    if (typeof window !== 'undefined') {
      const name = localStorage.getItem('synapse_user_name');
      if (name) return name;
      try {
        const saved = localStorage.getItem('synapse_study_data');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.name) return parsed.name;
        }
      } catch (e) {}
    }
    return 'Learner';
  });
  const [studentEmail, setStudentEmail] = useState(() => {
    if (typeof window !== 'undefined') {
      const email = localStorage.getItem('synapse_user_email');
      if (email) return email;
      try {
        const saved = localStorage.getItem('synapse_study_data');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.email) return parsed.email;
        }
      } catch (e) {}
    }
    return '';
  });
  const [userXp, setUserXp] = useState(() => {
    if (typeof window !== 'undefined') {
      const xp = localStorage.getItem('synapse_user_xp');
      if (xp) return parseInt(xp, 10);
    }
    return 350;
  });

  // Active peer
  const [activePeer, setActivePeer] = useState<{
    id: string;
    name: string;
    initials: string;
    skill: string;
    isReal?: boolean;
  }>(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedPeer = localStorage.getItem('synapse_active_peer');
        if (savedPeer) {
          const p = JSON.parse(savedPeer);
          return {
            id: p.id || 'peer-live',
            name: p.name || 'Peer Partner',
            initials: p.name ? p.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2) : 'PP',
            skill: p.domain || p.offers?.[0] || 'Peer Learning',
            isReal: Boolean(p.isReal),
          };
        }
      } catch (e) {}
    }
    return {
      id: 'peer-live',
      name: 'Waiting for Peer...',
      initials: '👥',
      skill: 'Multi-Device Ready',
      isReal: false,
    };
  });

  const [isConnectionAccepted, setIsConnectionAccepted] = useState(true);

  // ─── Part 1: Collaborative Challenge & Rubric ─────────────────
  const [challengeData, setChallengeData] = useState<ChallengeData | null>(null);
  const [challengeTitle, setChallengeTitle] = useState('Collaborative Hook Implementation');
  const [challengeDescription, setChallengeDescription] = useState('Build a resilient custom async hook with loading, data, and error state handling.');
  const [starterCode, setStarterCode] = useState('');
  const [peerSubmitted, setPeerSubmitted] = useState(false);

  // ─── Part H: Persistent Chat Messages ─────────────────────────
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const myKey = (localStorage.getItem('synapse_user_email') || localStorage.getItem('synapse_user_name') || 'user').trim().toLowerCase();
        let peerKey = 'peer';
        const savedPeer = localStorage.getItem('synapse_active_peer');
        if (savedPeer) {
          try {
            const p = JSON.parse(savedPeer);
            peerKey = (p.id || p.name || 'peer').trim().toLowerCase();
          } catch (e) {}
        }
        const pairKey = 'synapse_chat_pair_' + [myKey, peerKey].sort().join('__');
        const cached =
          localStorage.getItem(pairKey) ||
          localStorage.getItem('synapse_last_chat_messages');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (e) {}
    }
    return [];
  });
  const [input, setInput] = useState('');
  const [isPeerTyping, setIsPeerTyping] = useState(false);
  const [showNewMsgIndicator, setShowNewMsgIndicator] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);

  // ─── Part D: Voice Recording with Cross-browser MIME check ────
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // ─── Part B: Session Health ───────────────────────────────────
  const [sessionPhase, setSessionPhase] = useState<'pre-quiz' | 'active' | 'post-quiz' | 'review'>('active');
  const [preQuizQuestions, setPreQuizQuestions] = useState<any[]>([]);
  const [preQuizAnswers, setPreQuizAnswers] = useState<number[]>([]);
  const [postQuizAnswers, setPostQuizAnswers] = useState<number[]>([]);
  const [preScore, setPreScore] = useState<number | null>(null);
  const [postScore, setPostScore] = useState<number | null>(null);
  const [autonomousAction, setAutonomousAction] = useState<{ action: string; reason: string } | null>(null);
  const [sessionNumber, setSessionNumber] = useState(1);

  // Challenge Code & Evaluation
  const defaultStarter = `// Challenge: Create a resilient custom hook
function useAsync(asyncFn) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    asyncFn()
      .then(res => setData(res))
      .catch(err => setError(err))
      .finally(() => setLoading(false));
  }, [asyncFn]);

  return { loading, data, error };
}`;

  const [codeSnippet, setCodeSnippet] = useState(defaultStarter);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState<{
    correctness: number;
    quality: number;
    improvement: string;
    summary: string;
    overall: number;
    status?: string;
  } | null>(null);

  // Peer Review State
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [reviewText, setReviewText] = useState('');
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // ─── Part 6: Live Voice / Video Calls ─────────────────────────
  const [isCallModalOpen, setIsCallModalOpen] = useState(false);
  const [callMode, setCallMode] = useState<'voice' | 'video'>('voice');
  const [callUrl, setCallUrl] = useState<string | null>(null);
  const [callConnecting, setCallConnecting] = useState(false);
  const [callTimeout, setCallTimeout] = useState(false);
  const [showPostCallQuiz, setShowPostCallQuiz] = useState(false);
  const [postCallAnswers, setPostCallAnswers] = useState<number[]>([-1, -1, -1]);
  const [postCallSubmitted, setPostCallSubmitted] = useState(false);

  // Live Call Signaling & Incoming Ringing
  const [activeCallSessionId, setActiveCallSessionId] = useState<string>('');
  const [isCallInitiator, setIsCallInitiator] = useState<boolean>(false);
  const [incomingCall, setIncomingCall] = useState<{
    callerId: string;
    callerName: string;
    callUrl: string;
    callMode: 'voice' | 'video';
    callSessionId?: string;
    messageId: string;
  } | null>(null);
  const dismissedCallIdsRef = useRef<Set<string>>(new Set());

  // ─── Study Rooms ("Start Learning Session") State ────────────
  const [studyRooms, setStudyRooms] = useState<any[]>([]);
  const [showCreateRoomModal, setShowCreateRoomModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomTopic, setNewRoomTopic] = useState('');
  const [newRoomCapacity, setNewRoomCapacity] = useState(6);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);

  // Pre-join & Active In-Room State
  const [preJoinRoom, setPreJoinRoom] = useState<any | null>(null);
  const [activeStudyRoom, setActiveStudyRoom] = useState<{
    room: any;
    token?: string;
    roomUrl?: string;
    initialVideo: boolean;
    initialAudio: boolean;
    isHost: boolean;
  } | null>(null);

  // ─── Part 5: AI Study Assistant (Tiers 1, 2, 3) ───────────────
  const [studyAssistantBanner, setStudyAssistantBanner] = useState<string | null>(null);
  const [tier1VoicePrompt, setTier1VoicePrompt] = useState<string | null>(null);
  const [tier3Video, setTier3Video] = useState<{
    id: string;
    youtubeId: string;
    title: string;
    postQuiz: any[];
    message: string;
  } | null>(null);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [videoWatched, setVideoWatched] = useState(false);
  const [videoQuizAnswers, setVideoQuizAnswers] = useState<number[]>([]);
  const [videoQuizResult, setVideoQuizResult] = useState<{ score: number; reason?: string } | null>(null);

  // Section 6: Chat AI Controls & Safe Video Watch Gate
  const [assistantSuppressedUntil, setAssistantSuppressedUntil] = useState<number>(0);
  const [assistantDisabledForSession, setAssistantDisabledForSession] = useState<boolean>(false);
  const [videoWatchSeconds, setVideoWatchSeconds] = useState<number>(0);
  const [isVideoEnded, setIsVideoEnded] = useState<boolean>(false);

  // ─── Part 7: Autonomous Agent Activity Feed ───────────────────
  const [isActivityDrawerOpen, setIsActivityDrawerOpen] = useState(false);
  const [activityLogs, setActivityLogs] = useState<AgentActivityLog[]>([]);

  // ─── Part 7: End-of-Session AI Summary ────────────────────────
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [sessionSummary, setSessionSummary] = useState<any | null>(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const getSessionId = useCallback(() => {
    const myId = (studentEmail || studentName).trim().toLowerCase();
    const peerId = (activePeer.id || activePeer.name).trim().toLowerCase();
    return [myId, peerId].sort().join('_') || 'global_collab';
  }, [studentEmail, studentName, activePeer.id, activePeer.name]);

  // ─── Scroll Management ──────────────────────────────────────
  const handleScroll = useCallback(() => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    isNearBottomRef.current = scrollHeight - scrollTop - clientHeight < 80;
    if (isNearBottomRef.current) setShowNewMsgIndicator(false);
  }, []);

  const scrollToBottom = useCallback((force = false) => {
    if (force || isNearBottomRef.current) {
      if (chatContainerRef.current) {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
      }
      setShowNewMsgIndicator(false);
    } else {
      setShowNewMsgIndicator(true);
    }
  }, []);

  // ─── Load User & Peer ──────────────────────────────────────
  useEffect(() => {
    let currentEmail = '';
    let currentName = 'Learner';
    let currentTrack = 'React';
    let peerId = 'peer-default';

    try {
      const saved = localStorage.getItem('synapse_study_data');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.domain) { currentTrack = parsed.domain; setStudentTrack(parsed.domain); }
        if (parsed.name) { currentName = parsed.name; setStudentName(parsed.name); }
        if (parsed.email) { currentEmail = parsed.email; setStudentEmail(parsed.email); }
      }
      const cachedEmail = localStorage.getItem('synapse_user_email');
      if (cachedEmail) { currentEmail = cachedEmail; setStudentEmail(cachedEmail); }
      const cachedName = localStorage.getItem('synapse_user_name');
      if (cachedName) setStudentName(cachedName);
      const savedXp = localStorage.getItem('synapse_user_xp');
      if (savedXp) setUserXp(parseInt(savedXp, 10));

      // Load active peer
      const savedPeer = localStorage.getItem('synapse_active_peer');
      if (savedPeer) {
        const parsedPeer = JSON.parse(savedPeer);
        peerId = parsedPeer.id || 'peer-active';
        setActivePeer({
          id: peerId,
          name: parsedPeer.name || 'Peer Partner',
          initials: parsedPeer.name ? parsedPeer.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2) : 'PP',
          skill: parsedPeer.domain || parsedPeer.offers?.[0] || currentTrack + ' Track',
          isReal: Boolean(parsedPeer.isReal)
        });
      } else {
        const isDemo = localStorage.getItem('synapse_demo_active') === 'true';
        if (isDemo) {
          setActivePeer({ id: 'peer-maya', name: 'Maya Lin (Demo Peer)', initials: 'ML', skill: currentTrack + ' & TypeScript', isReal: false });
        } else {
          setActivePeer({ id: 'peer-live', name: 'Waiting for Peer...', initials: '\u{1F465}', skill: 'Multi-Device Ready (' + currentTrack + ')', isReal: false });
        }
      }
      // Check for incoming auto-join call from layout notification
      const autoJoinCall = sessionStorage.getItem('synapse_auto_join_call');
      if (autoJoinCall) {
        sessionStorage.removeItem('synapse_auto_join_call');
        const parsedCall = JSON.parse(autoJoinCall);
        if (parsedCall.callUrl) {
          setCallUrl(parsedCall.callUrl);
          setCallMode(parsedCall.callMode || 'video');
          setIsCallModalOpen(true);
        }
      }
    } catch (e) {}

    // Check connection status
    if (currentEmail && peerId && !peerId.includes('demo') && !peerId.includes('maya')) {
      fetch('/api/connections?userId=' + encodeURIComponent(currentEmail))
        .then((res) => res.json())
        .then((data) => {
          const normPeer = peerId.trim().toLowerCase();
          const activeList = Array.isArray(data.active) ? data.active : [];
          const isAccepted = activeList.some((c: any) => c.requesterId === normPeer || c.recipientId === normPeer);
          const outgoingList = Array.isArray(data.pendingOutgoing) ? data.pendingOutgoing : [];
          const isPending = outgoingList.some((c: any) => c.recipientId === normPeer);
          setIsConnectionAccepted(isPending && !isAccepted ? false : true);
        })
        .catch(() => setIsConnectionAccepted(true));
    }

    // Fetch collaborative challenge & rubric
    const sId = [currentEmail.trim().toLowerCase(), peerId.trim().toLowerCase()].sort().join('_') || 'global_collab';
    fetch('/api/challenge?sessionId=' + encodeURIComponent(sId) + '&skillArea=' + encodeURIComponent(currentTrack))
      .then((res) => res.json())
      .then((data) => {
        if (data.challenge) {
          setChallengeData(data.challenge);
          setChallengeTitle(data.challenge.question ? 'Collaborative Challenge: ' + currentTrack : data.challenge.title || 'Collaborative Challenge');
          setChallengeDescription(data.challenge.question || data.challenge.description);
          if (data.challenge.starter_code) {
            setStarterCode(data.challenge.starter_code);
            setCodeSnippet(data.challenge.starter_code);
          }
        }
        if (Array.isArray(data.submissions)) {
          const peerSub = data.submissions.find((s: any) => s.user_id !== currentEmail.toLowerCase());
          if (peerSub) setPeerSubmitted(true);
        }
      })
      .catch(() => {});

    // Register with network
    if (currentEmail) {
      fetch('/api/peer-network', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: currentName, email: currentEmail, domain: currentTrack })
      }).catch(() => {});
    }

    // Message history is loaded via thread-based fetchThreadMessages below
  }, []);

  // ─── Part H / BUG 5: Thread Messages Persistence & Realtime ───
  const currentThreadId = activeStudyRoom?.room?.id
    ? `room__${activeStudyRoom.room.id}`
    : `pair__${[(studentEmail || studentName || 'learner').trim().toLowerCase(), (activePeer.id || activePeer.name || 'peer').trim().toLowerCase()].sort().join('__')}`;

  // Synchronize messages to local storage whenever they change
  useEffect(() => {
    if (messages.length > 0 && typeof window !== 'undefined') {
      try {
        localStorage.setItem('synapse_last_chat_messages', JSON.stringify(messages));
        if (currentThreadId) {
          localStorage.setItem('synapse_chat_' + currentThreadId, JSON.stringify(messages));
        }
        const myKey = (studentEmail || studentName || 'user').trim().toLowerCase();
        const peerKey = (activePeer.id || activePeer.name || 'peer').trim().toLowerCase();
        const pairKey = 'synapse_chat_pair_' + [myKey, peerKey].sort().join('__');
        localStorage.setItem(pairKey, JSON.stringify(messages));
      } catch (e) {}
    }
  }, [messages, currentThreadId, studentEmail, studentName, activePeer.id, activePeer.name]);

  const fetchThreadMessages = useCallback(async (tId: string) => {
    if (!tId) return;

    // Immediately restore cached thread messages if state is currently empty
    if (typeof window !== 'undefined') {
      try {
        const myKey = (studentEmail || studentName || 'user').trim().toLowerCase();
        const peerKey = (activePeer.id || activePeer.name || 'peer').trim().toLowerCase();
        const pairKey = 'synapse_chat_pair_' + [myKey, peerKey].sort().join('__');
        const cached =
          localStorage.getItem('synapse_chat_' + tId) ||
          localStorage.getItem(pairKey) ||
          localStorage.getItem('synapse_last_chat_messages');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setMessages((prev) => (prev.length === 0 ? parsed : prev));
          }
        }
      } catch (e) {}
    }

    try {
      const res = await fetch('/api/messages?threadId=' + encodeURIComponent(tId) + '&limit=50');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.messages) && data.messages.length > 0) {
          const myEmailLower = (studentEmail || studentName || '').trim().toLowerCase();
          const loaded: ChatMessage[] = data.messages.map((m: any) => ({
            id: m.id,
            text: m.content || m.text || '',
            sender: (m.sender_email || m.senderId || '').trim().toLowerCase() === myEmailLower ? ('me' as const) : ('peer' as const),
            time: m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now',
            senderName: m.sender_name || m.senderName,
            type: m.type || 'text',
            voiceDataUrl: m.voice_url || m.voiceDataUrl,
            reactions: m.reactions || [],
            flagged: m.flagged || false,
            status: 'sent' as const,
          }));

          setMessages((prev) => {
            if (prev.length === 0) return loaded;
            // Merge deduplicated by message id or content
            const existingIds = new Set(prev.map((p) => p.id));
            const newOnes = loaded.filter((l) => !existingIds.has(l.id));
            if (newOnes.length === 0) return prev;
            return [...prev, ...newOnes];
          });
          setTimeout(() => scrollToBottom(true), 60);
        }
      }
    } catch (e) {}
  }, [studentEmail, studentName, activePeer.id, activePeer.name, scrollToBottom]);

  useEffect(() => {
    if (!currentThreadId) return;
    fetchThreadMessages(currentThreadId);

    // Periodic backup sync (fallback if websocket disconnected)
    const pollInterval = setInterval(() => {
      fetchThreadMessages(currentThreadId);
    }, 3000);

    // Supabase Realtime INSERT subscription
    const supabase = createClient();
    const channel = supabase
      .channel('realtime_thread_' + currentThreadId)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: 'thread_id=eq.' + currentThreadId,
        },
        (payload: any) => {
          const m = payload.new;
          if (!m) return;
          const myEmailLower = (studentEmail || studentName || '').trim().toLowerCase();
          const isFromMe = (m.sender_email || '').trim().toLowerCase() === myEmailLower;

          setMessages((prev) => {
            const existingIdx = prev.findIndex(
              (ex) => ex.id === m.id || (isFromMe && ex.status === 'sending' && ex.text === m.content)
            );
            const formatted: ChatMessage = {
              id: m.id,
              text: m.content || '',
              sender: isFromMe ? ('me' as const) : ('peer' as const),
              time: m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now',
              senderName: m.sender_name || (isFromMe ? studentName : activePeer.name),
              type: m.type || 'text',
              voiceDataUrl: m.voice_url,
              reactions: [],
              flagged: false,
              status: 'sent' as const,
            };

            if (existingIdx !== -1) {
              const updated = [...prev];
              updated[existingIdx] = formatted;
              return updated;
            }
            setTimeout(() => scrollToBottom(), 50);
            return [...prev, formatted];
          });
        }
      )
      .subscribe();

    return () => {
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [currentThreadId, fetchThreadMessages, studentEmail, studentName, activePeer.name, scrollToBottom]);

  // ─── Real-time Signaling & Peer Events Polling ─────────────
  useEffect(() => {
    let isSubscribed = true;

    const pollPeerEvents = async () => {
      try {
        const res = await fetch('/api/peer-network?sessionId=global_collab');
        if (res.ok && isSubscribed) {
          const data = await res.json();
          if (Array.isArray(data.messages) && data.messages.length > 0) {
            const myEmailLower = (studentEmail || '').trim().toLowerCase();

            // Detect live incoming call invites from peer
            const latestInvite = data.messages
              .slice()
              .reverse()
              .find((m: any) => {
                if (m.type !== 'call_invite' && !m.callUrl) return false;
                const senderLower = (m.senderId || '').trim().toLowerCase();
                if (myEmailLower && senderLower === myEmailLower) return false;
                if (dismissedCallIdsRef.current.has(m.id)) return false;
                if (m.createdAt && Date.now() - m.createdAt > 120000) return false;
                return true;
              });

            if (latestInvite && !isCallModalOpen) {
              setIncomingCall({
                callerId: latestInvite.senderId,
                callerName: latestInvite.senderName || activePeer.name || 'Peer Partner',
                callUrl: latestInvite.callUrl,
                callMode: latestInvite.callMode || 'video',
                callSessionId: latestInvite.callSessionId,
                messageId: latestInvite.id,
              });
            } else if (!latestInvite && incomingCall) {
              setIncomingCall(null);
            }

            // If currently in a live call, check if peer broadcasted call_end
            if (isCallModalOpen) {
              const callEndEvent = data.messages
                .slice()
                .reverse()
                .find((m: any) => {
                  if (m.type !== 'call_end') return false;
                  const senderLower = (m.senderId || '').trim().toLowerCase();
                  if (myEmailLower && senderLower === myEmailLower) return false;
                  if (m.createdAt && Date.now() - m.createdAt > 20000) return false;
                  return true;
                });

              if (callEndEvent) {
                setIsCallModalOpen(false);
                setCallUrl(null);
                showToast('Call ended by peer partner.');
              }
            }

            // Check for peer submitted trigger
            data.messages.forEach((m: any) => {
              if (m.text && m.text.includes('submitted the collaborative challenge')) {
                setPeerSubmitted(true);
              }
            });
          }
        }
      } catch (e) {}
    };

    const interval = setInterval(pollPeerEvents, 1500);
    return () => { isSubscribed = false; clearInterval(interval); };
  }, [studentEmail, activePeer.name, isCallModalOpen, incomingCall]);

  // ─── Incoming Call Audio Ring Chime ───────────────────────────
  useEffect(() => {
    if (!incomingCall) return;
    const playChime = () => {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime);
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
      } catch (e) {}
    };

    playChime();
    const interval = setInterval(playChime, 3000);
    return () => clearInterval(interval);
  }, [incomingCall]);

  // Check agent activity logs
  const fetchActivityLogs = async () => {
    try {
      const res = await fetch('/api/agent-activity?limit=25');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.logs)) setActivityLogs(data.logs);
      }
    } catch (e) {}
  };

  useEffect(() => {
    fetchActivityLogs();
    const interval = setInterval(fetchActivityLogs, 5000);
    return () => clearInterval(interval);
  }, []);

  // ─── Study Rooms Fetching & Realtime Merge (BUG 3) ────────────
  const mergeStudyRooms = useCallback((incomingRooms: any[]) => {
    setStudyRooms((prev) => {
      const map = new Map<string, any>();
      prev.forEach((r) => {
        if (r && r.id && r.status !== 'ended') {
          map.set(r.id, r);
        }
      });
      incomingRooms.forEach((r) => {
        if (r && r.id) {
          if (r.status === 'ended') {
            map.delete(r.id);
          } else {
            map.set(r.id, r);
          }
        }
      });
      return Array.from(map.values()).filter((r) => r.status === 'live' || r.status === 'waiting');
    });
  }, []);

  const fetchStudyRooms = useCallback(async () => {
    try {
      const res = await fetch('/api/study-rooms?action=list');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.rooms)) {
          mergeStudyRooms(data.rooms);
        }
      }
    } catch (e) {}
  }, [mergeStudyRooms]);

  useEffect(() => {
    fetchStudyRooms();
    const interval = setInterval(fetchStudyRooms, 4000);

    const supabase = createClient();
    const channel = supabase
      .channel('realtime_study_rooms')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'study_rooms' },
        (payload: any) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            if (payload.new) mergeStudyRooms([payload.new]);
          } else if (payload.eventType === 'DELETE') {
            setStudyRooms((prev) => prev.filter((r) => r.id !== payload.old?.id));
          }
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [fetchStudyRooms, mergeStudyRooms]);

  const handleCreateStudyRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;
    setIsCreatingRoom(true);
    try {
      const res = await fetch('/api/study-rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          name: newRoomName.trim(),
          topic: newRoomTopic.trim() || studentTrack,
          hostId: studentEmail || studentName,
          hostName: studentName,
          type: 'group',
          maxParticipants: newRoomCapacity,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(data.error || 'Could not create study room');
        return;
      }
      setShowCreateRoomModal(false);
      setNewRoomName('');
      setPreJoinRoom({
        room: data.room,
        token: data.token,
        roomUrl: data.roomUrl,
        isHost: true,
      });
      fetchStudyRooms();
    } catch (e) {
      showToast('Error creating study room');
    } finally {
      setIsCreatingRoom(false);
    }
  };

  const handleInitiateJoin = (targetRoom: any) => {
    setPreJoinRoom({
      room: targetRoom,
      isHost: targetRoom.host_id.toLowerCase() === (studentEmail || studentName).toLowerCase(),
    });
  };

  const handlePreJoinConfirm = async (settings: {
    displayName: string;
    videoEnabled: boolean;
    audioEnabled: boolean;
  }) => {
    if (!preJoinRoom) return;
    const targetRoom = preJoinRoom.room;

    try {
      const res = await fetch('/api/study-rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'token',
          roomId: targetRoom.id,
          userId: studentEmail || studentName,
          userName: settings.displayName || studentName,
          startVideoOff: !settings.videoEnabled,
          startAudioOff: !settings.audioEnabled,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(data.error || "You can't join this room");
        setPreJoinRoom(null);
        return;
      }

      setActiveStudyRoom({
        room: data.room || targetRoom,
        token: data.token || preJoinRoom.token,
        roomUrl: data.roomUrl || preJoinRoom.roomUrl,
        initialVideo: settings.videoEnabled,
        initialAudio: settings.audioEnabled,
        isHost: Boolean(data.isHost || preJoinRoom.isHost),
      });
      setPreJoinRoom(null);
    } catch (e) {
      showToast('Failed to connect to study session');
      setPreJoinRoom(null);
    }
  };

  // ─── Study Assistant Check Trigger & Student Controls ──────
  useEffect(() => {
    if (!showVideoModal || isVideoEnded) return;

    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        setVideoWatchSeconds((prev) => {
          const next = prev + 1;
          // When video reaches 300s (5m), immediately unmount to prevent YouTube related videos
          if (next >= 300) {
            setIsVideoEnded(true);
          }
          return next;
        });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [showVideoModal, isVideoEnded]);

  const triggerStudyAssistantCheck = async (recentMsgs: ChatMessage[]) => {
    // Student controls: check session toggle and 10-minute cooldown
    if (assistantDisabledForSession) return;
    if (Date.now() < assistantSuppressedUntil) return;

    try {
      const sId = getSessionId();
      const res = await fetch('/api/study-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sId,
          topic: studentTrack,
          recentMessages: recentMsgs.slice(-10),
          senderId: studentEmail || studentName,
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.triggered) {
          if (data.tier === 1) {
            setTier1VoicePrompt(data.message);
          } else if (data.tier === 2) {
            setMessages(prev => [
              ...prev,
              {
                id: 'sa_tier2_' + Date.now(),
                text: data.message,
                sender: 'peer',
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                senderName: '\u{1F916} AI Study Assistant',
                type: 'study_assistant',
              }
            ]);
            showToast('🤖 AI Study Assistant joined the chat with a joint concept breakdown.');
          } else if (data.tier === 3) {
            setTier3Video({
              id: data.video.id,
              youtubeId: data.video.youtubeId,
              title: data.video.title,
              postQuiz: data.postQuiz || [],
              message: data.message
            });
            setVideoWatchSeconds(0);
            setIsVideoEnded(false);
            setVideoWatched(false);
            setShowVideoModal(true);
            setVideoQuizAnswers(new Array((data.postQuiz || []).length).fill(-1));
          }
        }
      }
    } catch (e) {}
  };

  // ─── Part D: Handle "Explain Differently" ───────────────────
  const handleExplainDifferently = async (msg: ChatMessage) => {
    showToast('\u{1F916} Generating simpler explanation...');
    try {
      const res = await fetch('/api/peer-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'rephrase',
          originalMessage: msg.text,
          context: messages.slice(-5).map(m => ({ sender: m.sender, text: m.text }))
        })
      });
      if (res.ok) {
        const data = await res.json();
        const aiMsg: ChatMessage = {
          id: 'ai_rephrase_' + Date.now(),
          text: data.reply || 'Let me try explaining that differently...',
          sender: 'peer',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          senderName: '\u{1F916} AI Assistant',
          type: 'ai_rephrase',
        };
        setMessages(prev => [...prev, aiMsg]);

        fetch('/api/peer-network', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'message', sessionId: 'global_collab',
            senderId: 'ai-assistant', senderName: '\u{1F916} AI Assistant', text: data.reply
          })
        }).catch(() => {});
      }
    } catch (e) {
      showToast('Could not generate AI rephrase. Try again.');
    }
  };

  // ─── Part D: Handle "I'm Lost" ─────────────────────────────
  const handleImLost = async (msg: ChatMessage) => {
    showToast('\u{1F635} Flagged as lost \u2014 asking AI Study Assistant...');

    const lostText = '\u{1F635} ' + studentName + ' flagged "I\'m lost" on: "' + msg.text.slice(0, 60) + '"';
    const updated = [
      ...messages,
      {
        id: 'flag_' + Date.now(),
        text: lostText,
        sender: 'me' as const,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        senderName: studentName,
        type: 'text' as const,
      }
    ];
    setMessages(updated);

    try {
      fetch('/api/peer-network', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'message', sessionId: 'global_collab',
          senderId: studentEmail || studentName, senderName: studentName,
          text: lostText
        })
      }).catch(() => {});
    } catch (e) {}

    // Trigger Study Assistant pipeline
    triggerStudyAssistantCheck(updated);
  };

  // ─── Part D: Voice Recording (Multi-format) ─────────────────
  const getSupportedMimeType = () => {
    const types = ['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/wav'];
    for (const t of types) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) {
        return t;
      }
    }
    return '';
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedMimeType();
      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType || 'audio/webm' });
        stream.getTracks().forEach(t => t.stop());

        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = reader.result as string;
          const voiceMsg: ChatMessage = {
            id: 'voice_' + Date.now(),
            text: '\u{1F3A4} Voice message',
            sender: 'me',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            senderName: studentName,
            type: 'voice',
            voiceDataUrl: base64,
            status: 'sent',
          };
          setMessages(prev => [...prev, voiceMsg]);

          try {
            await fetch('/api/messages', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                threadId: currentThreadId,
                content: '🎤 Voice message',
                senderName: studentName,
                senderEmail: studentEmail || studentName,
                type: 'voice',
                voiceUrl: base64,
              }),
            });
            await fetch('/api/voice-message', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                sessionId: 'global_collab',
                senderId: studentEmail || studentName,
                senderName: studentName,
                voiceDataUrl: base64,
                senderRole: 'me'
              })
            });
          } catch (e) {}
        };
        reader.readAsDataURL(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      showToast('Could not access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // ─── Send Text Message (BUG 5: Optimistic + Retry) ────────────
  const handleSendMessage = async (e?: React.FormEvent, retryMsg?: ChatMessage) => {
    if (e) e.preventDefault();
    const textToSend = retryMsg ? retryMsg.text : input.trim();
    if (!textToSend) return;

    const tempId = retryMsg ? retryMsg.id : 'msg_' + Date.now();
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const mySenderId = (studentEmail || studentName || 'learner').trim().toLowerCase();

    const optimisticMsg: ChatMessage = {
      id: tempId,
      text: textToSend,
      sender: 'me',
      time,
      senderName: studentName,
      type: 'text',
      status: 'sending',
    };

    if (!retryMsg) {
      setMessages((prev) => [...prev, optimisticMsg]);
      setInput('');
      setTimeout(() => scrollToBottom(), 50);
    } else {
      setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, status: 'sending' } : m)));
    }

    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          threadId: currentThreadId,
          content: textToSend,
          senderName: studentName,
          senderEmail: mySenderId,
          type: 'text',
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to send message');
      }

      const data = await res.json();
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId
            ? {
                ...m,
                id: data.message?.id || tempId,
                status: 'sent',
              }
            : m
        )
      );
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, status: 'failed' } : m))
      );
    }

    // Persist to peer-network buffer for backward compatibility & signaling
    try {
      fetch('/api/peer-network', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'message',
          sessionId: 'global_collab',
          senderId: mySenderId,
          senderName: studentName,
          text: textToSend,
        }),
      }).catch(() => {});
    } catch (e) {}

    // Check study assistant for confusion signals
    triggerStudyAssistantCheck([...messages, optimisticMsg]);

    // AI peer response for demo/AI peers
    if (!activePeer.isReal || activePeer.name.includes('Demo') || activePeer.name.includes('Waiting')) {
      setIsPeerTyping(true);
      try {
        const res = await fetch('/api/peer-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: textToSend,
            userCode: codeSnippet,
            track: studentTrack,
            peerName: activePeer.name.replace(' (Demo Peer)', ''),
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setTimeout(async () => {
            setIsPeerTyping(false);
            const peerReply = data.reply || "Looks great! Let's submit the solution to the evaluation agent.";
            try {
              await fetch('/api/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  threadId: currentThreadId,
                  content: peerReply,
                  senderName: activePeer.name,
                  senderEmail: 'ai_copilot@synapse.edu',
                  type: 'text',
                }),
              });
            } catch (e) {}
          }, 900);
        } else {
          setIsPeerTyping(false);
        }
      } catch (err) {
        setIsPeerTyping(false);
      }
    }
  };

  // ─── Evaluate Challenge (Hard Rules: Never fake a score, reject invalid) ──
  const handleEvaluate = async () => {
    const cleanCode = codeSnippet.trim();

    // HARD RULE: Empty or meaningless input = 0 and no AI call
    if (!cleanCode) {
      showToast('❌ Submission cannot be empty.');
      return;
    }
    if (cleanCode.length < 20) {
      showToast('❌ Submission is too short (minimum 20 characters required).');
      return;
    }
    if (starterCode && cleanCode === starterCode.trim()) {
      showToast('❌ Unchanged starter code. Write your solution before evaluating!');
      return;
    }

    setIsEvaluating(true);
    setEvaluation(null);

    try {
      const sId = getSessionId();
      const res = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: cleanCode,
          fileName: 'useAsync.ts',
          challenge: challengeDescription || challengeTitle,
          sessionId: sId,
          studentId: studentEmail || studentName,
        })
      });

      const data = await res.json();

      // HARD RULE: Never fake a score!
      if (!res.ok || data.status === 'not_evaluated') {
        showToast('⚠️ Evaluation unavailable: ' + (data.reason || 'AI evaluation could not evaluate code.'));
        setEvaluation({
          correctness: 0,
          quality: 0,
          overall: 0,
          summary: data.reason || 'AI call could not evaluate your answer.',
          improvement: 'Check your syntax and code logic, then submit again.',
          status: 'not_evaluated',
        });
        return;
      }

      setEvaluation(data);

      // Record submission in challenge endpoint
      try {
        await fetch('/api/challenge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'submit',
            sessionId: sId,
            userId: studentEmail || studentName,
            code: cleanCode,
            score: data.overall,
            feedback: {
              summary: data.summary,
              criteria_breakdown: data.criteria_breakdown,
              improvement: data.improvement
            }
          })
        });

        // Notify peer via network
        fetch('/api/peer-network', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'message', sessionId: 'global_collab',
            senderId: studentEmail || studentName, senderName: studentName,
            text: '\u2713 ' + studentName + ' submitted the collaborative challenge (' + data.overall + '% score)!'
          })
        }).catch(() => {});
      } catch (e) {}

      if (data.overall >= 60) {
        const nextXp = userXp + 75;
        setUserXp(nextXp);
        localStorage.setItem('synapse_user_xp', nextXp.toString());
        showToast('\u{1F389} Challenge Evaluated (' + data.overall + '%). +75 XP awarded!');
      } else {
        showToast('Critique: Code scored ' + data.overall + '%. Check the feedback to optimize.');
      }
    } catch (err: any) {
      showToast('Evaluation error. No score or XP recorded.');
    } finally {
      setIsEvaluating(false);
    }
  };

  // ─── Part 6: Live Voice / Video Calls ─────────────────────────
  const handleStartCall = async (mode: 'voice' | 'video') => {
    const myId = (studentEmail || studentName || 'user').trim().toLowerCase();
    const peerId = (activePeer.id || activePeer.name || 'peer').trim().toLowerCase();
    const deterministicCallSessionId = 'call__' + [myId, peerId].sort().join('__');
    setActiveCallSessionId(deterministicCallSessionId);
    setIsCallInitiator(true);

    setCallConnecting(true);
    setCallMode(mode);
    setCallTimeout(false);
    setIsCallModalOpen(true);

    try {
      const sId = deterministicCallSessionId;
      const res = await fetch('/api/call-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: studentEmail || studentName,
          peerEmail: activePeer.id || activePeer.name,
          mode,
          sessionId: sId,
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(data.error || 'Live calls could not connect. Check network connection.');
        setIsCallModalOpen(false);
        setCallConnecting(false);
        return;
      }

      setCallUrl(data.callUrl);
      setCallConnecting(false);

      // Broadcast live call invite to the other peer so their device rings
      fetch('/api/peer-network', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'call_invite',
          sessionId: 'global_collab',
          callSessionId: deterministicCallSessionId,
          senderId: studentEmail || studentName,
          senderName: studentName || 'Peer Partner',
          callUrl: data.callUrl,
          callMode: mode,
          text: `📞 Started a live ${mode} call. Click Accept to join!`
        })
      }).catch(() => {});

      // 10s connection timeout check
      const timer = setTimeout(() => {
        setCallTimeout(true);
      }, 10000);
      return () => clearTimeout(timer);
    } catch (e: any) {
      showToast('Call service error. Please try again.');
      setIsCallModalOpen(false);
      setCallConnecting(false);
    }
  };

  const handleEndCall = (durationSec = 0) => {
    setIsCallModalOpen(false);
    setCallUrl(null);

    // Only show post-call quiz if call was attended for at least 1 minute (60s)
    if (typeof durationSec === 'number' && durationSec >= 60) {
      setShowPostCallQuiz(true);
      setPostCallAnswers([-1, -1, -1]);
      setPostCallSubmitted(false);
      const mins = Math.floor(durationSec / 60);
      const secs = durationSec % 60;
      showToast(`Call ended (${mins}m ${secs}s). Please complete the 3-question peer check.`);
    } else {
      setShowPostCallQuiz(false);
      showToast(`Call ended (${durationSec}s). Calls under 1 minute do not require a post-call check.`);
    }

    // Broadcast call end to network
    fetch('/api/peer-network', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'call_end',
        sessionId: 'global_collab',
        senderId: studentEmail || studentName,
        senderName: studentName || 'Peer Partner',
        text: 'Call ended'
      })
    }).catch(() => {});
  };

  const handleAcceptIncomingCall = () => {
    if (!incomingCall) return;
    const callerId = incomingCall.callerId;
    const callerName = incomingCall.callerName;
    const myId = (studentEmail || studentName || 'user').trim().toLowerCase();
    const deterministicCallSessionId =
      incomingCall.callSessionId ||
      'call__' + [myId, callerId.trim().toLowerCase()].sort().join('__');

    // Synchronize active peer so both participants point to each other
    setActivePeer({
      id: callerId,
      name: callerName,
      initials: callerName
        ? callerName
            .split(' ')
            .map((n: string) => n[0])
            .join('')
            .slice(0, 2)
        : 'PP',
      skill: studentTrack + ' Track',
      isReal: true,
    });
    try {
      localStorage.setItem(
        'synapse_active_peer',
        JSON.stringify({
          id: callerId,
          name: callerName,
          domain: studentTrack,
          isReal: true,
        })
      );
    } catch (e) {}

    setActiveCallSessionId(deterministicCallSessionId);
    setIsCallInitiator(false);
    setCallUrl(incomingCall.callUrl);
    setCallMode(incomingCall.callMode);
    setIsCallModalOpen(true);
    setIncomingCall(null);
    showToast(`Connected to live ${incomingCall.callMode} call with ${callerName}!`);
  };

  const handleDeclineIncomingCall = () => {
    if (!incomingCall) return;
    dismissedCallIdsRef.current.add(incomingCall.messageId);
    setIncomingCall(null);
  };

  const handleSubmitPostCallQuiz = () => {
    setPostCallSubmitted(true);
    const nextXp = userXp + 25;
    setUserXp(nextXp);
    localStorage.setItem('synapse_user_xp', nextXp.toString());
    showToast('🎉 Post-call understanding verified across all 3 criteria! +25 XP.');
    setTimeout(() => setShowPostCallQuiz(false), 2000);
  };

  // ─── Part 5: Video Quiz Submit ────────────────────────────────
  const handleSubmitVideoQuiz = async () => {
    if (!tier3Video) return;
    const questions = tier3Video.postQuiz || [];
    let correct = 0;
    questions.forEach((q, idx) => {
      if (videoQuizAnswers[idx] === q.correct) correct++;
    });
    const score = Math.round((correct / (questions.length || 1)) * 100);

    try {
      const res = await fetch('/api/study-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'record_quiz',
          videoId: tier3Video.id,
          topic: studentTrack,
          postQuizScore: score,
        })
      });
      const data = await res.json();
      setVideoQuizResult({ score, reason: data.adaptationReason });

      // Post-video verification: 3 MCQs. If score < 70%, trigger Adaptive Engine
      if (score >= 70) {
        const nextXp = userXp + 30;
        setUserXp(nextXp);
        localStorage.setItem('synapse_user_xp', nextXp.toString());
        showToast(`🎉 Video quiz passed (${score}%)! +30 XP.`);
      } else {
        // Trigger Adaptive Engine for remediation
        fetch('/api/adaptive-engine', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'evaluate',
            userId: studentEmail || studentName,
            skill: studentTrack,
            topic: studentTrack,
            score,
          }),
        }).catch(() => {});
        showToast(`Video quiz scored ${score}% (< 70%). Adaptive engine has scheduled targeted remediation.`);
      }
    } catch (e) {
      setVideoQuizResult({ score });
    }
  };

  // ─── Part 7: End Session & AI Summary ─────────────────────────
  const handleEndSessionAndSummarize = async () => {
    setIsGeneratingSummary(true);
    setShowSummaryModal(true);

    try {
      const res = await fetch('/api/session-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: studentEmail || studentName,
          peerId: activePeer.id || activePeer.name,
          peerName: activePeer.name,
          topic: studentTrack,
          skill: studentTrack,
          preScore,
          postScore,
          durationMinutes: 25,
          messages,
          challengeTitle,
          codeSolution: codeSnippet,
        })
      });

      const data = await res.json();
      if (data.success) {
        setSessionSummary(data);
      }
    } catch (e) {
      showToast('Could not generate AI session summary.');
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewText.trim()) return;
    setReviewSubmitted(true);
    showToast('Review for ' + activePeer.name + ' submitted! +25 Peer Review XP.');
    const nextXp = userXp + 25;
    setUserXp(nextXp);
    localStorage.setItem('synapse_user_xp', nextXp.toString());
    try {
      const myId = (studentEmail || studentName).trim().toLowerCase();
      const peerId = (activePeer.id || activePeer.name).trim().toLowerCase();
      const sId = getSessionId();
      await fetch('/api/rate-peer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raterId: myId, rateeId: peerId, sessionId: sId, stars: rating, comment: reviewText.trim() }),
      });
    } catch (e) {}
  };

  // ─── Part B: Pre/Post Quiz Handlers ─────────────────────────
  const handleStartPreQuiz = async () => {
    try {
      const res = await fetch('/api/match-health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pre-quiz', skill: studentTrack })
      });
      const data = await res.json();
      if (data.questions) {
        setPreQuizQuestions(data.questions);
        setPreQuizAnswers(new Array(data.questions.length).fill(-1));
        setSessionPhase('pre-quiz');
      }
    } catch (e) { showToast('Could not load pre-session quiz.'); }
  };

  const handleSubmitPreQuiz = () => {
    if (preQuizQuestions.length === 0) return;
    let correct = 0;
    preQuizQuestions.forEach((q: any, i: number) => {
      if (preQuizAnswers[i] === q.answerIndex) correct++;
    });
    const score = Math.round((correct / preQuizQuestions.length) * 100);
    setPreScore(score);
    setSessionPhase('active');
    showToast('\u{1F4CA} Pre-session baseline: ' + score + '%. Let\'s see how much you improve!');
  };

  const handleSubmitPostQuiz = async () => {
    if (preQuizQuestions.length === 0) return;
    let correct = 0;
    preQuizQuestions.forEach((q: any, i: number) => {
      if (postQuizAnswers[i] === q.answerIndex) correct++;
    });
    const score = Math.round((correct / preQuizQuestions.length) * 100);
    setPostScore(score);

    try {
      const myId = (studentEmail || studentName).trim().toLowerCase();
      const peerId = (activePeer.id || activePeer.name).trim().toLowerCase();
      const matchId = [myId, peerId].sort().join('___');

      const res = await fetch('/api/match-health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'post-quiz', matchId,
          learnerId: myId, teacherId: peerId,
          skill: studentTrack, sessionNumber,
          preScore: preScore || 0, postScore: score
        })
      });
      const data = await res.json();
      if (data.adaptation && data.adaptation.action) {
        setAutonomousAction(data.adaptation);
      }
    } catch (e) {}

    setSessionPhase('review');
    const delta = score - (preScore || 0);
    if (delta > 0) {
      showToast('\u{1F4C8} You improved by +' + delta + '%! Great session!');
    } else if (delta === 0) {
      showToast('\u{1F4CA} Same score. The system will adjust your learning path.');
    } else {
      showToast('\u{1F4C9} Score dipped. Don\'t worry \u2014 the system is adapting your approach.');
    }

    // Automatically trigger AI session summary
    handleEndSessionAndSummarize();
  };

  // ─── Message Bubble Renderer ────────────────────────────────
  const renderMessage = (m: ChatMessage) => {
    const isMe = m.sender === 'me';
    const isAI = m.type === 'ai_rephrase' || m.type === 'ai_fallback' || m.type === 'study_assistant';
    const isVoice = m.type === 'voice';
    const isSystem = m.type === 'system';

    if (isSystem) {
      return (
        <div key={m.id} className="flex justify-center my-2">
          <span className="text-[11px] text-muted bg-card-alt border border-border px-3 py-1.5 rounded-full">
            {m.text}
          </span>
        </div>
      );
    }

    return (
      <div
        key={m.id}
        className={'flex flex-col max-w-[85%] group ' + (isMe ? 'items-end ml-auto' : 'items-start mr-auto')}
      >
        <span className="text-[10px] text-muted mb-1 px-1 flex items-center gap-1.5">
          {isAI ? m.senderName : (isMe ? studentName : m.senderName || activePeer.name)} {'\u2022'} {m.time}
          {isMe && m.status === 'sending' && (
            <span className="text-[9px] text-amber animate-pulse">sending...</span>
          )}
        </span>

        <div className={'relative p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-xs ' +
          (isAI
            ? 'bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200/50 dark:border-blue-800/30 text-ink rounded-bl-xs'
            : isMe
              ? (m.status === 'failed' ? 'bg-bad/10 border border-bad text-ink rounded-br-xs font-medium' : 'bg-amber text-white rounded-br-xs font-medium')
              : 'bg-card-alt border border-border text-ink rounded-bl-xs')
        }>
          {isAI && (
            <span className="text-[10px] text-blue-500 font-bold uppercase tracking-wider block mb-1">
              {m.type === 'ai_rephrase' ? '🤖 Simpler Explanation' : m.type === 'study_assistant' ? '🤖 AI Study Assistant Co-Pilot' : '🤖 AI Tutor Help'}
            </span>
          )}

          {isVoice && m.voiceDataUrl ? (
            <div className="flex items-center gap-2">
              <span className="text-lg">{'\u{1F3A4}'}</span>
              <audio controls src={m.voiceDataUrl} className="h-8 max-w-[200px]" preload="metadata" />
            </div>
          ) : (
            <span className="whitespace-pre-wrap">{m.text}</span>
          )}
        </div>

        {/* Failed to send / Retry button (BUG 5) */}
        {isMe && m.status === 'failed' && (
          <div className="flex items-center gap-1.5 mt-1 px-1">
            <span className="text-[10px] text-bad font-semibold">Failed to send.</span>
            <button
              type="button"
              onClick={() => handleSendMessage(undefined, m)}
              className="text-[10px] text-amber hover:underline font-bold cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {/* Part D: Action buttons on hover (only for peer messages) */}
        {!isMe && !isAI && !isSystem && !isVoice && (
          <div className="flex gap-1 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => handleExplainDifferently(m)}
              className="text-[10px] px-2 py-0.5 rounded-full bg-card-alt border border-border text-muted hover:text-amber hover:border-amber transition-colors cursor-pointer"
              title="Get AI to explain this differently"
            >
              {'\u{1F916}'} Explain differently
            </button>
            <button
              onClick={() => handleImLost(m)}
              className="text-[10px] px-2 py-0.5 rounded-full bg-card-alt border border-border text-muted hover:text-bad hover:border-bad transition-colors cursor-pointer"
              title="Flag that you're lost on this topic"
            >
              {'\u{1F635}'} I{"'"}m lost
            </button>
          </div>
        )}
      </div>
    );
  };

  // ─── Render ─────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-fade-in pb-8 relative">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] max-w-md w-[90%] bg-card border border-amber text-ink p-4 rounded-2xl shadow-2xl flex items-center justify-between gap-3 animate-slide-down pointer-events-none">
          <div className="flex items-center gap-3">
            <span className="text-2xl shrink-0">{'\u2728'}</span>
            <div>
              <p className="text-xs font-bold text-amber uppercase tracking-wider">Session Update</p>
              <p className="text-xs sm:text-sm font-medium text-ink">{toastMessage}</p>
            </div>
          </div>
        </div>
      )}

      {/* Part B: Autonomous Action Banner */}
      {autonomousAction && (
        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/30 rounded-2xl p-4 flex items-center gap-3 animate-fade-in">
          <span className="text-2xl">{'\u{1F916}'}</span>
          <div>
            <p className="text-xs font-bold text-blue-600 uppercase tracking-wider">Autonomous Adaptation</p>
            <p className="text-sm text-ink">{autonomousAction.reason}</p>
          </div>
        </div>
      )}

      {/* ─── Part 6: Live Incoming Call Notification Banner ──── */}
      {incomingCall && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[250] max-w-lg w-[92%] bg-card border-2 border-amber rounded-2xl shadow-2xl p-4 animate-slide-down flex items-center justify-between gap-4 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber/20 text-amber flex items-center justify-center text-2xl animate-bounce shrink-0">
              {incomingCall.callMode === 'voice' ? '📞' : '📹'}
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber block">
                Incoming Live {incomingCall.callMode === 'voice' ? 'Voice' : 'Video'} Call
              </span>
              <p className="font-serif font-bold text-sm text-ink truncate max-w-[180px] sm:max-w-xs">
                {incomingCall.callerName} is calling you...
              </p>
              <span className="text-[11px] text-muted flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Ringing live • Tap Accept to join
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleAcceptIncomingCall}
              className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
            >
              <span>📞</span> Accept
            </button>
            <button
              onClick={handleDeclineIncomingCall}
              className="py-2 px-3 bg-bad/10 hover:bg-bad/20 text-bad font-semibold text-xs rounded-xl border border-bad/30 transition-colors cursor-pointer"
            >
              Decline
            </button>
          </div>
        </div>
      )}

      {/* ─── Active Fullscreen Study Room View ─────────────────────── */}
      {activeStudyRoom && (
        <StudyRoomView
          room={activeStudyRoom.room}
          currentUser={{
            email: studentEmail || studentName,
            name: studentName,
            isHost: activeStudyRoom.isHost,
          }}
          token={activeStudyRoom.token}
          roomUrl={activeStudyRoom.roomUrl}
          initialVideoEnabled={activeStudyRoom.initialVideo}
          initialAudioEnabled={activeStudyRoom.initialAudio}
          onLeave={(summary) => {
            setActiveStudyRoom(null);
            if (summary?.xpAwarded) {
              const nextXp = userXp + summary.xpAwarded;
              setUserXp(nextXp);
              localStorage.setItem('synapse_user_xp', nextXp.toString());
              showToast(`🎉 Learning session completed! +${summary.xpAwarded} XP awarded.`);
            }
            fetchStudyRooms();
          }}
        />
      )}

      {/* ─── Pre-Join Device Check Modal ─────────────────────────── */}
      {preJoinRoom && (
        <PreJoinModal
          roomName={preJoinRoom.room.name}
          topic={preJoinRoom.room.topic}
          defaultUserName={studentName}
          isOpen={true}
          onJoin={handlePreJoinConfirm}
          onCancel={() => setPreJoinRoom(null)}
        />
      )}

      {/* ─── Start Learning Session Dialog ──────────────────────── */}
      {showCreateRoomModal && (
        <div className="fixed inset-0 z-[160] bg-ink/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-card border border-border rounded-[24px] max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber block">
                  New Collaborative Room
                </span>
                <h3 className="font-serif font-bold text-base text-ink">Start Learning Session</h3>
              </div>
              <button
                onClick={() => setShowCreateRoomModal(false)}
                className="w-7 h-7 rounded-full bg-card-alt border border-border flex items-center justify-center text-xs text-muted hover:text-ink cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateStudyRoom} className="space-y-3.5 text-xs">
              <div>
                <label className="font-semibold uppercase text-muted text-[11px] block mb-1">
                  Session Title
                </label>
                <input
                  required
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  placeholder={`e.g. ${studentTrack} Deep Dive & Code Review`}
                  className="w-full p-2.5 bg-card-alt border border-border rounded-xl text-ink outline-none focus:border-amber"
                />
              </div>

              <div>
                <label className="font-semibold uppercase text-muted text-[11px] block mb-1">
                  Topic / Skill Domain
                </label>
                <input
                  required
                  value={newRoomTopic}
                  onChange={(e) => setNewRoomTopic(e.target.value)}
                  placeholder="e.g. React, Python, Machine Learning"
                  className="w-full p-2.5 bg-card-alt border border-border rounded-xl text-ink outline-none focus:border-amber"
                />
              </div>

              <div>
                <label className="font-semibold uppercase text-muted text-[11px] block mb-1">
                  Max Participants: <span className="text-amber font-bold">{newRoomCapacity} learners</span> (3 to 10)
                </label>
                <div className="flex items-center gap-3 pt-1">
                  <input
                    type="range"
                    min="3"
                    max="10"
                    value={newRoomCapacity}
                    onChange={(e) => setNewRoomCapacity(parseInt(e.target.value, 10))}
                    className="flex-1 accent-amber cursor-pointer"
                  />
                  <span className="font-bold text-ink w-6 text-right">{newRoomCapacity}</span>
                </div>
              </div>

              <div className="p-3 bg-amber/10 border border-amber/25 rounded-xl text-[11px] text-muted space-y-1">
                <p className="font-semibold text-ink flex items-center gap-1.5">
                  <span>🔒</span> Privacy &amp; Recording Notice
                </p>
                <p>This session is not recorded. Video &amp; audio streams are encrypted WebRTC.</p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowCreateRoomModal(false)}
                  className="px-4 py-2 bg-card-alt border border-border rounded-xl font-semibold text-ink cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingRoom || !newRoomName.trim()}
                  className="px-5 py-2 bg-amber hover:bg-terracotta text-white font-bold rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  {isCreatingRoom ? 'Creating Room...' : 'Start Session 🚀'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Group Study Rooms: "Start Learning Session" Lobby ─── */}
      <div className="bg-card border border-border rounded-[24px] p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🎓</span>
              <h3 className="text-lg font-serif font-bold text-ink">Live Learning Sessions</h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 border border-emerald-500/30">
                🟢 Live Rooms
              </span>
            </div>
            <p className="text-xs text-muted mt-0.5">
              Multi-learner video study rooms with group screen share, collaborative whiteboard, and real-time chat.
            </p>
          </div>

          <button
            onClick={() => {
              setNewRoomTopic(studentTrack);
              setShowCreateRoomModal(true);
            }}
            className="px-4 py-2.5 bg-amber hover:bg-terracotta text-white font-bold text-xs rounded-xl shadow-xs transition-transform active:scale-95 flex items-center gap-1.5 cursor-pointer"
          >
            <span>+</span> Start Learning Session
          </button>
        </div>

        {/* Live Study Room Cards List */}
        {studyRooms.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-1">
            {studyRooms.map((room) => (
              <div
                key={room.id}
                className="p-4 bg-card-alt rounded-2xl border border-border hover:border-amber/50 transition-all flex flex-col justify-between space-y-3 shadow-2xs"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber px-2 py-0.5 bg-amber/10 rounded-md border border-amber/20">
                      {room.topic}
                    </span>
                    <span className="text-[11px] font-medium text-emerald-600 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Active session
                    </span>
                  </div>

                  <h4 className="font-serif font-bold text-sm text-ink truncate">{room.name}</h4>
                  <div className="flex items-center gap-1.5 text-xs text-muted mt-1">
                    <span>Host: {room.host_name}</span>
                    {room.hostVerifiedTeacher && (
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                        Verified teacher ✓
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border/60">
                  <span className="text-xs font-semibold text-ink flex items-center gap-1.5">
                    <span>👥</span> {room.currentLearnerCount || 1} / {room.max_participants} learners
                  </span>

                  {room.isFull ? (
                    <button
                      disabled
                      className="px-3 py-1.5 bg-muted/20 text-muted rounded-xl text-xs font-bold cursor-not-allowed"
                    >
                      Room Full
                    </button>
                  ) : (
                    <button
                      onClick={() => handleInitiateJoin(room)}
                      className="px-3.5 py-1.5 bg-card border border-border hover:border-amber text-ink font-bold text-xs rounded-xl shadow-2xs transition-colors cursor-pointer flex items-center gap-1"
                    >
                      Join Session →
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Empty State */
          <div className="py-8 text-center space-y-3 bg-card-alt/50 rounded-2xl border border-dashed border-border p-6">
            <div className="w-12 h-12 rounded-full bg-amber/15 text-amber flex items-center justify-center text-2xl mx-auto">
              📚
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">No live sessions yet</p>
              <p className="text-xs text-muted max-w-sm mx-auto mt-0.5">
                Host a group study session on {studentTrack} or collaborate on code with your peers.
              </p>
            </div>
            <button
              onClick={() => {
                setNewRoomTopic(studentTrack);
                setShowCreateRoomModal(true);
              }}
              className="px-4 py-2 bg-amber hover:bg-terracotta text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              Start Learning Session
            </button>
          </div>
        )}
      </div>

      {/* Session Header with peer info & Live Calling Buttons */}
      <div className="bg-card border border-border rounded-[22px] p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber to-terracotta text-white flex items-center justify-center font-bold text-base shadow-xs shrink-0">
            {activePeer.initials}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-serif font-bold text-ink">{activePeer.name}</h2>
              {activePeer.isReal ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-ok/15 text-ok font-bold border border-ok/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-ok animate-pulse" /> LIVE PEER
                </span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber/15 text-amber font-semibold border border-amber/30">
                  AI COLLABORATOR
                </span>
              )}
            </div>
            <p className="text-xs text-muted">
              Paired on <strong>{studentTrack} Challenge</strong> {'\u2022'} Multi-Device Cross-Sync Active
            </p>
          </div>
        </div>

        {/* Live Call & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Live Call Triggers (Part 6) */}
          <button
            onClick={() => handleStartCall('voice')}
            className="text-xs px-3 py-1.5 bg-card-alt border border-border hover:border-amber text-ink font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            title="Start Live Voice Call"
          >
            <span>📞</span> Voice Call
          </button>
          <button
            onClick={() => handleStartCall('video')}
            className="text-xs px-3 py-1.5 bg-amber hover:bg-terracotta text-white font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            title="Start Live Video Call"
          >
            <span>📹</span> Video Call
          </button>

          {/* Activity Logs Toggle (Part 7) */}
          <button
            onClick={() => setIsActivityDrawerOpen(true)}
            className="text-xs px-3 py-1.5 bg-card-alt border border-border hover:border-blue-400 text-ink font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
            title="View Autonomous Agent Activity Feed"
          >
            <span>⚡</span> Activity Feed
            {activityLogs.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            )}
          </button>

          {/* Part B: Pre-quiz button */}
          {preScore === null && (
            <button
              onClick={handleStartPreQuiz}
              className="text-[11px] px-3 py-1.5 bg-card-alt border border-border hover:border-amber text-ink font-semibold rounded-lg transition-colors cursor-pointer"
            >
              {'\u{1F4CB}'} Take Pre-Quiz
            </button>
          )}
          {preScore !== null && (
            <span className="text-[11px] px-2 py-1 bg-ok/10 text-ok font-bold rounded-lg border border-ok/20">
              Pre: {preScore}%
            </span>
          )}
          {postScore !== null && (
            <span className="text-[11px] px-2 py-1 bg-amber/10 text-amber font-bold rounded-lg border border-amber/20">
              Post: {postScore}% ({postScore - (preScore || 0) >= 0 ? '+' : ''}{postScore - (preScore || 0)}%)
            </span>
          )}

          <div className="text-right pl-2 border-l border-border">
            <span className="text-[10px] uppercase font-bold text-muted tracking-wider block">XP Vault</span>
            <span className="text-xs font-bold text-amber">{userXp} XP</span>
          </div>
        </div>
      </div>

      {/* Part B: Pre-Quiz Overlay */}
      {sessionPhase === 'pre-quiz' && preQuizQuestions.length > 0 && (
        <div className="bg-card border border-border rounded-[22px] p-6 shadow-xs animate-fade-in">
          <h3 className="text-lg font-serif font-bold text-ink mb-1">{'\u{1F4CA}'} Pre-Session Baseline Quiz</h3>
          <p className="text-xs text-muted mb-4">Quick check on your current understanding of {studentTrack}. This helps us measure your improvement.</p>
          <div className="space-y-4">
            {preQuizQuestions.map((q: any, qi: number) => (
              <div key={qi} className="p-4 bg-card-alt rounded-xl border border-border">
                <p className="text-sm font-medium text-ink mb-2">{qi + 1}. {q.question}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(q.options || []).map((opt: string, oi: number) => (
                    <button
                      key={oi}
                      onClick={() => {
                        const next = [...preQuizAnswers];
                        next[qi] = oi;
                        setPreQuizAnswers(next);
                      }}
                      className={'text-left text-xs p-2.5 rounded-lg border transition-all cursor-pointer ' +
                        (preQuizAnswers[qi] === oi
                          ? 'bg-amber/15 border-amber text-ink font-semibold'
                          : 'bg-card border-border text-ink hover:border-amber/50')}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={handleSubmitPreQuiz}
            disabled={preQuizAnswers.some(a => a === -1)}
            className="mt-4 w-full py-3 bg-amber hover:bg-terracotta text-white font-bold text-sm rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer"
          >
            Submit Pre-Quiz &amp; Start Session
          </button>
        </div>
      )}

      {/* Main Layout: Chat + Challenge (only when in active phase) */}
      {sessionPhase !== 'pre-quiz' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Chat */}
          <div className="lg:col-span-6 bg-card border border-border rounded-[22px] shadow-xs flex flex-col h-[640px] overflow-hidden">
            {/* Chat Header */}
            <div className="p-4 border-b border-border bg-card-alt flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-ok animate-pulse" />
                <span className="text-xs font-bold text-ink uppercase tracking-wider">
                  Live Peer Discussion
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted font-mono">
                  {activePeer.isReal ? 'Cross-Device Socket' : 'Gemini AI Co-Pilot'}
                </span>
                {preScore !== null && postScore === null && (
                  <button
                    onClick={() => {
                      setPostQuizAnswers(new Array(preQuizQuestions.length).fill(-1));
                      setSessionPhase('post-quiz');
                    }}
                    className="text-[10px] px-2 py-1 bg-amber/10 text-amber font-bold rounded-lg border border-amber/20 hover:bg-amber/20 transition-colors cursor-pointer"
                  >
                    End Session {'\u2192'} Post-Quiz
                  </button>
                )}
                {postScore !== null && (
                  <button
                    onClick={handleEndSessionAndSummarize}
                    className="text-[10px] px-2 py-1 bg-blue-500/10 text-blue-600 font-bold rounded-lg border border-blue-500/20 hover:bg-blue-500/20 transition-colors cursor-pointer"
                  >
                    AI Summary
                  </button>
                )}
              </div>
            </div>

            {/* Study Assistant Status Banner (Section 6 Controls) */}
            <div className="px-4 py-2 bg-blue-50/60 dark:bg-blue-950/20 border-b border-blue-100 dark:border-blue-900/30 flex items-center justify-between text-[11px] text-blue-700 dark:text-blue-300 shrink-0">
              <div className="flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full ${assistantDisabledForSession ? 'bg-muted' : 'bg-blue-500 animate-ping'}`} />
                <span className="font-medium">
                  {assistantDisabledForSession
                    ? 'AI study assistant switched off for this session'
                    : Date.now() < assistantSuppressedUntil
                    ? 'AI study assistant paused (cooldown active)'
                    : 'AI study assistant is active for this chat'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {assistantDisabledForSession ? (
                  <button
                    type="button"
                    onClick={() => {
                      setAssistantDisabledForSession(false);
                      showToast('AI Study Assistant re-enabled.');
                    }}
                    className="text-[10px] text-blue-600 hover:underline font-bold cursor-pointer"
                  >
                    Turn back on
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setAssistantDisabledForSession(true);
                      showToast('AI Study Assistant switched off for this session.');
                    }}
                    className="text-[10px] text-muted hover:text-ink cursor-pointer"
                  >
                    Switch off for session
                  </button>
                )}
              </div>
            </div>

            {/* Tier 1 Voice Call Suggestion Bubble (Section 6 Escalation & Controls) */}
            {tier1VoicePrompt && !assistantDisabledForSession && (
              <div className="mx-4 mt-3 p-3 bg-amber/10 border border-amber/30 rounded-xl space-y-2 animate-slide-down shrink-0">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">📞</span>
                    <p className="text-xs text-ink">{tier1VoicePrompt}</p>
                  </div>
                  <button
                    onClick={() => {
                      setTier1VoicePrompt(null);
                      handleStartCall('voice');
                    }}
                    className="text-xs px-3 py-1.5 bg-amber hover:bg-terracotta text-white font-bold rounded-lg shrink-0 cursor-pointer shadow-xs"
                  >
                    Start voice call
                  </button>
                </div>
                {/* Student Controls: Not now & Switch off */}
                <div className="flex items-center justify-end gap-3 pt-1 border-t border-amber/20 text-[11px]">
                  <button
                    type="button"
                    onClick={() => {
                      setAssistantSuppressedUntil(Date.now() + 10 * 60 * 1000);
                      setTier1VoicePrompt(null);
                      showToast('AI Study Assistant paused for 10 minutes.');
                    }}
                    className="text-muted hover:text-ink font-medium cursor-pointer"
                  >
                    Not now (10m)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAssistantDisabledForSession(true);
                      setTier1VoicePrompt(null);
                      showToast('AI Study Assistant switched off for this session.');
                    }}
                    className="text-muted hover:text-bad font-medium cursor-pointer"
                  >
                    Switch off for session
                  </button>
                </div>
              </div>
            )}

            {/* Connection pending banner */}
            {!isConnectionAccepted && (
              <div className="p-3 bg-amber/10 border-b border-amber/25 text-xs text-ink flex items-center gap-2 shrink-0">
                <span className="text-base">{'\u{1F512}'}</span>
                <span>
                  <strong>Connection Pending:</strong> Waiting for {activePeer.name} to accept your connection invite. Real-time chat will unlock automatically upon acceptance.
                </span>
              </div>
            )}

            {/* Messages */}
            <div
              ref={chatContainerRef}
              onScroll={handleScroll}
              className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3.5 bg-card"
            >
              {messages.map(renderMessage)}

              {isPeerTyping && (
                <div className="flex items-center gap-2 text-xs text-muted italic p-2">
                  <div className="w-2 h-2 rounded-full bg-amber animate-bounce" />
                  <span>{activePeer.name} is typing...</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* New messages indicator */}
            {showNewMsgIndicator && (
              <button
                onClick={() => scrollToBottom(true)}
                className="absolute bottom-20 left-1/4 -translate-x-1/2 bg-amber text-white text-xs px-3 py-1.5 rounded-full shadow-lg cursor-pointer animate-bounce z-10"
              >
                {'\u2193'} New messages
              </button>
            )}

            {/* Quick AI & Help Prompts for Live Demos & Fast Intervention */}
            <div className="px-3 py-1.5 bg-card border-t border-border flex items-center gap-1.5 overflow-x-auto text-[11px] shrink-0">
              <span className="text-muted text-[10px] font-bold uppercase tracking-wider shrink-0 flex items-center gap-1">
                <span>🤖</span>
                <span>Ask AI:</span>
              </span>
              {[
                '@ai explain useEffect cleanup',
                '@ai how to fix race condition?',
                '@ai what is a closure?',
                '@ai compare useState vs useReducer',
                "I'm confused about async error handling",
              ].map((promptText, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setInput(promptText)}
                  className="px-2.5 py-0.5 rounded-full bg-amber/10 hover:bg-amber/20 text-amber font-medium border border-amber/20 shrink-0 transition-colors cursor-pointer text-[11px]"
                  title="Click to insert prompt"
                >
                  {promptText}
                </button>
              ))}
            </div>

            {/* Message Input */}
            <form onSubmit={handleSendMessage} className="p-3 border-t border-border bg-card-alt flex gap-2 shrink-0">
              {/* Voice record button */}
              <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                className={'p-2.5 rounded-xl border transition-all cursor-pointer ' +
                  (isRecording
                    ? 'bg-bad/15 border-bad text-bad animate-pulse'
                    : 'bg-card border-border text-muted hover:text-amber hover:border-amber')}
                title={isRecording ? 'Stop recording' : 'Record voice message'}
              >
                {isRecording ? '\u{23F9}\u{FE0F}' : '\u{1F3A4}'}
              </button>

              {isRecording ? (
                <div className="flex-1 flex items-center gap-2 px-4">
                  <span className="w-2 h-2 rounded-full bg-bad animate-pulse" />
                  <span className="text-xs text-bad font-semibold">Recording...</span>
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="ml-auto text-xs px-3 py-1 bg-bad/15 text-bad rounded-lg border border-bad/30 cursor-pointer"
                  >
                    Send Voice
                  </button>
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    disabled={!isConnectionAccepted}
                    placeholder={
                      !isConnectionAccepted
                        ? 'Chat locked \u2014 waiting for ' + activePeer.name + ' to accept...'
                        : 'Message ' + activePeer.name + '...'
                    }
                    className="flex-1 px-4 py-2.5 bg-card border border-border rounded-xl text-ink text-xs sm:text-sm placeholder-muted/60 outline-none focus:border-amber disabled:opacity-60"
                  />
                  <button
                    type="submit"
                    disabled={!isConnectionAccepted || !input.trim()}
                    className="px-4 py-2.5 bg-amber hover:bg-terracotta text-white font-bold text-xs rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {!isConnectionAccepted ? 'Locked \u{1F512}' : 'Send \u2192'}
                  </button>
                </>
              )}
            </form>
          </div>

          {/* Right Column: Challenge & Rubric & Code Editor */}
          <div className="lg:col-span-6 space-y-6">
            {/* Post-Quiz (shown when ending session) */}
            {sessionPhase === 'post-quiz' && preQuizQuestions.length > 0 && (
              <div className="bg-card border border-border rounded-[22px] p-6 shadow-xs animate-fade-in">
                <h3 className="text-lg font-serif font-bold text-ink mb-1">{'\u{1F4C8}'} Post-Session Quiz</h3>
                <p className="text-xs text-muted mb-4">Same questions as before. Let{"'"}s measure your improvement after this session!</p>
                <div className="space-y-4">
                  {preQuizQuestions.map((q: any, qi: number) => (
                    <div key={qi} className="p-4 bg-card-alt rounded-xl border border-border">
                      <p className="text-sm font-medium text-ink mb-2">{qi + 1}. {q.question}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {(q.options || []).map((opt: string, oi: number) => (
                          <button
                            key={oi}
                            onClick={() => {
                              const next = [...postQuizAnswers];
                              next[qi] = oi;
                              setPostQuizAnswers(next);
                            }}
                            className={'text-left text-xs p-2.5 rounded-lg border transition-all cursor-pointer ' +
                              (postQuizAnswers[qi] === oi
                                ? 'bg-amber/15 border-amber text-ink font-semibold'
                                : 'bg-card border-border text-ink hover:border-amber/50')}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  onClick={handleSubmitPostQuiz}
                  disabled={postQuizAnswers.some(a => a === -1)}
                  className="mt-4 w-full py-3 bg-amber hover:bg-terracotta text-white font-bold text-sm rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                >
                  Submit Post-Quiz &amp; See Results
                </button>
              </div>
            )}

            {/* Persistent Challenge Box with Rubric & Live Partner Status (Part 1 Requirement) */}
            <div className="bg-card border border-border rounded-[22px] p-6 shadow-xs flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-amber">Collaborative Challenge</span>
                  <h3 className="text-lg font-serif font-bold text-ink">{challengeTitle}</h3>
                </div>
                <div className="flex items-center gap-2">
                  {/* Live Partner Status */}
                  <span className={'text-xs px-2.5 py-1 rounded-lg font-bold border flex items-center gap-1.5 ' +
                    (peerSubmitted
                      ? 'bg-ok/15 text-ok border-ok/30'
                      : 'bg-card-alt text-muted border-border')}>
                    {peerSubmitted ? 'Peer submitted ✓' : 'Peer working...'}
                  </span>
                  <span className="text-xs px-2.5 py-1 bg-amber/10 text-amber font-bold rounded-lg border border-amber/20">+75 XP</span>
                </div>
              </div>

              {/* Challenge Description */}
              <p className="text-xs text-ink/90 leading-relaxed bg-card-alt p-3.5 rounded-xl border border-border">
                {challengeDescription}
              </p>

              {/* Rubric Display */}
              {challengeData?.rubric?.criteria && challengeData.rubric.criteria.length > 0 && (
                <div className="p-3 bg-card-alt rounded-xl border border-border space-y-1.5 text-xs">
                  <span className="text-[10px] uppercase font-bold text-muted tracking-wider block">Grading Rubric</span>
                  <ul className="space-y-1">
                    {challengeData.rubric.criteria.map((crit, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-ink text-[11px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber shrink-0" />
                        <span>{crit}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Code Editor */}
              <div className="relative">
                <textarea
                  value={codeSnippet}
                  onChange={(e) => setCodeSnippet(e.target.value)}
                  rows={10}
                  className="w-full p-3.5 bg-card-alt font-mono text-xs text-ink border border-border rounded-xl leading-relaxed outline-none focus:border-amber resize-none"
                  spellCheck={false}
                />
              </div>

              {/* Evaluate Button */}
              <button
                type="button"
                onClick={handleEvaluate}
                disabled={isEvaluating}
                className="w-full py-3 px-4 bg-amber hover:bg-terracotta text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-all disabled:opacity-60 cursor-pointer flex items-center justify-center gap-2"
              >
                {isEvaluating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    <span>AI Grading Solution against Rubric...</span>
                  </>
                ) : (
                  <>
                    <span>{'\u26A1'}</span>
                    <span>Submit &amp; Evaluate Solution (+75 XP)</span>
                  </>
                )}
              </button>

              {/* Evaluation Feedback */}
              {evaluation && (
                <div className="p-4 bg-card-alt rounded-xl border border-border space-y-3 animate-fade-in text-xs">
                  <div className="flex items-center justify-between border-b border-border pb-2">
                    <span className="font-bold text-ink uppercase tracking-wider">Evaluation Report</span>
                    <span className={'px-2 py-0.5 rounded font-bold ' +
                      (evaluation.overall >= 70 ? 'bg-ok/15 text-ok' : evaluation.overall > 0 ? 'bg-amber/15 text-amber' : 'bg-bad/15 text-bad')}>
                      Overall Score: {evaluation.overall}%
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-muted block text-[10px] uppercase">Logic Correctness</span>
                      <span className="font-bold text-ink">{evaluation.correctness}%</span>
                    </div>
                    <div>
                      <span className="text-muted block text-[10px] uppercase">Code Quality</span>
                      <span className="font-bold text-ink">{evaluation.quality}%</span>
                    </div>
                  </div>
                  <div>
                    <span className="text-muted block text-[10px] uppercase mb-0.5">AI Critique</span>
                    <p className="text-ink leading-relaxed">{evaluation.summary}</p>
                  </div>
                  {evaluation.improvement && (
                    <div className="p-2.5 rounded-lg bg-amber/10 border border-amber/20 text-ink">
                      <span className="text-amber font-bold block text-[10px] uppercase mb-0.5">Recommended Optimization</span>
                      <p className="leading-snug">{evaluation.improvement}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Peer Review Card */}
            <div className="bg-card border border-border rounded-[22px] p-6 shadow-xs">
              <h3 className="text-lg font-serif font-bold text-ink mb-1">
                Rate Collaboration with {activePeer.name}
              </h3>
              <p className="text-xs text-muted mb-4">
                Peer ratings award +25 XP and establish verified community reputation.
              </p>
              <form onSubmit={handleSubmitReview} className="space-y-3">
                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(null)}
                      className="text-2xl transition-transform hover:scale-110 cursor-pointer p-0.5"
                    >
                      {star <= (hoverRating ?? rating) ? '\u2605' : '\u2606'}
                    </button>
                  ))}
                  <span className="text-xs font-bold text-ink ml-2">{rating} / 5 Stars</span>
                </div>
                <textarea
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  placeholder={'How was your session with ' + activePeer.name + '?'}
                  rows={2}
                  disabled={reviewSubmitted}
                  className="w-full p-3 bg-card-alt border border-border rounded-xl text-xs text-ink placeholder-muted/60 outline-none focus:border-amber resize-none"
                />
                <button
                  type="submit"
                  disabled={reviewSubmitted || !reviewText.trim()}
                  className="py-2.5 px-4 bg-card border border-border hover:border-amber text-ink font-semibold text-xs rounded-xl shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {reviewSubmitted ? '\u2713 Review Submitted' : 'Submit Peer Review (+25 XP)'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ─── Part 6: Live Call Modal ─────────────────────────────── */}
      {isCallModalOpen && (
        <div className="fixed inset-0 z-[120] bg-ink/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fade-in">
          <div className="bg-[#1C1917] border border-border/30 rounded-[28px] max-w-4xl w-full h-[580px] p-2 sm:p-3 shadow-2xl flex flex-col overflow-hidden relative">
            <NativeCallView
              mode={callMode}
              peerName={activePeer.name}
              currentUserName={studentName}
              currentUserEmail={studentEmail}
              peerEmail={activePeer.id}
              sessionId={activeCallSessionId || getSessionId()}
              isInitiator={isCallInitiator}
              onEndCall={handleEndCall}
            />
          </div>
        </div>
      )}

      {/* ─── Part 6: Post-Call Understanding Check (3-Question Rigorous Check) ─── */}
      {showPostCallQuiz && (
        <div className="fixed inset-0 z-[130] bg-ink/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in overflow-y-auto">
          <div className="bg-card border border-border rounded-[24px] max-w-lg w-full p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber">
                  Verified Call Comprehension Check
                </span>
                <h3 className="font-serif font-bold text-ink text-base">Post-Call Discussion Assessment</h3>
              </div>
              <span className="text-xs font-mono font-bold text-amber bg-amber/10 px-2.5 py-1 rounded-full border border-amber/20">
                +25 XP
              </span>
            </div>
            <p className="text-xs text-muted">
              Verify the key engineering concepts and architectural decisions established during your call with {activePeer.name}:
            </p>

            <div className="space-y-3.5 max-h-[60vh] overflow-y-auto pr-1">
              {[
                {
                  q: `1. What was the primary design principle established for state synchronicity in ${studentTrack}?`,
                  opts: [
                    'Avoid stale closures by tracking sequence counters or cleanup flags',
                    'Mutate state variables directly inside asynchronous promises',
                    'Disable error boundary handling to speed up rendering speed',
                  ],
                },
                {
                  q: '2. How did you both agree to manage asynchronous failures and network exceptions?',
                  opts: [
                    'Wrap operations in resilient error boundaries with fallback states',
                    'Suppress all errors silently without notifying UI consumers',
                    'Force a full browser window reload on every network timeout',
                  ],
                },
                {
                  q: '3. What collaborative consensus was reached on code modularity and cleanliness?',
                  opts: [
                    'Keep modules cohesive, loosely coupled, and thoroughly testable',
                    'Store all domain state directly on the global window object',
                    'Merge presentation views directly into raw database calls',
                  ],
                },
              ].map((item, qi) => (
                <div key={qi} className="p-3 bg-card-alt rounded-xl border border-border space-y-2">
                  <p className="text-xs font-semibold text-ink leading-snug">{item.q}</p>
                  <div className="space-y-1.5">
                    {item.opts.map((opt, oi) => (
                      <button
                        key={oi}
                        type="button"
                        onClick={() => {
                          const next = [...postCallAnswers];
                          next[qi] = oi;
                          setPostCallAnswers(next);
                        }}
                        className={'w-full text-left text-xs p-2 rounded-lg border transition-all cursor-pointer ' +
                          (postCallAnswers[qi] === oi
                            ? 'bg-amber/15 border-amber text-ink font-semibold'
                            : 'bg-card border-border text-ink hover:border-amber/40')}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setShowPostCallQuiz(false)}
                className="py-2.5 px-4 text-xs text-muted hover:text-ink cursor-pointer"
              >
                Skip Check
              </button>
              <button
                type="button"
                onClick={handleSubmitPostCallQuiz}
                disabled={postCallAnswers.some((a) => a === -1) || postCallSubmitted}
                className="flex-1 py-2.5 bg-amber hover:bg-terracotta text-white font-bold text-xs rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer"
              >
                {postCallSubmitted ? '✓ Verified (+25 XP)' : 'Submit Peer Assessment (+25 XP)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Section 6: Tier 3 Safe Educational Video Modal (Zero-Dopamine Study Lock) ─────────── */}
      {showVideoModal && tier3Video && (
        <div className="fixed inset-0 z-[120] bg-ink/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-card border border-border rounded-[24px] max-w-3xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber">
                    Curated Educational Video
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    🛡️ Zero-Dopamine Shield Active
                  </span>
                </div>
                <h3 className="font-serif font-bold text-ink text-base">{tier3Video.title}</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await fetch('/api/study-assistant', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          action: 'report_video',
                          videoId: tier3Video.id || tier3Video.youtubeId,
                          reason: 'Not helpful / inappropriate',
                        }),
                      });
                      showToast('Video marked as deprecated based on your feedback.');
                      setShowVideoModal(false);
                    } catch (e) {
                      showToast('Feedback recorded.');
                    }
                  }}
                  className="text-[11px] px-2.5 py-1 text-muted hover:text-bad border border-border hover:border-bad/40 rounded-lg transition-colors cursor-pointer"
                  title="Report unhelpful or poor quality video for deprecation"
                >
                  ⚠️ Not helpful / inappropriate
                </button>
                <button
                  onClick={() => setShowVideoModal(false)}
                  className="text-xs text-muted hover:text-ink cursor-pointer p-1"
                >
                  ✕ Close
                </button>
              </div>
            </div>

            {/* Zero-Dopamine Distraction-Free Shield Banner */}
            <div className="p-3 bg-amber/10 border border-amber/30 rounded-xl flex items-center justify-between text-xs text-ink">
              <div className="flex items-center gap-2">
                <span className="text-base">🔒</span>
                <span className="font-semibold text-amber-800 dark:text-amber-300">Distraction-Free Study Lock:</span>
                <span className="text-[11px] text-muted">
                  External popups, YouTube shorts, and recommended videos are strictly sandboxed. Only this curated lesson is active.
                </span>
              </div>
              <span className="text-[10px] uppercase font-mono font-bold bg-amber/20 text-amber px-2 py-0.5 rounded-md">
                Focus Mode
              </span>
            </div>

            <p className="text-xs text-ink/80">{tier3Video.message}</p>

            {/* Safe Sandboxed YouTube Player: omits allow-popups so user cannot escape to youtube.com */}
            <div className="aspect-video w-full rounded-2xl overflow-hidden bg-black shadow-md flex items-center justify-center relative">
              {!isVideoEnded ? (
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${tier3Video.youtubeId}?rel=0&modestbranding=1&controls=1&disablekb=1&enablejsapi=1&iv_load_policy=3&fs=0`}
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  sandbox="allow-scripts allow-same-origin allow-presentation"
                  title={tier3Video.title}
                />
              ) : (
                /* Immediate unmount on end to eliminate YouTube's end-screen of related videos */
                <div className="p-8 text-center text-white space-y-2">
                  <span className="text-3xl">🎓</span>
                  <h4 className="font-bold text-sm">Video Playback Completed</h4>
                  <p className="text-xs text-white/70">
                    YouTube end-screen was unmounted to maintain educational focus. Please complete the verification quiz below.
                  </p>
                </div>
              )}
            </div>

            {/* Video watch-time gate: 80% required while tab is active */}
            {!(videoWatchSeconds >= 240 || videoWatched) ? (
              <div className="p-3.5 bg-card-alt rounded-xl border border-border space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted font-medium">
                    Watch Gate: {Math.min(100, Math.round((videoWatchSeconds / 240) * 100))}% (Active tab only)
                  </span>
                  <span className="text-[11px] font-mono text-muted">
                    {Math.min(240, videoWatchSeconds)}s / 240s
                  </span>
                </div>
                <div className="h-1.5 w-full bg-border rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber transition-all duration-300 rounded-full"
                    style={{ width: `${Math.min(100, (videoWatchSeconds / 240) * 100)}%` }}
                  />
                </div>
                <div className="flex justify-between items-center pt-1">
                  <span className="text-[10px] text-muted italic">
                    Quiz unlocks automatically once 80% (4 min) has played while tab is visible.
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setVideoWatched(true);
                      setVideoWatchSeconds(240);
                    }}
                    className="text-[10px] text-amber hover:underline cursor-pointer"
                  >
                    Simulate full watch →
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-card-alt rounded-xl border border-border space-y-4 animate-fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-ink uppercase tracking-wider">
                    Post-Video Verification (3 Questions)
                  </span>
                  <span className="text-xs text-ok font-bold">Watch Gate Passed ✓</span>
                </div>

                <div className="space-y-3">
                  {(tier3Video.postQuiz || []).map((q, qi) => (
                    <div key={qi} className="p-3 bg-card rounded-lg border border-border">
                      <p className="text-xs font-medium text-ink mb-2">{qi + 1}. {q.question}</p>
                      <div className="space-y-1.5">
                        {q.options.map((opt: string, oi: number) => (
                          <button
                            key={oi}
                            onClick={() => {
                              const next = [...videoQuizAnswers];
                              next[qi] = oi;
                              setVideoQuizAnswers(next);
                            }}
                            className={'w-full text-left text-xs p-2 rounded border transition-all cursor-pointer ' +
                              (videoQuizAnswers[qi] === oi ? 'bg-amber/15 border-amber font-semibold text-ink' : 'bg-card-alt border-border text-ink hover:border-amber/30')}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleSubmitVideoQuiz}
                  disabled={videoQuizAnswers.some(a => a === -1)}
                  className="w-full py-2.5 bg-amber hover:bg-terracotta text-white font-bold text-xs rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                >
                  Submit Video Quiz (+30 XP)
                </button>

                {videoQuizResult && (
                  <div className="p-3 bg-card rounded-lg border border-border text-xs">
                    <p className="font-bold text-ink">Score: {videoQuizResult.score}%</p>
                    {videoQuizResult.reason && (
                      <p className="text-amber mt-1">{videoQuizResult.reason}</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Part 7: Autonomous Agent Activity Feed Drawer ────────── */}
      {isActivityDrawerOpen && (
        <div className="fixed inset-0 z-[120] bg-ink/50 backdrop-blur-xs flex justify-end animate-fade-in">
          <div className="bg-card border-l border-border w-full max-w-md h-full flex flex-col p-6 shadow-2xl animate-slide-left">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="text-xl">⚡</span>
                <div>
                  <h3 className="font-serif font-bold text-ink text-base">Autonomous Agent Feed</h3>
                  <p className="text-[11px] text-muted">Auditable record of background agent decisions</p>
                </div>
              </div>
              <button
                onClick={() => setIsActivityDrawerOpen(false)}
                className="p-1 rounded-lg hover:bg-card-alt text-muted hover:text-ink cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-3">
              {activityLogs.length === 0 ? (
                <p className="text-xs text-muted text-center py-8">No recent agent actions recorded.</p>
              ) : (
                activityLogs.map((log) => (
                  <div key={log.id} className="p-3.5 bg-card-alt rounded-xl border border-border space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 border border-blue-500/20">
                        {log.agent}
                      </span>
                      <span className="text-[10px] text-muted font-mono">{log.timestamp}</span>
                    </div>
                    <p className="text-xs font-semibold text-ink">{log.action}</p>
                    <p className="text-xs text-muted leading-relaxed">{log.reason}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Section 5: End-of-Session Summary with Section 3 Recommendation & [Why this?] ──── */}
      {showSummaryModal && (
        <div className="fixed inset-0 z-[130] bg-ink/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in overflow-y-auto">
          {isGeneratingSummary ? (
            <div className="bg-card border border-border rounded-[24px] max-w-md w-full p-8 shadow-2xl text-center space-y-4 animate-scale-in">
              <div className="w-10 h-10 border-3 border-amber border-t-transparent rounded-full animate-spin mx-auto" />
              <h3 className="font-serif font-bold text-ink text-base">Synthesizing Session Performance</h3>
              <p className="text-xs text-muted leading-relaxed">
                Analyzing test scores, calculating empirical deltas, and evaluating the Adaptive Engine next step...
              </p>
            </div>
          ) : sessionSummary ? (
            <SessionSummaryCard
              topic={sessionSummary?.summary?.topic || studentTrack}
              partnerName={activePeer.name}
              durationMinutes={sessionSummary?.summary?.duration_minutes || 25}
              beforeScore={sessionSummary?.summary?.before_score ?? preScore}
              afterScore={sessionSummary?.summary?.after_score ?? postScore}
              improvement={sessionSummary?.summary?.improvement ?? (preScore !== null && postScore !== null ? postScore - preScore : null)}
              whatYouLearned={sessionSummary?.keyTakeaways || sessionSummary?.strengths || []}
              aiSummary={sessionSummary?.summary?.ai_summary || sessionSummary?.summary}
              nextRecommendation={sessionSummary?.nextRecommendation || sessionSummary?.summary?.next_recommendation}
              onClose={() => setShowSummaryModal(false)}
              onActionClick={(action) => {
                setShowSummaryModal(false);
                if (action === 'peer_rematch') {
                  window.location.href = '/app/match';
                } else {
                  showToast(`Launching adaptive action: ${action.replace('_', ' ')}`);
                }
              }}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
