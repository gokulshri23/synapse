'use client';

import React, { useEffect, useState } from 'react';

export interface ParticipantDebugState {
  name: string;
  isLocal: boolean;
  audioTrackState: 'live' | 'muted' | 'none';
  videoTrackState: 'live' | 'muted' | 'none';
  screenShareState: 'sharing' | 'none';
  audioLevel: number; // 0 - 100
}

export interface CallDebugPanelProps {
  roomName: string;
  callId?: string;
  connectionState: string;
  iceConnectionState?: string;
  relayType?: string;
  lastError?: string | null;
  localParticipant: ParticipantDebugState;
  remoteParticipant?: ParticipantDebugState | null;
  selectedMic?: string;
  selectedCamera?: string;
  selectedSpeaker?: string;
  isHttps?: boolean;
  isDisplayMediaSupported?: boolean;
}

export default function CallDebugPanel({
  roomName,
  callId,
  connectionState,
  iceConnectionState,
  relayType,
  lastError,
  localParticipant,
  remoteParticipant,
  selectedMic,
  selectedCamera,
  selectedSpeaker,
  isHttps,
  isDisplayMediaSupported,
}: CallDebugPanelProps) {
  const [isDebugEnabled, setIsDebugEnabled] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const search = window.location.search || '';
      setIsDebugEnabled(search.includes('calldebug=1'));
    }
  }, []);

  if (!isDebugEnabled) return null;

  const participantsCount = 1 + (remoteParticipant ? 1 : 0);
  const isSecure = typeof isHttps === 'boolean' ? isHttps : (typeof window !== 'undefined' ? window.location.protocol === 'https:' : false);
  const canDisplayMedia = typeof isDisplayMediaSupported === 'boolean'
    ? isDisplayMediaSupported
    : (typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia));

  const getTrackBadge = (state: 'live' | 'muted' | 'none') => {
    switch (state) {
      case 'live':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">LIVE</span>;
      case 'muted':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">MUTED</span>;
      case 'none':
      default:
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-zinc-700/40 text-zinc-400 border border-zinc-700">NONE</span>;
    }
  };

  return (
    <div className="fixed top-4 right-4 z-[200] w-84 max-w-[calc(100vw-32px)] bg-zinc-950/95 border-2 border-amber-500/70 rounded-2xl shadow-2xl backdrop-blur-xl text-zinc-200 font-mono text-xs overflow-hidden select-none animate-slide-down">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-amber-500/15 border-b border-amber-500/30">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
          <span className="font-bold text-amber-400 tracking-wider text-[11px] uppercase">
            CALL DIAGNOSTICS (?calldebug=1)
          </span>
        </div>
        <button
          onClick={() => setIsMinimized(!isMinimized)}
          className="text-zinc-400 hover:text-white px-2 py-0.5 rounded bg-zinc-800/80 text-[11px] font-bold cursor-pointer"
        >
          {isMinimized ? 'Expand' : 'Collapse'}
        </button>
      </div>

      {!isMinimized && (
        <div className="p-3.5 space-y-3 max-h-[80vh] overflow-y-auto">
          {/* Room & Call Meta */}
          <div className="space-y-1 bg-zinc-900/80 p-2.5 rounded-xl border border-zinc-800">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-400">Room Name:</span>
              <span className="font-bold text-amber-300 truncate max-w-[170px]" title={roomName}>
                {roomName || 'unassigned'}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-400">calls.id:</span>
              <span className="font-mono text-zinc-300 truncate max-w-[170px]" title={callId}>
                {callId || 'direct/local'}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-400">Relay Engine:</span>
              <span className="font-bold text-emerald-400">
                {relayType || 'TURN Relay (openrelay.metered.ca)'}
              </span>
            </div>
          </div>

          {/* Connection Status & Participant Count */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-zinc-900/80 p-2 rounded-xl border border-zinc-800">
              <span className="text-[10px] text-zinc-400 block uppercase">Participants</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span
                  className={`text-lg font-bold font-sans ${
                    participantsCount === 2 ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                >
                  {participantsCount} / 2
                </span>
                <span className="text-[10px] text-zinc-400">
                  {participantsCount === 2 ? '✓ Paired' : '⏳ Waiting'}
                </span>
              </div>
            </div>

            <div className="bg-zinc-900/80 p-2 rounded-xl border border-zinc-800">
              <span className="text-[10px] text-zinc-400 block uppercase">Peer Connection</span>
              <div className="flex items-center gap-1 mt-0.5 truncate">
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    connectionState === 'connected'
                      ? 'bg-emerald-400'
                      : connectionState === 'connecting'
                      ? 'bg-amber-400 animate-pulse'
                      : 'bg-bad'
                  }`}
                />
                <span className="text-xs font-bold capitalize text-zinc-200 truncate">
                  {connectionState || 'new'}
                </span>
              </div>
              {iceConnectionState && (
                <span className="text-[9px] text-zinc-400 block truncate">
                  ICE: {iceConnectionState}
                </span>
              )}
            </div>
          </div>

          {/* Participant 1: Local */}
          <div className="bg-zinc-900/90 p-2.5 rounded-xl border border-zinc-800 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="font-bold text-zinc-200">{localParticipant.name} (You)</span>
              </div>
              <span className="text-[10px] text-zinc-400">Local Device</span>
            </div>

            <div className="grid grid-cols-3 gap-1 text-[10px]">
              <div>
                <span className="text-zinc-500 block">Audio:</span>
                {getTrackBadge(localParticipant.audioTrackState)}
              </div>
              <div>
                <span className="text-zinc-500 block">Video:</span>
                {getTrackBadge(localParticipant.videoTrackState)}
              </div>
              <div>
                <span className="text-zinc-500 block">Screen:</span>
                <span
                  className={`px-1.5 py-0.5 rounded font-bold border ${
                    localParticipant.screenShareState === 'sharing'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-zinc-800 text-zinc-500 border-zinc-700'
                  }`}
                >
                  {localParticipant.screenShareState === 'sharing' ? 'ACTIVE' : 'OFF'}
                </span>
              </div>
            </div>

            {/* Mic Level Meter */}
            <div className="space-y-1 pt-1">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-zinc-400">My Mic Volume:</span>
                <span className="font-bold text-emerald-400">{localParticipant.audioLevel}%</span>
              </div>
              <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-amber-400 transition-all duration-75"
                  style={{ width: `${Math.min(100, Math.max(0, localParticipant.audioLevel))}%` }}
                />
              </div>
            </div>
          </div>

          {/* Participant 2: Remote */}
          <div className="bg-zinc-900/90 p-2.5 rounded-xl border border-zinc-800 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    remoteParticipant ? 'bg-emerald-400' : 'bg-zinc-600'
                  }`}
                />
                <span className="font-bold text-zinc-200">
                  {remoteParticipant ? remoteParticipant.name : 'Peer (Waiting to join...)'}
                </span>
              </div>
              <span className="text-[10px] text-zinc-400">Remote Peer</span>
            </div>

            {remoteParticipant ? (
              <>
                <div className="grid grid-cols-3 gap-1 text-[10px]">
                  <div>
                    <span className="text-zinc-500 block">Audio:</span>
                    {getTrackBadge(remoteParticipant.audioTrackState)}
                  </div>
                  <div>
                    <span className="text-zinc-500 block">Video:</span>
                    {getTrackBadge(remoteParticipant.videoTrackState)}
                  </div>
                  <div>
                    <span className="text-zinc-500 block">Screen:</span>
                    <span
                      className={`px-1.5 py-0.5 rounded font-bold border ${
                        remoteParticipant.screenShareState === 'sharing'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : 'bg-zinc-800 text-zinc-500 border-zinc-700'
                      }`}
                    >
                      {remoteParticipant.screenShareState === 'sharing' ? 'ACTIVE' : 'OFF'}
                    </span>
                  </div>
                </div>

                {/* Remote Audio Level Meter */}
                <div className="space-y-1 pt-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-zinc-400">Peer Audio Volume:</span>
                    <span className="font-bold text-emerald-400">{remoteParticipant.audioLevel}%</span>
                  </div>
                  <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-amber-400 transition-all duration-75"
                      style={{ width: `${Math.min(100, Math.max(0, remoteParticipant.audioLevel))}%` }}
                    />
                  </div>
                </div>
              </>
            ) : (
              <p className="text-[11px] text-zinc-500 italic">
                Device 2 has not yet connected to room {roomName}.
              </p>
            )}
          </div>

          {/* Selected Devices */}
          <div className="space-y-1 bg-zinc-900/60 p-2.5 rounded-xl border border-zinc-800 text-[10px]">
            <span className="text-zinc-400 font-bold block uppercase text-[9px] mb-1">
              Active Hardware Devices
            </span>
            <div className="truncate">
              <span className="text-zinc-500">Mic: </span>
              <span className="text-zinc-300">{selectedMic || 'Default Microphone'}</span>
            </div>
            <div className="truncate">
              <span className="text-zinc-500">Camera: </span>
              <span className="text-zinc-300">{selectedCamera || 'Default Camera / Off'}</span>
            </div>
            <div className="truncate">
              <span className="text-zinc-500">Speaker: </span>
              <span className="text-zinc-300">{selectedSpeaker || 'System Default'}</span>
            </div>
          </div>

          {/* Environment Checks */}
          <div className="flex items-center justify-between bg-zinc-900/60 p-2 rounded-xl border border-zinc-800 text-[10px]">
            <div className="flex items-center gap-1">
              <span>HTTPS:</span>
              <span className={`font-bold ${isSecure ? 'text-emerald-400' : 'text-bad'}`}>
                {isSecure ? '✓ Secure' : '✕ Insecure (http)'}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span>Screen Share:</span>
              <span className={`font-bold ${canDisplayMedia ? 'text-emerald-400' : 'text-zinc-500'}`}>
                {canDisplayMedia ? '✓ Supported' : '✕ Not supported (mobile)'}
              </span>
            </div>
          </div>

          {/* Error Message Display */}
          {lastError && (
            <div className="p-2 rounded-xl bg-bad/20 border border-bad/40 text-bad text-[11px]">
              <span className="font-bold block">Last Error:</span>
              <p className="break-words mt-0.5">{lastError}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
