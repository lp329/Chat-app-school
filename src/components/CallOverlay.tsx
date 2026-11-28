import { useEffect, useRef } from 'react';
import {
  AlertCircle,
  Calculator,
  Maximize2,
  Mic,
  MicOff,
  Minimize2,
  Phone,
  PhoneOff,
  SwitchCamera,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import type { WebRtcCallController } from '../hooks/useWebRtcCall';
import { Avatar } from './Avatar';

interface CallOverlayProps {
  call: WebRtcCallController;
  roomDisplayTitle: string;
  onActivateCamouflage: () => void;
}

function formatCallDuration(totalSeconds: number): string {
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  const mm = String(mins).padStart(2, '0');
  const ss = String(secs).padStart(2, '0');
  if (hrs > 0) {
    return `${String(hrs).padStart(2, '0')}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
}

export function CallOverlay({
  call,
  roomDisplayTitle,
  onActivateCamouflage,
}: CallOverlayProps) {
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);

  const hasRemoteVideoTrack = Boolean(
    call.remoteStream &&
      call.remoteStream
        .getVideoTracks()
        .some((t) => t.readyState === 'live') &&
      call.remoteVideoEnabled
  );

  const hasLocalVideoTrack = Boolean(
    call.localStream &&
      call.localStream
        .getVideoTracks()
        .some((t) => t.readyState === 'live') &&
      call.isVideoEnabled
  );

  // Bind remote audio stream (dedicated audio element so voice stays continuous across PiP/camera toggles)
  useEffect(() => {
    const audioEl = remoteAudioRef.current;
    if (!audioEl) return;
    if (call.remoteStream) {
      audioEl.srcObject = call.remoteStream;
      void audioEl.play().catch(() => {});
    } else {
      audioEl.srcObject = null;
    }
  }, [call.remoteStream, call.status]);

  // Bind remote video stream whenever full-screen/PiP video element mounts or stream changes
  useEffect(() => {
    const videoEl = remoteVideoRef.current;
    if (!videoEl) return;
    if (call.remoteStream && hasRemoteVideoTrack) {
      videoEl.srcObject = call.remoteStream;
      void videoEl.play().catch(() => {});
    } else {
      videoEl.srcObject = null;
    }
  }, [call.remoteStream, hasRemoteVideoTrack, call.isMinimized, call.status]);

  // Bind local video preview stream
  useEffect(() => {
    const videoEl = localVideoRef.current;
    if (!videoEl) return;
    if (call.localStream && hasLocalVideoTrack) {
      videoEl.srcObject = call.localStream;
      void videoEl.play().catch(() => {});
    } else {
      videoEl.srcObject = null;
    }
  }, [
    call.localStream,
    hasLocalVideoTrack,
    call.isMinimized,
    call.status,
    call.facingMode,
  ]);

  // 1. Error / Status Toast when idle
  if (call.status === 'idle') {
    if (!call.callNotice) return null;
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] w-[calc(100%-2rem)] max-w-md"
      >
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-xl px-4 py-3 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs font-medium text-slate-800 dark:text-slate-100 leading-relaxed flex-1">
            {call.callNotice}
          </p>
          <button
            type="button"
            onClick={call.dismissCallNotice}
            aria-label="通知を閉じる"
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  // 2. Incoming Call Modal / Floating Banner (`ringing`)
  if (call.status === 'ringing' && call.remotePeer) {
    const callLabel = call.callType === 'video' ? 'ビデオ通話' : '音声通話';
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${call.remotePeer.nickname}さんからの${callLabel}着信`}
        className="fixed inset-x-0 top-4 z-[70] flex justify-center px-4 pointer-events-none"
      >
        <div className="pointer-events-auto w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-700/80 bg-white/98 dark:bg-slate-900/98 backdrop-blur-xl shadow-2xl p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              {callLabel}の着信
            </span>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={call.toggleRingtoneMute}
                title={call.isRingtoneMuted ? '着信音をオンにする' : '着信音をミュート'}
                aria-label={
                  call.isRingtoneMuted ? '着信音をオンにする' : '着信音をミュート'
                }
                className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                {call.isRingtoneMuted ? (
                  <VolumeX className="w-4 h-4 text-rose-500" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>
              <button
                type="button"
                onClick={onActivateCamouflage}
                title="電卓画面へ切り替え（緊急隠蔽）"
                aria-label="電卓画面へ切り替え"
                className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <Calculator className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3.5">
            <div className="relative shrink-0">
              <Avatar
                name={call.remotePeer.nickname}
                avatarValue={call.remotePeer.avatar}
                avatarColor={call.remotePeer.avatarColor}
                size="lg"
                className="ring-4 ring-emerald-500/20"
              />
              <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center ring-2 ring-white dark:ring-slate-900">
                {call.callType === 'video' ? (
                  <Video className="w-3.5 h-3.5" />
                ) : (
                  <Phone className="w-3.5 h-3.5" />
                )}
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-900 dark:text-white leading-snug break-words">
                {call.remotePeer.nickname}さんから{callLabel}の着信があります
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                {roomDisplayTitle}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              onClick={call.rejectIncomingCall}
              className="min-h-[48px] px-4 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-500 active:scale-[0.98] text-sm font-bold text-white flex items-center justify-center gap-2 transition-all shadow-sm"
            >
              <PhoneOff className="w-4 h-4" />
              <span>拒否</span>
            </button>
            <button
              type="button"
              onClick={() => void call.acceptIncomingCall()}
              className="min-h-[48px] px-4 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98] text-sm font-bold text-white flex items-center justify-center gap-2 transition-all shadow-sm"
            >
              {call.callType === 'video' ? (
                <Video className="w-4 h-4" />
              ) : (
                <Phone className="w-4 h-4" />
              )}
              <span>応答</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. Active / Outgoing / Connecting Call Overlay (Full-screen OR Picture-in-Picture)
  const peerDisplayName = call.remotePeer?.nickname || roomDisplayTitle;
  const statusSubtitle =
    call.status === 'calling'
      ? '呼び出し中...'
      : call.status === 'connecting'
        ? '接続中...'
        : formatCallDuration(call.elapsedSeconds);

  return (
    <>
      {/* Persistent Remote Audio Element */}
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      {call.isMinimized ? (
        /* Picture-in-Picture Floating Mini Card */
        <div
          role="region"
          aria-label="通話中ピクチャーインピクチャー"
          className="fixed bottom-4 right-4 z-[70] w-60 sm:w-68 rounded-2xl border border-slate-700/80 bg-slate-900/95 text-white shadow-2xl overflow-hidden backdrop-blur-md"
        >
          <div className="relative h-36 bg-slate-950 flex flex-col items-center justify-center overflow-hidden">
            {hasRemoteVideoTrack ? (
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 px-3 text-center">
                <Avatar
                  name={peerDisplayName}
                  avatarValue={call.remotePeer?.avatar}
                  avatarColor={call.remotePeer?.avatarColor}
                  size="md"
                  className="ring-2 ring-emerald-500/40"
                />
                <span className="text-xs font-bold truncate max-w-full">
                  {peerDisplayName}
                </span>
              </div>
            )}

            <div className="absolute top-2 left-2 px-2 py-0.5 rounded-lg bg-slate-950/75 text-[11px] font-mono tabular-nums text-emerald-300">
              {statusSubtitle}
            </div>

            <button
              type="button"
              onClick={call.toggleMinimized}
              title="通話画面を拡大"
              aria-label="通話画面を拡大"
              className="absolute top-2 right-2 w-8 h-8 rounded-lg bg-slate-950/75 hover:bg-slate-800 text-white flex items-center justify-center transition-colors"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="px-3 py-2.5 bg-slate-900 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={call.toggleAudioMute}
              aria-label={call.isAudioMuted ? 'ミュート解除' : 'マイクミュート'}
              className={`min-h-[38px] flex-1 rounded-xl flex items-center justify-center transition-colors ${
                call.isAudioMuted
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-100'
              }`}
            >
              {call.isAudioMuted ? (
                <MicOff className="w-4 h-4" />
              ) : (
                <Mic className="w-4 h-4" />
              )}
            </button>

            <button
              type="button"
              onClick={() => void call.toggleVideoEnabled()}
              aria-label={call.isVideoEnabled ? 'カメラOFF' : 'カメラON'}
              className={`min-h-[38px] flex-1 rounded-xl flex items-center justify-center transition-colors ${
                call.isVideoEnabled
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-100'
              }`}
            >
              {call.isVideoEnabled ? (
                <Video className="w-4 h-4" />
              ) : (
                <VideoOff className="w-4 h-4" />
              )}
            </button>

            <button
              type="button"
              onClick={call.endCall}
              aria-label="通話を終了"
              className="min-h-[38px] flex-1 rounded-xl bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center transition-colors"
            >
              <PhoneOff className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        /* Full-Screen Modern Call Overlay */
        <div
          role="dialog"
          aria-modal="true"
          aria-label="リアルタイム通話画面"
          className="fixed inset-0 z-[70] bg-slate-950 text-white flex flex-col overflow-hidden select-none"
        >
          {/* Remote Video Background OR Audio Call Stage */}
          <div className="relative flex-1 w-full h-full flex items-center justify-center overflow-hidden bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950">
            {hasRemoteVideoTrack ? (
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center justify-center gap-5 px-6 text-center z-10">
                <div className="relative">
                  {call.status !== 'connected' && (
                    <span className="absolute -inset-4 rounded-full bg-emerald-500/20 animate-ping" />
                  )}
                  <div className="relative rounded-full p-1.5 bg-slate-900/80 ring-2 ring-emerald-500/40 shadow-2xl">
                    <Avatar
                      name={peerDisplayName}
                      avatarValue={call.remotePeer?.avatar}
                      avatarColor={call.remotePeer?.avatarColor}
                      size="xl"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <h2 className="text-2xl font-bold tracking-tight text-white">
                    {peerDisplayName}
                  </h2>
                  <p className="text-sm font-mono tabular-nums text-emerald-300">
                    {statusSubtitle}
                  </p>
                  {call.remoteAudioMuted && call.status === 'connected' && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/90 text-xs text-slate-300 mt-1">
                      <MicOff className="w-3.5 h-3.5 text-rose-400" />
                      相手はマイクをミュートしています
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Subtle top/bottom vignette gradients when video is visible */}
            {hasRemoteVideoTrack && (
              <>
                <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-slate-950/80 to-transparent" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-slate-950/90 to-transparent" />
              </>
            )}

            {/* Top Floating Header Bar */}
            <header className="absolute inset-x-0 top-0 z-20 px-4 sm:px-6 pt-[max(1rem,env(safe-area-inset-top))] pb-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      call.status === 'connected'
                        ? 'bg-emerald-400'
                        : 'bg-amber-400 animate-pulse'
                    }`}
                  />
                  <span className="text-sm sm:text-base font-bold text-white truncate">
                    {peerDisplayName}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-300 mt-0.5">
                  <span className="font-mono tabular-nums">{statusSubtitle}</span>
                  <span>·</span>
                  <span className="truncate">
                    {call.callType === 'video' ? 'ビデオ通話' : '音声通話'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={call.toggleMinimized}
                  title="小窓（ピクチャーインピクチャー）に縮小"
                  aria-label="小窓に縮小"
                  className="min-h-[42px] min-w-[42px] rounded-xl bg-slate-900/70 hover:bg-slate-800 border border-white/15 text-slate-100 flex items-center justify-center backdrop-blur-md transition-colors"
                >
                  <Minimize2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={onActivateCamouflage}
                  title="電卓画面へ切り替え（通話を即座に切断）"
                  aria-label="電卓画面へ切り替え"
                  className="min-h-[42px] px-3 rounded-xl bg-slate-900/70 hover:bg-slate-800 border border-white/15 text-slate-100 flex items-center gap-1.5 text-xs font-medium backdrop-blur-md transition-colors"
                >
                  <Calculator className="w-4 h-4" />
                  <span className="hidden sm:inline">電卓隠蔽</span>
                </button>
              </div>
            </header>

            {/* In-call transient notice */}
            {call.callNotice && (
              <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 w-[calc(100%-2rem)] max-w-sm">
                <div className="rounded-xl bg-slate-900/90 border border-amber-500/40 px-3.5 py-2.5 text-xs text-amber-200 flex items-center justify-between gap-2 shadow-lg backdrop-blur-md">
                  <span className="leading-relaxed">{call.callNotice}</span>
                  <button
                    type="button"
                    onClick={call.dismissCallNotice}
                    className="p-1 text-slate-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Local Self Video PiP (Bottom Right, Mirrored for front camera) */}
            {hasLocalVideoTrack && (
              <div className="absolute right-4 sm:right-6 bottom-28 sm:bottom-32 z-20 w-28 h-40 sm:w-36 sm:h-52 rounded-2xl overflow-hidden border-2 border-white/25 bg-slate-900 shadow-2xl">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${
                    call.facingMode === 'user' ? '-scale-x-100' : ''
                  }`}
                />
                <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-slate-950/70 text-[10px] font-medium text-white">
                  あなた
                </span>
              </div>
            )}

            {/* Bottom Call Control Bar */}
            <div className="absolute inset-x-0 bottom-0 z-20 px-4 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] flex justify-center">
              <div className="flex items-center justify-center gap-3 sm:gap-5 px-5 py-3 rounded-3xl bg-slate-900/85 border border-white/10 backdrop-blur-xl shadow-2xl">
                {/* 1. Mic Mute Toggle */}
                <button
                  type="button"
                  onClick={call.toggleAudioMute}
                  aria-label={
                    call.isAudioMuted ? 'マイクのミュートを解除' : 'マイクをミュート'
                  }
                  className="flex flex-col items-center gap-1 group"
                >
                  <span
                    className={`w-13 h-13 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition-all active:scale-95 ${
                      call.isAudioMuted
                        ? 'bg-white text-slate-950 shadow-md'
                        : 'bg-slate-800 hover:bg-slate-700 text-white'
                    }`}
                  >
                    {call.isAudioMuted ? (
                      <MicOff className="w-5 h-5" />
                    ) : (
                      <Mic className="w-5 h-5" />
                    )}
                  </span>
                  <span className="text-[10px] font-medium text-slate-300">
                    {call.isAudioMuted ? 'ミュート中' : 'マイク'}
                  </span>
                </button>

                {/* 2. Camera ON/OFF Toggle (supports audio -> video upgrade) */}
                <button
                  type="button"
                  onClick={() => void call.toggleVideoEnabled()}
                  aria-label={
                    call.isVideoEnabled ? 'カメラをOFFにする' : 'カメラをONにする'
                  }
                  className="flex flex-col items-center gap-1 group"
                >
                  <span
                    className={`w-13 h-13 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition-all active:scale-95 ${
                      call.isVideoEnabled
                        ? 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-md shadow-emerald-500/25'
                        : 'bg-slate-800 hover:bg-slate-700 text-white'
                    }`}
                  >
                    {call.isVideoEnabled ? (
                      <Video className="w-5 h-5" />
                    ) : (
                      <VideoOff className="w-5 h-5" />
                    )}
                  </span>
                  <span className="text-[10px] font-medium text-slate-300">
                    {call.isVideoEnabled ? 'カメラON' : 'カメラOFF'}
                  </span>
                </button>

                {/* 3. Front / Rear Camera Switch */}
                <button
                  type="button"
                  onClick={() => void call.switchCameraFacing()}
                  disabled={!call.isVideoEnabled}
                  aria-label="フロント・リアカメラを切り替え"
                  className="flex flex-col items-center gap-1 group disabled:opacity-40 disabled:pointer-events-none"
                >
                  <span className="w-13 h-13 sm:w-14 sm:h-14 rounded-full bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center transition-all active:scale-95">
                    <SwitchCamera className="w-5 h-5" />
                  </span>
                  <span className="text-[10px] font-medium text-slate-300">
                    カメラ切替
                  </span>
                </button>

                {/* 4. End Call (Red Handset) */}
                <button
                  type="button"
                  onClick={call.endCall}
                  aria-label="通話を終了"
                  className="flex flex-col items-center gap-1 group"
                >
                  <span className="w-14 h-14 sm:w-15 sm:h-15 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center transition-all active:scale-95 shadow-lg shadow-rose-600/35">
                    <PhoneOff className="w-6 h-6" />
                  </span>
                  <span className="text-[10px] font-medium text-rose-300">
                    終了
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
