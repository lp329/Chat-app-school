import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { OFFICIAL_ROOM_ID } from '../lib/constants';
import { hashRoomCode } from '../lib/crypto';
import {
  encodeGameInviteContent,
  encodeGameResultContent,
} from '../lib/minigameData';
import {
  subscribeToMiniGameSync,
  type MiniGameSyncChannel,
} from '../lib/minigameSignaling';
import type {
  MiniGameId,
  MiniGameInvitePayload,
  MiniGamePlayer,
  MiniGameSyncEventType,
  MiniGameSyncPayload,
  SupabaseConfig,
  UserProfile,
} from '../types/chat';

export interface ActiveMiniGameMatch {
  matchId: string;
  gameId: MiniGameId;
  host: MiniGamePlayer;
  guest: MiniGamePlayer;
  isHost: boolean;
  rematchKey: number;
}

export interface PendingMiniGameInvite {
  matchId: string;
  gameId: MiniGameId;
}

interface UseMiniGameSessionOptions {
  activeRoomCode: string | null;
  profile: UserProfile;
  supabaseConfig: SupabaseConfig;
  isSupabaseConfigured: boolean;
  isDisabled: boolean;
  isStealthOrMaintenance: boolean;
  onSendRoomText: (roomCode: string, text: string) => Promise<void>;
}

function createMatchId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `mg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function useMiniGameSession({
  activeRoomCode,
  profile,
  supabaseConfig,
  isSupabaseConfigured,
  isDisabled,
  isStealthOrMaintenance,
  onSendRoomText,
}: UseMiniGameSessionOptions) {
  const [isLauncherOpen, setIsLauncherOpen] = useState(false);
  const [pendingInvite, setPendingInvite] =
    useState<PendingMiniGameInvite | null>(null);
  const [joiningMatchId, setJoiningMatchId] = useState<string | null>(null);
  const [activeMatch, setActiveMatch] = useState<ActiveMiniGameMatch | null>(
    null
  );
  const [rematchPendingFromSelf, setRematchPendingFromSelf] = useState(false);
  const [rematchRequestedByOpponent, setRematchRequestedByOpponent] =
    useState(false);
  const [miniGameNotice, setMiniGameNotice] = useState<string | null>(null);

  const channelRef = useRef<MiniGameSyncChannel | null>(null);
  const activeMatchRef = useRef<ActiveMiniGameMatch | null>(null);
  const joiningMatchIdRef = useRef<string | null>(null);
  const rematchPendingSelfRef = useRef(false);
  const rematchRequestedOppRef = useRef(false);
  const joinTimeoutRef = useRef<number | null>(null);
  const noticeTimeoutRef = useRef<number | null>(null);
  const listenersRef = useRef<Set<(payload: MiniGameSyncPayload) => void>>(
    new Set()
  );

  const selfPlayer: MiniGamePlayer = useMemo(
    () => ({
      userId: profile.id,
      nickname: profile.nickname.trim() || 'ゲスト',
      avatar:
        profile.avatarType === 'preset' || profile.avatarType === 'custom'
          ? profile.avatarValue
          : null,
      avatarColor: profile.avatarColor,
    }),
    [
      profile.avatarColor,
      profile.avatarType,
      profile.avatarValue,
      profile.id,
      profile.nickname,
    ]
  );

  const selfPlayerRef = useRef<MiniGamePlayer>(selfPlayer);
  selfPlayerRef.current = selfPlayer;

  const activeRoomCodeRef = useRef<string | null>(activeRoomCode);
  activeRoomCodeRef.current = activeRoomCode;

  const showNotice = useCallback((message: string | null) => {
    if (noticeTimeoutRef.current !== null) {
      window.clearTimeout(noticeTimeoutRef.current);
      noticeTimeoutRef.current = null;
    }
    setMiniGameNotice(message);
    if (message) {
      noticeTimeoutRef.current = window.setTimeout(() => {
        setMiniGameNotice(null);
        noticeTimeoutRef.current = null;
      }, 5000);
    }
  }, []);

  const clearJoinTimeout = useCallback(() => {
    if (joinTimeoutRef.current !== null) {
      window.clearTimeout(joinTimeoutRef.current);
      joinTimeoutRef.current = null;
    }
  }, []);

  const updateActiveMatch = useCallback((next: ActiveMiniGameMatch | null) => {
    activeMatchRef.current = next;
    setActiveMatch(next);
  }, []);

  const resetRematchFlags = useCallback(() => {
    rematchPendingSelfRef.current = false;
    rematchRequestedOppRef.current = false;
    setRematchPendingFromSelf(false);
    setRematchRequestedByOpponent(false);
  }, []);

  const sendRawPayload = useCallback(
    (payload: MiniGameSyncPayload) => {
      void channelRef.current?.send(payload);
    },
    []
  );

  const sendEvent = useCallback(
    (
      eventType: MiniGameSyncEventType,
      extra?: Partial<
        Omit<
          MiniGameSyncPayload,
          | 'eventType'
          | 'matchId'
          | 'gameId'
          | 'fromUserId'
          | 'fromNickname'
          | 'fromAvatar'
          | 'fromAvatarColor'
        >
      >
    ) => {
      const current = activeMatchRef.current;
      if (!current) return;
      const self = selfPlayerRef.current;
      const opponent = current.isHost ? current.guest : current.host;

      sendRawPayload({
        eventType,
        matchId: current.matchId,
        gameId: current.gameId,
        fromUserId: self.userId,
        fromNickname: self.nickname,
        fromAvatar: self.avatar,
        fromAvatarColor: self.avatarColor,
        toUserId: opponent.userId,
        ...extra,
      });
    },
    [sendRawPayload]
  );

  const registerEventListener = useCallback(
    (listener: (payload: MiniGameSyncPayload) => void) => {
      listenersRef.current.add(listener);
      return () => {
        listenersRef.current.delete(listener);
      };
    },
    []
  );

  const leaveActiveMatch = useCallback(
    (notifyOpponent = true) => {
      const current = activeMatchRef.current;
      if (current && notifyOpponent) {
        sendEvent('match-leave');
      }
      clearJoinTimeout();
      joiningMatchIdRef.current = null;
      setJoiningMatchId(null);
      resetRematchFlags();
      updateActiveMatch(null);
    },
    [clearJoinTimeout, resetRematchFlags, sendEvent, updateActiveMatch]
  );

  // Immediately terminate everything when Stealth Calculator or Maintenance Mode activates
  useEffect(() => {
    if (!isStealthOrMaintenance) return;
    const current = activeMatchRef.current;
    if (current) {
      sendEvent('match-leave');
    }
    clearJoinTimeout();
    joiningMatchIdRef.current = null;
    setJoiningMatchId(null);
    setPendingInvite(null);
    setIsLauncherOpen(false);
    resetRematchFlags();
    updateActiveMatch(null);
    showNotice(null);
  }, [
    clearJoinTimeout,
    isStealthOrMaintenance,
    resetRematchFlags,
    sendEvent,
    showNotice,
    updateActiveMatch,
  ]);

  // Subscribe to room-scoped `minigame-sync` channel
  useEffect(() => {
    const canUseRoom =
      Boolean(activeRoomCode) &&
      activeRoomCode !== OFFICIAL_ROOM_ID &&
      !isDisabled &&
      !isStealthOrMaintenance;

    // Reset room-scoped game UI on room switch
    if (activeMatchRef.current) {
      sendEvent('match-leave');
    }
    clearJoinTimeout();
    joiningMatchIdRef.current = null;
    setJoiningMatchId(null);
    setPendingInvite(null);
    setIsLauncherOpen(false);
    resetRematchFlags();
    updateActiveMatch(null);

    if (!canUseRoom || !activeRoomCode) {
      channelRef.current?.unsubscribe();
      channelRef.current = null;
      return;
    }

    let cancelled = false;

    const handleIncomingEvent = (payload: MiniGameSyncPayload) => {
      const self = selfPlayerRef.current;

      if (payload.eventType === 'join-match') {
        // Only the invited host accepts when not already in a game
        if (activeMatchRef.current) return;
        const guestPlayer: MiniGamePlayer = payload.guest || {
          userId: payload.fromUserId,
          nickname: payload.fromNickname,
          avatar: payload.fromAvatar ?? null,
          avatarColor: payload.fromAvatarColor ?? null,
        };
        const match: ActiveMiniGameMatch = {
          matchId: payload.matchId,
          gameId: payload.gameId,
          host: self,
          guest: guestPlayer,
          isHost: true,
          rematchKey: 0,
        };
        setPendingInvite(null);
        setIsLauncherOpen(false);
        clearJoinTimeout();
        joiningMatchIdRef.current = null;
        setJoiningMatchId(null);
        resetRematchFlags();
        updateActiveMatch(match);

        sendRawPayload({
          eventType: 'match-start',
          matchId: payload.matchId,
          gameId: payload.gameId,
          fromUserId: self.userId,
          fromNickname: self.nickname,
          fromAvatar: self.avatar,
          fromAvatarColor: self.avatarColor,
          toUserId: guestPlayer.userId,
          host: self,
          guest: guestPlayer,
        });
        return;
      }

      if (payload.eventType === 'match-start') {
        if (
          activeMatchRef.current &&
          activeMatchRef.current.matchId === payload.matchId
        ) {
          return;
        }
        const hostPlayer: MiniGamePlayer = payload.host || {
          userId: payload.fromUserId,
          nickname: payload.fromNickname,
          avatar: payload.fromAvatar ?? null,
          avatarColor: payload.fromAvatarColor ?? null,
        };
        clearJoinTimeout();
        joiningMatchIdRef.current = null;
        setJoiningMatchId(null);
        setPendingInvite(null);
        setIsLauncherOpen(false);
        resetRematchFlags();
        updateActiveMatch({
          matchId: payload.matchId,
          gameId: payload.gameId,
          host: hostPlayer,
          guest: self,
          isHost: false,
          rematchKey: 0,
        });
        return;
      }

      const current = activeMatchRef.current;
      if (!current || payload.matchId !== current.matchId) return;

      if (payload.eventType === 'match-leave') {
        resetRematchFlags();
        updateActiveMatch(null);
        showNotice(`${payload.fromNickname}さんがミニゲームを終了しました`);
        return;
      }

      if (payload.eventType === 'rematch-request') {
        if (rematchPendingSelfRef.current) {
          resetRematchFlags();
          const bumped: ActiveMiniGameMatch = {
            ...current,
            rematchKey: current.rematchKey + 1,
          };
          updateActiveMatch(bumped);
          sendEvent('rematch-accept');
        } else {
          rematchRequestedOppRef.current = true;
          setRematchRequestedByOpponent(true);
        }
        return;
      }

      if (payload.eventType === 'rematch-accept') {
        resetRematchFlags();
        updateActiveMatch({
          ...current,
          rematchKey: current.rematchKey + 1,
        });
        return;
      }

      // Dispatch gameplay events synchronously to the active game component
      listenersRef.current.forEach((listener) => {
        try {
          listener(payload);
        } catch {
          // Isolate game listener errors
        }
      });
    };

    void (async () => {
      const hashed = await hashRoomCode(activeRoomCode);
      if (cancelled) return;
      const ch = subscribeToMiniGameSync(
        supabaseConfig,
        isSupabaseConfigured,
        hashed,
        profile.id,
        handleIncomingEvent
      );
      if (cancelled) {
        ch.unsubscribe();
        return;
      }
      channelRef.current = ch;
    })();

    return () => {
      cancelled = true;
      channelRef.current?.unsubscribe();
      channelRef.current = null;
    };
  }, [
    activeRoomCode,
    clearJoinTimeout,
    isDisabled,
    isStealthOrMaintenance,
    isSupabaseConfigured,
    profile.id,
    resetRematchFlags,
    sendEvent,
    sendRawPayload,
    showNotice,
    supabaseConfig,
    updateActiveMatch,
  ]);

  const openLauncher = useCallback(() => {
    if (
      !activeRoomCodeRef.current ||
      activeRoomCodeRef.current === OFFICIAL_ROOM_ID
    ) {
      return;
    }
    setIsLauncherOpen(true);
  }, []);

  const closeLauncher = useCallback(() => {
    setIsLauncherOpen(false);
  }, []);

  const createInvite = useCallback(
    async (gameId: MiniGameId) => {
      const roomCode = activeRoomCodeRef.current;
      if (!roomCode || roomCode === OFFICIAL_ROOM_ID) return;
      const matchId = createMatchId();
      const invite: MiniGameInvitePayload = {
        matchId,
        gameId,
        host: selfPlayerRef.current,
        createdAt: new Date().toISOString(),
      };
      setIsLauncherOpen(false);
      setPendingInvite({ matchId, gameId });
      await onSendRoomText(roomCode, encodeGameInviteContent(invite));
    },
    [onSendRoomText]
  );

  const cancelPendingInvite = useCallback(() => {
    setPendingInvite(null);
  }, []);

  const joinInvite = useCallback(
    (invite: MiniGameInvitePayload) => {
      if (activeMatchRef.current) return;
      const self = selfPlayerRef.current;
      if (invite.host.userId === self.userId) {
        showNotice('友達が「参加して対戦する！」を押すのを待っています');
        return;
      }

      clearJoinTimeout();
      joiningMatchIdRef.current = invite.matchId;
      setJoiningMatchId(invite.matchId);

      sendRawPayload({
        eventType: 'join-match',
        matchId: invite.matchId,
        gameId: invite.gameId,
        fromUserId: self.userId,
        fromNickname: self.nickname,
        fromAvatar: self.avatar,
        fromAvatarColor: self.avatarColor,
        toUserId: invite.host.userId,
        guest: self,
      });

      joinTimeoutRef.current = window.setTimeout(() => {
        if (joiningMatchIdRef.current === invite.matchId) {
          joiningMatchIdRef.current = null;
          setJoiningMatchId(null);
          showNotice(
            '募集主が現在このルームにいないため開始できませんでした。新しく対戦募集を送ってみてください。'
          );
        }
      }, 6000);
    },
    [clearJoinTimeout, sendRawPayload, showNotice]
  );

  const requestRematch = useCallback(() => {
    const current = activeMatchRef.current;
    if (!current) return;
    if (rematchRequestedOppRef.current) {
      resetRematchFlags();
      updateActiveMatch({
        ...current,
        rematchKey: current.rematchKey + 1,
      });
      sendEvent('rematch-accept');
    } else {
      rematchPendingSelfRef.current = true;
      setRematchPendingFromSelf(true);
      sendEvent('rematch-request');
    }
  }, [resetRematchFlags, sendEvent, updateActiveMatch]);

  const reportMatchResult = useCallback(
    (result: {
      headline: string;
      detail: string;
      winnerName?: string | null;
    }) => {
      const current = activeMatchRef.current;
      const roomCode = activeRoomCodeRef.current;
      if (!current || !current.isHost || !roomCode) return;
      const content = encodeGameResultContent({
        matchId: current.matchId,
        gameId: current.gameId,
        headline: result.headline,
        detail: result.detail,
        winnerName: result.winnerName ?? null,
        createdAt: new Date().toISOString(),
      });
      void onSendRoomText(roomCode, content);
    },
    [onSendRoomText]
  );

  const dismissNotice = useCallback(() => {
    showNotice(null);
  }, [showNotice]);

  return {
    isLauncherOpen,
    openLauncher,
    closeLauncher,
    pendingInvite,
    cancelPendingInvite,
    joiningMatchId,
    activeMatch,
    selfPlayer,
    rematchPendingFromSelf,
    rematchRequestedByOpponent,
    miniGameNotice,
    dismissNotice,
    createInvite,
    joinInvite,
    leaveActiveMatch,
    requestRematch,
    reportMatchResult,
    registerEventListener,
    sendEvent,
  };
}
