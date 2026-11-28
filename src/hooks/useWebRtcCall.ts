import { useCallback, useEffect, useRef, useState } from 'react';
import { OFFICIAL_ROOM_ID } from '../lib/constants';
import { hashRoomCode } from '../lib/crypto';
import {
  CallRingtoneController,
  subscribeToCallSignaling,
  type CallSignalingChannel,
} from '../lib/callSignaling';
import type {
  CallPeerInfo,
  CallStatus,
  CallType,
  SupabaseConfig,
  UserProfile,
  WebRtcSignalPayload,
} from '../types/chat';

const RTC_CONFIGURATION: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

function createCallId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function mapMediaErrorToJapanese(err: unknown, wantsVideo: boolean): string {
  const name = err instanceof Error ? err.name : '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return wantsVideo
      ? 'カメラまたはマイクの使用が許可されませんでした。ブラウザの権限設定をご確認のうえ再度お試しください。'
      : 'マイクの使用が許可されませんでした。ブラウザの権限設定をご確認のうえ再度お試しください。';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return wantsVideo
      ? '利用可能なカメラまたはマイクが見つかりませんでした。デバイスの接続をご確認ください。'
      : '利用可能なマイクが見つかりませんでした。デバイスの接続をご確認ください。';
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return 'カメラまたはマイクが他のアプリで使用中のため開始できませんでした。';
  }
  if (name === 'OverconstrainedError') {
    return '指定されたカメラ設定がこの端末でサポートされていません。';
  }
  return 'カメラ・マイクの起動に失敗しました。HTTPS接続およびブラウザの対応状況をご確認ください。';
}

function stopMediaStream(stream: MediaStream | null): void {
  if (!stream) return;
  stream.getTracks().forEach((track) => {
    try {
      track.stop();
    } catch {
      // Ignore track stop errors
    }
  });
}

interface UseWebRtcCallOptions {
  activeRoomCode: string | null;
  profile: UserProfile;
  supabaseConfig: SupabaseConfig;
  isSupabaseConfigured: boolean;
  isDisabled: boolean;
  isStealthOrMaintenance: boolean;
}

export interface WebRtcCallController {
  status: CallStatus;
  callType: CallType;
  callRoomCode: string | null;
  remotePeer: CallPeerInfo | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isAudioMuted: boolean;
  isVideoEnabled: boolean;
  remoteVideoEnabled: boolean;
  remoteAudioMuted: boolean;
  facingMode: 'user' | 'environment';
  isRingtoneMuted: boolean;
  isMinimized: boolean;
  elapsedSeconds: number;
  callNotice: string | null;
  startCall: (type: CallType) => Promise<void>;
  acceptIncomingCall: () => Promise<void>;
  rejectIncomingCall: () => void;
  endCall: () => void;
  toggleAudioMute: () => void;
  toggleVideoEnabled: () => Promise<void>;
  switchCameraFacing: () => Promise<void>;
  toggleRingtoneMute: () => void;
  toggleMinimized: () => void;
  dismissCallNotice: () => void;
}

export function useWebRtcCall({
  activeRoomCode,
  profile,
  supabaseConfig,
  isSupabaseConfigured,
  isDisabled,
  isStealthOrMaintenance,
}: UseWebRtcCallOptions): WebRtcCallController {
  const [status, setStatus] = useState<CallStatus>('idle');
  const [callType, setCallType] = useState<CallType>('audio');
  const [callRoomCode, setCallRoomCode] = useState<string | null>(null);
  const [remotePeer, setRemotePeer] = useState<CallPeerInfo | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [remoteVideoEnabled, setRemoteVideoEnabled] = useState(false);
  const [remoteAudioMuted, setRemoteAudioMuted] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [isRingtoneMuted, setIsRingtoneMuted] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [callNotice, setCallNotice] = useState<string | null>(null);

  // Refs for fresh state inside async WebRTC / Realtime callbacks
  const statusRef = useRef<CallStatus>(status);
  const callIdRef = useRef<string | null>(null);
  const callTypeRef = useRef<CallType>(callType);
  const callRoomCodeRef = useRef<string | null>(callRoomCode);
  const remotePeerRef = useRef<CallPeerInfo | null>(remotePeer);
  const profileRef = useRef<UserProfile>(profile);
  const isRingtoneMutedRef = useRef<boolean>(isRingtoneMuted);
  const facingModeRef = useRef<'user' | 'environment'>(facingMode);
  const isAudioMutedRef = useRef<boolean>(isAudioMuted);
  const isVideoEnabledRef = useRef<boolean>(isVideoEnabled);

  const signalingRef = useRef<CallSignalingChannel | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const ringtoneRef = useRef<CallRingtoneController>(new CallRingtoneController());
  const callTimeoutRef = useRef<number | null>(null);
  const noticeTimerRef = useRef<number | null>(null);

  statusRef.current = status;
  callTypeRef.current = callType;
  callRoomCodeRef.current = callRoomCode;
  remotePeerRef.current = remotePeer;
  profileRef.current = profile;
  isRingtoneMutedRef.current = isRingtoneMuted;
  facingModeRef.current = facingMode;
  isAudioMutedRef.current = isAudioMuted;
  isVideoEnabledRef.current = isVideoEnabled;

  const showNotice = useCallback((message: string, durationMs = 5000) => {
    setCallNotice(message);
    if (noticeTimerRef.current !== null) {
      window.clearTimeout(noticeTimerRef.current);
    }
    noticeTimerRef.current = window.setTimeout(() => {
      setCallNotice((curr) => (curr === message ? null : curr));
    }, durationMs);
  }, []);

  const dismissCallNotice = useCallback(() => {
    setCallNotice(null);
    if (noticeTimerRef.current !== null) {
      window.clearTimeout(noticeTimerRef.current);
      noticeTimerRef.current = null;
    }
  }, []);

  const clearCallTimeout = useCallback(() => {
    if (callTimeoutRef.current !== null) {
      window.clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }
  }, []);

  const buildSelfPayloadBase = useCallback(() => {
    const p = profileRef.current;
    const avatar =
      p.avatarType === 'preset' || p.avatarType === 'custom'
        ? p.avatarValue
        : null;
    return {
      fromUserId: p.id,
      fromNickname: p.nickname.trim() || 'ゲスト',
      fromAvatar: avatar,
      fromAvatarColor: p.avatarColor,
    };
  }, []);

  const sendSignal = useCallback(
    (partial: Omit<WebRtcSignalPayload, 'fromUserId' | 'fromNickname' | 'fromAvatar' | 'fromAvatarColor'>) => {
      const fullPayload: WebRtcSignalPayload = {
        ...buildSelfPayloadBase(),
        ...partial,
      };
      void signalingRef.current?.send(fullPayload);
    },
    [buildSelfPayloadBase]
  );

  /**
   * Immediately terminates all local/remote media tracks, closes RTCPeerConnection,
   * stops ringtone, and resets UI state back to idle.
   */
  const cleanupCallResources = useCallback(() => {
    clearCallTimeout();
    ringtoneRef.current.stop();

    if (pcRef.current) {
      try {
        pcRef.current.onicecandidate = null;
        pcRef.current.ontrack = null;
        pcRef.current.onconnectionstatechange = null;
        pcRef.current.oniceconnectionstatechange = null;
        pcRef.current.close();
      } catch {
        // Ignore close errors
      }
      pcRef.current = null;
    }

    stopMediaStream(localStreamRef.current);
    localStreamRef.current = null;

    stopMediaStream(remoteStreamRef.current);
    remoteStreamRef.current = null;

    pendingIceCandidatesRef.current = [];
    callIdRef.current = null;

    setLocalStream(null);
    setRemoteStream(null);
    setRemotePeer(null);
    setCallRoomCode(null);
    setStatus('idle');
    setIsAudioMuted(false);
    setIsVideoEnabled(false);
    setRemoteVideoEnabled(false);
    setRemoteAudioMuted(false);
    setFacingMode('user');
    setIsMinimized(false);
    setElapsedSeconds(0);
  }, [clearCallTimeout]);

  const flushPendingIceCandidates = useCallback(async (pc: RTCPeerConnection) => {
    if (!pc.remoteDescription) return;
    while (pendingIceCandidatesRef.current.length > 0) {
      const candidate = pendingIceCandidatesRef.current.shift();
      if (!candidate) continue;
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {
        // Ignore stale ICE candidates
      }
    }
  }, []);

  const createPeerConnection = useCallback(
    (callId: string, targetPeerId: string, stream: MediaStream): RTCPeerConnection => {
      if (pcRef.current) {
        try {
          pcRef.current.close();
        } catch {
          // Ignore
        }
      }

      const pc = new RTCPeerConnection(RTC_CONFIGURATION);
      pcRef.current = pc;

      // Add all local audio/video tracks
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      const incomingStream = new MediaStream();
      remoteStreamRef.current = incomingStream;
      setRemoteStream(incomingStream);

      pc.ontrack = (event) => {
        const tracks =
          event.streams && event.streams[0]
            ? event.streams[0].getTracks()
            : [event.track];
        tracks.forEach((track) => {
          if (!incomingStream.getTracks().some((t) => t.id === track.id)) {
            incomingStream.addTrack(track);
          }
        });
        // Trigger React update with a fresh MediaStream wrapper reference
        const updated = new MediaStream(incomingStream.getTracks());
        remoteStreamRef.current = updated;
        setRemoteStream(updated);

        const hasLiveVideo = updated
          .getVideoTracks()
          .some((t) => t.readyState === 'live' && t.enabled);
        if (hasLiveVideo) {
          setRemoteVideoEnabled(true);
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate && callIdRef.current === callId) {
          sendSignal({
            type: 'ice-candidate',
            callId,
            toUserId: targetPeerId,
            candidate: event.candidate.toJSON(),
          });
        }
      };

      const handleConnChange = () => {
        if (pcRef.current !== pc) return;
        const connState = pc.connectionState;
        const iceState = pc.iceConnectionState;

        if (
          connState === 'connected' ||
          iceState === 'connected' ||
          iceState === 'completed'
        ) {
          clearCallTimeout();
          setStatus('connected');
        } else if (
          connState === 'failed' ||
          connState === 'closed' ||
          iceState === 'failed'
        ) {
          cleanupCallResources();
          showNotice('通信接続が切断されたため通話を終了しました。');
        } else if (connState === 'disconnected' || iceState === 'disconnected') {
          // Brief network hiccup can recover; disconnect if still down after 6s
          window.setTimeout(() => {
            if (
              pcRef.current === pc &&
              (pc.connectionState === 'disconnected' ||
                pc.iceConnectionState === 'disconnected')
            ) {
              cleanupCallResources();
              showNotice('相手との接続が切れました。');
            }
          }, 6000);
        }
      };

      pc.onconnectionstatechange = handleConnChange;
      pc.oniceconnectionstatechange = handleConnChange;

      return pc;
    },
    [clearCallTimeout, cleanupCallResources, sendSignal, showNotice]
  );

  // Elapsed timer while connected
  useEffect(() => {
    if (status !== 'connected') {
      setElapsedSeconds(0);
      return;
    }
    const startedAt = Date.now();
    const id = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(id);
  }, [status]);

  // Incoming ringtone lifecycle
  useEffect(() => {
    if (status === 'ringing' && !isRingtoneMuted && !isStealthOrMaintenance) {
      ringtoneRef.current.start();
    } else {
      ringtoneRef.current.stop();
    }
  }, [status, isRingtoneMuted, isStealthOrMaintenance]);

  // Force-terminate call IMMEDIATELY on Camouflage Calculator or Maintenance Mode
  useEffect(() => {
    if (!isStealthOrMaintenance) return;
    if (statusRef.current === 'idle') {
      ringtoneRef.current.stop();
      return;
    }

    const activeCallId = callIdRef.current;
    const peerId = remotePeerRef.current?.userId;
    if (activeCallId) {
      if (statusRef.current === 'calling') {
        sendSignal({
          type: 'call-reject',
          callId: activeCallId,
          reason: 'cancelled',
        });
      } else if (statusRef.current === 'ringing') {
        sendSignal({
          type: 'call-reject',
          callId: activeCallId,
          toUserId: peerId,
          reason: 'rejected',
        });
      } else {
        sendSignal({
          type: 'call-end',
          callId: activeCallId,
          toUserId: peerId,
        });
      }
    }
    cleanupCallResources();
  }, [isStealthOrMaintenance, cleanupCallResources, sendSignal]);

  // Handle incoming signaling messages
  const handleIncomingSignal = useCallback(
    async (signal: WebRtcSignalPayload) => {
      if (isStealthOrMaintenance) return;

      switch (signal.type) {
        case 'call-invite': {
          if (statusRef.current !== 'idle') {
            if (callIdRef.current !== signal.callId) {
              sendSignal({
                type: 'call-reject',
                callId: signal.callId,
                toUserId: signal.fromUserId,
                reason: 'busy',
              });
            }
            return;
          }

          const incomingType: CallType =
            signal.callType === 'video' ? 'video' : 'audio';
          callIdRef.current = signal.callId;
          setCallType(incomingType);
          setCallRoomCode(activeRoomCode);
          setRemotePeer({
            userId: signal.fromUserId,
            nickname: signal.fromNickname || 'ゲスト',
            avatar: signal.fromAvatar ?? null,
            avatarColor: signal.fromAvatarColor ?? null,
          });
          setRemoteVideoEnabled(incomingType === 'video');
          setRemoteAudioMuted(false);
          setStatus('ringing');
          setIsMinimized(false);
          break;
        }

        case 'call-accept': {
          if (
            statusRef.current !== 'calling' ||
            callIdRef.current !== signal.callId
          ) {
            return;
          }
          clearCallTimeout();

          const stream = localStreamRef.current;
          if (!stream) {
            cleanupCallResources();
            return;
          }

          const peer: CallPeerInfo = {
            userId: signal.fromUserId,
            nickname: signal.fromNickname || 'ゲスト',
            avatar: signal.fromAvatar ?? null,
            avatarColor: signal.fromAvatarColor ?? null,
          };
          setRemotePeer(peer);
          setRemoteVideoEnabled(signal.callType === 'video');
          setStatus('connecting');

          try {
            const pc = createPeerConnection(signal.callId, peer.userId, stream);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            sendSignal({
              type: 'offer',
              callId: signal.callId,
              toUserId: peer.userId,
              callType: callTypeRef.current,
              sdp: offer,
            });
            sendSignal({
              type: 'media-state',
              callId: signal.callId,
              toUserId: peer.userId,
              videoEnabled: isVideoEnabledRef.current,
              audioMuted: isAudioMutedRef.current,
            });
          } catch {
            cleanupCallResources();
            showNotice('WebRTC通話の接続準備に失敗しました。');
          }
          break;
        }

        case 'call-reject': {
          if (callIdRef.current !== signal.callId) return;
          const prevStatus = statusRef.current;
          cleanupCallResources();
          if (prevStatus === 'calling') {
            if (signal.reason === 'busy') {
              showNotice(`${signal.fromNickname}さんは現在別の通話中です。`);
            } else {
              showNotice(`${signal.fromNickname}さんに通話が拒否されました。`);
            }
          }
          break;
        }

        case 'call-end': {
          if (callIdRef.current !== signal.callId) return;
          const peerName = remotePeerRef.current?.nickname || signal.fromNickname;
          cleanupCallResources();
          showNotice(`${peerName}さんとの通話を終了しました。`, 3500);
          break;
        }

        case 'offer': {
          if (
            callIdRef.current !== signal.callId ||
            !signal.sdp ||
            (statusRef.current !== 'connecting' &&
              statusRef.current !== 'connected')
          ) {
            return;
          }

          const stream = localStreamRef.current;
          if (!stream) return;

          try {
            const pc =
              pcRef.current ||
              createPeerConnection(signal.callId, signal.fromUserId, stream);
            await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
            await flushPendingIceCandidates(pc);

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            sendSignal({
              type: 'answer',
              callId: signal.callId,
              toUserId: signal.fromUserId,
              sdp: answer,
            });
          } catch {
            if (!signal.renegotiate) {
              cleanupCallResources();
              showNotice('通話接続（Offer処理）に失敗しました。');
            }
          }
          break;
        }

        case 'answer': {
          if (
            callIdRef.current !== signal.callId ||
            !signal.sdp ||
            !pcRef.current
          ) {
            return;
          }
          try {
            await pcRef.current.setRemoteDescription(
              new RTCSessionDescription(signal.sdp)
            );
            await flushPendingIceCandidates(pcRef.current);
          } catch {
            // Ignore duplicate/late answer errors
          }
          break;
        }

        case 'ice-candidate': {
          if (callIdRef.current !== signal.callId || !signal.candidate) return;
          const pc = pcRef.current;
          if (pc && pc.remoteDescription) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
            } catch {
              // Ignore bad candidate
            }
          } else {
            pendingIceCandidatesRef.current.push(signal.candidate);
          }
          break;
        }

        case 'media-state': {
          if (callIdRef.current !== signal.callId) return;
          if (typeof signal.videoEnabled === 'boolean') {
            setRemoteVideoEnabled(signal.videoEnabled);
          }
          if (typeof signal.audioMuted === 'boolean') {
            setRemoteAudioMuted(signal.audioMuted);
          }
          break;
        }
      }
    },
    [
      activeRoomCode,
      clearCallTimeout,
      cleanupCallResources,
      createPeerConnection,
      flushPendingIceCandidates,
      isStealthOrMaintenance,
      sendSignal,
      showNotice,
    ]
  );

  // Subscribe to the active room's signaling channel (uses SHA-256 hashed room ID)
  useEffect(() => {
    if (
      isDisabled ||
      !activeRoomCode ||
      activeRoomCode === OFFICIAL_ROOM_ID
    ) {
      if (statusRef.current !== 'idle') {
        const activeId = callIdRef.current;
        if (activeId) {
          sendSignal({
            type: 'call-end',
            callId: activeId,
            toUserId: remotePeerRef.current?.userId,
          });
        }
        cleanupCallResources();
      }
      signalingRef.current?.unsubscribe();
      signalingRef.current = null;
      return;
    }

    // If switching rooms while in a call, end the previous room's call cleanly
    if (
      statusRef.current !== 'idle' &&
      callRoomCodeRef.current &&
      callRoomCodeRef.current !== activeRoomCode
    ) {
      const activeId = callIdRef.current;
      if (activeId) {
        sendSignal({
          type: 'call-end',
          callId: activeId,
          toUserId: remotePeerRef.current?.userId,
        });
      }
      cleanupCallResources();
    }

    let cancelled = false;
    void hashRoomCode(activeRoomCode).then((hashedRoomId) => {
      if (cancelled) return;
      signalingRef.current?.unsubscribe();
      signalingRef.current = subscribeToCallSignaling(
        supabaseConfig,
        isSupabaseConfigured,
        hashedRoomId,
        profile.id,
        (signal) => {
          void handleIncomingSignal(signal);
        }
      );
    });

    return () => {
      cancelled = true;
      signalingRef.current?.unsubscribe();
      signalingRef.current = null;
    };
  }, [
    activeRoomCode,
    isDisabled,
    isSupabaseConfigured,
    supabaseConfig,
    profile.id,
    handleIncomingSignal,
    cleanupCallResources,
    sendSignal,
  ]);

  // Final cleanup on unmount
  useEffect(() => {
    return () => {
      if (noticeTimerRef.current !== null) {
        window.clearTimeout(noticeTimerRef.current);
      }
      cleanupCallResources();
    };
  }, [cleanupCallResources]);

  // --- Public Call Actions ---

  const startCall = useCallback(
    async (type: CallType) => {
      if (isStealthOrMaintenance || !activeRoomCode || activeRoomCode === OFFICIAL_ROOM_ID) {
        return;
      }
      if (statusRef.current !== 'idle') return;

      if (
        typeof window === 'undefined' ||
        typeof RTCPeerConnection === 'undefined' ||
        !navigator.mediaDevices ||
        typeof navigator.mediaDevices.getUserMedia !== 'function'
      ) {
        showNotice(
          'このブラウザ環境では音声・ビデオ通話（WebRTC）を利用できません。HTTPS接続または最新のブラウザをお試しください。'
        );
        return;
      }

      dismissCallNotice();

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video:
            type === 'video'
              ? { facingMode: { ideal: 'user' } }
              : false,
        });
      } catch (err) {
        showNotice(mapMediaErrorToJapanese(err, type === 'video'));
        return;
      }

      const newCallId = createCallId();
      callIdRef.current = newCallId;
      localStreamRef.current = stream;

      setLocalStream(stream);
      setCallType(type);
      setCallRoomCode(activeRoomCode);
      setRemotePeer(null);
      setIsAudioMuted(false);
      setIsVideoEnabled(type === 'video');
      setRemoteVideoEnabled(false);
      setRemoteAudioMuted(false);
      setFacingMode('user');
      setIsMinimized(false);
      setStatus('calling');

      sendSignal({
        type: 'call-invite',
        callId: newCallId,
        callType: type,
      });

      // Auto-cancel if no peer accepts within 45 seconds
      clearCallTimeout();
      callTimeoutRef.current = window.setTimeout(() => {
        if (
          statusRef.current === 'calling' &&
          callIdRef.current === newCallId
        ) {
          sendSignal({
            type: 'call-reject',
            callId: newCallId,
            reason: 'cancelled',
          });
          cleanupCallResources();
          showNotice('応答がなかったため発信を終了しました。');
        }
      }, 45000);
    },
    [
      activeRoomCode,
      clearCallTimeout,
      cleanupCallResources,
      dismissCallNotice,
      isStealthOrMaintenance,
      sendSignal,
      showNotice,
    ]
  );

  const acceptIncomingCall = useCallback(async () => {
    if (statusRef.current !== 'ringing') return;
    const activeCallId = callIdRef.current;
    const caller = remotePeerRef.current;
    if (!activeCallId || !caller) return;

    ringtoneRef.current.stop();

    if (
      typeof window === 'undefined' ||
      typeof RTCPeerConnection === 'undefined' ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== 'function'
    ) {
      sendSignal({
        type: 'call-reject',
        callId: activeCallId,
        toUserId: caller.userId,
        reason: 'rejected',
      });
      cleanupCallResources();
      showNotice(
        'このブラウザ環境では音声・ビデオ通話（WebRTC）を利用できません。'
      );
      return;
    }

    const wantsVideo = callTypeRef.current === 'video';
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: wantsVideo ? { facingMode: { ideal: 'user' } } : false,
      });
    } catch (err) {
      sendSignal({
        type: 'call-reject',
        callId: activeCallId,
        toUserId: caller.userId,
        reason: 'rejected',
      });
      cleanupCallResources();
      showNotice(mapMediaErrorToJapanese(err, wantsVideo));
      return;
    }

    localStreamRef.current = stream;
    setLocalStream(stream);
    setIsAudioMuted(false);
    setIsVideoEnabled(wantsVideo);
    setFacingMode('user');
    setStatus('connecting');

    createPeerConnection(activeCallId, caller.userId, stream);

    sendSignal({
      type: 'call-accept',
      callId: activeCallId,
      toUserId: caller.userId,
      callType: callTypeRef.current,
    });
    sendSignal({
      type: 'media-state',
      callId: activeCallId,
      toUserId: caller.userId,
      videoEnabled: wantsVideo,
      audioMuted: false,
    });
  }, [cleanupCallResources, createPeerConnection, sendSignal, showNotice]);

  const rejectIncomingCall = useCallback(() => {
    if (statusRef.current !== 'ringing') return;
    const activeCallId = callIdRef.current;
    const callerId = remotePeerRef.current?.userId;
    if (activeCallId) {
      sendSignal({
        type: 'call-reject',
        callId: activeCallId,
        toUserId: callerId,
        reason: 'rejected',
      });
    }
    cleanupCallResources();
  }, [cleanupCallResources, sendSignal]);

  const endCall = useCallback(() => {
    const activeCallId = callIdRef.current;
    const peerId = remotePeerRef.current?.userId;
    if (activeCallId) {
      if (statusRef.current === 'calling') {
        sendSignal({
          type: 'call-reject',
          callId: activeCallId,
          reason: 'cancelled',
        });
      } else if (statusRef.current === 'ringing') {
        sendSignal({
          type: 'call-reject',
          callId: activeCallId,
          toUserId: peerId,
          reason: 'rejected',
        });
      } else {
        sendSignal({
          type: 'call-end',
          callId: activeCallId,
          toUserId: peerId,
        });
      }
    }
    cleanupCallResources();
  }, [cleanupCallResources, sendSignal]);

  const toggleAudioMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const nextMuted = !isAudioMutedRef.current;
    stream.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });
    setIsAudioMuted(nextMuted);

    const activeCallId = callIdRef.current;
    if (activeCallId) {
      sendSignal({
        type: 'media-state',
        callId: activeCallId,
        toUserId: remotePeerRef.current?.userId,
        audioMuted: nextMuted,
        videoEnabled: isVideoEnabledRef.current,
      });
    }
  }, [sendSignal]);

  const toggleVideoEnabled = useCallback(async () => {
    const stream = localStreamRef.current;
    if (!stream) return;

    const existingVideoTracks = stream.getVideoTracks();
    const activeCallId = callIdRef.current;
    const peerId = remotePeerRef.current?.userId;

    // Case 1: Video track already exists -> toggle enabled flag
    if (existingVideoTracks.length > 0) {
      const nextEnabled = !isVideoEnabledRef.current;
      existingVideoTracks.forEach((track) => {
        track.enabled = nextEnabled;
      });
      setIsVideoEnabled(nextEnabled);
      if (activeCallId) {
        sendSignal({
          type: 'media-state',
          callId: activeCallId,
          toUserId: peerId,
          videoEnabled: nextEnabled,
          audioMuted: isAudioMutedRef.current,
        });
      }
      return;
    }

    // Case 2: Started as audio-only call -> acquire camera & renegotiate WebRTC offer
    if (
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== 'function'
    ) {
      showNotice('この環境ではカメラを起動できません。');
      return;
    }

    let videoStream: MediaStream;
    try {
      videoStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facingModeRef.current } },
      });
    } catch (err) {
      showNotice(mapMediaErrorToJapanese(err, true));
      return;
    }

    const newVideoTrack = videoStream.getVideoTracks()[0];
    if (!newVideoTrack) return;

    stream.addTrack(newVideoTrack);
    const refreshedStream = new MediaStream(stream.getTracks());
    localStreamRef.current = refreshedStream;
    setLocalStream(refreshedStream);
    setCallType('video');
    setIsVideoEnabled(true);

    const pc = pcRef.current;
    if (pc && activeCallId && peerId) {
      try {
        pc.addTrack(newVideoTrack, refreshedStream);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sendSignal({
          type: 'offer',
          callId: activeCallId,
          toUserId: peerId,
          callType: 'video',
          sdp: offer,
          renegotiate: true,
        });
      } catch {
        showNotice('ビデオ切替の同期に失敗しました。');
      }
    }

    if (activeCallId) {
      sendSignal({
        type: 'media-state',
        callId: activeCallId,
        toUserId: peerId,
        videoEnabled: true,
        audioMuted: isAudioMutedRef.current,
      });
    }
  }, [sendSignal, showNotice]);

  const switchCameraFacing = useCallback(async () => {
    const stream = localStreamRef.current;
    if (!stream || !isVideoEnabledRef.current) return;
    if (
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== 'function'
    ) {
      return;
    }

    const nextFacing: 'user' | 'environment' =
      facingModeRef.current === 'user' ? 'environment' : 'user';

    let nextVideoStream: MediaStream;
    try {
      try {
        nextVideoStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { exact: nextFacing } },
        });
      } catch {
        nextVideoStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: nextFacing } },
        });
      }
    } catch (err) {
      showNotice(mapMediaErrorToJapanese(err, true));
      return;
    }

    const newTrack = nextVideoStream.getVideoTracks()[0];
    if (!newTrack) return;

    // Replace sender track on active peer connection without renegotiation
    const pc = pcRef.current;
    if (pc) {
      const videoSender = pc
        .getSenders()
        .find((s) => s.track && s.track.kind === 'video');
      if (videoSender) {
        try {
          await videoSender.replaceTrack(newTrack);
        } catch {
          // Ignore replace failure
        }
      }
    }

    // Stop and remove old local video tracks
    stream.getVideoTracks().forEach((oldTrack) => {
      try {
        oldTrack.stop();
      } catch {
        // Ignore
      }
      stream.removeTrack(oldTrack);
    });

    stream.addTrack(newTrack);
    const refreshed = new MediaStream(stream.getTracks());
    localStreamRef.current = refreshed;
    setLocalStream(refreshed);
    setFacingMode(nextFacing);
  }, [showNotice]);

  const toggleRingtoneMute = useCallback(() => {
    setIsRingtoneMuted((prev) => !prev);
  }, []);

  const toggleMinimized = useCallback(() => {
    setIsMinimized((prev) => !prev);
  }, []);

  return {
    status,
    callType,
    callRoomCode,
    remotePeer,
    localStream,
    remoteStream,
    isAudioMuted,
    isVideoEnabled,
    remoteVideoEnabled,
    remoteAudioMuted,
    facingMode,
    isRingtoneMuted,
    isMinimized,
    elapsedSeconds,
    callNotice,
    startCall,
    acceptIncomingCall,
    rejectIncomingCall,
    endCall,
    toggleAudioMute,
    toggleVideoEnabled,
    switchCameraFacing,
    toggleRingtoneMute,
    toggleMinimized,
    dismissCallNotice,
  };
}
