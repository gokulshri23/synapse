'use client';
import { useEffect, useRef, useState } from 'react';

interface PreJoinModalProps {
  roomName: string;
  topic: string;
  defaultUserName: string;
  isOpen: boolean;
  onJoin: (settings: {
    displayName: string;
    videoEnabled: boolean;
    audioEnabled: boolean;
    audioDeviceId?: string;
    videoDeviceId?: string;
  }) => void;
  onCancel: () => void;
}

export default function PreJoinModal({
  roomName,
  topic,
  defaultUserName,
  isOpen,
  onJoin,
  onCancel,
}: PreJoinModalProps) {
  const [displayName, setDisplayName] = useState(defaultUserName || 'Learner');
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [audioLevel, setAudioLevel] = useState(0);

  // Devices list
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioId, setSelectedAudioId] = useState<string>('');
  const [selectedVideoId, setSelectedVideoId] = useState<string>('');

  // Fallback modes if hardware/permission is limited
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [hasNoCamera, setHasNoCamera] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    setDisplayName(defaultUserName || 'Learner');
  }, [defaultUserName]);

  // Request devices preview
  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;

    async function initPreview() {
      try {
        setPermissionError(null);
        const stream = await navigator.mediaDevices.getUserMedia({
          video: selectedVideoId ? { deviceId: { exact: selectedVideoId } } : true,
          audio: selectedAudioId ? { deviceId: { exact: selectedAudioId } } : true,
        });

        if (!mounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }

        // Setup audio level meter
        try {
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioContextClass) {
            const ctx = new AudioContextClass();
            audioContextRef.current = ctx;
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 64;
            analyserRef.current = analyser;
            const source = ctx.createMediaStreamSource(stream);
            source.connect(analyser);

            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            const checkLevel = () => {
              if (!mounted) return;
              analyser.getByteFrequencyData(dataArray);
              let sum = 0;
              for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
              const avg = sum / dataArray.length;
              setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
              animFrameRef.current = requestAnimationFrame(checkLevel);
            };
            checkLevel();
          }
        } catch (e) {}

        // Enumerate devices
        const devices = await navigator.mediaDevices.enumerateDevices();
        if (mounted) {
          const audios = devices.filter((d) => d.kind === 'audioinput');
          const videos = devices.filter((d) => d.kind === 'videoinput');
          setAudioDevices(audios);
          setVideoDevices(videos);
          if (videos.length === 0) setHasNoCamera(true);
        }
      } catch (err: any) {
        if (!mounted) return;
        console.warn('[PreJoinModal] Media stream error:', err);
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setPermissionError('Camera and mic permission was denied in your browser settings.');
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          setHasNoCamera(true);
          setPermissionError('No camera found on this device. You can join with audio only.');
        } else {
          setPermissionError('Unable to access devices. You can still join in listen/audio mode.');
        }
      }
    }

    initPreview();

    return () => {
      mounted = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, [isOpen, selectedAudioId, selectedVideoId]);

  // Video track toggle
  useEffect(() => {
    if (streamRef.current) {
      streamRef.current.getVideoTracks().forEach((t) => {
        t.enabled = videoEnabled;
      });
    }
  }, [videoEnabled]);

  // Audio track toggle
  useEffect(() => {
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach((t) => {
        t.enabled = audioEnabled;
      });
    }
  }, [audioEnabled]);

  if (!isOpen) return null;

  const handleJoin = () => {
    // Stop local preview tracks before handing over to DailyProvider
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
    }

    onJoin({
      displayName: displayName.trim() || 'Learner',
      videoEnabled: !hasNoCamera && videoEnabled,
      audioEnabled,
      audioDeviceId: selectedAudioId || undefined,
      videoDeviceId: selectedVideoId || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-[180] bg-ink/75 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-card border border-border rounded-[24px] max-w-xl w-full p-6 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber block">
              Pre-Join Device Check
            </span>
            <h3 className="font-serif font-bold text-lg text-ink">{roomName}</h3>
            <p className="text-xs text-muted">Topic: {topic}</p>
          </div>
          <button
            onClick={onCancel}
            className="w-8 h-8 rounded-full bg-card-alt border border-border hover:border-amber flex items-center justify-center text-muted hover:text-ink text-sm cursor-pointer transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Video Preview Box */}
        <div className="relative h-60 bg-ink/95 rounded-2xl overflow-hidden flex items-center justify-center border border-border shadow-inner">
          {videoEnabled && !hasNoCamera ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover scale-x-[-1]"
            />
          ) : (
            <div className="text-center space-y-2 p-4">
              <div className="w-16 h-16 rounded-full bg-amber/20 text-amber flex items-center justify-center text-2xl mx-auto font-bold font-serif">
                {displayName.charAt(0).toUpperCase()}
              </div>
              <p className="text-xs text-zinc-300 font-medium">Camera is turned off</p>
              <p className="text-[11px] text-zinc-500">Avatar will be shown to other learners</p>
            </div>
          )}

          {/* Quick Controls overlay */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-ink/80 backdrop-blur-md py-1.5 px-3 rounded-full border border-white/10 shadow-lg">
            <button
              type="button"
              onClick={() => setAudioEnabled(!audioEnabled)}
              className={`p-2 rounded-full transition-colors cursor-pointer text-xs ${
                audioEnabled ? 'bg-white/20 text-white hover:bg-white/30' : 'bg-bad text-white'
              }`}
              title={audioEnabled ? 'Mute microphone' : 'Unmute microphone'}
            >
              {audioEnabled ? '🎤' : '🔇'}
            </button>
            <button
              type="button"
              onClick={() => setVideoEnabled(!videoEnabled)}
              disabled={hasNoCamera}
              className={`p-2 rounded-full transition-colors cursor-pointer text-xs disabled:opacity-40 ${
                videoEnabled && !hasNoCamera ? 'bg-white/20 text-white hover:bg-white/30' : 'bg-bad text-white'
              }`}
              title={videoEnabled ? 'Turn off camera' : 'Turn on camera'}
            >
              {videoEnabled && !hasNoCamera ? '📹' : '🚫'}
            </button>
          </div>
        </div>

        {/* Microphone Audio Meter */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted">
            <span className="flex items-center gap-1.5">
              <span>🎙️</span> Mic Level
            </span>
            <span className="text-[11px] font-semibold text-ink">
              {audioEnabled ? `${audioLevel}%` : 'Muted'}
            </span>
          </div>
          <div className="h-2 w-full bg-card-alt rounded-full overflow-hidden border border-border">
            <div
              className={`h-full transition-all duration-75 rounded-full ${
                audioLevel > 60 ? 'bg-emerald-500' : audioLevel > 20 ? 'bg-amber' : 'bg-border'
              }`}
              style={{ width: `${audioEnabled ? audioLevel : 0}%` }}
            />
          </div>
        </div>

        {/* Permission Denied Warning & Fallbacks */}
        {permissionError && (
          <div className="p-3.5 bg-amber/10 border border-amber/30 rounded-xl text-xs space-y-2">
            <p className="font-semibold text-amber flex items-center gap-1.5">
              <span>⚠️</span> {permissionError}
            </p>
            <p className="text-muted text-[11px]">
              You can still participate in the learning session without local video or microphone.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setVideoEnabled(false);
                  setAudioEnabled(true);
                  handleJoin();
                }}
                className="px-3 py-1.5 bg-card border border-border hover:border-amber rounded-lg text-xs font-semibold text-ink transition-colors cursor-pointer"
              >
                Join with Audio Only
              </button>
              <button
                type="button"
                onClick={() => {
                  setVideoEnabled(false);
                  setAudioEnabled(false);
                  handleJoin();
                }}
                className="px-3 py-1.5 bg-card border border-border hover:border-amber rounded-lg text-xs font-semibold text-ink transition-colors cursor-pointer"
              >
                Join Listen-Only (No Mic)
              </button>
            </div>
          </div>
        )}

        {/* Display Name & Device Selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div>
            <label className="text-[11px] font-semibold uppercase text-muted block mb-1">
              Your Display Name
            </label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Alex Morgan"
              className="w-full p-2.5 bg-card-alt border border-border rounded-xl text-xs text-ink outline-none focus:border-amber"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase text-muted block mb-1">
              Microphone
            </label>
            <select
              value={selectedAudioId}
              onChange={(e) => setSelectedAudioId(e.target.value)}
              className="w-full p-2.5 bg-card-alt border border-border rounded-xl text-xs text-ink outline-none focus:border-amber"
            >
              {audioDevices.length > 0 ? (
                audioDevices.map((d, i) => (
                  <option key={d.deviceId || i} value={d.deviceId}>
                    {d.label || `Microphone ${i + 1}`}
                  </option>
                ))
              ) : (
                <option value="">Default Microphone</option>
              )}
            </select>
          </div>
        </div>

        {/* Privacy Note */}
        <div className="flex items-center justify-between text-[11px] text-muted pt-1">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            🔒 This session is not recorded.
          </span>
          <span className="text-[10px] text-muted">WebRTC Encrypted</span>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-border">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 bg-card-alt border border-border hover:border-amber text-xs font-semibold rounded-xl text-ink transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleJoin}
            className="px-6 py-2.5 bg-amber hover:bg-terracotta text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
          >
            <span>🚀</span> Join Session
          </button>
        </div>
      </div>
    </div>
  );
}
