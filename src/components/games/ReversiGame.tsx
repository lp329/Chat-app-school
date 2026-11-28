import React, { useEffect, useMemo, useRef, useState } from 'react';
import { RotateCcw, Trophy } from 'lucide-react';
import type { ActiveMiniGameProps } from './ReactionBattleGame';
import {
  applyReversiMove,
  countReversiDiscs,
  createInitialReversiBoard,
  getValidReversiMoves,
  type ReversiCell,
} from '../../lib/minigameData';

export const ReversiGame: React.FC<ActiveMiniGameProps> = ({
  isHost,
  host,
  guest,
  opponent,
  rematchKey,
  rematchPendingFromSelf,
  rematchRequestedByOpponent,
  registerEventListener,
  sendEvent,
  onReportMatchResult,
  onRequestRematch,
}) => {
  // Host = Black (1), Guest = White (2)
  const mySide: 1 | 2 = isHost ? 1 : 2;
  const [board, setBoard] = useState<ReversiCell[]>(() =>
    createInitialReversiBoard()
  );
  const [currentTurn, setCurrentTurn] = useState<1 | 2>(1);
  const [lastMoveIndex, setLastMoveIndex] = useState<number | null>(null);
  const [passNotice, setPassNotice] = useState<string | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const [winnerSide, setWinnerSide] = useState<0 | 1 | 2>(0);

  const resultReportedRef = useRef(false);

  const reportFinalResult = (
    finalWinner: 0 | 1 | 2,
    blackCount: number,
    whiteCount: number
  ) => {
    if (!isHost || resultReportedRef.current) return;
    resultReportedRef.current = true;
    if (finalWinner === 1) {
      onReportMatchResult({
        headline: `🏆 ${host.nickname}さんがリバーシで勝利！（黒 ${blackCount} - 白 ${whiteCount}）`,
        detail: `${host.nickname}（黒） vs ${guest.nickname}（白）`,
        winnerName: host.nickname,
      });
    } else if (finalWinner === 2) {
      onReportMatchResult({
        headline: `🏆 ${guest.nickname}さんがリバーシで勝利！（白 ${whiteCount} - 黒 ${blackCount}）`,
        detail: `${host.nickname}（黒） vs ${guest.nickname}（白）`,
        winnerName: guest.nickname,
      });
    } else {
      onReportMatchResult({
        headline: `⚫⚪ リバーシは引き分け！（黒 ${blackCount} - 白 ${whiteCount}）`,
        detail: `${host.nickname}（黒） vs ${guest.nickname}（白）`,
        winnerName: null,
      });
    }
  };

  // Reset board on rematch
  useEffect(() => {
    setBoard(createInitialReversiBoard());
    setCurrentTurn(1);
    setLastMoveIndex(null);
    setPassNotice(null);
    setGameOver(false);
    setWinnerSide(0);
    resultReportedRef.current = false;
  }, [rematchKey]);

  // Listen for opponent moves
  useEffect(() => {
    return registerEventListener((ev) => {
      if (ev.eventType !== 'reversi-move' || !ev.board || ev.board.length !== 64) {
        return;
      }
      const nextBoard = ev.board as ReversiCell[];
      setBoard(nextBoard);
      if (ev.nextTurn === 1 || ev.nextTurn === 2) {
        setCurrentTurn(ev.nextTurn);
      }
      if (ev.lastMoveIndex !== undefined) {
        setLastMoveIndex(ev.lastMoveIndex);
      }
      if (ev.passedPlayer === 1) {
        setPassNotice(`${host.nickname}さん（黒）は置ける場所がないためパス！`);
      } else if (ev.passedPlayer === 2) {
        setPassNotice(`${guest.nickname}さん（白）は置ける場所がないためパス！`);
      } else {
        setPassNotice(null);
      }

      if (ev.gameOver) {
        const finalWinner = ev.winnerSide ?? 0;
        setGameOver(true);
        setWinnerSide(finalWinner);
        const counts = countReversiDiscs(nextBoard);
        reportFinalResult(
          finalWinner,
          ev.blackCount ?? counts.black,
          ev.whiteCount ?? counts.white
        );
      }
    });
  }, [guest.nickname, host.nickname, registerEventListener]);

  const counts = useMemo(() => countReversiDiscs(board), [board]);
  const isMyTurn = !gameOver && currentTurn === mySide;

  const validMoveSet = useMemo(() => {
    if (!isMyTurn) return new Set<number>();
    return new Set(getValidReversiMoves(board, mySide));
  }, [board, isMyTurn, mySide]);

  const handleCellClick = (idx: number) => {
    if (!isMyTurn || !validMoveSet.has(idx)) return;
    const outcome = applyReversiMove(board, idx, mySide);
    if (!outcome) return;

    setBoard(outcome.board);
    setCurrentTurn(outcome.nextTurn);
    setLastMoveIndex(idx);

    if (outcome.passedPlayer === 1) {
      setPassNotice(`${host.nickname}さん（黒）は置ける場所がないためパス！`);
    } else if (outcome.passedPlayer === 2) {
      setPassNotice(`${guest.nickname}さん（白）は置ける場所がないためパス！`);
    } else {
      setPassNotice(null);
    }

    if (outcome.gameOver) {
      setGameOver(true);
      setWinnerSide(outcome.winnerSide);
      reportFinalResult(
        outcome.winnerSide,
        outcome.blackCount,
        outcome.whiteCount
      );
    }

    sendEvent('reversi-move', {
      board: outcome.board,
      nextTurn: outcome.nextTurn,
      lastMoveIndex: idx,
      passedPlayer: outcome.passedPlayer,
      gameOver: outcome.gameOver,
      blackCount: outcome.blackCount,
      whiteCount: outcome.whiteCount,
      winnerSide: outcome.winnerSide,
    });
  };

  const didIWin = gameOver && winnerSide === mySide;
  const isDraw = gameOver && winnerSide === 0;

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Player Score & Turn Header */}
      <div className="grid grid-cols-2 gap-2.5 w-full max-w-[420px]">
        <div
          className={`flex items-center justify-between rounded-2xl border px-3 py-2.5 transition-all ${
            !gameOver && currentTurn === 1
              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/15 ring-2 ring-emerald-500/30'
              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="h-5 w-5 rounded-full bg-slate-950 border border-slate-600 shadow-xs shrink-0" />
            <div className="min-w-0">
              <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                黒 {mySide === 1 ? '（あなた）' : ''}
              </div>
              <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                {host.nickname}
              </div>
            </div>
          </div>
          <span className="text-xl font-black tabular-nums text-slate-900 dark:text-white ml-2">
            {counts.black}
          </span>
        </div>

        <div
          className={`flex items-center justify-between rounded-2xl border px-3 py-2.5 transition-all ${
            !gameOver && currentTurn === 2
              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/15 ring-2 ring-emerald-500/30'
              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="h-5 w-5 rounded-full bg-white border-2 border-slate-300 shadow-xs shrink-0" />
            <div className="min-w-0">
              <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                白 {mySide === 2 ? '（あなた）' : ''}
              </div>
              <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                {guest.nickname}
              </div>
            </div>
          </div>
          <span className="text-xl font-black tabular-nums text-slate-900 dark:text-white ml-2">
            {counts.white}
          </span>
        </div>
      </div>

      {/* Turn / Pass Indicator */}
      {!gameOver && (
        <div className="flex flex-col items-center gap-1">
          <div
            className={`rounded-xl px-3 py-1 text-xs font-bold ${
              isMyTurn
                ? 'bg-emerald-500 text-white'
                : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
            }`}
          >
            {isMyTurn
              ? 'あなたのターン（ガイドのあるマスをタップ）'
              : `${opponent.nickname}さんの思考中...`}
          </div>
          {passNotice && (
            <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
              {passNotice}
            </span>
          )}
        </div>
      )}

      {/* 8x8 Reversi Board */}
      <div className="w-full max-w-[420px] aspect-square rounded-2xl bg-emerald-800 p-2 shadow-lg border-2 border-emerald-950/60">
        <div className="grid grid-cols-8 grid-rows-8 gap-0.5 w-full h-full bg-emerald-950/50 rounded-xl overflow-hidden">
          {board.map((cell, idx) => {
            const isLegal = validMoveSet.has(idx);
            const isLast = lastMoveIndex === idx;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleCellClick(idx)}
                disabled={!isLegal}
                aria-label={`行${Math.floor(idx / 8) + 1}列${(idx % 8) + 1}`}
                className={`relative flex items-center justify-center bg-emerald-700 transition-colors touch-manipulation ${
                  isLegal
                    ? 'hover:bg-emerald-600 active:bg-emerald-500 cursor-pointer'
                    : 'cursor-default'
                }`}
              >
                {cell !== 0 && (
                  <span
                    className={`w-[78%] h-[78%] rounded-full shadow-md transition-transform duration-200 ${
                      cell === 1
                        ? 'bg-gradient-to-br from-slate-700 via-slate-900 to-black border border-slate-600/60'
                        : 'bg-gradient-to-br from-white via-slate-100 to-slate-200 border border-slate-300'
                    } ${isLast ? 'ring-2 ring-amber-400' : ''}`}
                  />
                )}
                {cell === 0 && isLegal && (
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-300/80 shadow-xs" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Game Over Result Banner */}
      {gameOver && (
        <div className="w-full max-w-[420px] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 text-center shadow-sm">
          <div className="inline-flex items-center gap-1.5 text-lg font-black text-slate-900 dark:text-white">
            <Trophy className="w-5 h-5 text-amber-500" />
            {isDraw
              ? '引き分け！'
              : didIWin
              ? 'あなたの勝利！🎉'
              : `${opponent.nickname}さんの勝利`}
          </div>
          <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
            黒 {counts.black} - 白 {counts.white}
          </p>
          <div className="mt-3 flex flex-col items-center gap-1.5">
            <button
              type="button"
              onClick={onRequestRematch}
              disabled={rematchPendingFromSelf}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 px-5 py-2.5 text-xs font-bold text-white transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {rematchPendingFromSelf
                ? '相手の承認を待っています...'
                : rematchRequestedByOpponent
                ? '再戦を受ける！（もう1回）'
                : 'もう1回！'}
            </button>
            {rematchRequestedByOpponent && !rematchPendingFromSelf && (
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                {opponent.nickname}さんが再戦をリクエストしています！
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
