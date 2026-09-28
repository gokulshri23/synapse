'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import CallDebugPanel, { ParticipantDebugState } from './CallDebugPanel';

interface NativeCallViewProps {
  mode: 'voice' | 'video';
  peerName: string;
  peerAvatar?: string;
  currentUserName: string;
  currentUserEmail?: string;
  peerEmail?: string;
  sessionId: string;
  callId?: string;
  roomName?: string;
  isInitiator?: boolean;
  onEndCall: (durationSeconds?: number) => void;
}

// Enterprise-grade STUN and free TURN relay servers (OpenRelay / Metered / Google / Cloudflare)
const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'stun:openrelay.metered.ca:80' },
  { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turns:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
];

export default function NativeCallView({
  mode,
  peerName,
  peerAvatar,
  currentUserName,
  currentUserEmail,
  peerEmail,
  sessionId,
  callId,
  roomName,
  isInitiator,
  onEndCall,
}: NativeCallViewProps) {
  // Call Controls State
  const [micMuted, setMicMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(mode === 'voice');
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isRemoteScreenSharing, setIsRemoteScreenSharing] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  // Connection & Media States
  const [connectionState, setConnectionState] = useState<string>('connecting');
  const [iceConnectionState, setIceConnectionState] = useState<string>('new');
  const [peerConnected, setPeerConnected] = useState(false);
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);
  const [remoteAudioActive, setRemoteAudioActive] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  // Real-time Audio Levels (0-100)
  const [localAudioLevel, setLocalAudioLevel] = useState(0);
  const [remoteAudioLevel, setRemoteAudioLevel] = useState(0);

  // Errors & Retry
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [screenShareError, setScreenShareError] = useState<string | null>(null);

  // Selected Hardware Devices
  const [selectedMic, setSelectedMic] = useState<string>('');
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const [selectedSpeaker, setSelectedSpeaker] = useState<string>('');

  // Video / Audio Refs
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);

  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);

  // PeerJS Refs
  const peerInstanceRef = useRef<any>(null);
  const activeCallRef = useRef<any>(null);
  const callRetryTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Audio meters
  const localAudioCtxRef = useRef<AudioContext | null>(null);
  const remoteAudioCtxRef = useRef<AudioContext | null>(null);
  const localAnimRef = useRef<number | null>(null);
  const remoteAnimRef = useRef<number | null>(null);

  const effectiveRoomName = roomName || sessionId;
  const myId = (currentUserEmail || currentUserName || 'user').toLowerCase().trim();
  const targetPeerId = (peerEmail || peerName || 'peer').toLowerCase().trim();

  const cleanRoom = (effectiveRoomName || 'call_room').toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 32);
  const jitsiUrl = `https://meet.jit.si/synapse_${cleanRoom}`;

  // Screen share availability check (desktop only, missing on mobile)
  const isDisplayMediaSupported =
    typeof navigator !== 'undefined' &&
    Boolean(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);

  const isHttps =
    typeof window !== 'undefined' ? window.location.protocol === 'https:' : false;

  const callDurationRef = useRef<number>(0);
  const onEndCallRef = useRef(onEndCall);
  useEffect(() => {
    onEndCallRef.current = onEndCall;
  }, [onEndCall]);

  // ─── Call Duration Counter ──────────────────────────────────
  useEffect(() => {
    const timer = setInterval(() => {
      setCallDuration((d) => {
        const next = d + 1;
        callDurationRef.current = next;
        return next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // ─── Device Enumeration for Debug Panel ──────────────────────
  const refreshDevices = useCallback(async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const mic = devices.find((d) => d.kind === 'audioinput');
        const cam = devices.find((d) => d.kind === 'videoinput');
        const spk = devices.find((d) => d.kind === 'audiooutput');
        if (mic) setSelectedMic(mic.label || 'Default Microphone');
        if (cam) setSelectedCamera(cam.label || 'Default Camera');
        if (spk) setSelectedSpeaker(spk.label || 'Default Speaker');
      }
    } catch (e) {}
  }, []);

  // ─── Helper to Safely Unlock Remote Audio Playback ────────────
  const triggerAudioPlayback = useCallback(() => {
    if (remoteAudioRef.current) {
      remoteAudioRef.current
        .play()
        .then(() => setAutoplayBlocked(false))
        .catch(() => {});
    }
    if (remoteVideoRef.current && remoteVideoRef.current.srcObject) {
      remoteVideoRef.current.play().catch(() => {});
    }
  }, []);

  // ─── Setup Audio Analysers for Local Mic & Remote Audio ───────
  const setupLocalAudioMeter = useCallback((stream: MediaStream) => {
    try {
      if (localAnimRef.current) cancelAnimationFrame(localAnimRef.current);
      if (localAudioCtxRef.current) localAudioCtxRef.current.close().catch(() => {});

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx || stream.getAudioTracks().length === 0) return;

      const ctx = new AudioCtx();
      localAudioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);

      const buffer = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) sum += buffer[i];
        const avg = sum / buffer.length;
        setLocalAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
        localAnimRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch (e) {}
  }, []);

  const setupRemoteAudioMeter = useCallback((stream: MediaStream) => {
    try {
      if (remoteAnimRef.current) cancelAnimationFrame(remoteAnimRef.current);
      if (remoteAudioCtxRef.current) remoteAudioCtxRef.current.close().catch(() => {});

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx || stream.getAudioTracks().length === 0) return;

      const ctx = new AudioCtx();
      remoteAudioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);

      const buffer = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) sum += buffer[i];
        const avg = sum / buffer.length;
        setRemoteAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
        remoteAnimRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch (e) {}
  }, []);

  // ─── Initialize Media & PeerJS P2P Connection ────────────────
  const initConnection = useCallback(async (audioOnly = false) => {
    setPermissionError(null);

    let stream: MediaStream | null = null;
    try {
      const wantVideo = mode === 'video' && !audioOnly;
      stream = await navigator.mediaDevices.getUserMedia({
        video: wantVideo
          ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }
          : false,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      if (audioOnly) setVideoOff(true);
    } catch (err: any) {
      console.warn('[CallMedia] Initial getUserMedia error:', err);
      // Fallback: try audio-only if video failed
      if (mode === 'video' && !audioOnly) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          });
          setVideoOff(true);
        } catch (audioErr: any) {
          err = audioErr;
        }
      }

      if (!stream) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setPermissionError(
            'Microphone or camera permission was denied. Click the lock/tune icon in your address bar to allow permissions, then tap Retry.'
          );
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          setPermissionError('No microphone or camera was detected on this device.');
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          setPermissionError(
            'Camera or microphone is already in use by another application or browser tab.'
          );
        } else {
          setPermissionError(err.message || 'Could not access media devices.');
        }
        setConnectionState('failed');
        return;
      }
    }

    localStreamRef.current = stream;
    if (localVideoRef.current && stream.getVideoTracks().length > 0) {
      localVideoRef.current.srcObject = stream;
      localVideoRef.current.play().catch(() => {});
    }

    setupLocalAudioMeter(stream);
    refreshDevices();

    // ─── Connect via PeerJS (No Login, Pure P2P WebRTC) ────────
    try {
      const { default: Peer } = await import('peerjs');

      const amIInitiator = typeof isInitiator === 'boolean' ? isInitiator : myId < targetPeerId;
      const myPeerId = `syn_${cleanRoom}_${amIInitiator ? 'caller' : 'callee'}`;
      const remotePeerId = `syn_${cleanRoom}_${amIInitiator ? 'callee' : 'caller'}`;

      const peer = new Peer(myPeerId, {
        config: {
          iceServers: ICE_SERVERS,
        },
        debug: 1,
      });
      peerInstanceRef.current = peer;

      const handleRemoteStream = (remoteStream: MediaStream) => {
        remoteStreamRef.current = remoteStream;

        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
          remoteVideoRef.current.playsInline = true;
          remoteVideoRef.current.autoplay = true;
          remoteVideoRef.current.play().catch(() => {});
        }

        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = remoteStream;
          remoteAudioRef.current.autoplay = true;
          remoteAudioRef.current.muted = false;
          remoteAudioRef.current.setAttribute('playsinline', 'true');
          const p = remoteAudioRef.current.play();
          if (p !== undefined) {
            p.then(() => {
              setAutoplayBlocked(false);
              setRemoteAudioActive(true);
            }).catch(() => {
              setAutoplayBlocked(true);
            });
          }
        }

        setupRemoteAudioMeter(remoteStream);
        const hasLiveVideo = remoteStream.getVideoTracks().some((t) => t.enabled && t.readyState === 'live');
        setHasRemoteVideo(hasLiveVideo);
        setRemoteAudioActive(remoteStream.getAudioTracks().length > 0);
        setPeerConnected(true);
        setConnectionState('connected');

        if (callRetryTimerRef.current) {
          clearInterval(callRetryTimerRef.current);
          callRetryTimerRef.current = null;
        }
      };

      peer.on('open', () => {
        setConnectionState('ready');

        if (amIInitiator) {
          const makeCall = () => {
            if (peerConnected || peer.destroyed) return;
            try {
              const call = peer.call(remotePeerId, stream);
              if (call) {
                activeCallRef.current = call;
                call.on('stream', handleRemoteStream);
                call.on('close', () => {
                  onEndCallRef.current(callDurationRef.current);
                });
                call.on('error', () => {});
              }
            } catch (e) {}
          };

          makeCall();
          callRetryTimerRef.current = setInterval(makeCall, 2000);
        }
      });

      peer.on('call', (incomingCall) => {
        incomingCall.answer(stream);
        activeCallRef.current = incomingCall;
        incomingCall.on('stream', handleRemoteStream);
        incomingCall.on('close', () => {
          onEndCallRef.current(callDurationRef.current);
        });
        incomingCall.on('error', () => {});
      });

      peer.on('error', (err: any) => {
        // peer-unavailable means the other peer hasn't answered yet; interval will retry
        if (err.type !== 'peer-unavailable') {
          console.warn('[PeerJS] Notice:', err.type, err.message);
        }
      });
    } catch (e: any) {
      console.warn('[PeerJS] Init error:', e);
    }
  }, [mode, myId, targetPeerId, cleanRoom, isInitiator, setupLocalAudioMeter, setupRemoteAudioMeter, refreshDevices, peerConnected]);

  // Mount media & Peer connection strictly once on mount
  useEffect(() => {
    initConnection();

    return () => {
      if (callRetryTimerRef.current) {
        clearInterval(callRetryTimerRef.current);
        callRetryTimerRef.current = null;
      }
      if (localAnimRef.current) cancelAnimationFrame(localAnimRef.current);
      if (remoteAnimRef.current) cancelAnimationFrame(remoteAnimRef.current);
      if (localAudioCtxRef.current) localAudioCtxRef.current.close().catch(() => {});
      if (remoteAudioCtxRef.current) remoteAudioCtxRef.current.close().catch(() => {});
      if (activeCallRef.current) {
        try {
          activeCallRef.current.close();
        } catch (e) {}
      }
      if (peerInstanceRef.current) {
        try {
          peerInstanceRef.current.destroy();
        } catch (e) {}
      }
      if (localStreamRef.current) localStreamRef.current.getTracks().forEach((t) => t.stop());
      if (screenStreamRef.current) screenStreamRef.current.getTracks().forEach((t) => t.stop());
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ensure local video element rebinds when camera toggles
  useEffect(() => {
    if (localVideoRef.current && localStreamRef.current && mode === 'video' && !videoOff) {
      if (localVideoRef.current.srcObject !== localStreamRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
        localVideoRef.current.play().catch(() => {});
      }
    }
  }, [videoOff, mode]);

  // ─── Handle Microphone Mute / Unmute ──────────────────────────
  const toggleMic = () => {
    triggerAudioPlayback();
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      const nextMuted = !micMuted;
      audioTracks.forEach((t) => (t.enabled = !nextMuted));
      setMicMuted(nextMuted);
    }
  };

  // ─── Handle Camera Toggle ────────────────────────────────────
  const toggleCamera = async () => {
    triggerAudioPlayback();
    if (videoOff) {
      try {
        if (!localStreamRef.current?.getVideoTracks().length) {
          const videoStream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
          });
          const newVideoTrack = videoStream.getVideoTracks()[0];
          localStreamRef.current?.addTrack(newVideoTrack);

          if (activeCallRef.current?.peerConnection) {
            const senders = activeCallRef.current.peerConnection.getSenders();
            const videoSender = senders.find((s: any) => s.track && s.track.kind === 'video');
            if (videoSender) {
              await videoSender.replaceTrack(newVideoTrack);
            }
          }
        } else {
          localStreamRef.current.getVideoTracks().forEach((t) => (t.enabled = true));
        }

        if (localVideoRef.current && localStreamRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }
        setVideoOff(false);
        refreshDevices();
      } catch (e: any) {
        setPermissionError('Could not enable camera: ' + (e.message || 'Permission denied'));
      }
    } else {
      localStreamRef.current?.getVideoTracks().forEach((t) => (t.enabled = false));
      setVideoOff(true);
    }
  };

  // ─── Handle Screen Share ─────────────────────────────────────
  const toggleScreenShare = async () => {
    triggerAudioPlayback();

    if (isScreenSharing) {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = null;
      }
      const camTrack = localStreamRef.current?.getVideoTracks()[0] || null;
      if (activeCallRef.current?.peerConnection && camTrack) {
        const senders = activeCallRef.current.peerConnection.getSenders();
        const videoSender = senders.find((s: any) => s.track && s.track.kind === 'video');
        if (videoSender) {
          await videoSender.replaceTrack(camTrack);
        }
      }
      setIsScreenSharing(false);
      return;
    }

    let displayStream: MediaStream;
    try {
      displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' } as any,
        audio: false,
      });
    } catch (err: any) {
      if (err.name !== 'NotAllowedError' && err.name !== 'AbortError') {
        setScreenShareError(err.message || 'Screen sharing could not start.');
      }
      return;
    }

    const screenTrack = displayStream.getVideoTracks()[0];
    if (!screenTrack) return;

    screenStreamRef.current = displayStream;
    if (screenVideoRef.current) {
      screenVideoRef.current.srcObject = displayStream;
      screenVideoRef.current.play().catch(() => {});
    }

    if (activeCallRef.current?.peerConnection) {
      const senders = activeCallRef.current.peerConnection.getSenders();
      const videoSender = senders.find((s: any) => s.track && s.track.kind === 'video');
      if (videoSender) {
        await videoSender.replaceTrack(screenTrack);
      }
    }

    setIsScreenSharing(true);
    setScreenShareError(null);

    screenTrack.onended = async () => {
      setIsScreenSharing(false);
      screenStreamRef.current = null;
      const camTrack = localStreamRef.current?.getVideoTracks()[0] || null;
      if (activeCallRef.current?.peerConnection && camTrack) {
        const senders = activeCallRef.current.peerConnection.getSenders();
        const videoSender = senders.find((s: any) => s.track && s.track.kind === 'video');
        if (videoSender) {
          await videoSender.replaceTrack(camTrack);
        }
      }
    };
  };

  const handleLocalEndCall = () => {
    onEndCallRef.current(callDurationRef.current);
  };

  const peerInitials = peerName
    ? peerName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'P';

  // Debug state
  const localParticipantDebug: ParticipantDebugState = {
    name: currentUserName || 'You',
    isLocal: true,
    audioTrackState: micMuted ? 'muted' : localStreamRef.current?.getAudioTracks().length ? 'live' : 'none',
    videoTrackState: videoOff ? 'muted' : localStreamRef.current?.getVideoTracks().some((t) => t.enabled) ? 'live' : 'none',
    screenShareState: isScreenSharing ? 'sharing' : 'none',
    audioLevel: micMuted ? 0 : localAudioLevel,
  };

  const remoteParticipantDebug: ParticipantDebugState | null = peerConnected
    ? {
        name: peerName || 'Remote Peer',
        isLocal: false,
        audioTrackState: remoteAudioActive ? 'live' : 'muted',
        videoTrackState: hasRemoteVideo ? 'live' : 'muted',
        screenShareState: isRemoteScreenSharing ? 'sharing' : 'none',
        audioLevel: remoteAudioLevel,
      }
    : null;

  return (
    <div
      onClick={triggerAudioPlayback}
      className="w-full h-full flex flex-col bg-[#1C1917] text-white rounded-2xl overflow-hidden relative select-none"
    >
      {/* ─── Call Debug Overlay (?calldebug=1) ──────────────── */}
      <CallDebugPanel
        roomName={cleanRoom}
        callId={callId}
        connectionState={connectionState}
        iceConnectionState={iceConnectionState}
        relayType="Direct P2P PeerJS"
        lastError={permissionError || screenShareError}
        localParticipant={localParticipantDebug}
        remoteParticipant={remoteParticipantDebug}
        selectedMic={selectedMic}
        selectedCamera={selectedCamera}
        selectedSpeaker={selectedSpeaker}
        isHttps={isHttps}
        isDisplayMediaSupported={isDisplayMediaSupported}
      />

      {/* ─── Remote Audio Playback Element (Plays unmuted stream) ──── */}
      <audio
        ref={remoteAudioRef}
        autoPlay
        playsInline
        style={{ position: 'fixed', top: '-1000px', left: '-1000px', opacity: 0, pointerEvents: 'none' }}
      />

      {/* ─── Autoplay Blocked Banner with Tap to Enable Sound ─────── */}
      {autoplayBlocked && (
        <button
          onClick={triggerAudioPlayback}
          className="absolute top-14 left-1/2 -translate-x-1/2 z-40 bg-amber hover:bg-amber-600 text-ink font-bold px-4 py-2 rounded-xl shadow-2xl flex items-center gap-2 text-xs cursor-pointer animate-bounce border border-amber/40"
        >
          <span>🔊</span> Tap to enable sound
        </button>
      )}

      {/* ─── Top HUD ──────────────────────────────────────────────── */}
      <div className="absolute top-3 left-3 right-3 z-20 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2 bg-ink/80 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/10 shadow-lg pointer-events-auto">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              peerConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400 animate-ping'
            }`}
          />
          <span className="text-xs font-semibold text-white/90">
            {mode === 'voice' ? 'Voice Call' : 'Video Call'} • {peerName}
          </span>
          <span className="text-[10px] text-emerald-400 font-mono font-bold bg-emerald-950/60 px-2 py-0.5 rounded-full">
            {formatTime(callDuration)}
          </span>
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          {/* External Jitsi Fallback Link */}
          <a
            href={jitsiUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 bg-ink/80 hover:bg-zinc-800 text-zinc-300 hover:text-white px-3 py-1.5 rounded-full border border-white/10 text-[11px] font-semibold transition-all backdrop-blur-md shadow-lg cursor-pointer"
            title="Open in Jitsi Meet in a new browser tab"
          >
            <span>🌐</span>
            <span>Open in Jitsi</span>
          </a>

          <div className="flex items-center gap-1.5 bg-ink/80 backdrop-blur-md px-2.5 py-1.5 rounded-full border border-white/10 text-[11px] text-zinc-300">
            <span className="text-emerald-400">🔒</span>
            <span className="hidden sm:inline">P2P Encrypted</span>
          </div>
        </div>
      </div>

      {/* ─── Main Video / Screen Area ─────────────────────────────── */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden p-3 pt-14 pb-20">
        {permissionError && (
          <div className="absolute top-14 left-4 right-4 z-30 bg-amber/95 text-ink text-xs p-3 rounded-xl border border-amber font-medium shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-2 animate-slide-down">
            <span>{permissionError}</span>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => initConnection(false)}
                className="px-3 py-1 bg-ink text-white text-[11px] font-bold rounded-lg hover:bg-zinc-800 cursor-pointer"
              >
                Retry
              </button>
              <button
                onClick={() => initConnection(true)}
                className="px-3 py-1 bg-white/20 text-ink text-[11px] font-bold rounded-lg hover:bg-white/30 cursor-pointer"
              >
                Audio Only
              </button>
            </div>
          </div>
        )}

        {/* Screen Share Stage (if active on local machine) */}
        {isScreenSharing ? (
          <div className="w-full h-full rounded-2xl overflow-hidden bg-black/80 relative border border-white/10 flex items-center justify-center aspect-video min-h-[220px]">
            <video
              ref={screenVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-contain"
            />
            <div className="absolute top-2 left-2 bg-ink/80 text-white text-[11px] px-2.5 py-1 rounded-lg backdrop-blur-md border border-white/10">
              🖥️ You are sharing your screen
            </div>
          </div>
        ) : (
          /* Normal Call Stage */
          <div className="w-full h-full flex flex-col md:flex-row items-center justify-center gap-3">
            {/* Peer Stage (aspect ratio 16/9, min-height 220px) */}
            <div className="flex-1 w-full h-full max-h-[380px] min-h-[220px] aspect-video bg-zinc-900 rounded-2xl border border-white/10 relative overflow-hidden flex items-center justify-center shadow-xl">
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className={`w-full h-full object-contain aspect-video ${
                  hasRemoteVideo ? 'block' : 'hidden'
                }`}
              />

              {/* Peer Avatar / Voice Card fallback (active when video is off) */}
              {!hasRemoteVideo && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-gradient-to-b from-zinc-900/60 via-zinc-900/90 to-zinc-950">
                  <div className="relative mb-3">
                    <div
                      className="w-24 h-24 rounded-full bg-gradient-to-tr from-amber to-terracotta text-white flex items-center justify-center text-3xl font-bold shadow-2xl ring-4 ring-white/10 transition-transform duration-100"
                      style={{
                        transform: `scale(${1 + Math.min(0.25, (remoteAudioLevel / 100) * 0.25)})`,
                      }}
                    >
                      {peerInitials}
                    </div>
                    {/* Active speaking wave ring driven by live audio level */}
                    {peerConnected && remoteAudioLevel > 5 && (
                      <div className="absolute inset-0 rounded-full border-2 border-emerald-400 animate-ping opacity-60" />
                    )}
                  </div>
                  <h3 className="text-base font-serif font-bold text-white mb-0.5">{peerName}</h3>
                  <p className="text-xs text-emerald-400 flex items-center gap-1.5 justify-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    {peerConnected ? 'Live Connection Active' : 'Connecting to peer...'}
                  </p>
                  <div className="mt-4 flex items-center gap-1.5">
                    <span className="text-[10px] text-zinc-400 uppercase tracking-widest font-mono">
                      Live Audio
                    </span>
                    <div className="flex gap-1 h-3.5 items-end">
                      {[0.3, 0.7, 0.4, 0.9, 0.5, 0.8].map((h, i) => (
                        <span
                          key={i}
                          className="w-1 bg-emerald-400 rounded-full transition-all duration-75"
                          style={{
                            height: `${Math.max(15, Math.min(100, remoteAudioLevel * h * 1.5))}%`,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Bottom Peer Badge */}
              <div className="absolute bottom-2.5 left-2.5 bg-ink/80 backdrop-blur-md px-2.5 py-1 rounded-lg text-[11px] font-semibold text-white/90 border border-white/10 flex items-center gap-1.5">
                <span>{peerName}</span>
                {isRemoteScreenSharing && (
                  <span className="text-[9px] bg-amber/30 text-amber-300 px-1.5 py-0.5 rounded font-bold">
                    Screen Sharing
                  </span>
                )}
              </div>
            </div>

            {/* Local Video Stage (PiP / Side tile, aspect ratio 16/9, min-height 140px) */}
            <div className="w-44 h-32 md:w-56 md:h-full md:max-h-[380px] min-h-[140px] aspect-video bg-zinc-950 rounded-2xl border border-white/10 relative overflow-hidden flex items-center justify-center shadow-xl shrink-0">
              {mode === 'video' && !videoOff ? (
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover aspect-video scale-x-[-1]"
                />
              ) : (
                <div className="text-center p-3">
                  <div className="w-12 h-12 rounded-full bg-amber/20 text-amber flex items-center justify-center text-lg font-bold mx-auto mb-1 border border-amber/30">
                    You
                  </div>
                  <span className="text-[10px] text-zinc-400 block">Camera off</span>
                </div>
              )}

              {/* Local status tag */}
              <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between bg-ink/80 backdrop-blur-md px-2 py-1 rounded-lg text-[10px] border border-white/10">
                <span className="font-semibold text-white/90">You</span>
                <div className="flex items-center gap-1">
                  {micMuted ? (
                    <span className="text-bad">🔇</span>
                  ) : (
                    <div
                      className="w-2.5 h-2.5 rounded-full bg-emerald-400 transition-transform duration-75"
                      style={{ transform: `scale(${1 + localAudioLevel / 50})` }}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── Floating Bottom Control Bar ──────────────────────────── */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 bg-zinc-900/90 backdrop-blur-xl px-5 py-2.5 rounded-full border border-white/15 shadow-2xl">
        {/* Mic Button */}
        <button
          onClick={toggleMic}
          className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all cursor-pointer ${
            micMuted
              ? 'bg-bad text-white shadow-bad/40 shadow-lg'
              : 'bg-white/10 text-white hover:bg-white/20'
          }`}
          title={micMuted ? 'Unmute Microphone' : 'Mute Microphone'}
        >
          {micMuted ? '🔇' : '🎙️'}
        </button>

        {/* Video Button */}
        <button
          onClick={toggleCamera}
          className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all cursor-pointer ${
            videoOff
              ? 'bg-zinc-800 text-zinc-400 hover:text-white'
              : 'bg-white/10 text-white hover:bg-white/20'
          }`}
          title={videoOff ? 'Turn On Camera' : 'Turn Off Camera'}
        >
          {videoOff ? '📷' : '📹'}
        </button>

        {/* Screen Share Button (Desktop Only: hidden on phones where getDisplayMedia is missing) */}
        {isDisplayMediaSupported && (
          <button
            onClick={toggleScreenShare}
            className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all cursor-pointer ${
              isScreenSharing
                ? 'bg-amber text-white shadow-amber/40 shadow-lg'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
            title={isScreenSharing ? 'Stop Sharing Screen' : 'Share Screen'}
          >
            🖥️
          </button>
        )}

        <div className="w-[1px] h-6 bg-white/20 mx-1" />

        {/* End Call Button */}
        <button
          onClick={handleLocalEndCall}
          className="px-5 py-2 rounded-full bg-bad hover:bg-red-700 text-white font-bold text-xs shadow-lg transition-colors cursor-pointer flex items-center gap-1.5"
        >
          <span>✕</span> End Call
        </button>
      </div>
    </div>
  );
}
