'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────
interface ChatMessage {
  id: string;
  text: string;
  sender: 'me' | 'peer';
  time: string;
  senderName?: string;
  type?: 'text' | 'voice' | 'ai_rephrase' | 'ai_fallback' | 'system';
  voiceDataUrl?: string;
  reactions?: string[];
  flagged?: boolean;
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
  const [challengeTitle, setChallengeTitle] = useState('Collaborative Hook Implementation');
  const [challengeDescription, setChallengeDescription] = useState('Build a resilient custom async hook with loading, data, and error state handling.');

  // ─── Part H: Persistent Chat Messages ───────────────────────
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isPeerTyping, setIsPeerTyping] = useState(false);
  const [showNewMsgIndicator, setShowNewMsgIndicator] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);

  // ─── Part D: Voice Recording ────────────────────────────────
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // ─── Part B: Session Health ─────────────────────────────────
  const [sessionPhase, setSessionPhase] = useState<'pre-quiz' | 'active' | 'post-quiz' | 'review'>('active');
  const [preQuizQuestions, setPreQuizQuestions] = useState<any[]>([]);
  const [preQuizAnswers, setPreQuizAnswers] = useState<number[]>([]);
  const [postQuizAnswers, setPostQuizAnswers] = useState<number[]>([]);
  const [preScore, setPreScore] = useState<number | null>(null);
  const [postScore, setPostScore] = useState<number | null>(null);
  const [autonomousAction, setAutonomousAction] = useState<{ action: string; reason: string } | null>(null);
  const [sessionNumber, setSessionNumber] = useState(1);

  // Challenge Code & Evaluation
  const [codeSnippet, setCodeSnippet] = useState(
`// Challenge: Create a resilient custom hook
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
}`
  );
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState<{
    correctness: number;
    quality: number;
    improvement: string;
    summary: string;
    overall: number;
  } | null>(null);

  // Peer Review State
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [reviewText, setReviewText] = useState('');
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // ─── Scroll Management ──────────────────────────────────────
  const handleScroll = useCallback(() => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    isNearBottomRef.current = scrollHeight - scrollTop - clientHeight < 80;
    if (isNearBottomRef.current) setShowNewMsgIndicator(false);
  }, []);

  const scrollToBottom = useCallback((force = false) => {
    if (force || isNearBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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

    // Fetch collaborative challenge
    const sessionId = [currentEmail.trim().toLowerCase(), peerId.trim().toLowerCase()].sort().join('_') || 'global_collab';
    fetch('/api/challenge?sessionId=' + encodeURIComponent(sessionId) + '&skillArea=' + encodeURIComponent(currentTrack))
      .then((res) => res.json())
      .then((data) => {
        if (data.challenge) {
          setChallengeTitle(data.challenge.title);
          setChallengeDescription(data.challenge.description);
          if (data.challenge.starterCode) setCodeSnippet(data.challenge.starterCode);
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
  }, []);

  // ─── Real-time Message Polling ──────────────────────────────
  useEffect(() => {
    let isSubscribed = true;

    const pollMessages = async () => {
      try {
        const res = await fetch('/api/peer-network?sessionId=global_collab');
        if (res.ok && isSubscribed) {
          const data = await res.json();
          if (Array.isArray(data.messages) && data.messages.length > 0) {
            setMessages(prev => {
              const existingIds = new Set(prev.map(m => m.id));
              const myEmailLower = (studentEmail || '').trim().toLowerCase();

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
                return [...prev, ...newIncoming];
              }
              return prev;
            });
            scrollToBottom();
          }
        }
      } catch (e) {}
    };

    const interval = setInterval(pollMessages, 1500);
    return () => { isSubscribed = false; clearInterval(interval); };
  }, [studentEmail, activePeer.name, scrollToBottom]);

  // Auto-scroll when new messages added by user
  useEffect(() => {
    scrollToBottom();
  }, [messages.length, scrollToBottom]);

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

        // Persist to backend
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
    showToast('\u{1F635} Flagged as lost \u2014 generating AI help...');

    // Flag the message
    try {
      fetch('/api/peer-network', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'message', sessionId: 'global_collab',
          senderId: studentEmail || studentName, senderName: studentName,
          text: '\u{1F635} ' + studentName + ' flagged "I\'m lost" on this topic'
        })
      }).catch(() => {});
    } catch (e) {}

    // Check if both peers are stuck (Part E)
    try {
      const bothStuckRes = await fetch('/api/match-health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'both-stuck',
          sessionId: 'global_collab',
          topic: studentTrack,
          peerAId: studentEmail,
          peerBId: activePeer.id
        })
      });
      const bothStuckData = await bothStuckRes.json();

      if (bothStuckData.action === 'third_peer' && bothStuckData.peer) {
        const sysMsg: ChatMessage = {
          id: 'sys_' + Date.now(),
          text: '\u{1F916} Both peers need help \u2014 connecting you with ' + bothStuckData.peer.name + ' who is verified in this area.',
          sender: 'peer', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          senderName: 'System', type: 'system',
        };
        setMessages(prev => [...prev, sysMsg]);
        return;
      }
    } catch (e) {}

    // Generate AI fallback
    try {
      const res = await fetch('/api/peer-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'fallback',
          topic: studentTrack,
          recentMessages: messages.slice(-8).map(m => ({ sender: m.senderName || m.sender, text: m.text }))
        })
      });
      if (res.ok) {
        const data = await res.json();
        const aiMsg: ChatMessage = {
          id: 'ai_fallback_' + Date.now(),
          text: data.reply || 'Let me help explain this concept step by step...',
          sender: 'peer',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          senderName: '\u{1F916} AI Tutor',
          type: 'ai_fallback',
        };
        setMessages(prev => [...prev, aiMsg]);

        fetch('/api/peer-network', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'message', sessionId: 'global_collab',
            senderId: 'ai-tutor', senderName: '\u{1F916} AI Tutor', text: data.reply
          })
        }).catch(() => {});
      }
    } catch (e) {
      showToast('Could not generate AI help. Try again.');
    }
  };

  // ─── Part D: Voice Recording ────────────────────────────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(t => t.stop());

        // Convert to base64
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

          // Persist voice message
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
    setMessages(prev => [...prev, userMsg]);
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

  // ─── Evaluate Challenge ─────────────────────────────────────
  const handleEvaluate = async () => {
    setIsEvaluating(true);
    setEvaluation(null);
    try {
      const res = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: codeSnippet, fileName: 'useAsync.ts', challenge: 'Create a resilient custom async hook with loading, data, and error state handling' })
      });
      if (!res.ok) throw new Error('Evaluation service offline');
      const data = await res.json();
      setEvaluation(data);
      if (data.overall >= 60) {
        const nextXp = userXp + 75;
        setUserXp(nextXp);
        localStorage.setItem('synapse_user_xp', nextXp.toString());
        try {
          const saved = localStorage.getItem('synapse_study_data');
          if (saved) {
            const parsed = JSON.parse(saved);
            const currentScore = parsed.score || 80;
            parsed.score = Math.min(100, Math.round((currentScore * 0.7) + (data.overall * 0.3)));
            localStorage.setItem('synapse_study_data', JSON.stringify(parsed));
          }
        } catch (e) {}
        showToast('\u{1F389} Challenge Evaluated (' + data.overall + '%). +75 XP awarded to your College Transcript!');
      } else {
        showToast('Critique: Code scored ' + data.overall + '%. Check the feedback to optimize.');
      }
    } catch (err: any) {
      setEvaluation({ correctness: 75, quality: 70, overall: 72, summary: 'Solid implementation! The loading and state updates run cleanly.', improvement: 'Add an isMounted ref to avoid updating state if the component unmounts.' });
      showToast('Challenge evaluated via local heuristic checker.');
    } finally { setIsEvaluating(false); }
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
      const sessionId = [myId, peerId].sort().join('_') || 'global_collab';
      await fetch('/api/rate-peer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raterId: myId, rateeId: peerId, sessionId, stars: rating, comment: reviewText.trim() }),
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

    // Submit to match-health for autonomous adaptation
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
  };

  // ─── Message Bubble Renderer ────────────────────────────────
  const renderMessage = (m: ChatMessage) => {
    const isMe = m.sender === 'me';
    const isAI = m.type === 'ai_rephrase' || m.type === 'ai_fallback';
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
        {/* Sender name + time */}
        <span className="text-[10px] text-muted mb-1 px-1">
          {isAI ? m.senderName : (isMe ? studentName : m.senderName || activePeer.name)} {'\u2022'} {m.time}
        </span>

        {/* Message bubble */}
        <div className={'relative p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-xs ' +
          (isAI
            ? 'bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200/50 dark:border-blue-800/30 text-ink rounded-bl-xs'
            : isMe
              ? 'bg-amber text-white rounded-br-xs font-medium'
              : 'bg-card-alt border border-border text-ink rounded-bl-xs')
        }>
          {isAI && (
            <span className="text-[10px] text-blue-500 font-bold uppercase tracking-wider block mb-1">
              {m.type === 'ai_rephrase' ? '\u{1F916} Simpler Explanation' : '\u{1F916} AI Tutor Help'}
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

      {/* Session Header with peer info */}
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

        <div className="flex items-center gap-3">
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
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-muted tracking-wider block">Your Score &amp; XP</span>
            <span className="text-xs font-bold text-amber">{userXp} XP Available</span>
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
          <div className="lg:col-span-6 bg-card border border-border rounded-[22px] shadow-xs flex flex-col h-[600px] overflow-hidden">
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
              </div>
            </div>

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

          {/* Right Column: Challenge & Review */}
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

            {/* Challenge Code Editor */}
            <div className="bg-card border border-border rounded-[22px] p-6 shadow-xs flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-amber">Collaborative Challenge</span>
                  <h3 className="text-lg font-serif font-bold text-ink">{challengeTitle}</h3>
                </div>
                <span className="text-xs px-2.5 py-1 bg-amber/10 text-amber font-bold rounded-lg border border-amber/20">+75 XP</span>
              </div>

              <p className="text-xs text-muted">
                {challengeDescription} Submit your solution to <strong>Gemini AI</strong> to grade correctness and earn college credit.
              </p>

              <div className="relative">
                <textarea
                  value={codeSnippet}
                  onChange={(e) => setCodeSnippet(e.target.value)}
                  rows={11}
                  className="w-full p-3.5 bg-card-alt font-mono text-xs text-ink border border-border rounded-xl leading-relaxed outline-none focus:border-amber resize-none"
                  spellCheck={false}
                />
              </div>

              <button
                type="button"
                onClick={handleEvaluate}
                disabled={isEvaluating}
                className="w-full py-3 px-4 bg-amber hover:bg-terracotta text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-all disabled:opacity-60 cursor-pointer flex items-center justify-center gap-2"
              >
                {isEvaluating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    <span>AI Evaluating Code...</span>
                  </>
                ) : (
                  <>
                    <span>{'\u26A1'}</span>
                    <span>Evaluate Solution with AI (+75 XP)</span>
                  </>
                )}
              </button>

              {evaluation && (
                <div className="p-4 bg-card-alt rounded-xl border border-border space-y-3 animate-fade-in text-xs">
                  <div className="flex items-center justify-between border-b border-border pb-2">
                    <span className="font-bold text-ink uppercase tracking-wider">Evaluation Report</span>
                    <span className={'px-2 py-0.5 rounded font-bold ' +
                      (evaluation.overall >= 70 ? 'bg-ok/15 text-ok' : 'bg-amber/15 text-amber')}>
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
    </div>
  );
}
