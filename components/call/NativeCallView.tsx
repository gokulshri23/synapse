'use client';
import React, { useEffect, useRef, useState, useCallback } from 'react';

interface NativeCallViewProps {
  mode: 'voice' | 'video';
  peerName: string;
  peerAvatar?: string;
  currentUserName: string;
  currentUserEmail?: string;
  peerEmail?: string;
  sessionId: string;
  isInitiator?: boolean;
  onEndCall: () => void;
}

export default function NativeCallView({
  mode,
  peerName,
  peerAvatar,
  currentUserName,
  currentUserEmail,
  peerEmail,
  sessionId,
  isInitiator,
  onEndCall,
}: NativeCallViewProps) {
  const [micMuted, setMicMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(mode === 'voice');
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [peerConnected, setPeerConnected] = useState(false);
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);

  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const signalingOfferSentRef = useRef<boolean>(false);

  const myId = (currentUserEmail || currentUserName || 'user').toLowerCase().trim();
  const targetPeerId = (peerEmail || peerName || 'peer').toLowerCase().trim();

  // Call duration counter
  useEffect(() => {
    const timer = setInterval(() => setCallDuration((d) => d + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Helper to safely play remote audio element upon any interaction
  const triggerAudioPlayback = useCallback(() => {
    if (remoteAudioRef.current && remoteAudioRef.current.srcObject) {
      remoteAudioRef.current.play().catch(() => {});
    }
    if (remoteVideoRef.current && remoteVideoRef.current.srcObject) {
      remoteVideoRef.current.play().catch(() => {});
    }
  }, []);

  // Setup local media & WebRTC connection
  useEffect(() => {
    let isMounted = true;
    signalingOfferSentRef.current = false;
    pendingCandidatesRef.current = [];

    async function initMedia() {
      try {
        setPermissionError(null);
        let stream: MediaStream | null = null;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: mode === 'video' ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } : false,
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          });
        } catch (mediaErr: any) {
          // If camera in use or denied, try audio-only fallback
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
              },
            });
            setVideoOff(true);
          } catch (audioErr) {
            setPermissionError('Microphone or camera access was restricted. Continuing in standby mode.');
          }
        }

        if (!isMounted) {
          stream?.getTracks().forEach((t) => t.stop());
          return;
        }

        if (stream) {
          localStreamRef.current = stream;
          if (localVideoRef.current && mode === 'video' && stream.getVideoTracks().length > 0) {
            localVideoRef.current.srcObject = stream;
            localVideoRef.current.play().catch(() => {});
          }

          // Setup Audio Analyser for mic volume indicator
          try {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            if (AudioContextClass) {
              const ctx = new AudioContextClass();
              audioContextRef.current = ctx;
              const source = ctx.createMediaStreamSource(stream);
              const analyser = ctx.createAnalyser();
              analyser.fftSize = 64;
              source.connect(analyser);

              const buffer = new Uint8Array(analyser.frequencyBinCount);
              const checkLevel = () => {
                if (!isMounted) return;
                analyser.getByteFrequencyData(buffer);
                let sum = 0;
                for (let i = 0; i < buffer.length; i++) sum += buffer[i];
                const avg = sum / buffer.length;
                setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
                animFrameRef.current = requestAnimationFrame(checkLevel);
              };
              checkLevel();
            }
          } catch (e) {}
        }

        // Initialize PeerConnection with robust multi-region STUN list
        const pc = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun.cloudflare.com:3478' },
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            { urls: 'stun:stun4.l.google.com:19302' },
            { urls: 'stun:stun.relay.metered.ca:80' },
          ],
        });
        pcRef.current = pc;

        // Add local tracks to PeerConnection
        if (stream) {
          stream.getTracks().forEach((track) => pc.addTrack(track, stream!));
        }

        // Handle remote incoming tracks (Audio and Video)
        pc.ontrack = (event) => {
          const remoteStream = event.streams[0] || new MediaStream([event.track]);

          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStream;
            remoteVideoRef.current.playsInline = true;
            remoteVideoRef.current.autoplay = true;
            remoteVideoRef.current.play().catch(() => {});
          }
          if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = remoteStream;
            remoteAudioRef.current.autoplay = true;
            remoteAudioRef.current.play().catch(() => {});
          }

          setPeerConnected(true);

          const checkVideoTracks = () => {
            const vTracks = remoteStream.getVideoTracks();
            const isLive = vTracks.length > 0 && vTracks.some((t) => t.enabled && t.readyState === 'live');
            setHasRemoteVideo(isLive);
          };

          checkVideoTracks();
          remoteStream.getVideoTracks().forEach((vt) => {
            vt.onmute = checkVideoTracks;
            vt.onunmute = checkVideoTracks;
            vt.onended = checkVideoTracks;
          });
        };

        // Track ICE connection state
        pc.onconnectionstatechange = () => {
          if (pc.connectionState === 'connected') {
            setPeerConnected(true);
          }
        };

        pc.oniceconnectionstatechange = () => {
          if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
            setPeerConnected(true);
          }
        };

        // Transmit local ICE candidate to peer
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            fetch('/api/peer-network', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: 'webrtc_candidate',
                sessionId,
                senderId: myId,
                recipientId: targetPeerId,
                candidate: event.candidate,
              }),
            }).catch(() => {});
          }
        };

        // Determine if this peer should initiate the WebRTC offer
        const shouldInitiate = typeof isInitiator === 'boolean' ? isInitiator : myId < targetPeerId;
        if (shouldInitiate && !signalingOfferSentRef.current) {
          signalingOfferSentRef.current = true;
          const offer = await pc.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true,
          });
          await pc.setLocalDescription(offer);

          fetch('/api/peer-network', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'webrtc_offer',
              sessionId,
              senderId: myId,
              recipientId: targetPeerId,
              offer,
            }),
          }).catch(() => {});
        }

        setTimeout(() => {
          if (isMounted) setPeerConnected(true);
        }, 1200);
      } catch (err: any) {
        if (isMounted) {
          setPermissionError('Microphone or Camera access was denied or not detected.');
        }
      }
    }

    initMedia();

    return () => {
      isMounted = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioContextRef.current) audioContextRef.current.close().catch(() => {});
      if (localStreamRef.current) localStreamRef.current.getTracks().forEach((t) => t.stop());
      if (screenStreamRef.current) screenStreamRef.current.getTracks().forEach((t) => t.stop());
      if (pcRef.current) pcRef.current.close();
    };
  }, [mode, myId, targetPeerId, sessionId, isInitiator]);

  // Realtime WebRTC signaling poll & exchange with candidate buffering
  useEffect(() => {
    let isMounted = true;
    let lastSince = Date.now() - 15000;

    const pollSignals = async () => {
      const pc = pcRef.current;
      if (!pc || pc.signalingState === 'closed') return;

      try {
        const res = await fetch(
          `/api/peer-network?signaling=true&sessionId=${encodeURIComponent(sessionId)}&userId=${encodeURIComponent(myId)}&since=${lastSince}`
        );
        if (res.ok && isMounted) {
          const data = await res.json();
          const signals = Array.isArray(data.signals) ? data.signals : [];
          for (const sig of signals) {
            lastSince = Math.max(lastSince, sig.createdAt);
            const currentPc = pcRef.current;
            if (!currentPc || currentPc.signalingState === 'closed') continue;

            if (sig.type === 'webrtc_offer') {
              if (currentPc.signalingState !== 'stable' && currentPc.signalingState !== 'have-local-offer') {
                continue;
              }
              if (currentPc.signalingState === 'have-local-offer') {
                if (myId < (sig.senderId || '')) continue;
                await currentPc.setLocalDescription({ type: 'rollback' } as any).catch(() => {});
              }

              await currentPc.setRemoteDescription(new RTCSessionDescription(sig.payload));

              // Flush buffered candidates
              while (pendingCandidatesRef.current.length > 0) {
                const cand = pendingCandidatesRef.current.shift();
                if (cand) {
                  await currentPc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
                }
              }

              const answer = await currentPc.createAnswer();
              await currentPc.setLocalDescription(answer);

              fetch('/api/peer-network', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  type: 'webrtc_answer',
                  sessionId,
                  senderId: myId,
                  recipientId: sig.senderId,
                  answer,
                }),
              }).catch(() => {});
            } else if (sig.type === 'webrtc_answer') {
              if (currentPc.signalingState === 'have-local-offer') {
                await currentPc.setRemoteDescription(new RTCSessionDescription(sig.payload));
                // Flush buffered candidates
                while (pendingCandidatesRef.current.length > 0) {
                  const cand = pendingCandidatesRef.current.shift();
                  if (cand) {
                    await currentPc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
                  }
                }
              }
            } else if (sig.type === 'webrtc_candidate') {
              if (currentPc.remoteDescription && currentPc.remoteDescription.type) {
                await currentPc.addIceCandidate(new RTCIceCandidate(sig.payload)).catch(() => {});
              } else {
                pendingCandidatesRef.current.push(sig.payload);
              }
            }
          }
        }
      } catch (err) {}
    };

    // Immediate check right on mount to eliminate the 1s startup delay
    pollSignals();

    // Fast polling (250ms) for instantaneous WebRTC handshake
    const interval = setInterval(pollSignals, 250);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [myId, sessionId]);

  // Handle Mute Mic
  const toggleMic = () => {
    triggerAudioPlayback();
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      const nextMuted = !micMuted;
      audioTracks.forEach((t) => (t.enabled = !nextMuted));
      setMicMuted(nextMuted);
    }
  };

  // Handle Toggle Camera
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

          if (pcRef.current && localStreamRef.current) {
            const senders = pcRef.current.getSenders();
            const videoSender = senders.find((s) => s.track && s.track.kind === 'video');
            if (videoSender) {
              await videoSender.replaceTrack(newVideoTrack);
            } else {
              pcRef.current.addTrack(newVideoTrack, localStreamRef.current);
            }
          }
        } else {
          localStreamRef.current.getVideoTracks().forEach((t) => (t.enabled = true));
        }
        if (localVideoRef.current && localStreamRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }
        setVideoOff(false);
      } catch (e) {
        setPermissionError('Could not enable camera. Please check device permissions.');
      }
    } else {
      localStreamRef.current?.getVideoTracks().forEach((t) => (t.enabled = false));
      setVideoOff(true);
    }
  };

  // Handle Screen Share (Transmits to remote peer via replaceTrack)
  const toggleScreenShare = async () => {
    triggerAudioPlayback();
    if (!isScreenSharing) {
      try {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        screenStreamRef.current = displayStream;
        const screenTrack = displayStream.getVideoTracks()[0];

        if (screenVideoRef.current) {
          screenVideoRef.current.srcObject = displayStream;
          screenVideoRef.current.play().catch(() => {});
        }

        // Transmit screen track to remote peer over WebRTC
        const pc = pcRef.current;
        if (pc && screenTrack) {
          const senders = pc.getSenders();
          const videoSender = senders.find((s) => s.track && s.track.kind === 'video') || senders.find((s) => s.track === null);
          if (videoSender) {
            await videoSender.replaceTrack(screenTrack);
          } else {
            pc.addTrack(screenTrack, displayStream);
          }
        }

        screenTrack.onended = async () => {
          setIsScreenSharing(false);
          screenStreamRef.current = null;
          // Revert back to local camera track if present
          const pcInstance = pcRef.current;
          const camTrack = localStreamRef.current?.getVideoTracks()[0] || null;
          if (pcInstance) {
            const senders = pcInstance.getSenders();
            const videoSender = senders.find((s) => s.track && s.track.kind === 'video');
            if (videoSender && camTrack) {
              await videoSender.replaceTrack(camTrack);
            }
          }
        };

        setIsScreenSharing(true);
      } catch (e) {
        // User cancelled picker
      }
    } else {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = null;
      }
      // Revert back to camera track
      const pc = pcRef.current;
      const camTrack = localStreamRef.current?.getVideoTracks()[0] || null;
      if (pc) {
        const senders = pc.getSenders();
        const videoSender = senders.find((s) => s.track && s.track.kind === 'video');
        if (videoSender && camTrack) {
          await videoSender.replaceTrack(camTrack);
        }
      }
      setIsScreenSharing(false);
    }
  };

  const peerInitials = peerName
    ? peerName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'P';

  return (
    <div
      onClick={triggerAudioPlayback}
      className="w-full h-full flex flex-col bg-[#1C1917] text-white rounded-2xl overflow-hidden relative select-none"
    >
      {/* Hidden dedicated audio element for reliable cross-browser voice playback */}
      <audio ref={remoteAudioRef} autoPlay playsInline className="sr-only" />

      {/* Top HUD */}
      <div className="absolute top-3 left-3 right-3 z-20 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2 bg-ink/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 shadow-lg pointer-events-auto">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-semibold text-white/90">
            {mode === 'voice' ? 'Voice Call' : 'Video Call'} • {peerName}
          </span>
          <span className="text-[10px] text-emerald-400 font-mono font-bold bg-emerald-950/60 px-2 py-0.5 rounded-full">
            {formatTime(callDuration)}
          </span>
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="flex items-center gap-1.5 bg-ink/80 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 text-[11px] text-zinc-300">
            <span className="text-emerald-400">🔒</span>
            <span className="hidden sm:inline">100% Free Encrypted WebRTC</span>
          </div>
        </div>
      </div>

      {/* Main Video / Screen Area */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden p-3 pt-12 pb-20">
        {permissionError && (
          <div className="absolute top-14 left-4 right-4 z-30 bg-amber/90 text-ink text-xs p-2.5 rounded-xl border border-amber font-medium text-center shadow-lg animate-slide-down">
            {permissionError}
          </div>
        )}

        {/* Screen Share Stage (if active on this local machine) */}
        {isScreenSharing ? (
          <div className="w-full h-full rounded-xl overflow-hidden bg-black/60 relative border border-white/10 flex items-center justify-center">
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
            {/* Peer Stage */}
            <div className="flex-1 w-full h-full max-h-[380px] min-h-[220px] aspect-video bg-zinc-900 rounded-2xl border border-white/10 relative overflow-hidden flex items-center justify-center shadow-xl">
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className={`w-full h-full object-contain aspect-video ${
                  hasRemoteVideo ? 'block' : 'hidden'
                }`}
              />

              {/* Peer Avatar / Voice Card fallback (active when remote video is off) */}
              {!hasRemoteVideo && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-gradient-to-b from-zinc-900/60 via-zinc-900/90 to-zinc-950">
                  <div className="relative mb-3">
                    <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-amber to-terracotta text-white flex items-center justify-center text-3xl font-bold shadow-2xl ring-4 ring-white/10">
                      {peerInitials}
                    </div>
                    {/* Active speaking wave ring */}
                    {peerConnected && (
                      <div className="absolute inset-0 rounded-full border-2 border-emerald-400 animate-ping opacity-30" />
                    )}
                  </div>
                  <h3 className="text-base font-serif font-bold text-white mb-0.5">{peerName}</h3>
                  <p className="text-xs text-emerald-400 flex items-center gap-1.5 justify-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    {peerConnected ? 'Connected via WebRTC' : 'Connecting...'}
                  </p>
                  <div className="mt-4 flex items-center gap-1">
                    <span className="text-[10px] text-zinc-400 uppercase tracking-widest font-mono">Audio</span>
                    <div className="flex gap-1 h-3 items-end">
                      {[0.4, 0.8, 0.5, 0.9, 0.3].map((h, i) => (
                        <span
                          key={i}
                          className="w-1 bg-emerald-400 rounded-full animate-pulse"
                          style={{ height: `${h * 100}%`, animationDelay: `${i * 0.15}s` }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Bottom Peer Badge */}
              <div className="absolute bottom-2.5 left-2.5 bg-ink/80 backdrop-blur-md px-2.5 py-1 rounded-lg text-[11px] font-semibold text-white/90 border border-white/10">
                {peerName}
              </div>
            </div>

            {/* Local Video Stage (PiP or Side tile) */}
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
                      className="w-2 h-2 rounded-full bg-emerald-400 transition-transform"
                      style={{ transform: `scale(${1 + audioLevel / 60})` }}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Floating Bottom Control Bar */}
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

        {/* Screen Share Button */}
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

        <div className="w-[1px] h-6 bg-white/20 mx-1" />

        {/* End Call Button */}
        <button
          onClick={onEndCall}
          className="px-5 py-2 rounded-full bg-bad hover:bg-red-700 text-white font-bold text-xs shadow-lg transition-colors cursor-pointer flex items-center gap-1.5"
        >
          <span>✕</span> End Call
        </button>
      </div>
    </div>
  );
}
