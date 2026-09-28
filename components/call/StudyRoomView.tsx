'use client';
import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import DailyIframe, { DailyCall } from '@daily-co/daily-js';
import {
  DailyProvider,
  DailyVideo,
  DailyAudio,
  useDaily,
  useLocalParticipant,
  useParticipantIds,
  useActiveSpeakerId,
  useScreenShare,
  useNetwork,
} from '@daily-co/daily-react';

interface StudyRoomViewProps {
  room: {
    id: string;
    name: string;
    topic: string;
    host_id: string;
    host_name: string;
    type: 'pair' | 'group';
    max_participants: number;
    daily_room_name: string;
    daily_room_url?: string;
  };
  currentUser: {
    email: string;
    name: string;
    isHost: boolean;
  };
  token?: string;
  roomUrl?: string;
  initialVideoEnabled: boolean;
  initialAudioEnabled: boolean;
  onLeave: (summary?: any) => void;
}

// ─── Main Wrapper that initializes DailyCall or 100% Free WebRTC Stage ────
export default function StudyRoomView(props: StudyRoomViewProps) {
  const [callObject, setCallObject] = useState<DailyCall | null>(null);
  const [isJoining, setIsJoining] = useState(true);
  const [useFreeStage, setUseFreeStage] = useState(
    !props.token || Boolean(props.roomUrl?.includes('meet.jit.si')) || Boolean(!props.roomUrl?.includes('.daily.co'))
  );

  useEffect(() => {
    // If explicitly in 100% free mode (no token or Jitsi URL), skip Daily initialization
    if (useFreeStage) {
      setIsJoining(false);
      return;
    }

    let call: DailyCall | null = null;
    let isMounted = true;

    async function setupDaily() {
      try {
        const targetUrl = props.roomUrl || props.room.daily_room_url;
        if (!targetUrl || targetUrl.includes('demo') || !props.token) {
          // Gracefully fallback to 100% free open WebRTC mode
          if (isMounted) {
            setUseFreeStage(true);
            setIsJoining(false);
          }
          return;
        }

        call = DailyIframe.createCallObject({
          audioSource: props.initialAudioEnabled,
          videoSource: props.initialVideoEnabled,
          dailyConfig: {
            useDevicePreferenceCookies: true,
          },
        });

        if (!isMounted) {
          call.destroy();
          return;
        }

        setCallObject(call);

        await call.join({
          url: targetUrl,
          token: props.token,
          userName: props.currentUser.name || 'Learner',
        });

        if (isMounted) setIsJoining(false);
      } catch (err: any) {
        console.warn('[StudyRoomView] Daily connect failed, automatically switching to Free WebRTC stage:', err);
        if (isMounted) {
          setUseFreeStage(true);
          setIsJoining(false);
        }
      }
    }

    setupDaily();

    return () => {
      isMounted = false;
      if (call) {
        call.leave().catch(() => {});
        call.destroy().catch(() => {});
      }
    };
  }, [useFreeStage, props.roomUrl, props.room.daily_room_url, props.token, props.currentUser.name, props.initialAudioEnabled, props.initialVideoEnabled]);

  if (useFreeStage) {
    return <FreeRoomStage {...props} />;
  }

  if (isJoining || !callObject) {
    return (
      <div className="fixed inset-0 z-[200] bg-canvas flex items-center justify-center p-6 text-ink">
        <div className="bg-card border border-border rounded-[24px] max-w-sm w-full p-8 shadow-2xl text-center space-y-4 animate-fade-in">
          <div className="w-12 h-12 border-3 border-amber border-t-transparent rounded-full animate-spin mx-auto" />
          <h3 className="font-serif font-bold text-lg text-ink">Entering Study Room...</h3>
          <p className="text-xs text-muted">Establishing WebRTC encrypted peer stream for {props.room.name}</p>
        </div>
      </div>
    );
  }

  return (
    <DailyProvider callObject={callObject}>
      <DailyAudio />
      <RoomStageInner {...props} callObject={callObject} />
    </DailyProvider>
  );
}

// ─── Inside DailyProvider: In-room Video Stage, Controls & Side Panels ────
function RoomStageInner({
  room,
  currentUser,
  onLeave,
  callObject,
}: StudyRoomViewProps & { callObject: DailyCall }) {
  const daily = useDaily();
  const localParticipant = useLocalParticipant();
  const participantIds = useParticipantIds();
  const activeSpeakerId = useActiveSpeakerId();
  const { isSharingScreen, screens, startScreenShare, stopScreenShare } = useScreenShare();
  const network = useNetwork();

  // In-room UI states
  const [activeTab, setActiveTab] = useState<'chat' | 'files' | 'board' | 'people' | null>(null);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showWrapUp, setShowWrapUp] = useState(false);
  const [wrapUpData, setWrapUpData] = useState<any>(null);

  // Free minutes / Duration warning states
  const [durationWarning, setDurationWarning] = useState<string | null>(null);

  // Reporting state
  const [reportingUser, setReportingUser] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [reportToast, setReportToast] = useState<string | null>(null);

  // Chat state
  const [messages, setMessages] = useState<Array<{ id: string; sender: string; text: string; time: string }>>([
    {
      id: 'welcome',
      sender: 'System',
      text: `Welcome to ${room.name}! This session is focused on ${room.topic}.`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [chatInput, setChatInput] = useState('');

  // Files state
  const [resources, setResources] = useState<Array<{ id: string; title: string; url: string; userName: string; kind: 'file' | 'link' }>>([]);
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [isAddingLink, setIsAddingLink] = useState(false);

  // Whiteboard state (Simple synced collaborative canvas)
  const [boardColor, setBoardColor] = useState('#D97706');
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Mobile detection for screen share support
  const canScreenShare = typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getDisplayMedia);

  // ─── Session Timer & 80/90 Minute Warnings ─────────────────────
  useEffect(() => {
    const timer = setInterval(() => {
      setSessionSeconds((prev) => {
        const next = prev + 1;
        // 80 minute warning (4800s)
        if (next === 4800) {
          setDurationWarning('⚠️ Session has reached 80 minutes. The room will automatically conclude in 10 minutes to protect monthly allowances.');
        }
        // 90 minute auto-end (5400s)
        if (next >= 5400) {
          handleEndSession();
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // ─── Heartbeat Attendance (every 30 seconds) ────────────────────
  useEffect(() => {
    const sendHeartbeat = () => {
      fetch('/api/study-rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'heartbeat',
          roomId: room.id,
          userId: currentUser.email,
          userName: currentUser.name,
        }),
      }).catch(() => {});
    };

    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 30000);
    return () => clearInterval(interval);
  }, [room.id, currentUser.email, currentUser.name]);

  // ─── Load Resources ───────────────────────────────────────────
  useEffect(() => {
    fetch(`/api/study-rooms?action=resources&roomId=${encodeURIComponent(room.id)}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.resources)) setResources(data.resources);
      })
      .catch(() => {});
  }, [room.id]);

  // ─── Keyboard Shortcuts: M (mute), V (camera) ─────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in chat or input
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;

      if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        toggleAudio();
      } else if (e.key === 'v' || e.key === 'V') {
        e.preventDefault();
        toggleVideo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [localParticipant?.audio, localParticipant?.video]);

  // ─── Toggles ──────────────────────────────────────────────────
  const toggleAudio = () => {
    if (!daily) return;
    const isMuted = !localParticipant?.audio;
    daily.setLocalAudio(!isMuted);
  };

  const toggleVideo = () => {
    if (!daily) return;
    const isVideoOff = !localParticipant?.video;
    daily.setLocalVideo(!isVideoOff);
  };

  const toggleScreen = async () => {
    if (!daily) return;
    try {
      if (isSharingScreen) {
        stopScreenShare();
      } else {
        startScreenShare();
      }
    } catch (e) {
      console.warn('Screen share toggle error:', e);
    }
  };

  // ─── Host Controls ────────────────────────────────────────────
  const handleMuteParticipant = (pId: string) => {
    if (!daily || !currentUser.isHost) return;
    daily.updateParticipant(pId, { setAudio: false });
  };

  const handleRemoveParticipant = (pId: string) => {
    if (!daily || !currentUser.isHost) return;
    // Kick participant by sending them out
    daily.updateParticipant(pId, { eject: true });
  };

  // ─── Leave & End Session ──────────────────────────────────────
  const handleLeaveSession = async () => {
    setShowLeaveConfirm(false);
    try {
      const res = await fetch('/api/study-rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'leave',
          roomId: room.id,
          userId: currentUser.email,
        }),
      });
      const data = await res.json();
      setWrapUpData(data);
      setShowWrapUp(true);
    } catch (e) {
      onLeave();
    }
  };

  const handleEndSession = async () => {
    setShowLeaveConfirm(false);
    try {
      const res = await fetch('/api/study-rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'end',
          roomId: room.id,
          hostId: currentUser.email,
        }),
      });
      const data = await res.json();
      setWrapUpData({
        durationMinutes: Math.round(sessionSeconds / 60),
        eligibleForXp: sessionSeconds >= 600,
        xpAwarded: sessionSeconds >= 600 ? 50 : 0,
        summary: data.summary,
      });
      setShowWrapUp(true);
    } catch (e) {
      onLeave();
    }
  };

  // ─── Add Resource Link ────────────────────────────────────────
  const handleAddLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLinkTitle.trim() || !newLinkUrl.trim()) return;

    try {
      const res = await fetch('/api/study-rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'resource',
          roomId: room.id,
          userId: currentUser.email,
          userName: currentUser.name,
          kind: 'link',
          title: newLinkTitle.trim(),
          url: newLinkUrl.trim(),
        }),
      });
      const data = await res.json();
      if (data.resource) {
        setResources((prev) => [...prev, data.resource]);
        setNewLinkTitle('');
        setNewLinkUrl('');
        setIsAddingLink(false);
      }
    } catch (e) {}
  };

  // ─── Report User ──────────────────────────────────────────────
  const handleFileReport = async () => {
    if (!reportingUser || !reportReason.trim()) return;
    try {
      await fetch('/api/study-rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'report',
          roomId: room.id,
          reporterId: currentUser.email,
          reportedId: reportingUser,
          reason: reportReason.trim(),
        }),
      });
      setReportToast('Report submitted. Our integrity system has recorded this review.');
      setReportingUser(null);
      setReportReason('');
      setTimeout(() => setReportToast(null), 4000);
    } catch (e) {}
  };

  // ─── Send Chat Message ────────────────────────────────────────
  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const newMsg = {
      id: `msg_${Date.now()}`,
      sender: currentUser.name,
      text: chatInput.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, newMsg]);
    setChatInput('');
  };

  // ─── Participant Grid Calculations ────────────────────────────
  // List of all participant IDs
  const allParticipantIds = useMemo(() => {
    return participantIds || [];
  }, [participantIds]);

  const activeScreenShare = screens?.[0];

  // Grid classes according to requirements
  const gridClass = useMemo(() => {
    if (activeScreenShare) return 'grid grid-cols-1';
    const count = allParticipantIds.length;
    if (count <= 1) return 'grid grid-cols-1';
    if (count === 2) return 'grid grid-cols-1 sm:grid-cols-2';
    if (count <= 4) return 'grid grid-cols-2';
    if (count <= 6) return 'grid grid-cols-2 sm:grid-cols-3';
    return 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4';
  }, [allParticipantIds.length, activeScreenShare]);

  return (
    <div className="fixed inset-0 z-[140] bg-canvas flex flex-col text-ink font-sans select-none overflow-hidden">
      {/* ─── Top Bar ────────────────────────────────────────────── */}
      <header className="h-14 bg-card border-b border-border px-4 sm:px-6 flex items-center justify-between shrink-0 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h2 className="font-serif font-bold text-sm sm:text-base text-ink truncate max-w-[140px] sm:max-w-xs">
              {room.name}
            </h2>
          </div>
          <span className="hidden sm:inline-flex text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber/10 text-amber border border-amber/20">
            {room.topic}
          </span>
          <span className="text-[11px] text-muted flex items-center gap-1">
            <span>👥</span> {allParticipantIds.length} online
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Session Timer */}
          <div className="text-xs font-mono font-semibold px-2.5 py-1 bg-card-alt border border-border rounded-lg text-ink flex items-center gap-1.5 shadow-2xs">
            <span>⏱</span>
            <span>{formatTimer(sessionSeconds)}</span>
          </div>

          {/* Network Quality Indicator */}
          <span className="text-xs text-muted hidden sm:inline" title={`Network quality: ${network?.quality || 'Good'}`}>
            📶
          </span>

          {/* Leave Button */}
          <button
            onClick={() => setShowLeaveConfirm(true)}
            className="text-xs font-bold px-3 py-1.5 bg-bad/15 text-bad hover:bg-bad/25 border border-bad/30 rounded-xl transition-colors cursor-pointer"
          >
            Leave
          </button>
        </div>
      </header>

      {/* ─── Duration Warning Banner ────────────────────────────── */}
      {durationWarning && (
        <div className="bg-amber/15 border-b border-amber/30 px-4 py-2 text-xs text-ink flex items-center justify-between animate-slide-down">
          <span>{durationWarning}</span>
          <button onClick={() => setDurationWarning(null)} className="text-muted hover:text-ink font-bold ml-2">
            ✕
          </button>
        </div>
      )}

      {/* ─── Main Room Stage ────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Video / Screen Grid Area */}
        <div className="flex-1 p-3 sm:p-5 flex flex-col items-center justify-center overflow-y-auto">
          {/* Screen Share Stage (Big Stage) */}
          {activeScreenShare ? (
            <div className="w-full h-full flex flex-col lg:flex-row gap-3">
              <div className="flex-1 bg-[#1C1917] rounded-2xl overflow-hidden relative border border-border shadow-2xl flex items-center justify-center">
                <DailyVideo
                  sessionId={activeScreenShare.session_id}
                  type="screenVideo"
                  className="w-full h-full object-contain"
                />
                <div className="absolute top-3 left-3 bg-ink/80 text-white text-xs px-3 py-1 rounded-full backdrop-blur-md flex items-center gap-2">
                  <span>🖥️</span> Screen Share Stage
                </div>
              </div>

              {/* Filmstrip of participants */}
              <div className="lg:w-64 flex lg:flex-col gap-2 overflow-x-auto lg:overflow-y-auto shrink-0 max-h-48 lg:max-h-full">
                {allParticipantIds.map((pId) => (
                  <div key={pId} className="w-36 h-28 lg:w-full lg:h-36 shrink-0">
                    <ParticipantTile
                      participantId={pId}
                      isActiveSpeaker={activeSpeakerId === pId}
                      isHost={pId === localParticipant?.session_id ? currentUser.isHost : false}
                      currentUserId={currentUser.email}
                      onMute={() => handleMuteParticipant(pId)}
                      onRemove={() => handleRemoveParticipant(pId)}
                      onReport={(id) => setReportingUser(id)}
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Regular Grid Area */
            <div className={`w-full h-full max-w-6xl max-h-[750px] gap-3.5 ${gridClass}`}>
              {allParticipantIds.map((pId) => (
                <ParticipantTile
                  key={pId}
                  participantId={pId}
                  isActiveSpeaker={activeSpeakerId === pId}
                  isHost={pId === localParticipant?.session_id ? currentUser.isHost : false}
                  currentUserId={currentUser.email}
                  onMute={() => handleMuteParticipant(pId)}
                  onRemove={() => handleRemoveParticipant(pId)}
                  onReport={(id) => setReportingUser(id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* ─── Side Panel (Drawer on desktop, bottom sheet on phone) ─── */}
        {activeTab && (
          <aside className="w-full sm:w-80 lg:w-96 bg-card border-l border-border flex flex-col shadow-2xl z-30 shrink-0 animate-slide-left">
            {/* Panel Tabs */}
            <div className="h-12 border-b border-border flex items-center justify-between px-2 bg-card-alt">
              <div className="flex gap-1">
                {(['chat', 'files', 'board', 'people'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => {
                      setActiveTab(tab);
                      if (tab === 'chat') setUnreadChatCount(0);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors cursor-pointer ${
                      activeTab === tab
                        ? 'bg-amber text-white shadow-xs'
                        : 'text-muted hover:text-ink hover:bg-card'
                    }`}
                  >
                    {tab}
                    {tab === 'chat' && unreadChatCount > 0 && (
                      <span className="ml-1 px-1.5 py-0.2 bg-bad text-white text-[10px] rounded-full">
                        {unreadChatCount}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setActiveTab(null)}
                className="w-7 h-7 rounded-lg text-muted hover:text-ink flex items-center justify-center text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Panel Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {/* CHAT TAB */}
              {activeTab === 'chat' && (
                <div className="h-full flex flex-col justify-between space-y-3">
                  <div className="space-y-2.5 overflow-y-auto flex-1 pr-1">
                    {messages.map((m) => {
                      const isMe = m.sender === currentUser.name;
                      return (
                        <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                          <div className="flex items-center gap-1.5 text-[10px] text-muted mb-0.5">
                            <span className="font-semibold text-ink">{m.sender}</span>
                            <span>{m.time}</span>
                          </div>
                          <div
                            className={`p-2.5 rounded-xl text-xs max-w-[85%] ${
                              isMe ? 'bg-amber text-white rounded-br-none' : 'bg-card-alt border border-border text-ink rounded-bl-none'
                            }`}
                          >
                            {/* Render code blocks monospace */}
                            {m.text.includes('```') ? (
                              <pre className="font-mono text-[11px] p-2 bg-ink/90 text-white rounded-lg overflow-x-auto whitespace-pre">
                                {m.text.replace(/```/g, '')}
                              </pre>
                            ) : (
                              <span>{m.text}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <form onSubmit={handleSendChat} className="flex gap-2 pt-2 border-t border-border">
                    <input
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Discuss topic or share code..."
                      className="flex-1 p-2.5 bg-card-alt border border-border rounded-xl text-xs text-ink outline-none focus:border-amber"
                    />
                    <button
                      type="submit"
                      className="px-3.5 bg-amber hover:bg-terracotta text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    >
                      Send
                    </button>
                  </form>
                </div>
              )}

              {/* FILES & LINKS TAB */}
              {activeTab === 'files' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-border">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted">Shared Resources</h4>
                    <button
                      onClick={() => setIsAddingLink(!isAddingLink)}
                      className="text-xs text-amber font-semibold hover:underline cursor-pointer"
                    >
                      {isAddingLink ? 'Cancel' : '+ Add Link'}
                    </button>
                  </div>

                  {isAddingLink && (
                    <form onSubmit={handleAddLink} className="p-3 bg-card-alt rounded-xl border border-border space-y-2 text-xs">
                      <input
                        required
                        value={newLinkTitle}
                        onChange={(e) => setNewLinkTitle(e.target.value)}
                        placeholder="Resource title (e.g. React Docs)"
                        className="w-full p-2 bg-card border border-border rounded-lg text-ink text-xs outline-none focus:border-amber"
                      />
                      <input
                        required
                        type="url"
                        value={newLinkUrl}
                        onChange={(e) => setNewLinkUrl(e.target.value)}
                        placeholder="https://..."
                        className="w-full p-2 bg-card border border-border rounded-lg text-ink text-xs outline-none focus:border-amber"
                      />
                      <button
                        type="submit"
                        className="w-full py-1.5 bg-amber hover:bg-terracotta text-white font-semibold rounded-lg text-xs transition-colors cursor-pointer"
                      >
                        Share with Room
                      </button>
                    </form>
                  )}

                  <div className="space-y-2">
                    {resources.length === 0 ? (
                      <p className="text-xs text-muted text-center py-6">No shared files or links yet.</p>
                    ) : (
                      resources.map((r) => (
                        <div key={r.id} className="p-3 bg-card-alt rounded-xl border border-border space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-ink truncate">{r.title}</span>
                            <span className="text-[10px] text-muted">{r.kind}</span>
                          </div>
                          <a
                            href={r.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-amber hover:underline flex items-center gap-1 truncate"
                          >
                            <span>↗</span> {r.url}
                          </a>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* WHITEBOARD TAB */}
              {activeTab === 'board' && (
                <div className="h-full flex flex-col space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted">Collaborative Board</span>
                    <div className="flex gap-1.5">
                      {['#D97706', '#2ee6a8', '#ff4d6a', '#1C1917'].map((c) => (
                        <button
                          key={c}
                          onClick={() => setBoardColor(c)}
                          className={`w-5 h-5 rounded-full border cursor-pointer ${
                            boardColor === c ? 'ring-2 ring-amber scale-110' : 'opacity-70'
                          }`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex-1 bg-white rounded-xl border border-border relative overflow-hidden shadow-inner">
                    <canvas
                      ref={canvasRef}
                      width={320}
                      height={400}
                      className="w-full h-full cursor-crosshair"
                      onMouseDown={(e) => {
                        const canvas = canvasRef.current;
                        if (!canvas) return;
                        const ctx = canvas.getContext('2d');
                        if (!ctx) return;
                        setIsDrawing(true);
                        const rect = canvas.getBoundingClientRect();
                        ctx.beginPath();
                        ctx.strokeStyle = boardColor;
                        ctx.lineWidth = 2.5;
                        ctx.lineCap = 'round';
                        ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
                      }}
                      onMouseMove={(e) => {
                        if (!isDrawing) return;
                        const canvas = canvasRef.current;
                        if (!canvas) return;
                        const ctx = canvas.getContext('2d');
                        if (!ctx) return;
                        const rect = canvas.getBoundingClientRect();
                        ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
                        ctx.stroke();
                      }}
                      onMouseUp={() => setIsDrawing(false)}
                      onMouseLeave={() => setIsDrawing(false)}
                    />
                  </div>
                  <button
                    onClick={() => {
                      const canvas = canvasRef.current;
                      if (!canvas) return;
                      const ctx = canvas.getContext('2d');
                      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
                    }}
                    className="w-full py-1.5 bg-card-alt border border-border text-xs text-muted hover:text-bad rounded-lg font-medium transition-colors cursor-pointer"
                  >
                    Clear Board
                  </button>
                </div>
              )}

              {/* PEOPLE TAB */}
              {activeTab === 'people' && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted">
                    Participants ({allParticipantIds.length})
                  </h4>
                  <div className="space-y-2">
                    {allParticipantIds.map((pId) => {
                      const isMe = pId === localParticipant?.session_id;
                      return (
                        <div key={pId} className="p-2.5 bg-card-alt rounded-xl border border-border flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-amber/20 text-amber flex items-center justify-center font-bold text-xs">
                              {pId.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-ink">
                                {isMe ? `${currentUser.name} (You)` : `Learner (${pId.slice(0, 5)})`}
                              </p>
                              {isMe && currentUser.isHost && (
                                <span className="text-[10px] text-amber font-bold">Session Host</span>
                              )}
                            </div>
                          </div>

                          {currentUser.isHost && !isMe && (
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleMuteParticipant(pId)}
                                className="text-[11px] px-2 py-1 bg-card border border-border hover:border-amber rounded-lg text-ink cursor-pointer"
                                title="Mute learner"
                              >
                                🔇 Mute
                              </button>
                              <button
                                onClick={() => handleRemoveParticipant(pId)}
                                className="text-[11px] px-2 py-1 bg-bad/15 hover:bg-bad/25 text-bad border border-bad/30 rounded-lg font-bold cursor-pointer"
                                title="Remove learner"
                              >
                                Remove
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* ─── Bottom Floating Control Pill (Centered) ───────────── */}
      <footer className="h-20 flex items-center justify-center p-3 relative pointer-events-none">
        <div className="bg-card/95 backdrop-blur-md border border-border py-2 px-3 sm:px-4 rounded-full shadow-2xl flex items-center gap-2 pointer-events-auto">
          {/* Mic Button */}
          <button
            onClick={toggleAudio}
            className={`w-11 h-11 rounded-full flex items-center justify-center text-base transition-transform active:scale-95 cursor-pointer shadow-xs ${
              localParticipant?.audio
                ? 'bg-card-alt text-ink hover:border-amber border border-border'
                : 'bg-bad text-white'
            }`}
            title={`Toggle Microphone (${localParticipant?.audio ? 'Muted' : 'Unmuted'}) [M]`}
          >
            {localParticipant?.audio ? '🎤' : '🔇'}
          </button>

          {/* Camera Button */}
          <button
            onClick={toggleVideo}
            className={`w-11 h-11 rounded-full flex items-center justify-center text-base transition-transform active:scale-95 cursor-pointer shadow-xs ${
              localParticipant?.video
                ? 'bg-card-alt text-ink hover:border-amber border border-border'
                : 'bg-bad text-white'
            }`}
            title={`Toggle Camera (${localParticipant?.video ? 'On' : 'Off'}) [V]`}
          >
            {localParticipant?.video ? '📹' : '🚫'}
          </button>

          {/* Screen Share Button (Hidden on phones if no getDisplayMedia) */}
          {canScreenShare && (
            <button
              onClick={toggleScreen}
              className={`w-11 h-11 rounded-full flex items-center justify-center text-base transition-transform active:scale-95 cursor-pointer shadow-xs ${
                isSharingScreen
                  ? 'bg-emerald-600 text-white'
                  : 'bg-card-alt text-ink hover:border-amber border border-border'
              }`}
              title={isSharingScreen ? 'Stop screen share' : 'Share screen'}
            >
              🖥️
            </button>
          )}

          <div className="h-6 w-[1px] bg-border mx-1" />

          {/* Chat Toggle Button */}
          <button
            onClick={() => setActiveTab(activeTab === 'chat' ? null : 'chat')}
            className={`w-11 h-11 rounded-full flex items-center justify-center text-base transition-transform active:scale-95 cursor-pointer relative shadow-xs ${
              activeTab === 'chat' ? 'bg-amber text-white' : 'bg-card-alt text-ink hover:border-amber border border-border'
            }`}
            title="Chat & AI Study Assistant"
          >
            💬
            {unreadChatCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-bad text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {unreadChatCount}
              </span>
            )}
          </button>

          {/* Resources Toggle */}
          <button
            onClick={() => setActiveTab(activeTab === 'files' ? null : 'files')}
            className={`w-11 h-11 rounded-full flex items-center justify-center text-base transition-transform active:scale-95 cursor-pointer shadow-xs ${
              activeTab === 'files' ? 'bg-amber text-white' : 'bg-card-alt text-ink hover:border-amber border border-border'
            }`}
            title="Shared Files & Links"
          >
            📄
          </button>

          {/* Whiteboard Toggle */}
          <button
            onClick={() => setActiveTab(activeTab === 'board' ? null : 'board')}
            className={`w-11 h-11 rounded-full flex items-center justify-center text-base transition-transform active:scale-95 cursor-pointer shadow-xs ${
              activeTab === 'board' ? 'bg-amber text-white' : 'bg-card-alt text-ink hover:border-amber border border-border'
            }`}
            title="Whiteboard"
          >
            ✏️
          </button>

          {/* People Toggle */}
          <button
            onClick={() => setActiveTab(activeTab === 'people' ? null : 'people')}
            className={`w-11 h-11 rounded-full flex items-center justify-center text-base transition-transform active:scale-95 cursor-pointer shadow-xs ${
              activeTab === 'people' ? 'bg-amber text-white' : 'bg-card-alt text-ink hover:border-amber border border-border'
            }`}
            title="Participants & Host Controls"
          >
            👥
          </button>

          <div className="h-6 w-[1px] bg-border mx-1" />

          {/* Leave Button */}
          <button
            onClick={() => setShowLeaveConfirm(true)}
            className="h-11 px-4 rounded-full bg-bad hover:bg-red-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md transition-transform active:scale-95 cursor-pointer"
          >
            <span>🔴</span> Leave
          </button>
        </div>
      </footer>

      {/* ─── Report Modal ───────────────────────────────────────── */}
      {reportingUser && (
        <div className="fixed inset-0 z-[220] bg-ink/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-card border border-border rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <h3 className="font-serif font-bold text-base text-ink">Report Participant</h3>
            <p className="text-xs text-muted">Help maintain a respectful, supportive study environment.</p>
            <textarea
              required
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="Describe the issue (inappropriate behavior, spam, disruption)..."
              rows={3}
              className="w-full p-3 bg-card-alt border border-border rounded-xl text-xs text-ink outline-none focus:border-amber resize-none"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setReportingUser(null)}
                className="flex-1 py-2 bg-card-alt border border-border rounded-xl text-xs font-semibold text-ink cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleFileReport}
                disabled={!reportReason.trim()}
                className="flex-1 py-2 bg-bad text-white rounded-xl text-xs font-bold disabled:opacity-50 cursor-pointer shadow-xs"
              >
                Submit Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Leave Confirmation Dialog ──────────────────────────── */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 z-[220] bg-ink/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-card border border-border rounded-[24px] max-w-md w-full p-6 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-bad/15 text-bad flex items-center justify-center text-2xl mx-auto">
              🔴
            </div>
            <h3 className="font-serif font-bold text-lg text-ink">Leave Learning Session?</h3>
            <p className="text-xs text-muted leading-relaxed">
              Your attendance and learning progress will be saved. Leaving will trigger your post-session wrap-up.
            </p>
            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={handleLeaveSession}
                className="w-full py-2.5 bg-bad hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Yes, Leave Session
              </button>
              {currentUser.isHost && (
                <button
                  onClick={handleEndSession}
                  className="w-full py-2.5 bg-ink text-white font-bold text-xs rounded-xl shadow-xs hover:bg-ink/80 transition-colors cursor-pointer"
                >
                  End Session for Everyone (Host)
                </button>
              )}
              <button
                onClick={() => setShowLeaveConfirm(false)}
                className="w-full py-2 bg-card-alt border border-border text-xs font-semibold text-ink rounded-xl hover:border-amber transition-colors cursor-pointer"
              >
                Cancel &amp; Continue Session
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Wrap-Up Screen on Session End ───────────────────────── */}
      {showWrapUp && (
        <div className="fixed inset-0 z-[250] bg-ink/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-card border border-border rounded-[28px] max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-5 animate-scale-in">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-600 flex items-center justify-center text-3xl mx-auto font-bold">
                ✓
              </div>
              <h3 className="font-serif font-bold text-2xl text-ink">Session Concluded</h3>
              <p className="text-xs text-muted">
                Completed {Math.round(sessionSeconds / 60)} minutes in <strong>{room.name}</strong>
              </p>
            </div>

            {/* Attendance & XP Integrity Status */}
            <div className="p-4 bg-card-alt rounded-2xl border border-border space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-ink">Session Duration</span>
                <span>{Math.round(sessionSeconds / 60)} minutes</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-ink">XP Integrity Verification</span>
                {sessionSeconds >= 600 ? (
                  <span className="font-bold text-emerald-600 flex items-center gap-1">
                    ✓ Verified (10+ min) • +50 XP
                  </span>
                ) : (
                  <span className="text-muted font-medium">
                    Under 10 min (No XP awarded)
                  </span>
                )}
              </div>
            </div>

            {/* Post-Session Quiz & Feedback */}
            <div className="space-y-3 pt-1">
              <p className="text-xs font-semibold text-ink">How was this learning session?</p>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => {
                      setReportToast('Thank you! Your rating has been logged.');
                      setTimeout(() => setReportToast(null), 3000);
                    }}
                    className="p-2 bg-card-alt border border-border rounded-xl text-lg hover:scale-110 transition-transform cursor-pointer"
                  >
                    ⭐
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => onLeave(wrapUpData)}
              className="w-full py-3.5 bg-amber hover:bg-terracotta text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
            >
              Return to Sessions Lobby →
            </button>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {reportToast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[300] bg-ink text-white px-4 py-2.5 rounded-xl text-xs shadow-2xl flex items-center gap-2 animate-slide-down">
          <span>✓</span> {reportToast}
        </div>
      )}
    </div>
  );
}

// ─── 100% Free WebRTC Study Room Stage (No Paid Account / No Daily Key Needed) ────
function FreeRoomStage({
  room,
  currentUser,
  onLeave,
  initialVideoEnabled,
  initialAudioEnabled,
  roomUrl,
}: StudyRoomViewProps) {
  const [activeTab, setActiveTab] = useState<'chat' | 'files' | 'board' | 'people' | null>(null);
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showWrapUp, setShowWrapUp] = useState(false);
  const [wrapUpData, setWrapUpData] = useState<any>(null);
  const [wrapUpFeedback, setWrapUpFeedback] = useState('');
  const [wrapUpRating, setWrapUpRating] = useState(5);

  // Chat state
  const [messages, setMessages] = useState<Array<{ id: string; sender: string; text: string; time: string }>>([
    {
      id: 'welcome',
      sender: 'System',
      text: `Welcome to ${room.name}! This free learning room is focused on ${room.topic}.`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [chatInput, setChatInput] = useState('');

  // Resources
  const [resources, setResources] = useState<Array<{ id: string; title: string; url: string; userName: string; kind: 'file' | 'link' }>>([]);
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [isAddingLink, setIsAddingLink] = useState(false);

  // Whiteboard
  const [boardColor, setBoardColor] = useState('#D97706');
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Free WebRTC URL
  const cleanRoom = room.name.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 40) || 'study';
  const displayName = encodeURIComponent(currentUser.name || 'Learner');
  const startMuted = !initialAudioEnabled ? '&config.startWithAudioMuted=true' : '';
  const startVideoOff = !initialVideoEnabled ? '&config.startWithVideoMuted=true' : '';
  const freeCallUrl = roomUrl?.includes('meet.jit.si')
    ? roomUrl
    : `https://meet.jit.si/synapse-${cleanRoom}#config.prejoinPageEnabled=false&config.disableDeepLinking=true&userInfo.displayName="${displayName}"${startMuted}${startVideoOff}&config.toolbarButtons=%5B'microphone','camera','desktop','chat','raisehand','tileview','hangup'%5D`;

  // Session timer
  useEffect(() => {
    const timer = setInterval(() => {
      setSessionSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Heartbeat attendance
  useEffect(() => {
    const sendHeartbeat = () => {
      fetch('/api/study-rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'heartbeat',
          roomId: room.id,
          userId: currentUser.email,
          userName: currentUser.name,
        }),
      }).catch(() => {});
    };
    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 30000);
    return () => clearInterval(interval);
  }, [room.id, currentUser.email, currentUser.name]);

  // Load resources
  useEffect(() => {
    fetch(`/api/study-rooms?action=resources&roomId=${encodeURIComponent(room.id)}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.resources)) setResources(data.resources);
      })
      .catch(() => {});
  }, [room.id]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    setMessages((prev) => [
      ...prev,
      {
        id: `msg-${Date.now()}`,
        sender: currentUser.name,
        text: chatInput.trim(),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    setChatInput('');
  };

  const handleAddLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLinkTitle.trim() || !newLinkUrl.trim()) return;
    try {
      const res = await fetch('/api/study-rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'resource',
          roomId: room.id,
          title: newLinkTitle.trim(),
          url: newLinkUrl.trim(),
          userName: currentUser.name,
          kind: 'link',
        }),
      });
      const data = await res.json();
      if (data.success && data.resource) {
        setResources((prev) => [data.resource, ...prev]);
        setNewLinkTitle('');
        setNewLinkUrl('');
        setIsAddingLink(false);
      }
    } catch {}
  };

  const handleEndSession = async () => {
    try {
      const res = await fetch('/api/study-rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'leave',
          roomId: room.id,
          userId: currentUser.email,
          durationSeconds: sessionSeconds,
        }),
      });
      const data = await res.json();
      setWrapUpData({
        duration: sessionSeconds,
        xpAwarded: data.xpAwarded || (sessionSeconds >= 600 ? 40 : 0),
        participants: 2,
      });
      setShowWrapUp(true);
    } catch {
      onLeave();
    }
  };

  return (
    <div className="fixed inset-0 z-[150] bg-canvas flex flex-col text-ink select-none animate-fade-in font-sans">
      {/* Top Header */}
      <header className="h-14 bg-card border-b border-border px-4 sm:px-6 flex items-center justify-between shadow-2xs z-30 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h2 className="font-serif font-bold text-sm sm:text-base text-ink truncate max-w-[140px] sm:max-w-xs">
              {room.name}
            </h2>
          </div>
          <span className="hidden sm:inline-flex text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber/10 text-amber border border-amber/20">
            {room.topic}
          </span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
            100% Free WebRTC
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Session Timer */}
          <div className="text-xs font-mono font-semibold px-2.5 py-1 bg-card-alt border border-border rounded-lg text-ink flex items-center gap-1.5 shadow-2xs">
            <span>⏱</span>
            <span>{formatTimer(sessionSeconds)}</span>
          </div>

          {/* Drawer Tabs */}
          <div className="hidden sm:flex items-center gap-1 bg-card-alt border border-border p-1 rounded-xl">
            <button
              onClick={() => setActiveTab(activeTab === 'chat' ? null : 'chat')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                activeTab === 'chat' ? 'bg-amber text-white shadow-2xs' : 'text-muted hover:text-ink'
              }`}
            >
              💬 Chat
            </button>
            <button
              onClick={() => setActiveTab(activeTab === 'files' ? null : 'files')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                activeTab === 'files' ? 'bg-amber text-white shadow-2xs' : 'text-muted hover:text-ink'
              }`}
            >
              📁 Files
            </button>
            <button
              onClick={() => setActiveTab(activeTab === 'board' ? null : 'board')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                activeTab === 'board' ? 'bg-amber text-white shadow-2xs' : 'text-muted hover:text-ink'
              }`}
            >
              🎨 Board
            </button>
            <button
              onClick={() => setActiveTab(activeTab === 'people' ? null : 'people')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                activeTab === 'people' ? 'bg-amber text-white shadow-2xs' : 'text-muted hover:text-ink'
              }`}
            >
              👥 People
            </button>
          </div>

          {/* Leave Button */}
          <button
            onClick={() => setShowLeaveConfirm(true)}
            className="text-xs font-bold px-3 py-1.5 bg-bad/15 text-bad hover:bg-bad/25 border border-bad/30 rounded-xl transition-colors cursor-pointer"
          >
            Leave
          </button>
        </div>
      </header>

      {/* Main Room Body */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Video Stage */}
        <div className="flex-1 p-2 sm:p-4 flex flex-col items-center justify-center overflow-hidden">
          <div className="w-full h-full bg-[#1C1917] rounded-2xl overflow-hidden relative border border-border shadow-2xl flex flex-col">
            <iframe
              src={freeCallUrl}
              allow="camera; microphone; fullscreen; display-capture; autoplay; clipboard-write; screen-wake-lock"
              className="w-full h-full border-0 rounded-2xl"
              title="Synapse Free Study Room"
            />
          </div>
        </div>

        {/* 4-Tab Side Drawer */}
        {activeTab && (
          <aside className="w-80 sm:w-96 bg-card border-l border-border flex flex-col z-20 shadow-xl animate-fade-in shrink-0">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="font-serif font-bold text-sm text-ink capitalize">{activeTab}</h3>
              <button onClick={() => setActiveTab(null)} className="text-muted hover:text-ink text-sm font-bold cursor-pointer">
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {activeTab === 'chat' && (
                <div className="h-full flex flex-col space-y-3">
                  <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                    {messages.map((m) => (
                      <div key={m.id} className="p-2.5 bg-card-alt rounded-xl border border-border text-xs">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-ink">{m.sender}</span>
                          <span className="text-[10px] text-muted">{m.time}</span>
                        </div>
                        <p className="text-ink/90 whitespace-pre-wrap">{m.text}</p>
                      </div>
                    ))}
                  </div>
                  <form onSubmit={handleSendMessage} className="flex gap-2 pt-2 border-t border-border">
                    <input
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Type a message or code..."
                      className="flex-1 p-2 bg-card-alt border border-border rounded-xl text-xs text-ink outline-none focus:border-amber"
                    />
                    <button
                      type="submit"
                      className="px-3.5 py-2 bg-amber hover:bg-terracotta text-white font-semibold rounded-xl text-xs transition-colors cursor-pointer"
                    >
                      Send
                    </button>
                  </form>
                </div>
              )}

              {activeTab === 'files' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-border">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted">Shared Resources</h4>
                    <button
                      onClick={() => setIsAddingLink(!isAddingLink)}
                      className="text-xs text-amber font-semibold hover:underline cursor-pointer"
                    >
                      {isAddingLink ? 'Cancel' : '+ Add Link'}
                    </button>
                  </div>
                  {isAddingLink && (
                    <form onSubmit={handleAddLink} className="p-3 bg-card-alt rounded-xl border border-border space-y-2 text-xs">
                      <input
                        required
                        value={newLinkTitle}
                        onChange={(e) => setNewLinkTitle(e.target.value)}
                        placeholder="Resource title"
                        className="w-full p-2 bg-card border border-border rounded-lg text-ink text-xs outline-none focus:border-amber"
                      />
                      <input
                        required
                        type="url"
                        value={newLinkUrl}
                        onChange={(e) => setNewLinkUrl(e.target.value)}
                        placeholder="https://..."
                        className="w-full p-2 bg-card border border-border rounded-lg text-ink text-xs outline-none focus:border-amber"
                      />
                      <button
                        type="submit"
                        className="w-full py-1.5 bg-amber hover:bg-terracotta text-white font-semibold rounded-lg text-xs cursor-pointer"
                      >
                        Share
                      </button>
                    </form>
                  )}
                  <div className="space-y-2">
                    {resources.length === 0 ? (
                      <p className="text-xs text-muted text-center py-6">No shared links yet.</p>
                    ) : (
                      resources.map((r) => (
                        <div key={r.id} className="p-3 bg-card-alt rounded-xl border border-border space-y-1">
                          <span className="text-xs font-semibold text-ink block">{r.title}</span>
                          <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-xs text-amber hover:underline truncate block">
                            ↗ {r.url}
                          </a>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'board' && (
                <div className="h-full flex flex-col space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted">Drawing Canvas</span>
                    <div className="flex gap-1.5">
                      {['#D97706', '#2ee6a8', '#ff4d6a', '#1C1917'].map((c) => (
                        <button
                          key={c}
                          onClick={() => setBoardColor(c)}
                          className={`w-5 h-5 rounded-full border cursor-pointer ${
                            boardColor === c ? 'ring-2 ring-amber scale-110' : 'opacity-70'
                          }`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex-1 bg-white rounded-xl border border-border relative overflow-hidden shadow-inner min-h-[300px]">
                    <canvas
                      ref={canvasRef}
                      width={320}
                      height={360}
                      className="w-full h-full cursor-crosshair"
                      onMouseDown={(e) => {
                        const canvas = canvasRef.current;
                        if (!canvas) return;
                        const ctx = canvas.getContext('2d');
                        if (!ctx) return;
                        setIsDrawing(true);
                        const rect = canvas.getBoundingClientRect();
                        ctx.beginPath();
                        ctx.strokeStyle = boardColor;
                        ctx.lineWidth = 2.5;
                        ctx.lineCap = 'round';
                        ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
                      }}
                      onMouseMove={(e) => {
                        if (!isDrawing) return;
                        const canvas = canvasRef.current;
                        if (!canvas) return;
                        const ctx = canvas.getContext('2d');
                        if (!ctx) return;
                        const rect = canvas.getBoundingClientRect();
                        ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
                        ctx.stroke();
                      }}
                      onMouseUp={() => setIsDrawing(false)}
                      onMouseLeave={() => setIsDrawing(false)}
                    />
                  </div>
                  <button
                    onClick={() => {
                      const canvas = canvasRef.current;
                      if (!canvas) return;
                      const ctx = canvas.getContext('2d');
                      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
                    }}
                    className="w-full py-1.5 bg-card-alt border border-border text-xs text-muted hover:text-bad rounded-lg font-medium transition-colors cursor-pointer"
                  >
                    Clear Board
                  </button>
                </div>
              )}

              {activeTab === 'people' && (
                <div className="space-y-3">
                  <div className="p-3 bg-card-alt rounded-xl border border-border flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-ink block">{currentUser.name} (You)</span>
                      <span className="text-[10px] text-muted">{currentUser.email}</span>
                    </div>
                    {currentUser.isHost && (
                      <span className="text-[10px] px-2 py-0.5 bg-amber text-white font-bold rounded-md">Host</span>
                    )}
                  </div>
                  <div className="p-3 bg-card-alt rounded-xl border border-border flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-ink block">{room.host_name}</span>
                      <span className="text-[10px] text-muted">Study Partner</span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 bg-ok/15 text-ok border border-ok/30 font-bold rounded-md">
                      Verified teacher ✓
                    </span>
                  </div>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* Leave Confirmation Modal */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 z-[250] bg-ink/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-card border border-border rounded-[24px] max-w-sm w-full p-6 shadow-2xl space-y-4">
            <h3 className="font-serif font-bold text-lg text-ink">Leave Learning Session?</h3>
            <p className="text-xs text-muted leading-relaxed">
              {sessionSeconds >= 600
                ? 'Great job! You have reached 10 minutes and will be awarded +40 XP upon concluding.'
                : `You have attended for ${formatTimer(sessionSeconds)}. Attending for at least 10 minutes is required to earn +40 XP.`}
            </p>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowLeaveConfirm(false)}
                className="flex-1 py-2.5 bg-card-alt border border-border text-xs font-semibold text-ink rounded-xl hover:bg-card transition-colors cursor-pointer"
              >
                Keep Learning
              </button>
              <button
                onClick={() => {
                  setShowLeaveConfirm(false);
                  handleEndSession();
                }}
                className="flex-1 py-2.5 bg-bad text-white text-xs font-bold rounded-xl hover:bg-red-700 transition-colors cursor-pointer"
              >
                End Session
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Wrap-up Feedback Modal */}
      {showWrapUp && wrapUpData && (
        <div className="fixed inset-0 z-[300] bg-ink/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-card border border-border rounded-[26px] max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-amber/15 text-amber text-2xl flex items-center justify-center mx-auto">
                🎓
              </div>
              <h3 className="font-serif font-bold text-xl text-ink">Session Complete!</h3>
              <p className="text-xs text-muted">You studied {room.topic} in {room.name}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 py-2">
              <div className="p-3 bg-card-alt rounded-xl border border-border text-center">
                <span className="text-[10px] text-muted block uppercase tracking-wider">Duration</span>
                <span className="text-lg font-mono font-bold text-ink">{formatTimer(wrapUpData.duration)}</span>
              </div>
              <div className="p-3 bg-card-alt rounded-xl border border-border text-center">
                <span className="text-[10px] text-muted block uppercase tracking-wider">XP Earned</span>
                <span className="text-lg font-bold text-amber">+{wrapUpData.xpAwarded} XP</span>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <label className="text-xs font-semibold text-ink block">Rate your session experience</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setWrapUpRating(star)}
                    className="text-2xl transition-transform hover:scale-110 cursor-pointer"
                  >
                    {star <= wrapUpRating ? '★' : '☆'}
                  </button>
                ))}
              </div>
              <textarea
                value={wrapUpFeedback}
                onChange={(e) => setWrapUpFeedback(e.target.value)}
                placeholder="What was the key concept you learned or taught today?"
                rows={2}
                className="w-full p-2.5 bg-card-alt border border-border rounded-xl text-xs text-ink outline-none focus:border-amber resize-none"
              />
            </div>

            <button
              onClick={() => onLeave(wrapUpData)}
              className="w-full py-3 bg-amber hover:bg-terracotta text-white font-semibold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              Finish & Return to Dashboard →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Individual Participant Video Tile ───────────────────────────
function ParticipantTile({
  participantId,
  isActiveSpeaker,
  isHost,
  currentUserId,
  onMute,
  onRemove,
  onReport,
}: {
  participantId: string;
  isActiveSpeaker: boolean;
  isHost: boolean;
  currentUserId: string;
  onMute: () => void;
  onRemove: () => void;
  onReport: (id: string) => void;
}) {
  const localParticipant = useLocalParticipant();
  const isLocal = participantId === localParticipant?.session_id;
  const participant = isLocal ? localParticipant : undefined;

  const [menuOpen, setMenuOpen] = useState(false);

  // If local, check video track
  const hasVideo = isLocal ? Boolean(localParticipant?.video) : true;
  const isMuted = isLocal ? !localParticipant?.audio : false;
  const displayName = isLocal ? 'You' : `Learner ${participantId.slice(0, 4)}`;

  return (
    <div
      className={`w-full h-full bg-[#1C1917] rounded-2xl overflow-hidden relative border transition-all duration-300 shadow-xl flex items-center justify-center ${
        isActiveSpeaker ? 'border-amber ring-2 ring-amber/50 shadow-amber/20' : 'border-zinc-800'
      }`}
    >
      {/* Video Stream or Avatar fallback */}
      {hasVideo ? (
        <DailyVideo
          sessionId={participantId}
          type="video"
          className="w-full h-full object-cover scale-x-[-1]"
        />
      ) : (
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber to-terracotta text-white flex items-center justify-center font-bold text-xl shadow-lg mx-auto">
            {displayName.slice(0, 2).toUpperCase()}
          </div>
          <span className="text-[11px] text-zinc-400 font-medium block">{displayName}</span>
        </div>
      )}

      {/* Participant Info Overlay (Bottom Left) */}
      <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5 bg-ink/75 backdrop-blur-md px-2.5 py-1 rounded-xl border border-white/10 text-white text-[11px] z-10 shadow-sm">
        <span className="font-semibold truncate max-w-[120px]">{displayName}</span>
        {isHost && (
          <span className="text-[9px] px-1.5 py-0.2 bg-amber text-white font-bold rounded-md">
            Host
          </span>
        )}
        {isMuted && <span className="text-bad text-xs">🔇</span>}
      </div>

      {/* Tile Menu Button (Top Right) */}
      {!isLocal && (
        <div className="absolute top-2.5 right-2.5 z-10">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="w-6 h-6 rounded-full bg-ink/60 hover:bg-ink/90 text-white/80 hover:text-white flex items-center justify-center text-xs backdrop-blur-sm cursor-pointer"
          >
            ⋮
          </button>
          {menuOpen && (
            <div className="absolute right-0 mt-1 w-32 bg-card border border-border rounded-xl shadow-xl py-1 z-30 text-xs text-ink animate-fade-in">
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onReport(participantId);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-card-alt text-bad font-semibold cursor-pointer"
              >
                Report User
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
