'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import DailyIframe, { DailyCall } from '@daily-co/daily-js';
import CallDebugPanel, { ParticipantDebugState } from './CallDebugPanel';

interface DailyPrebuiltCallProps {
  roomName: string;
  roomUrl: string;
  token?: string;
  mode: 'voice' | 'video';
  callId?: string;
  currentUserName: string;
  currentUserEmail?: string;
  peerName: string;
  peerEmail?: string;
  onEndCall: (durationSeconds?: number) => void;
}

export default function DailyPrebuiltCall({
  roomName,
  roomUrl,
  token,
  mode,
  callId,
  currentUserName,
  currentUserEmail,
  peerName,
  peerEmail,
  onEndCall,
}: DailyPrebuiltCallProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const callFrameRef = useRef<DailyCall | null>(null);
  const frameCreatingRef = useRef<boolean>(false);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<string | null>(null);
  const [networkQuality, setNetworkQuality] = useState<string>('good');
  const [connectionState, setConnectionState] = useState<string>('connecting');
  const [participantsCount, setParticipantsCount] = useState<number>(1);
  const [callDuration, setCallDuration] = useState<number>(0);

  // Participant track states for ?calldebug=1
  const [localParticipantState, setLocalParticipantState] = useState<ParticipantDebugState>({
    name: currentUserName || 'You',
    isLocal: true,
    audioTrackState: 'live',
    videoTrackState: mode === 'voice' ? 'none' : 'live',
    screenShareState: 'none',
    audioLevel: 50,
  });

  const [remoteParticipantState, setRemoteParticipantState] = useState<ParticipantDebugState | null>(null);

  // Selected Devices
  const [selectedMic, setSelectedMic] = useState<string>('Daily Managed Mic');
  const [selectedCamera, setSelectedCamera] = useState<string>(mode === 'voice' ? 'Camera Off' : 'Daily Managed Camera');
  const [selectedSpeaker, setSelectedSpeaker] = useState<string>('System Default');

  // Call timer
  useEffect(() => {
    const timer = setInterval(() => setCallDuration((d) => d + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const isDailyHosted = Boolean(roomUrl && roomUrl.includes('.daily.co'));

  // ─── Destroy Call Frame Cleanly ───────────────────────────────
  const destroyCallFrame = useCallback(() => {
    if (callFrameRef.current) {
      try {
        callFrameRef.current.leave().catch(() => {});
        callFrameRef.current.destroy().catch(() => {});
      } catch (e) {}
      callFrameRef.current = null;
    }
    frameCreatingRef.current = false;
  }, []);

  // ─── Initialize Daily Prebuilt Frame ──────────────────────────
  const setupDailyFrame = useCallback(async (audioOnlyFallback = false) => {
    if (!containerRef.current) return;
    if (frameCreatingRef.current || callFrameRef.current) return;

    frameCreatingRef.current = true;
    setIsLoading(true);
    setErrorMessage(null);
    setErrorType(null);

    // If open WebRTC URL (non-Daily domain), iframe fallback will render
    if (!isDailyHosted) {
      setIsLoading(false);
      setConnectionState('connected');
      setParticipantsCount(2);
      frameCreatingRef.current = false;
      return;
    }

    try {
      // 1. Create Frame with Daily Prebuilt
      const frame = DailyIframe.createFrame(containerRef.current, {
        iframeStyle: {
          width: '100%',
          height: '100%',
          minHeight: '420px',
          border: '0',
          borderRadius: '16px',
        },
        showLeaveButton: false, // Shell provides its own Leave confirmation
        showFullscreenButton: true,
        theme: {
          colors: {
            accent: '#D97706', // Synapse amber
            accentText: '#FFFFFF',
            background: '#1C1917', // Synapse ink
            backgroundAccent: '#292524',
            baseText: '#F4F1EA',
            border: '#E8E3D8',
            mainAreaBg: '#1C1917',
            mainAreaBgAccent: '#292524',
          },
        },
      });

      callFrameRef.current = frame;

      // 2. Attach Event Handlers
      frame.on('joined-meeting', (event) => {
        setIsLoading(false);
        setConnectionState('connected');
        const participants = frame.participants();
        const pCount = Object.keys(participants).length;
        setParticipantsCount(Math.max(1, pCount));

        if (participants.local) {
          const lp = participants.local;
          setLocalParticipantState({
            name: lp.user_name || currentUserName || 'You',
            isLocal: true,
            audioTrackState: lp.audio ? 'live' : 'muted',
            videoTrackState: lp.video ? 'live' : 'muted',
            screenShareState: lp.screen ? 'sharing' : 'none',
            audioLevel: lp.audio ? 65 : 0,
          });
        }
      });

      frame.on('participant-joined', (event) => {
        const p = event.participant;
        setParticipantsCount((c) => Math.max(2, c + 1));
        if (p && !p.local) {
          setRemoteParticipantState({
            name: p.user_name || peerName || 'Remote Peer',
            isLocal: false,
            audioTrackState: p.audio ? 'live' : 'muted',
            videoTrackState: p.video ? 'live' : 'muted',
            screenShareState: p.screen ? 'sharing' : 'none',
            audioLevel: p.audio ? 60 : 0,
          });
        }
      });

      frame.on('participant-updated', (event) => {
        const p = event.participant;
        if (p) {
          if (p.local) {
            setLocalParticipantState((prev) => ({
              ...prev,
              audioTrackState: p.audio ? 'live' : 'muted',
              videoTrackState: p.video ? 'live' : 'muted',
              screenShareState: p.screen ? 'sharing' : 'none',
            }));
          } else {
            setRemoteParticipantState({
              name: p.user_name || peerName || 'Remote Peer',
              isLocal: false,
              audioTrackState: p.audio ? 'live' : 'muted',
              videoTrackState: p.video ? 'live' : 'muted',
              screenShareState: p.screen ? 'sharing' : 'none',
              audioLevel: p.audio ? 60 : 0,
            });
          }
        }
      });

      frame.on('participant-left', () => {
        setParticipantsCount(1);
        setRemoteParticipantState(null);
      });

      frame.on('network-quality-change', (event) => {
        const q = (event as any)?.quality || 'good';
        setNetworkQuality(q);
      });

      frame.on('network-connection', (event) => {
        const eventType = (event as any)?.event;
        if (eventType === 'interrupted') {
          setConnectionState('interrupted');
        } else if (eventType === 'connected') {
          setConnectionState('connected');
        }
      });

      frame.on('camera-error', (event) => {
        const err = (event as any)?.errorMsg?.errorMsg || 'Camera access error';
        setErrorType('camera');
        setErrorMessage(err);
      });

      frame.on('error', (event) => {
        const err = (event as any)?.errorMsg || 'Daily media connection error';
        setErrorMessage(err);
        setConnectionState('failed');
      });

      frame.on('left-meeting', () => {
        onEndCall(callDuration);
      });

      // 3. Join the Daily Room
      const startVideo = mode === 'video' && !audioOnlyFallback;
      await frame.join({
        url: roomUrl,
        token: token,
        userName: currentUserName,
        audioSource: true,
        videoSource: startVideo,
      });

      setIsLoading(false);
    } catch (err: any) {
      console.warn('[DailyPrebuiltCall] Join error:', err);
      setIsLoading(false);
      setConnectionState('failed');

      if (err.name === 'NotAllowedError' || err?.message?.includes('permission')) {
        setErrorType('permission');
        setErrorMessage(
          'Microphone or camera permission was denied. Please allow access in your browser settings (click the lock icon in your URL bar) and retry.'
        );
      } else if (err.name === 'NotReadableError' || err?.message?.includes('in use')) {
        setErrorType('busy');
        setErrorMessage(
          'Camera or microphone is currently in use by another tab or app. Please close other meeting apps and retry.'
        );
      } else {
        setErrorMessage(err.message || 'Could not join call room.');
      }
    } finally {
      frameCreatingRef.current = false;
    }
  }, [isDailyHosted, roomUrl, token, mode, currentUserName, peerName, onEndCall, callDuration]);

  // Mount effect with React StrictMode guard
  useEffect(() => {
    let isMounted = true;
    if (isMounted) {
      setupDailyFrame(false);
    }

    return () => {
      isMounted = false;
      destroyCallFrame();
    };
  }, [setupDailyFrame, destroyCallFrame]);

  // ─── Retry Handler ───────────────────────────────────────────
  const handleRetry = (audioOnly = false) => {
    destroyCallFrame();
    setTimeout(() => {
      setupDailyFrame(audioOnly);
    }, 200);
  };

  const isHttps = typeof window !== 'undefined' ? window.location.protocol === 'https:' : false;
  const isDisplayMediaSupported =
    typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getDisplayMedia);

  return (
    <div className="w-full h-full flex flex-col bg-[#1C1917] rounded-2xl overflow-hidden relative">
      {/* ─── Step 4: Call Diagnostics Panel (?calldebug=1) ─────────── */}
      <CallDebugPanel
        roomName={roomName}
        callId={callId}
        connectionState={connectionState}
        iceConnectionState={networkQuality}
        relayType={isDailyHosted ? 'Daily Prebuilt Managed SFU/Relay' : 'OpenRelay WebRTC Stage'}
        lastError={errorMessage}
        localParticipant={localParticipantState}
        remoteParticipant={remoteParticipantState}
        selectedMic={selectedMic}
        selectedCamera={selectedCamera}
        selectedSpeaker={selectedSpeaker}
        isHttps={isHttps}
        isDisplayMediaSupported={isDisplayMediaSupported}
      />

      {/* ─── Step 5: Clear Error Screen When Something Goes Wrong ──── */}
      {errorMessage && (
        <div className="absolute inset-0 z-30 bg-[#1C1917]/95 flex items-center justify-center p-6 text-center animate-fade-in">
          <div className="bg-card border border-border rounded-[24px] max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-full bg-bad/15 text-bad flex items-center justify-center text-2xl mx-auto">
              {errorType === 'permission' ? '🔒' : errorType === 'busy' ? '📹' : '⚠️'}
            </div>

            <div className="space-y-1">
              <h3 className="font-serif font-bold text-base text-ink">
                {errorType === 'permission'
                  ? 'Permission Required'
                  : errorType === 'busy'
                  ? 'Hardware Busy'
                  : 'Connection Issue'}
              </h3>
              <p className="text-xs text-muted leading-relaxed">{errorMessage}</p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={() => handleRetry(false)}
                className="w-full py-2.5 bg-amber hover:bg-amber-600 text-ink font-bold text-xs rounded-xl shadow-md cursor-pointer transition-colors"
              >
                🔄 Retry
              </button>

              {errorType === 'permission' && (
                <button
                  onClick={() => handleRetry(true)}
                  className="w-full py-2 bg-card-alt border border-border hover:border-amber text-ink font-semibold text-xs rounded-xl cursor-pointer"
                >
                  🎙️ Join with Audio Only
                </button>
              )}

              <button
                onClick={() => onEndCall(callDuration)}
                className="w-full py-2 text-xs font-semibold text-muted hover:text-ink cursor-pointer"
              >
                Leave Call
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Network Interrupted Warning ─────────────────────────── */}
      {connectionState === 'interrupted' && !errorMessage && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 bg-amber/90 text-ink font-bold text-xs px-4 py-1.5 rounded-full shadow-lg border border-amber flex items-center gap-2 animate-pulse">
          <span>📡</span> Reconnecting to peer...
        </div>
      )}

      {/* ─── Loading Spinner ─────────────────────────────────────── */}
      {isLoading && !errorMessage && (
        <div className="absolute inset-0 z-20 bg-[#1C1917] flex flex-col items-center justify-center gap-3 text-white">
          <div className="w-10 h-10 border-3 border-amber border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-zinc-300 font-mono">Initializing Daily Call Window...</p>
        </div>
      )}

      {/* ─── Call Window Container (Daily Prebuilt Frame) ─────────── */}
      {isDailyHosted ? (
        <div
          ref={containerRef}
          className="w-full h-full flex-1 relative overflow-hidden"
          style={{ minHeight: '420px' }}
        />
      ) : (
        /* Zero-config open WebRTC iframe fallback if no DAILY_API_KEY is present */
        <iframe
          src={roomUrl}
          allow="camera; microphone; display-capture; autoplay; clipboard-write"
          className="w-full h-full flex-1 border-0 rounded-2xl"
          style={{ minHeight: '420px' }}
          title={`Call with ${peerName}`}
        />
      )}
    </div>
  );
}
