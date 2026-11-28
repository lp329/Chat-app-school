import React from 'react';
import { Calculator, Gamepad2, X, Zap, Palette, Circle } from 'lucide-react';
import type {
  MiniGamePlayer,
  MiniGameSyncEventType,
  MiniGameSyncPayload,
} from '../types/chat';
import type { ActiveMiniGameMatch } from '../hooks/useMiniGameSession';
import { getMiniGameMeta } from '../lib/minigameData';
import { ReactionBattleGame } from './games/ReactionBattleGame';
import { DrawGuessGame } from './games/DrawGuessGame';
import { ReversiGame } from './games/ReversiGame';

interface MiniGameOverlayProps {
  match: ActiveMiniGameMatch | null;
  selfPlayer: MiniGamePlayer;
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
  onLeaveMatch: () => void;
  onTriggerCamouflage: () => void;
}

export const MiniGameOverlay: React.FC<MiniGameOverlayProps> = ({
  match,
  selfPlayer,
  rematchPendingFromSelf,
  rematchRequestedByOpponent,
  registerEventListener,
  sendEvent,
  onReportMatchResult,
  onRequestRematch,
  onLeaveMatch,
  onTriggerCamouflage,
}) => {
  if (!match) return null;

  const meta = getMiniGameMeta(match.gameId);
  const opponent = match.isHost ? match.guest : match.host;

  const gameProps = {
    matchId: match.matchId,
    isHost: match.isHost,
    host: match.host,
    guest: match.guest,
    selfPlayer,
    opponent,
    rematchKey: match.rematchKey,
    rematchPendingFromSelf,
    rematchRequestedByOpponent,
    registerEventListener,
    sendEvent,
    onReportMatchResult,
    onRequestRematch,
  };

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-2 sm:p-4">
      <div className="flex flex-col w-full max-w-2xl max-h-[96dvh] rounded-3xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 shadow-2xl overflow-hidden">
        {/* Top Bar */}
        <div className="flex items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${meta.accentClass}`}
            >
              {match.gameId === 'reaction' ? (
                <Zap className="w-4 h-4" />
              ) : match.gameId === 'draw_guess' ? (
                <Palette className="w-4 h-4" />
              ) : match.gameId === 'reversi' ? (
                <Circle className="w-4 h-4" />
              ) : (
                <Gamepad2 className="w-4 h-4" />
              )}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-extrabold text-slate-900 dark:text-white truncate">
                {meta.shortTitle}
              </div>
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate">
                vs {opponent.nickname}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onTriggerCamouflage}
              title="電卓モードへ緊急切り替え"
              aria-label="電卓モードへ緊急切り替え"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              <Calculator className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onLeaveMatch}
              className="inline-flex items-center gap-1 rounded-xl border border-rose-200 dark:border-rose-500/35 bg-rose-50 dark:bg-rose-500/15 px-3 py-1.5 text-xs font-bold text-rose-600 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-500/25 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              終了
            </button>
          </div>
        </div>

        {/* Game Body */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5">
          {match.gameId === 'reaction' && <ReactionBattleGame {...gameProps} />}
          {match.gameId === 'draw_guess' && <DrawGuessGame {...gameProps} />}
          {match.gameId === 'reversi' && <ReversiGame {...gameProps} />}
        </div>
      </div>
    </div>
  );
};
