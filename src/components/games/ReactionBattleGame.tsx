import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RotateCcw, Trophy, Zap, AlertTriangle, Sparkles } from 'lucide-react';
import type {
  MiniGamePlayer,
  MiniGameSyncEventType,
  MiniGameSyncPayload,
} from '../../types/chat';

export interface ActiveMiniGameProps {
  matchId: string;
  isHost: boolean;
  host: MiniGamePlayer;
  guest: MiniGamePlayer;
  selfPlayer: MiniGamePlayer;
  opponent: MiniGamePlayer;
  rematchKey: number;
  rematchPendingFromSelf: boolean;
  rematchRequestedByOpponent: boolean;
  registerEventListener: (
    listener: (payload: MiniGameSyncPayload) => void
  ) => () => void;
  sendEvent: (
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
  ) => void;
  onReportMatchResult: (result: {
    headline: string;
    detail: string;
    winnerName?: string | null;
  }) => void;
  onRequestRematch: () => void;
}

type ReactionPhase =
  | 'preparing'
  | 'waiting'
  | 'go'
  | 'tapped'
  | 'round_result'
  | 'finished';

const WINS_TARGET = 3;

function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(3)}秒`;
}

export const ReactionBattleGame: React.FC<ActiveMiniGameProps> = ({
  isHost,
  host,
  guest,
  selfPlayer,
  opponent,
  rematchKey,
  rematchPendingFromSelf,
  rematchRequestedByOpponent,
  registerEventListener,
  sendEvent,
  onReportMatchResult,
  onRequestRematch,
}) => {
  const [round, setRound] = useState(1);
  const [phase, setPhase] = useState<ReactionPhase>('preparing');
  const [hostScore, setHostScore] = useState(0);
  const [guestScore, setGuestScore] = useState(0);
  const [myTapMs, setMyTapMs] = useState<number | null>(null);
  const [myFoul, setMyFoul] = useState(false);
  const [roundSummary, setRoundSummary] = useState('');
  const [roundWinnerId, setRoundWinnerId] = useState<string | null>(null);
  const [bestRecordMs, setBestRecordMs] = useState<number | null>(null);

  const phaseRef = useRef<ReactionPhase>('preparing');
  const roundRef = useRef(1);
  const hostScoreRef = useRef(0);
  const guestScoreRef = useRef(0);
  const bestRecordByUserRef = useRef<Record<string, number>>({});
  const greenAtRef = useRef<number>(0);

  // Host-only round tracking
  const hostTapRef = useRef<{ ms: number | null; foul: boolean } | null>(null);
  const guestTapRef = useRef<{ ms: number | null; foul: boolean } | null>(null);
  const roundResolvedRef = useRef(false);
  const resultReportedRef = useRef(false);

  const timersRef = useRef<number[]>([]);

  const clearAllTimers = useCallback(() => {
    for (const id of timersRef.current) {
      window.clearTimeout(id);
    }
    timersRef.current = [];
  }, []);

  const scheduleTimer = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timersRef.current.push(id);
    return id;
  }, []);

  const updatePhase = useCallback((next: ReactionPhase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const startRoundAsHost = useCallback(
    (nextRound: number) => {
      if (!isHost) return;
      clearAllTimers();
      roundRef.current = nextRound;
      setRound(nextRound);
      hostTapRef.current = null;
      guestTapRef.current = null;
      roundResolvedRef.current = false;
      setMyTapMs(null);
      setMyFoul(false);
      setRoundSummary('');
      setRoundWinnerId(null);

      updatePhase('waiting');
      sendEvent('reaction-arm', { round: nextRound });

      const randomDelay = 2000 + Math.floor(Math.random() * 3000);
      scheduleTimer(() => {
        if (phaseRef.current !== 'waiting' || roundResolvedRef.current) return;
        greenAtRef.current = performance.now();
        updatePhase('go');
        sendEvent('reaction-go', { round: nextRound });
      }, randomDelay);
    },
    [clearAllTimers, isHost, scheduleTimer, sendEvent, updatePhase]
  );

  const finalizeRoundAsHost = useCallback(() => {
    if (!isHost || roundResolvedRef.current) return;
    roundResolvedRef.current = true;
    clearAllTimers();

    const hTap = hostTapRef.current;
    const gTap = guestTapRef.current;

    let winnerId: string | null = null;
    let summary = '';

    if (hTap?.foul && !gTap?.foul) {
      winnerId = guest.userId;
      summary = `${host.nickname}さんがフライング！ ${guest.nickname}さんの勝ち`;
    } else if (gTap?.foul && !hTap?.foul) {
      winnerId = host.userId;
      summary = `${guest.nickname}さんがフライング！ ${host.nickname}さんの勝ち`;
    } else if (hTap?.foul && gTap?.foul) {
      winnerId = null;
      summary = '両者フライングで引き分け！';
    } else if (hTap?.ms != null && gTap?.ms != null) {
      if (hTap.ms < gTap.ms) {
        winnerId = host.userId;
        summary = `${host.nickname} ${formatSeconds(hTap.ms)} vs ${guest.nickname} ${formatSeconds(gTap.ms)}`;
      } else if (gTap.ms < hTap.ms) {
        winnerId = guest.userId;
        summary = `${guest.nickname} ${formatSeconds(gTap.ms)} vs ${host.nickname} ${formatSeconds(hTap.ms)}`;
      } else {
        winnerId = null;
        summary = `同着 ${formatSeconds(hTap.ms)} で引き分け！`;
      }
    } else if (hTap?.ms != null) {
      winnerId = host.userId;
      summary = `${host.nickname} ${formatSeconds(hTap.ms)}（タイムアウト勝利）`;
    } else if (gTap?.ms != null) {
      winnerId = guest.userId;
      summary = `${guest.nickname} ${formatSeconds(gTap.ms)}（タイムアウト勝利）`;
    } else {
      winnerId = null;
      summary = '引き分け';
    }

    if (hTap?.ms != null && !hTap.foul) {
      const prev = bestRecordByUserRef.current[host.userId];
      if (prev === undefined || hTap.ms < prev) {
        bestRecordByUserRef.current[host.userId] = hTap.ms;
      }
    }
    if (gTap?.ms != null && !gTap.foul) {
      const prev = bestRecordByUserRef.current[guest.userId];
      if (prev === undefined || gTap.ms < prev) {
        bestRecordByUserRef.current[guest.userId] = gTap.ms;
      }
    }

    const nextHostScore =
      hostScoreRef.current + (winnerId === host.userId ? 1 : 0);
    const nextGuestScore =
      guestScoreRef.current + (winnerId === guest.userId ? 1 : 0);

    hostScoreRef.current = nextHostScore;
    guestScoreRef.current = nextGuestScore;
    setHostScore(nextHostScore);
    setGuestScore(nextGuestScore);
    setRoundWinnerId(winnerId);
    setRoundSummary(summary);

    const isMatchOver =
      nextHostScore >= WINS_TARGET || nextGuestScore >= WINS_TARGET;
    const matchWinner =
      nextHostScore >= WINS_TARGET
        ? host
        : nextGuestScore >= WINS_TARGET
        ? guest
        : null;
    const winnerBestMs = matchWinner
      ? bestRecordByUserRef.current[matchWinner.userId] ?? null
      : null;

    if (winnerBestMs !== null) {
      setBestRecordMs(winnerBestMs);
    }

    sendEvent('reaction-round-end', {
      round: roundRef.current,
      hostScore: nextHostScore,
      guestScore: nextGuestScore,
      roundWinnerId: winnerId,
      roundSummary: summary,
      bestMs: winnerBestMs,
    });

    if (isMatchOver && matchWinner) {
      updatePhase('finished');
      if (!resultReportedRef.current) {
        resultReportedRef.current = true;
        const recordNote =
          winnerBestMs !== null
            ? `（記録: ${formatSeconds(winnerBestMs)}）`
            : '';
        onReportMatchResult({
          headline: `🏆 ${matchWinner.nickname}さんが早押しバトルで勝利！${recordNote}`,
          detail: `${host.nickname} ${nextHostScore} - ${nextGuestScore} ${guest.nickname}`,
          winnerName: matchWinner.nickname,
        });
      }
    } else {
      updatePhase('round_result');
      const nextRoundNumber = roundRef.current + 1;
      scheduleTimer(() => {
        startRoundAsHost(nextRoundNumber);
      }, 2200);
    }
  }, [
    clearAllTimers,
    guest,
    host,
    isHost,
    onReportMatchResult,
    scheduleTimer,
    sendEvent,
    startRoundAsHost,
    updatePhase,
  ]);

  const tryEvaluateHostRound = useCallback(() => {
    if (!isHost || roundResolvedRef.current) return;
    const h = hostTapRef.current;
    const g = guestTapRef.current;
    // Foul resolves immediately
    if (h?.foul || g?.foul) {
      finalizeRoundAsHost();
      return;
    }
    // Both players have valid reaction taps
    if (h && g) {
      finalizeRoundAsHost();
      return;
    }
    // One player tapped on green: wait up to 3.5s for the other player
    if (h || g) {
      scheduleTimer(() => {
        finalizeRoundAsHost();
      }, 3500);
    }
  }, [finalizeRoundAsHost, isHost, scheduleTimer]);

  // Reset and start on mount or rematch
  useEffect(() => {
    clearAllTimers();
    roundRef.current = 1;
    hostScoreRef.current = 0;
    guestScoreRef.current = 0;
    bestRecordByUserRef.current = {};
    hostTapRef.current = null;
    guestTapRef.current = null;
    roundResolvedRef.current = false;
    resultReportedRef.current = false;

    setRound(1);
    setHostScore(0);
    setGuestScore(0);
    setMyTapMs(null);
    setMyFoul(false);
    setRoundSummary('');
    setRoundWinnerId(null);
    setBestRecordMs(null);
    updatePhase('preparing');

    if (isHost) {
      scheduleTimer(() => {
        startRoundAsHost(1);
      }, 900);
    }

    return () => {
      clearAllTimers();
    };
  }, [clearAllTimers, isHost, rematchKey, scheduleTimer, startRoundAsHost, updatePhase]);

  // Subscribe to realtime events
  useEffect(() => {
    return registerEventListener((ev) => {
      if (ev.eventType === 'reaction-arm') {
        clearAllTimers();
        const nextRound = ev.round ?? roundRef.current;
        roundRef.current = nextRound;
        setRound(nextRound);
        setMyTapMs(null);
        setMyFoul(false);
        setRoundSummary('');
        setRoundWinnerId(null);
        updatePhase('waiting');
        return;
      }

      if (ev.eventType === 'reaction-go') {
        if (phaseRef.current === 'waiting') {
          greenAtRef.current = performance.now();
          updatePhase('go');
        }
        return;
      }

      if (ev.eventType === 'reaction-tap' && isHost) {
        if (ev.round !== undefined && ev.round !== roundRef.current) return;
        if (ev.fromUserId === guest.userId) {
          guestTapRef.current = {
            ms: ev.foul ? null : ev.reactionMs ?? null,
            foul: Boolean(ev.foul),
          };
          tryEvaluateHostRound();
        }
        return;
      }

      if (ev.eventType === 'reaction-round-end') {
        clearAllTimers();
        const nextHostScore = ev.hostScore ?? hostScoreRef.current;
        const nextGuestScore = ev.guestScore ?? guestScoreRef.current;
        hostScoreRef.current = nextHostScore;
        guestScoreRef.current = nextGuestScore;
        setHostScore(nextHostScore);
        setGuestScore(nextGuestScore);
        setRoundWinnerId(ev.roundWinnerId ?? null);
        setRoundSummary(ev.roundSummary ?? '');
        if (ev.bestMs != null) {
          setBestRecordMs(ev.bestMs);
        }
        const finished =
          nextHostScore >= WINS_TARGET || nextGuestScore >= WINS_TARGET;
        updatePhase(finished ? 'finished' : 'round_result');
      }
    });
  }, [
    clearAllTimers,
    guest.userId,
    isHost,
    registerEventListener,
    tryEvaluateHostRound,
    updatePhase,
  ]);

  const handlePadPress = () => {
    if (phaseRef.current === 'waiting') {
      // Early tap = foul!
      setMyFoul(true);
      setMyTapMs(null);
      updatePhase('tapped');
      if (isHost) {
        hostTapRef.current = { ms: null, foul: true };
        tryEvaluateHostRound();
      } else {
        sendEvent('reaction-tap', {
          round: roundRef.current,
          foul: true,
        });
      }
      return;
    }

    if (phaseRef.current === 'go') {
      const elapsed = Math.max(
        1,
        Math.round(performance.now() - greenAtRef.current)
      );
      setMyTapMs(elapsed);
      setMyFoul(false);
      updatePhase('tapped');
      if (isHost) {
        hostTapRef.current = { ms: elapsed, foul: false };
        tryEvaluateHostRound();
      } else {
        sendEvent('reaction-tap', {
          round: roundRef.current,
          reactionMs: elapsed,
          foul: false,
        });
      }
    }
  };

  const myScore = isHost ? hostScore : guestScore;
  const oppScore = isHost ? guestScore : hostScore;
  const didIWinMatch = phase === 'finished' && myScore > oppScore;

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Scoreboard */}
      <div className="grid grid-cols-3 items-center gap-2 rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800/80 p-3 shadow-sm">
        <div className="flex flex-col items-start min-w-0">
          <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
            あなた
          </span>
          <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate max-w-full">
            {selfPlayer.nickname}
          </span>
          <div className="mt-1.5 flex items-center gap-1">
            {Array.from({ length: WINS_TARGET }).map((_, i) => (
              <span
                key={i}
                className={`h-2.5 w-6 rounded-full transition-colors ${
                  i < myScore
                    ? 'bg-emerald-500'
                    : 'bg-slate-200 dark:bg-slate-700'
                }`}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-col items-center justify-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            ROUND {round}
          </span>
          <div className="text-2xl font-black tabular-nums text-slate-900 dark:text-white">
            {myScore} <span className="text-slate-400 text-base">-</span>{' '}
            {oppScore}
          </div>
          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
            3本先取
          </span>
        </div>

        <div className="flex flex-col items-end min-w-0">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
            対戦相手
          </span>
          <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate max-w-full">
            {opponent.nickname}
          </span>
          <div className="mt-1.5 flex items-center gap-1">
            {Array.from({ length: WINS_TARGET }).map((_, i) => (
              <span
                key={i}
                className={`h-2.5 w-6 rounded-full transition-colors ${
                  i < oppScore
                    ? 'bg-amber-500'
                    : 'bg-slate-200 dark:bg-slate-700'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Main Interactive Tap Area */}
      {phase === 'finished' ? (
        <div className="flex-1 flex flex-col items-center justify-center rounded-3xl border border-slate-200 dark:border-slate-700 bg-gradient-to-b from-amber-50 to-white dark:from-slate-800 dark:to-slate-900 p-6 text-center">
          <div
            className={`flex h-16 w-16 items-center justify-center rounded-2xl shadow-md mb-4 ${
              didIWinMatch
                ? 'bg-amber-400 text-slate-950'
                : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
            }`}
          >
            <Trophy className="w-8 h-8" />
          </div>
          <h3 className="text-2xl font-black text-slate-900 dark:text-white">
            {didIWinMatch ? 'あなたの勝利！🎉' : `${opponent.nickname}さんの勝利`}
          </h3>
          <p className="mt-1.5 text-sm font-semibold text-slate-600 dark:text-slate-300">
            最終スコア: {myScore} - {oppScore}
            {bestRecordMs !== null ? ` / 最速 ${formatSeconds(bestRecordMs)}` : ''}
          </p>
          {roundSummary && (
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              {roundSummary}
            </p>
          )}
          <div className="mt-6 flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={onRequestRematch}
              disabled={rematchPendingFromSelf}
              className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 px-6 py-3.5 text-sm font-bold text-white shadow-sm transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              {rematchPendingFromSelf
                ? '相手の承認を待っています...'
                : rematchRequestedByOpponent
                ? '再戦を受ける！（もう1回）'
                : 'もう1回！'}
            </button>
            {rematchRequestedByOpponent && !rematchPendingFromSelf && (
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                {opponent.nickname}さんが再戦をリクエストしています！
              </span>
            )}
          </div>
        </div>
      ) : (
        <button
          type="button"
          onPointerDown={handlePadPress}
          disabled={
            phase === 'preparing' ||
            phase === 'tapped' ||
            phase === 'round_result'
          }
          className={`flex-1 min-h-[250px] sm:min-h-[300px] w-full rounded-3xl flex flex-col items-center justify-center p-6 text-center select-none touch-manipulation transition-colors duration-75 shadow-inner ${
            phase === 'waiting'
              ? 'bg-rose-600 active:bg-rose-700 text-white cursor-pointer'
              : phase === 'go'
              ? 'bg-emerald-500 active:bg-emerald-600 text-white cursor-pointer shadow-emerald-500/30 shadow-lg'
              : phase === 'tapped'
              ? myFoul
                ? 'bg-rose-900 text-rose-100'
                : 'bg-slate-800 text-white'
              : phase === 'round_result'
              ? roundWinnerId === selfPlayer.userId
                ? 'bg-emerald-600 text-white'
                : roundWinnerId === null
                ? 'bg-slate-700 text-white'
                : 'bg-slate-800 text-slate-100'
              : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
          }`}
        >
          {phase === 'preparing' && (
            <>
              <Zap className="w-12 h-12 mb-3 text-amber-500 animate-pulse" />
              <div className="text-xl font-black">まもなくスタート...</div>
              <p className="mt-1 text-xs opacity-80">
                画面が緑に変わった瞬間にタップ！
              </p>
            </>
          )}

          {phase === 'waiting' && (
            <>
              <div className="text-4xl sm:text-5xl font-black tracking-tight">
                待て...
              </div>
              <p className="mt-3 text-sm font-bold text-rose-100">
                緑に変わるまでタップしないで！
              </p>
            </>
          )}

          {phase === 'go' && (
            <>
              <Zap className="w-14 h-14 mb-2 fill-white" />
              <div className="text-5xl sm:text-6xl font-black tracking-tight">
                今だ！！
              </div>
              <p className="mt-2 text-base font-bold text-emerald-50">
                今すぐタップ！
              </p>
            </>
          )}

          {phase === 'tapped' && (
            <>
              {myFoul ? (
                <>
                  <AlertTriangle className="w-12 h-12 mb-2 text-amber-300" />
                  <div className="text-3xl font-black">フライング！</div>
                  <p className="mt-2 text-xs text-rose-200">
                    緑になる前に押してしまいました...
                  </p>
                </>
              ) : (
                <>
                  <Sparkles className="w-10 h-10 mb-2 text-emerald-400" />
                  <div className="text-4xl font-black tabular-nums">
                    {myTapMs !== null ? formatSeconds(myTapMs) : '--'}
                  </div>
                  <p className="mt-2 text-xs text-slate-300">
                    対戦相手のタップを待っています...
                  </p>
                </>
              )}
            </>
          )}

          {phase === 'round_result' && (
            <>
              <div className="text-3xl font-black">
                {roundWinnerId === selfPlayer.userId
                  ? 'このラウンド勝利！'
                  : roundWinnerId === null
                  ? '引き分け！'
                  : 'このラウンド敗北...'}
              </div>
              <p className="mt-2 text-sm font-bold opacity-95">
                {roundSummary}
              </p>
              <span className="mt-4 text-xs opacity-75">
                次のラウンドを準備中...
              </span>
            </>
          )}
        </button>
      )}
    </div>
  );
};
