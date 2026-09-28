'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

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
  const [studentTrack, setStudentTrack] = useState('React');
  const [studentName, setStudentName] = useState('Learner');
  const [studentEmail, setStudentEmail] = useState('');
  const [userXp, setUserXp] = useState(350);

  // Active peer
  const [activePeer, setActivePeer] = useState({
    id: 'peer-default',
    name: 'Peer Partner',
    initials: 'PP',
    skill: 'React Track',
    isReal: false
  });

  const [isConnectionAccepted, setIsConnectionAccepted] = useState(true);

  // ─── Part 1: Collaborative Challenge & Rubric ─────────────────
  const [challengeData, setChallengeData] = useState<ChallengeData | null>(null);
  const [challengeTitle, setChallengeTitle] = useState('Collaborative Hook Implementation');
  const [challengeDescription, setChallengeDescription] = useState('Build a resilient custom async hook with loading, data, and error state handling.');
  const [starterCode, setStarterCode] = useState('');
  const [peerSubmitted, setPeerSubmitted] = useState(false);

  // ─── Part H: Persistent Chat Messages ─────────────────────────
  const [messages, setMessages] = useState<ChatMessage[]>([]);
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
  const [postCallAnswer, setPostCallAnswer] = useState<number | null>(null);
  const [postCallSubmitted, setPostCallSubmitted] = useState(false);

  // Live Call Signaling & Incoming Ringing
  const [incomingCall, setIncomingCall] = useState<{
    callerId: string;
    callerName: string;
    callUrl: string;
    callMode: 'voice' | 'video';
    messageId: string;
  } | null>(null);
  const dismissedCallIdsRef = useRef<Set<string>>(new Set());

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

  // ─── Part 7: Autonomous Agent Activity Feed ───────────────────
  const [isActivityDrawerOpen, setIsActivityDrawerOpen] = useState(false);
  const [activityLogs, setActivityLogs] = useState<AgentActivityLog[]>([]);

  // ─── Part 7: End-of-Session AI Summary ────────────────────────
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [sessionSummary, setSessionSummary] = useState<{
    summary: string;
    strengths: string[];
    weakTopics: string[];
    roadmapUpdated: boolean;
  } | null>(null);
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

    // Part H: Load persisted messages on mount
    fetch('/api/peer-network?sessionId=global_collab')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.messages) && data.messages.length > 0) {
          const loaded: ChatMessage[] = data.messages.map((m: any) => ({
            id: m.id,
            text: m.text,
            sender: (m.senderId || '').trim().toLowerCase() === currentEmail.trim().toLowerCase() ? 'me' as const : 'peer' as const,
            time: m.timestamp || 'Now',
            senderName: m.senderName,
            type: m.type || 'text',
            voiceDataUrl: m.voiceDataUrl,
            reactions: m.reactions || [],
            flagged: m.flagged || false,
          }));
          setMessages(loaded);
          setTimeout(() => scrollToBottom(true), 100);
        }
      })
      .catch(() => {});
  }, [scrollToBottom]);

  // ─── Real-time Message Polling & Study Assistant ───────────
  useEffect(() => {
    let isSubscribed = true;

    const pollMessages = async () => {
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
                messageId: latestInvite.id,
              });
            } else if (!latestInvite && incomingCall) {
              setIncomingCall(null);
            }

            setMessages(prev => {
              const existingIds = new Set(prev.map(m => m.id));

              const newIncoming = data.messages
                .filter((m: any) => {
                  if (existingIds.has(m.id)) return false;
                  const senderLower = (m.senderId || '').trim().toLowerCase();
                  if (myEmailLower && senderLower === myEmailLower) return false;
                  return true;
                })
                .map((m: any) => ({
                  id: m.id,
                  text: m.text,
                  sender: 'peer' as const,
                  time: m.timestamp || 'Now',
                  senderName: m.senderName,
                  type: m.type || 'text',
                  voiceDataUrl: m.voiceDataUrl,
                  reactions: m.reactions || [],
                  flagged: m.flagged || false,
                }));

              if (newIncoming.length > 0) {
                const latest = newIncoming[newIncoming.length - 1];
                if (latest.senderName && latest.senderName !== activePeer.name) {
                  setActivePeer(p => ({
                    ...p,
                    name: latest.senderName || p.name,
                    initials: latest.senderName ? latest.senderName.split(' ').map((n: string) => n[0]).join('').slice(0, 2) : p.initials,
                    isReal: true
                  }));
                }

                // Check for peer submitted trigger
                if (latest.text.includes('submitted the collaborative challenge')) {
                  setPeerSubmitted(true);
                }

                setTimeout(() => scrollToBottom(), 50);
                return [...prev, ...newIncoming];
              }
              return prev;
            });
          }
        }
      } catch (e) {}
    };

    const interval = setInterval(pollMessages, 1500);
    return () => { isSubscribed = false; clearInterval(interval); };
  }, [studentEmail, activePeer.name, isCallModalOpen, incomingCall, scrollToBottom]);

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

  // ─── Study Assistant Check Trigger ──────────────────────────
  const triggerStudyAssistantCheck = async (recentMsgs: ChatMessage[]) => {
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
            setShowVideoModal(true);
            setVideoWatched(false);
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
          };
          setMessages(prev => [...prev, voiceMsg]);

          try {
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

  // ─── Send Text Message ──────────────────────────────────────
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userText = input.trim();
    const userMsg: ChatMessage = {
      id: 'msg_' + Date.now(), text: userText, sender: 'me', time,
      senderName: studentName, type: 'text',
    };
    const nextMsgs = [...messages, userMsg];
    setMessages(nextMsgs);
    setInput('');

    // Persist to backend
    const mySenderId = (studentEmail || 'user_' + studentName).trim().toLowerCase();
    try {
      fetch('/api/peer-network', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'message', sessionId: 'global_collab',
          senderId: mySenderId, senderName: studentName, text: userText
        })
      });
    } catch (e) {}

    // Check study assistant for confusion signals
    triggerStudyAssistantCheck(nextMsgs);

    // AI peer response for demo/AI peers
    if (!activePeer.isReal || activePeer.name.includes('Demo') || activePeer.name.includes('Waiting')) {
      setIsPeerTyping(true);
      try {
        const res = await fetch('/api/peer-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: userText, userCode: codeSnippet,
            track: studentTrack, peerName: activePeer.name.replace(' (Demo Peer)', '')
          })
        });
        if (res.ok) {
          const data = await res.json();
          setTimeout(() => {
            setIsPeerTyping(false);
            setMessages(prev => [...prev, {
              id: 'peer_' + Date.now(),
              text: data.reply || "Looks great! Let's submit the solution to the evaluation agent.",
              sender: 'peer', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              senderName: activePeer.name, type: 'text',
            }]);
          }, 900);
        } else { setIsPeerTyping(false); }
      } catch (err) { setIsPeerTyping(false); }
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
    setCallConnecting(true);
    setCallMode(mode);
    setCallTimeout(false);
    setIsCallModalOpen(true);

    try {
      const sId = getSessionId();
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

  const handleEndCall = () => {
    setIsCallModalOpen(false);
    setCallUrl(null);
    setShowPostCallQuiz(true);

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
    setCallUrl(incomingCall.callUrl);
    setCallMode(incomingCall.callMode);
    setIsCallModalOpen(true);
    setIncomingCall(null);
    showToast(`Connected to live ${incomingCall.callMode} call with ${incomingCall.callerName}!`);
  };

  const handleDeclineIncomingCall = () => {
    if (!incomingCall) return;
    dismissedCallIdsRef.current.add(incomingCall.messageId);
    setIncomingCall(null);
  };

  const handleSubmitPostCallQuiz = () => {
    setPostCallSubmitted(true);
    const nextXp = userXp + 15;
    setUserXp(nextXp);
    localStorage.setItem('synapse_user_xp', nextXp.toString());
    showToast('🎉 Post-call understanding verified! +15 XP.');
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
      if (score >= 60) {
        const nextXp = userXp + 30;
        setUserXp(nextXp);
        localStorage.setItem('synapse_user_xp', nextXp.toString());
        showToast(`🎉 Video quiz passed (${score}%)! +30 XP.`);
      } else {
        showToast(`Video quiz scored ${score}%. The system will adapt your study plan.`);
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
          peerName: activePeer.name,
          topic: studentTrack,
          preScore,
          postScore,
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
        <span className="text-[10px] text-muted mb-1 px-1">
          {isAI ? m.senderName : (isMe ? studentName : m.senderName || activePeer.name)} {'\u2022'} {m.time}
        </span>

        <div className={'relative p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-xs ' +
          (isAI
            ? 'bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200/50 dark:border-blue-800/30 text-ink rounded-bl-xs'
            : isMe
              ? 'bg-amber text-white rounded-br-xs font-medium'
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

            {/* Study Assistant Status Banner (Part 5 Requirement) */}
            <div className="px-4 py-2 bg-blue-50/60 dark:bg-blue-950/20 border-b border-blue-100 dark:border-blue-900/30 flex items-center justify-between text-[11px] text-blue-700 dark:text-blue-300 shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" />
                <span className="font-medium">AI study assistant is on for this chat</span>
              </div>
              <span className="text-[10px] text-muted">Autonomous Co-Pilot</span>
            </div>

            {/* Tier 1 Voice Call Suggestion Bubble (Part 5) */}
            {tier1VoicePrompt && (
              <div className="mx-4 mt-3 p-3 bg-amber/10 border border-amber/30 rounded-xl flex items-center justify-between gap-3 animate-slide-down shrink-0">
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
        <div className="fixed inset-0 z-[120] bg-ink/75 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-card border border-border rounded-[24px] max-w-2xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-3">
                <span className="text-2xl animate-pulse">{callMode === 'voice' ? '📞' : '📹'}</span>
                <div>
                  <h3 className="font-serif font-bold text-ink text-base">
                    Live {callMode === 'voice' ? 'Voice Call' : 'Video Call'} with {activePeer.name}
                  </h3>
                  <p className="text-xs text-emerald-600 font-medium flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    WebRTC Encrypted Room • Ringing on peer's screen
                  </p>
                </div>
              </div>
              <button
                onClick={handleEndCall}
                className="text-xs px-3.5 py-1.5 bg-bad/15 text-bad border border-bad/30 rounded-xl hover:bg-bad/25 cursor-pointer font-bold transition-colors"
              >
                End Call
              </button>
            </div>

            {/* Connection Timeout Warning */}
            {callTimeout && (
              <div className="p-3 bg-amber/15 border border-amber/30 rounded-xl text-xs text-ink flex items-center gap-2">
                <span>⚠️</span>
                <span>Connecting is taking a few moments. If the peer is ready, you can also open the call in a separate window below.</span>
              </div>
            )}

            {/* Call Screen / Frame */}
            <div className="h-[420px] bg-ink/95 rounded-2xl flex flex-col items-center justify-center text-white relative overflow-hidden shadow-inner">
              {callUrl ? (
                <iframe
                  src={callUrl}
                  allow="camera; microphone; fullscreen; display-capture; autoplay; clipboard-write"
                  className="w-full h-full border-0 rounded-2xl"
                  title="Synapse Live WebRTC Call"
                />
              ) : (
                <div className="text-center space-y-3 p-6">
                  <div className="w-16 h-16 rounded-full bg-amber/20 text-amber flex items-center justify-center text-2xl mx-auto animate-bounce">
                    {callMode === 'voice' ? '📞' : '📹'}
                  </div>
                  <p className="text-sm font-semibold">Initiating call to {activePeer.name}...</p>
                  <p className="text-xs text-zinc-400">Microphone {callMode === 'video' ? 'and camera active' : 'active (camera off)'}</p>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted">
                  {callMode === 'voice' ? '🎙️ Audio active' : '📹 Video & audio live'}
                </span>
                {callUrl && (
                  <a
                    href={callUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs px-3 py-1.5 bg-amber/15 border border-amber/30 text-amber hover:bg-amber/25 rounded-xl font-bold flex items-center gap-1.5 transition-colors"
                  >
                    <span>↗</span> Open Full Screen
                  </a>
                )}
              </div>
              <button
                onClick={handleEndCall}
                className="py-2.5 px-6 bg-bad hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Leave &amp; End Call
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Part 6: Post-Call Understanding Check ───────────────── */}
      {showPostCallQuiz && (
        <div className="fixed inset-0 z-[130] bg-ink/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-card border border-border rounded-[24px] max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="font-serif font-bold text-ink text-base">Quick Post-Call Check</h3>
            <p className="text-xs text-muted">1-question check to verify key takeaway from your discussion with {activePeer.name}:</p>
            <div className="p-3.5 bg-card-alt rounded-xl border border-border">
              <p className="text-xs font-semibold text-ink mb-2">
                What was the primary design principle discussed for handling state synchronicity in {studentTrack}?
              </p>
              <div className="space-y-2">
                {[
                  'Avoid stale closures by tracking sequence counters or cleanup flags',
                  'Mutate state variables directly inside async promises',
                  'Disable error boundary handling to speed up execution'
                ].map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => setPostCallAnswer(i)}
                    className={'w-full text-left text-xs p-2.5 rounded-lg border transition-all cursor-pointer ' +
                      (postCallAnswer === i ? 'bg-amber/15 border-amber text-ink font-semibold' : 'bg-card border-border text-ink hover:border-amber/40')}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={handleSubmitPostCallQuiz}
              disabled={postCallAnswer === null || postCallSubmitted}
              className="w-full py-2.5 bg-amber hover:bg-terracotta text-white font-bold text-xs rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer"
            >
              {postCallSubmitted ? '✓ Verified (+15 XP)' : 'Submit Check (+15 XP)'}
            </button>
          </div>
        </div>
      )}

      {/* ─── Part 5: Tier 3 Curated Video Modal ───────────────────── */}
      {showVideoModal && tier3Video && (
        <div className="fixed inset-0 z-[120] bg-ink/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-card border border-border rounded-[24px] max-w-3xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div>
                <span className="text-[10px] uppercase font-bold text-blue-600 tracking-wider">Tier 3 AI Intervention</span>
                <h3 className="font-serif font-bold text-ink text-base">{tier3Video.title}</h3>
              </div>
              <button
                onClick={() => setShowVideoModal(false)}
                className="text-xs text-muted hover:text-ink cursor-pointer"
              >
                ✕ Close
              </button>
            </div>

            <p className="text-xs text-ink/80">{tier3Video.message}</p>

            {/* Embedded YouTube Player (youtube-nocookie.com) */}
            <div className="aspect-video w-full rounded-2xl overflow-hidden bg-black shadow-md">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${tier3Video.youtubeId}?enablejsapi=1`}
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title={tier3Video.title}
              />
            </div>

            {/* Simulated 80% Watch unlock toggle */}
            {!videoWatched ? (
              <div className="p-3 bg-card-alt rounded-xl border border-border flex items-center justify-between">
                <span className="text-xs text-muted">Watch the tutorial to unlock the post-video quiz</span>
                <button
                  onClick={() => setVideoWatched(true)}
                  className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg cursor-pointer"
                >
                  I Finished Watching (Unlock Quiz)
                </button>
              </div>
            ) : (
              <div className="p-4 bg-card-alt rounded-xl border border-border space-y-4 animate-fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-ink uppercase tracking-wider">Verification Quiz</span>
                  <span className="text-xs text-ok font-bold">Unlocked ✓</span>
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
                      <p className="text-blue-600 mt-1">{videoQuizResult.reason}</p>
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

      {/* ─── Part 7: End-of-Session AI Summary Modal ──────────────── */}
      {showSummaryModal && (
        <div className="fixed inset-0 z-[130] bg-ink/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-card border border-border rounded-[24px] max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">🎓</span>
                <h3 className="font-serif font-bold text-ink text-base">End-of-Session AI Synthesis</h3>
              </div>
              <button
                onClick={() => setShowSummaryModal(false)}
                className="text-xs text-muted hover:text-ink cursor-pointer"
              >
                ✕ Close
              </button>
            </div>

            {isGeneratingSummary ? (
              <div className="py-8 text-center space-y-3">
                <div className="w-8 h-8 border-2 border-amber border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs text-muted">Synthesizing session metrics and diagnosing weak areas...</p>
              </div>
            ) : sessionSummary ? (
              <div className="space-y-4 text-xs">
                <div className="p-3.5 bg-card-alt rounded-xl border border-border">
                  <span className="text-[10px] uppercase font-bold text-muted tracking-wider block mb-1">Session Overview</span>
                  <p className="text-ink leading-relaxed">{sessionSummary.summary}</p>
                </div>

                {sessionSummary.strengths && sessionSummary.strengths.length > 0 && (
                  <div>
                    <span className="text-[10px] uppercase font-bold text-ok tracking-wider block mb-1">Demonstrated Strengths</span>
                    <ul className="space-y-1">
                      {sessionSummary.strengths.map((str, i) => (
                        <li key={i} className="flex items-center gap-2 text-ink">
                          <span className="text-ok font-bold">✓</span>
                          <span>{str}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {sessionSummary.weakTopics && sessionSummary.weakTopics.length > 0 && (
                  <div className="p-3.5 bg-amber/10 border border-amber/25 rounded-xl space-y-2">
                    <span className="text-[10px] uppercase font-bold text-amber tracking-wider block">Autonomous Roadmap Adaptation</span>
                    <p className="text-ink text-[11px]">
                      The AI Learning Planner has identified weak concepts and appended the following reinforcement modules to your Skill Roadmap:
                    </p>
                    <ul className="space-y-1">
                      {sessionSummary.weakTopics.map((topic, i) => (
                        <li key={i} className="text-ink font-semibold flex items-center gap-1.5">
                          <span className="text-amber">●</span>
                          <span>{topic} (Reinforcement Node)</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <button
                  onClick={() => setShowSummaryModal(false)}
                  className="w-full py-2.5 bg-amber hover:bg-terracotta text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  Return to Learning Hub
                </button>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
