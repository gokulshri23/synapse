'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface ChatMessage {
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
  thread_id?: string;
}

export interface ChatWindowProps {
  threadId: string;
  threadType?: 'pair' | 'room';
  connectionId?: string;
  studentName: string;
  studentEmail: string;
  studentTrack: string;
  activePeer: {
    id: string;
    name: string;
    initials: string;
    skill: string;
    isReal?: boolean;
    isAiTutor?: boolean;
    avatarUrl?: string;
  };
  isConnectionAccepted: boolean;
  onStartCall?: (mode: 'voice' | 'video') => void;
  onTakePostQuiz?: () => void;
  onEndSessionAndSummarize?: () => void;
  onMessagesChange?: (messages: ChatMessage[]) => void;
  preScore?: number | null;
  postScore?: number | null;
  triggerStudyAssistantCheck?: (messages: ChatMessage[]) => void;
  showToast: (msg: string) => void;
  userCode?: string;
  assistantDisabledForSession?: boolean;
  setAssistantDisabledForSession?: (val: boolean) => void;
  assistantSuppressedUntil?: number;
  tier1VoicePrompt?: string | null;
  setTier1VoicePrompt?: (val: string | null) => void;
  setAssistantSuppressedUntil?: (val: number) => void;
}

export default function ChatWindow({
  threadId,
  threadType = 'pair',
  studentName,
  studentEmail,
  studentTrack,
  activePeer,
  isConnectionAccepted,
  onStartCall,
  onTakePostQuiz,
  onEndSessionAndSummarize,
  onMessagesChange,
  preScore,
  postScore,
  triggerStudyAssistantCheck,
  showToast,
  userCode,
  assistantDisabledForSession = false,
  setAssistantDisabledForSession,
  assistantSuppressedUntil = 0,
  tier1VoicePrompt,
  setTier1VoicePrompt,
  setAssistantSuppressedUntil,
}: ChatWindowProps) {
  // ─── Local Component State ─────────────────────────────────────
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (typeof window !== 'undefined' && threadId && !threadId.includes('peer-live') && !threadId.includes('Waiting')) {
      try {
        const cached = localStorage.getItem('synapse_chat_' + threadId);
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
  const [isRecording, setIsRecording] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // ─── Scroll Management ─────────────────────────────────────────
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

  // ─── Local Storage Sync (Scoped to this thread) ───────────────
  useEffect(() => {
    if (messages.length > 0 && typeof window !== 'undefined' && threadId) {
      try {
        localStorage.setItem('synapse_chat_' + threadId, JSON.stringify(messages));
      } catch (e) {}
    }
    if (onMessagesChange) {
      onMessagesChange(messages);
    }
  }, [messages, threadId, onMessagesChange]);

  // ─── Fetch Thread Messages ─────────────────────────────────────
  const fetchMessages = useCallback(async () => {
    if (!threadId) return;
    try {
      const res = await fetch(`/api/messages?threadId=${encodeURIComponent(threadId)}&limit=50`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.messages)) {
          const myEmailLower = (studentEmail || studentName || '').trim().toLowerCase();
          const loaded: ChatMessage[] = data.messages
            .filter((m: any) => !m.thread_id || m.thread_id === threadId)
            .map((m: any) => ({
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
              thread_id: m.thread_id || threadId,
            }));

          setMessages((prev) => {
            if (prev.length === 0) return loaded;
            const existingIds = new Set(prev.map((p) => p.id));
            const newOnes = loaded.filter((l) => !existingIds.has(l.id));
            if (newOnes.length === 0) return prev;
            return [...prev, ...newOnes];
          });
          setTimeout(() => scrollToBottom(true), 60);
        }
      }
    } catch (e) {}
  }, [threadId, studentEmail, studentName, scrollToBottom]);

  // ─── Realtime Channel Subscription (Scoped Strictly to threadId)
  useEffect(() => {
    if (!threadId) return;

    fetchMessages();
    const pollInterval = setInterval(fetchMessages, 1000);

    const supabase = createClient();
    const channelName = `chat_${threadId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `thread_id=eq.${threadId}`,
        },
        (payload: any) => {
          const m = payload.new;
          if (!m || m.thread_id !== threadId) return; // Strict isolation guard

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
              thread_id: threadId,
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
  }, [threadId, fetchMessages, studentEmail, studentName, activePeer.name, scrollToBottom]);

  // ─── Send Message (Optimistic + Isolated POST) ─────────────────
  const handleSendMessage = async (e?: React.FormEvent, retryMsg?: ChatMessage) => {
    if (e) e.preventDefault();
    const textToSend = retryMsg ? retryMsg.text : input.trim();
    if (!textToSend || !threadId) return;

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
      thread_id: threadId,
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
          threadId,
          threadType,
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
      fetchMessages();
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, status: 'failed' } : m))
      );
    }

    // Trigger study assistant check if available
    if (triggerStudyAssistantCheck) {
      triggerStudyAssistantCheck([...messages, optimisticMsg]);
    }

    // Handle AI peer automated replies strictly for explicit AI Peer Tutor sessions
    const isExplicitAiTutor = activePeer.id === 'peer-ai-tutor' || activePeer.name.includes('AI Peer Tutor') || activePeer.id === 'peer-maya';
    if (isExplicitAiTutor) {
      setIsPeerTyping(true);
      try {
        const res = await fetch('/api/peer-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: textToSend,
            userCode: userCode || '',
            track: studentTrack,
            peerName: activePeer.name.replace(' (Demo Peer)', ''),
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setTimeout(async () => {
            setIsPeerTyping(false);
            const peerReply = data.reply || "Let's explore this step by step. What approach do you think we should try first?";
            try {
              await fetch('/api/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  threadId,
                  threadType,
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

  // ─── Voice Recording Handlers ──────────────────────────────────
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
        stream.getTracks().forEach((t) => t.stop());

        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = reader.result as string;
          const voiceMsg: ChatMessage = {
            id: 'voice_' + Date.now(),
            text: '🎤 Voice message',
            sender: 'me',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            senderName: studentName,
            type: 'voice',
            voiceDataUrl: base64,
            status: 'sent',
            thread_id: threadId,
          };
          setMessages((prev) => [...prev, voiceMsg]);

          try {
            await fetch('/api/messages', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                threadId,
                threadType,
                content: '🎤 Voice message',
                senderName: studentName,
                senderEmail: studentEmail || studentName,
                type: 'voice',
                voiceUrl: base64,
              }),
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

  // ─── Explain Differently & I'm Lost ───────────────────────────
  const handleExplainDifferently = async (msg: ChatMessage) => {
    showToast('🤖 Generating simpler explanation...');
    try {
      const res = await fetch('/api/peer-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'rephrase',
          originalMessage: msg.text,
          context: messages.slice(-5).map((m) => ({ sender: m.sender, text: m.text })),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const aiMsg: ChatMessage = {
          id: 'ai_rephrase_' + Date.now(),
          text: data.reply || 'Let me try explaining that differently...',
          sender: 'peer',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          senderName: '🤖 AI Assistant',
          type: 'ai_rephrase',
          thread_id: threadId,
        };
        setMessages((prev) => [...prev, aiMsg]);
        await fetch('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            threadId,
            threadType,
            content: data.reply,
            senderName: '🤖 AI Assistant',
            senderEmail: 'ai-assistant@synapse.edu',
            type: 'ai_rephrase',
          }),
        });
      }
    } catch (e) {
      showToast('Could not generate AI rephrase.');
    }
  };

  const handleImLost = async (msg: ChatMessage) => {
    showToast("😵 Flagged as lost — asking AI Study Assistant...");
    const lostText = `😵 ${studentName} flagged "I'm lost" on: "${msg.text.slice(0, 60)}"`;
    const updated = [
      ...messages,
      {
        id: 'flag_' + Date.now(),
        text: lostText,
        sender: 'me' as const,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        senderName: studentName,
        type: 'text' as const,
        thread_id: threadId,
      },
    ];
    setMessages(updated);

    try {
      await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          threadId,
          threadType,
          content: lostText,
          senderName: studentName,
          senderEmail: studentEmail || studentName,
          type: 'text',
        }),
      });
    } catch (e) {}

    if (triggerStudyAssistantCheck) {
      triggerStudyAssistantCheck(updated);
    }
  };

  // ─── Message Bubble Renderer ──────────────────────────────────
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
          {isAI ? m.senderName : isMe ? studentName : m.senderName || activePeer.name} • {m.time}
          {isMe && m.status === 'sending' && (
            <span className="text-[9px] text-amber animate-pulse">sending...</span>
          )}
        </span>

        <div
          className={
            'relative p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-xs ' +
            (isAI
              ? 'bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200/50 dark:border-blue-800/30 text-ink rounded-bl-xs'
              : isMe
              ? m.status === 'failed'
                ? 'bg-bad/10 border border-bad text-ink rounded-br-xs font-medium'
                : 'bg-amber text-white rounded-br-xs font-medium'
              : 'bg-card-alt border border-border text-ink rounded-bl-xs')
          }
        >
          {isAI && (
            <span className="text-[10px] text-blue-500 font-bold uppercase tracking-wider block mb-1">
              {m.type === 'ai_rephrase'
                ? '🤖 Simpler Explanation'
                : m.type === 'study_assistant'
                ? '🤖 AI Study Assistant Co-Pilot'
                : '🤖 AI Tutor Help'}
            </span>
          )}

          {isVoice && m.voiceDataUrl ? (
            <div className="flex items-center gap-2">
              <span className="text-lg">🎤</span>
              <audio controls src={m.voiceDataUrl} className="h-8 max-w-[200px]" preload="metadata" />
            </div>
          ) : (
            <span className="whitespace-pre-wrap">{m.text}</span>
          )}
        </div>

        {/* Failed to send / Retry button */}
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

        {/* Action buttons on hover (only for peer messages) */}
        {!isMe && !isAI && !isSystem && !isVoice && (
          <div className="flex gap-1 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => handleExplainDifferently(m)}
              className="text-[10px] px-2 py-0.5 rounded-full bg-card-alt border border-border text-muted hover:text-amber hover:border-amber transition-colors cursor-pointer"
              title="Get AI to explain this differently"
            >
              🤖 Explain differently
            </button>
            <button
              onClick={() => handleImLost(m)}
              className="text-[10px] px-2 py-0.5 rounded-full bg-card-alt border border-border text-muted hover:text-bad hover:border-bad transition-colors cursor-pointer"
              title="Flag that you're lost on this topic"
            >
              😵 I{"'"}m lost
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-card border border-border rounded-[22px] shadow-xs flex flex-col h-[640px] overflow-hidden">
      {/* Chat Header */}
      <div className="p-4 border-b border-border bg-card-alt flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-ok animate-pulse" />
          <span className="text-xs font-bold text-ink uppercase tracking-wider">
            {activePeer.name.includes('Waiting')
              ? 'Study Room (Waiting for Partner)'
              : activePeer.name.includes('Wants to Connect')
              ? `Connection Request: ${activePeer.name}`
              : activePeer.isAiTutor || activePeer.id === 'peer-ai-tutor'
              ? '1-on-1 Session with AI Peer Tutor'
              : `Discussion with ${activePeer.name}`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted font-mono">
            {activePeer.isReal
              ? 'Private Peer Socket'
              : activePeer.isAiTutor || activePeer.id === 'peer-ai-tutor'
              ? 'AI Pedagogical Tutor Active'
              : 'Connecting...'}
          </span>
          {preScore !== null && postScore === null && onTakePostQuiz && (
            <button
              onClick={onTakePostQuiz}
              className="text-[10px] px-2 py-1 bg-amber/10 text-amber font-bold rounded-lg border border-amber/20 hover:bg-amber/20 transition-colors cursor-pointer"
            >
              End Session → Post-Quiz
            </button>
          )}
          {postScore !== null && onEndSessionAndSummarize && (
            <button
              onClick={onEndSessionAndSummarize}
              className="text-[10px] px-2 py-1 bg-blue-500/10 text-blue-600 font-bold rounded-lg border border-blue-500/20 hover:bg-blue-500/20 transition-colors cursor-pointer"
            >
              AI Summary
            </button>
          )}
        </div>
      </div>

      {/* Study Assistant Status Banner */}
      <div className="px-4 py-2 bg-blue-50/60 dark:bg-blue-950/20 border-b border-blue-100 dark:border-blue-900/30 flex items-center justify-between text-[11px] text-blue-700 dark:text-blue-300 shrink-0">
        <div className="flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full ${assistantDisabledForSession ? 'bg-muted' : 'bg-blue-500 animate-ping'}`} />
          <span className="font-medium">
            {assistantDisabledForSession
              ? 'AI study assistant switched off for this session'
              : Date.now() < assistantSuppressedUntil
              ? 'AI study assistant paused (cooldown active)'
              : 'AI study assistant is active for this thread'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {setAssistantDisabledForSession && (
            assistantDisabledForSession ? (
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
            )
          )}
        </div>
      </div>

      {/* Tier 1 Voice Call Suggestion Bubble */}
      {tier1VoicePrompt && !assistantDisabledForSession && onStartCall && (
        <div className="mx-4 mt-3 p-3 bg-amber/10 border border-amber/30 rounded-xl space-y-2 animate-slide-down shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">📞</span>
              <p className="text-xs text-ink">{tier1VoicePrompt}</p>
            </div>
            <button
              onClick={() => {
                if (setTier1VoicePrompt) setTier1VoicePrompt(null);
                onStartCall('voice');
              }}
              className="text-xs px-3 py-1.5 bg-amber hover:bg-terracotta text-white font-bold rounded-lg shrink-0 cursor-pointer shadow-xs"
            >
              Start voice call
            </button>
          </div>
          <div className="flex items-center justify-end gap-3 pt-1 border-t border-amber/20 text-[11px]">
            {setAssistantSuppressedUntil && (
              <button
                type="button"
                onClick={() => {
                  setAssistantSuppressedUntil(Date.now() + 10 * 60 * 1000);
                  if (setTier1VoicePrompt) setTier1VoicePrompt(null);
                  showToast('AI Study Assistant paused for 10 minutes.');
                }}
                className="text-muted hover:text-ink font-medium cursor-pointer"
              >
                Not now (10m)
              </button>
            )}
            {setAssistantDisabledForSession && (
              <button
                type="button"
                onClick={() => {
                  setAssistantDisabledForSession(true);
                  if (setTier1VoicePrompt) setTier1VoicePrompt(null);
                  showToast('AI Study Assistant switched off for this session.');
                }}
                className="text-muted hover:text-bad font-medium cursor-pointer"
              >
                Switch off for session
              </button>
            )}
          </div>
        </div>
      )}

      {/* Connection pending banner */}
      {!isConnectionAccepted && (
        <div className="p-3 bg-amber/10 border-b border-amber/25 text-xs text-ink flex items-center gap-2 shrink-0">
          <span className="text-base">🔒</span>
          <span>
            <strong>Connection Pending:</strong> Waiting for {activePeer.name} to accept your connection invite. Real-time chat will unlock automatically upon acceptance.
          </span>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div
        ref={chatContainerRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3.5 bg-card"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-muted">
            {activePeer.isAiTutor || activePeer.id === 'peer-ai-tutor' ? (
              <>
                <div className="w-12 h-12 rounded-full bg-amber/15 text-amber flex items-center justify-center text-2xl mb-2">
                  🤖
                </div>
                <p className="text-xs font-semibold text-ink">Synapse AI Peer Tutor Active</p>
                <p className="text-[11px] text-muted max-w-xs mt-0.5">
                  Ask any question, discuss challenge concepts, or request code reviews! I am here to teach and mentor you in {studentTrack}.
                </p>
              </>
            ) : activePeer.name.includes('Waiting') ? (
              <>
                <div className="w-12 h-12 rounded-full bg-card-alt border border-border flex items-center justify-center text-2xl mb-2">
                  👥
                </div>
                <p className="text-xs font-semibold text-ink">Waiting for a Peer Partner</p>
                <p className="text-[11px] text-muted max-w-xs mt-0.5">
                  Connect with another learner from the Match page, or learn with the AI Peer Tutor to study right away!
                </p>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-full bg-card-alt border border-border flex items-center justify-center text-2xl mb-2">
                  💬
                </div>
                <p className="text-xs font-semibold text-ink">Private thread with {activePeer.name}</p>
                <p className="text-[11px] text-muted max-w-xs mt-0.5">
                  Messages and calls in this thread are private and isolated to this friend connection.
                </p>
              </>
            )}
          </div>
        ) : (
          messages.map(renderMessage)
        )}

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
          ↓ New messages
        </button>
      )}

      {/* Quick AI & Help Prompts */}
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

      {/* Message Input Form */}
      <form onSubmit={handleSendMessage} className="p-3 border-t border-border bg-card-alt flex gap-2 shrink-0">
        {/* Voice record button */}
        <button
          type="button"
          onClick={isRecording ? stopRecording : startRecording}
          className={
            'p-2.5 rounded-xl border transition-all cursor-pointer ' +
            (isRecording
              ? 'bg-bad/15 border-bad text-bad animate-pulse'
              : 'bg-card border-border text-muted hover:text-amber hover:border-amber')
          }
          title={isRecording ? 'Stop recording' : 'Record voice message'}
        >
          {isRecording ? '⏹️' : '🎤'}
        </button>

        {isRecording ? (
          <div className="flex-1 flex items-center gap-2 px-4">
            <span className="w-2 h-2 rounded-full bg-bad animate-pulse" />
            <span className="text-xs text-bad font-semibold">Recording voice message...</span>
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
                  ? `Chat locked — waiting for ${activePeer.name} to accept...`
                  : `Message ${activePeer.name}...`
              }
              className="flex-1 px-4 py-2.5 bg-card border border-border rounded-xl text-ink text-xs sm:text-sm placeholder-muted/60 outline-none focus:border-amber disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={!isConnectionAccepted || !input.trim()}
              className="px-4 py-2.5 bg-amber hover:bg-terracotta text-white font-bold text-xs rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer"
            >
              {!isConnectionAccepted ? 'Locked 🔒' : 'Send →'}
            </button>
          </>
        )}
      </form>
    </div>
  );
}
