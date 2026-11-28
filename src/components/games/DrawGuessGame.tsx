import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Eraser,
  Trash2,
  Send,
  Trophy,
  RotateCcw,
  CheckCircle2,
  Clock,
  Palette,
} from 'lucide-react';
import type { DrawStrokeSegment } from '../../types/chat';
import type { ActiveMiniGameProps } from './ReactionBattleGame';
import {
  findDrawPromptById,
  isDrawGuessCorrect,
  normalizeJapaneseAnswer,
  pickRandomDrawPrompt,
} from '../../lib/minigameData';

const TOTAL_ROUNDS = 4;
const ROUND_DURATION_SECONDS = 60;
const CANVAS_W = 640;
const CANVAS_H = 420;

const PEN_TOOLS = [
  { id: 'black', label: '黒', color: '#0F172A', isEraser: false },
  { id: 'red', label: '赤', color: '#EF4444', isEraser: false },
  { id: 'blue', label: '青', color: '#2563EB', isEraser: false },
  { id: 'green', label: '緑', color: '#10B981', isEraser: false },
  { id: 'eraser', label: '消しゴム', color: '#FFFFFF', isEraser: true },
] as const;

const BRUSH_SIZES = [
  { label: '細', width: 3 },
  { label: '中', width: 7 },
  { label: '太', width: 14 },
] as const;

interface GuessEntry {
  id: string;
  senderName: string;
  text: string;
  isCorrect?: boolean;
}

type DrawPhase = 'loading' | 'playing' | 'round_end' | 'finished';

export const DrawGuessGame: React.FC<ActiveMiniGameProps> = ({
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
  const [phase, setPhase] = useState<DrawPhase>('loading');
  const [drawerId, setDrawerId] = useState<string>(host.userId);
  const [promptId, setPromptId] = useState<string>('');
  const [promptWord, setPromptWord] = useState<string>('');
  const [promptHintLength, setPromptHintLength] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState(ROUND_DURATION_SECONDS);
  const [hostScore, setHostScore] = useState(0);
  const [guestScore, setGuestScore] = useState(0);
  const [guessInput, setGuessInput] = useState('');
  const [guessLog, setGuessLog] = useState<GuessEntry[]>([]);
  const [roundBanner, setRoundBanner] = useState<{
    correct: boolean;
    title: string;
    subtitle: string;
  } | null>(null);

  const [selectedToolIdx, setSelectedToolIdx] = useState(0);
  const [brushWidth, setBrushWidth] = useState<number>(7);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const lastNormPosRef = useRef<{ x: number; y: number } | null>(null);
  const outgoingBatchRef = useRef<DrawStrokeSegment[]>([]);
  const flushTimerRef = useRef<number | null>(null);

  const roundRef = useRef(1);
  const phaseRef = useRef<DrawPhase>('loading');
  const hostScoreRef = useRef(0);
  const guestScoreRef = useRef(0);
  const promptWordRef = useRef('');
  const usedPromptIdsRef = useRef<string[]>([]);
  const resultReportedRef = useRef(false);
  const roundEndedRef = useRef(false);
  const timersRef = useRef<number[]>([]);

  const isDrawer = drawerId === selfPlayer.userId;

  const clearTimers = useCallback(() => {
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

  const updatePhase = useCallback((next: DrawPhase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const clearCanvasLocal = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }, []);

  const drawSegmentsOnCanvas = useCallback((segments: DrawStrokeSegment[]) => {
    const canvas = canvasRef.current;
    if (!canvas || segments.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const seg of segments) {
      ctx.strokeStyle = seg.color;
      ctx.lineWidth = seg.width;
      ctx.beginPath();
      ctx.moveTo(seg.x1 * CANVAS_W, seg.y1 * CANVAS_H);
      ctx.lineTo(seg.x2 * CANVAS_W, seg.y2 * CANVAS_H);
      ctx.stroke();
    }
  }, []);

  const flushOutgoingStrokes = useCallback(() => {
    if (flushTimerRef.current !== null) {
      window.clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    if (outgoingBatchRef.current.length === 0) return;
    const batch = outgoingBatchRef.current;
    outgoingBatchRef.current = [];
    sendEvent('draw-stroke', {
      round: roundRef.current,
      strokes: batch,
    });
  }, [sendEvent]);

  const queueStrokeSegment = useCallback(
    (seg: DrawStrokeSegment) => {
      outgoingBatchRef.current.push(seg);
      if (outgoingBatchRef.current.length >= 16) {
        flushOutgoingStrokes();
        return;
      }
      if (flushTimerRef.current === null) {
        flushTimerRef.current = window.setTimeout(() => {
          flushOutgoingStrokes();
        }, 35);
      }
    },
    [flushOutgoingStrokes]
  );

  const finishMatchIfComplete = useCallback(
    (finalHostScore: number, finalGuestScore: number) => {
      updatePhase('finished');
      if (isHost && !resultReportedRef.current) {
        resultReportedRef.current = true;
        if (finalHostScore > finalGuestScore) {
          onReportMatchResult({
            headline: `🏆 ${host.nickname}さんがお絵描きクイズで勝利！（${finalHostScore}pt）`,
            detail: `${host.nickname} ${finalHostScore}pt - ${finalGuestScore}pt ${guest.nickname}`,
            winnerName: host.nickname,
          });
        } else if (finalGuestScore > finalHostScore) {
          onReportMatchResult({
            headline: `🏆 ${guest.nickname}さんがお絵描きクイズで勝利！（${finalGuestScore}pt）`,
            detail: `${host.nickname} ${finalHostScore}pt - ${finalGuestScore}pt ${guest.nickname}`,
            winnerName: guest.nickname,
          });
        } else {
          onReportMatchResult({
            headline: `🎨 お絵描きクイズは同点引き分け！（${finalHostScore}pt）`,
            detail: `${host.nickname} ${finalHostScore}pt - ${finalGuestScore}pt ${guest.nickname}`,
            winnerName: null,
          });
        }
      }
    },
    [guest.nickname, host.nickname, isHost, onReportMatchResult, updatePhase]
  );

  const startRoundAsHost = useCallback(
    (nextRound: number) => {
      if (!isHost) return;
      clearTimers();
      roundRef.current = nextRound;
      roundEndedRef.current = false;
      const nextDrawerId = nextRound % 2 === 1 ? host.userId : guest.userId;
      const picked = pickRandomDrawPrompt(usedPromptIdsRef.current);
      usedPromptIdsRef.current.push(picked.id);
      promptWordRef.current = picked.word;

      setRound(nextRound);
      setDrawerId(nextDrawerId);
      setPromptId(picked.id);
      setPromptWord(picked.word);
      setPromptHintLength(picked.word.length);
      setTimeLeft(ROUND_DURATION_SECONDS);
      setGuessInput('');
      setGuessLog([]);
      setRoundBanner(null);
      updatePhase('playing');
      clearCanvasLocal();

      sendEvent('draw-round-start', {
        round: nextRound,
        drawerId: nextDrawerId,
        promptId: picked.id,
        promptWord: picked.word,
        promptHintLength: picked.word.length,
        hostScore: hostScoreRef.current,
        guestScore: guestScoreRef.current,
      });
    },
    [
      clearCanvasLocal,
      clearTimers,
      guest.userId,
      host.userId,
      isHost,
      sendEvent,
      updatePhase,
    ]
  );

  const advanceAfterRoundEnd = useCallback(
    (nextHostScore: number, nextGuestScore: number) => {
      const currentRound = roundRef.current;
      if (currentRound >= TOTAL_ROUNDS) {
        scheduleTimer(() => {
          finishMatchIfComplete(nextHostScore, nextGuestScore);
        }, 2300);
      } else if (isHost) {
        scheduleTimer(() => {
          startRoundAsHost(currentRound + 1);
        }, 2400);
      }
    },
    [finishMatchIfComplete, isHost, scheduleTimer, startRoundAsHost]
  );

  // Reset on mount or rematch
  useEffect(() => {
    clearTimers();
    if (flushTimerRef.current !== null) {
      window.clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    outgoingBatchRef.current = [];
    usedPromptIdsRef.current = [];
    roundRef.current = 1;
    hostScoreRef.current = 0;
    guestScoreRef.current = 0;
    resultReportedRef.current = false;
    roundEndedRef.current = false;

    setRound(1);
    setHostScore(0);
    setGuestScore(0);
    setGuessLog([]);
    setGuessInput('');
    setRoundBanner(null);
    updatePhase('loading');
    clearCanvasLocal();

    if (isHost) {
      scheduleTimer(() => {
        startRoundAsHost(1);
      }, 450);
    }

    return () => {
      clearTimers();
      if (flushTimerRef.current !== null) {
        window.clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
    };
  }, [clearCanvasLocal, clearTimers, isHost, rematchKey, scheduleTimer, startRoundAsHost, updatePhase]);

  // Ensure white background when canvas mounts
  useEffect(() => {
    clearCanvasLocal();
  }, [clearCanvasLocal]);

  // Countdown timer during playing phase
  useEffect(() => {
    if (phase !== 'playing') return;
    const interval = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [phase, round]);

  // Host triggers timeout when countdown hits 0
  useEffect(() => {
    if (phase !== 'playing' || timeLeft > 0 || !isHost || roundEndedRef.current) {
      return;
    }
    roundEndedRef.current = true;
    updatePhase('round_end');
    setRoundBanner({
      correct: false,
      title: '時間切れ！',
      subtitle: `正解は「${promptWordRef.current}」でした`,
    });
    sendEvent('draw-timeout', {
      round: roundRef.current,
      promptWord: promptWordRef.current,
      hostScore: hostScoreRef.current,
      guestScore: guestScoreRef.current,
    });
    advanceAfterRoundEnd(hostScoreRef.current, guestScoreRef.current);
  }, [advanceAfterRoundEnd, isHost, phase, sendEvent, timeLeft, updatePhase]);

  // Subscribe to realtime sync events
  useEffect(() => {
    return registerEventListener((ev) => {
      if (ev.eventType === 'draw-round-start') {
        clearTimers();
        const nextRound = ev.round ?? 1;
        roundRef.current = nextRound;
        roundEndedRef.current = false;
        promptWordRef.current = ev.promptWord ?? '';

        setRound(nextRound);
        setDrawerId(ev.drawerId ?? host.userId);
        setPromptId(ev.promptId ?? '');
        setPromptWord(ev.promptWord ?? '');
        setPromptHintLength(ev.promptHintLength ?? 0);
        setTimeLeft(ROUND_DURATION_SECONDS);
        setGuessInput('');
        setGuessLog([]);
        setRoundBanner(null);
        if (ev.hostScore !== undefined) {
          hostScoreRef.current = ev.hostScore;
          setHostScore(ev.hostScore);
        }
        if (ev.guestScore !== undefined) {
          guestScoreRef.current = ev.guestScore;
          setGuestScore(ev.guestScore);
        }
        updatePhase('playing');
        clearCanvasLocal();
        return;
      }

      if (ev.eventType === 'draw-stroke') {
        if (ev.strokes && ev.strokes.length > 0) {
          drawSegmentsOnCanvas(ev.strokes);
        }
        return;
      }

      if (ev.eventType === 'draw-clear') {
        clearCanvasLocal();
        return;
      }

      if (ev.eventType === 'draw-guess') {
        const text = ev.guessText?.trim();
        if (text) {
          setGuessLog((prev) => [
            ...prev.slice(-12),
            {
              id: `${Date.now()}_${Math.random()}`,
              senderName: ev.fromNickname,
              text,
            },
          ]);
        }
        return;
      }

      if (ev.eventType === 'draw-correct') {
        if (roundEndedRef.current) return;
        roundEndedRef.current = true;
        const pts = ev.pointsAwarded ?? 100;
        const nextHostScore =
          ev.hostScore !== undefined
            ? ev.hostScore
            : hostScoreRef.current + (ev.fromUserId === host.userId ? pts : 0);
        const nextGuestScore =
          ev.guestScore !== undefined
            ? ev.guestScore
            : guestScoreRef.current +
              (ev.fromUserId === guest.userId ? pts : 0);

        hostScoreRef.current = nextHostScore;
        guestScoreRef.current = nextGuestScore;
        setHostScore(nextHostScore);
        setGuestScore(nextGuestScore);

        if (ev.guessText) {
          setGuessLog((prev) => [
            ...prev.slice(-12),
            {
              id: `${Date.now()}_ok`,
              senderName: ev.fromNickname,
              text: ev.guessText || '',
              isCorrect: true,
            },
          ]);
        }

        updatePhase('round_end');
        setRoundBanner({
          correct: true,
          title: '正解！🎉',
          subtitle: `${ev.fromNickname}さんが「${ev.promptWord || promptWordRef.current}」を当てました（+${pts}pt）`,
        });
        advanceAfterRoundEnd(nextHostScore, nextGuestScore);
        return;
      }

      if (ev.eventType === 'draw-timeout') {
        if (roundEndedRef.current) return;
        roundEndedRef.current = true;
        updatePhase('round_end');
        setRoundBanner({
          correct: false,
          title: '時間切れ！',
          subtitle: `正解は「${ev.promptWord || promptWordRef.current}」でした`,
        });
        advanceAfterRoundEnd(hostScoreRef.current, guestScoreRef.current);
      }
    });
  }, [
    advanceAfterRoundEnd,
    clearCanvasLocal,
    clearTimers,
    drawSegmentsOnCanvas,
    guest.userId,
    host.userId,
    registerEventListener,
    updatePhase,
  ]);

  // Pointer drawing handlers (Drawer only)
  const getNormalizedPoint = (
    e: React.PointerEvent<HTMLCanvasElement>
  ): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    return {
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawer || phase !== 'playing') return;
    e.preventDefault();
    const pos = getNormalizedPoint(e);
    if (!pos) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    isDrawingRef.current = true;
    lastNormPosRef.current = pos;

    const activeTool = PEN_TOOLS[selectedToolIdx] || PEN_TOOLS[0];
    const effectiveWidth = activeTool.isEraser ? brushWidth * 2.4 : brushWidth;
    const dot: DrawStrokeSegment = {
      x1: pos.x,
      y1: pos.y,
      x2: pos.x + 0.0005,
      y2: pos.y + 0.0005,
      color: activeTool.color,
      width: effectiveWidth,
    };
    drawSegmentsOnCanvas([dot]);
    queueStrokeSegment(dot);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !isDrawer || phase !== 'playing') return;
    e.preventDefault();
    const pos = getNormalizedPoint(e);
    const prev = lastNormPosRef.current;
    if (!pos || !prev) return;

    const dx = pos.x - prev.x;
    const dy = pos.y - prev.y;
    if (dx * dx + dy * dy < 0.000004) return;

    const activeTool = PEN_TOOLS[selectedToolIdx] || PEN_TOOLS[0];
    const effectiveWidth = activeTool.isEraser ? brushWidth * 2.4 : brushWidth;
    const seg: DrawStrokeSegment = {
      x1: prev.x,
      y1: prev.y,
      x2: pos.x,
      y2: pos.y,
      color: activeTool.color,
      width: effectiveWidth,
    };
    lastNormPosRef.current = pos;
    drawSegmentsOnCanvas([seg]);
    queueStrokeSegment(seg);
  };

  const handlePointerEnd = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    lastNormPosRef.current = null;
    flushOutgoingStrokes();
  };

  const handleClearCanvas = () => {
    if (!isDrawer || phase !== 'playing') return;
    clearCanvasLocal();
    sendEvent('draw-clear', { round: roundRef.current });
  };

  const handleGuessSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isDrawer || phase !== 'playing' || roundEndedRef.current) return;
    const text = guessInput.trim();
    if (!text) return;
    setGuessInput('');

    const promptObj = findDrawPromptById(promptId);
    const isMatch = promptObj
      ? isDrawGuessCorrect(text, promptObj)
      : normalizeJapaneseAnswer(text) === normalizeJapaneseAnswer(promptWord);

    if (isMatch) {
      roundEndedRef.current = true;
      const points = 100 + Math.max(0, timeLeft);
      const nextHostScore =
        hostScoreRef.current + (selfPlayer.userId === host.userId ? points : 0);
      const nextGuestScore =
        guestScoreRef.current +
        (selfPlayer.userId === guest.userId ? points : 0);

      hostScoreRef.current = nextHostScore;
      guestScoreRef.current = nextGuestScore;
      setHostScore(nextHostScore);
      setGuestScore(nextGuestScore);

      setGuessLog((prev) => [
        ...prev.slice(-12),
        {
          id: `${Date.now()}_me_ok`,
          senderName: selfPlayer.nickname,
          text,
          isCorrect: true,
        },
      ]);

      updatePhase('round_end');
      setRoundBanner({
        correct: true,
        title: '正解！🎉',
        subtitle: `「${promptWord}」を見事当てました！（+${points}pt）`,
      });

      sendEvent('draw-correct', {
        round: roundRef.current,
        guessText: text,
        promptWord,
        pointsAwarded: points,
        hostScore: nextHostScore,
        guestScore: nextGuestScore,
      });

      advanceAfterRoundEnd(nextHostScore, nextGuestScore);
    } else {
      setGuessLog((prev) => [
        ...prev.slice(-12),
        {
          id: `${Date.now()}_me`,
          senderName: selfPlayer.nickname,
          text,
        },
      ]);
      sendEvent('draw-guess', {
        round: roundRef.current,
        guessText: text,
      });
    }
  };

  const myScore = isHost ? hostScore : guestScore;
  const oppScore = isHost ? guestScore : hostScore;

  if (phase === 'finished') {
    const isWin = myScore > oppScore;
    const isDraw = myScore === oppScore;
    return (
      <div className="flex flex-col items-center justify-center h-full rounded-3xl border border-slate-200 dark:border-slate-700 bg-gradient-to-b from-sky-50 to-white dark:from-slate-800 dark:to-slate-900 p-6 text-center">
        <div
          className={`flex h-16 w-16 items-center justify-center rounded-2xl shadow-md mb-4 ${
            isWin
              ? 'bg-amber-400 text-slate-950'
              : 'bg-sky-500 text-white'
          }`}
        >
          <Trophy className="w-8 h-8" />
        </div>
        <h3 className="text-2xl font-black text-slate-900 dark:text-white">
          {isDraw
            ? '引き分け！🎨'
            : isWin
            ? 'あなたの勝利！🎉'
            : `${opponent.nickname}さんの勝利`}
        </h3>
        <div className="mt-4 grid grid-cols-2 gap-3 w-full max-w-xs">
          <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3">
            <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 truncate">
              あなた
            </div>
            <div className="text-2xl font-black tabular-nums text-slate-900 dark:text-white">
              {myScore}
              <span className="text-xs font-bold ml-0.5 text-slate-400">pt</span>
            </div>
          </div>
          <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3">
            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 truncate">
              {opponent.nickname}
            </div>
            <div className="text-2xl font-black tabular-nums text-slate-900 dark:text-white">
              {oppScore}
              <span className="text-xs font-bold ml-0.5 text-slate-400">pt</span>
            </div>
          </div>
        </div>
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
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Top Status Strip: Round, Role/Prompt, Timer, Score */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800/80 px-3.5 py-2.5 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-lg bg-sky-100 dark:bg-sky-500/20 px-2 py-0.5 text-[11px] font-extrabold text-sky-700 dark:text-sky-300">
            R{round}/{TOTAL_ROUNDS}
          </span>
          {phase === 'loading' ? (
            <span className="text-xs font-bold text-slate-500">お題を準備中...</span>
          ) : isDrawer ? (
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                お題:
              </span>
              <span className="rounded-lg bg-amber-100 dark:bg-amber-500/20 px-2.5 py-0.5 text-sm font-black text-amber-800 dark:text-amber-200">
                {promptWord}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-sky-500" />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                {opponent.nickname}さんが描画中
              </span>
              {promptHintLength > 0 && (
                <span className="text-[11px] font-bold text-slate-400">
                  （{promptHintLength}文字）
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="text-xs font-bold tabular-nums text-slate-600 dark:text-slate-300">
            あなた {myScore}pt / 相手 {oppScore}pt
          </div>
          <div
            className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-black tabular-nums ${
              timeLeft <= 10
                ? 'bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-300'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            {timeLeft}s
          </div>
        </div>
      </div>

      {/* Canvas Board */}
      <div className="relative w-full overflow-hidden rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white shadow-sm">
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          className={`block w-full aspect-[640/420] touch-none select-none ${
            isDrawer && phase === 'playing' ? 'cursor-crosshair' : 'cursor-default'
          }`}
        />

        {roundBanner && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/65 backdrop-blur-xs p-4 text-center text-white">
            {roundBanner.correct && (
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mb-2" />
            )}
            <div className="text-3xl font-black">{roundBanner.title}</div>
            <p className="mt-1.5 text-sm font-bold text-slate-100">
              {roundBanner.subtitle}
            </p>
          </div>
        )}
      </div>

      {/* Controls: Drawing Toolbar for Drawer, Answer Form for Guesser */}
      {isDrawer ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 p-2.5">
          <div className="flex items-center gap-1.5">
            {PEN_TOOLS.map((tool, idx) => {
              const active = selectedToolIdx === idx;
              return (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => setSelectedToolIdx(idx)}
                  aria-label={tool.label}
                  title={tool.label}
                  className={`flex h-9 w-9 items-center justify-center rounded-xl border-2 transition-transform cursor-pointer ${
                    active
                      ? 'border-emerald-500 scale-105 shadow-sm'
                      : 'border-slate-200 dark:border-slate-600'
                  } ${tool.isEraser ? 'bg-slate-100 dark:bg-slate-700' : ''}`}
                >
                  {tool.isEraser ? (
                    <Eraser className="w-4 h-4 text-slate-700 dark:text-slate-200" />
                  ) : (
                    <span
                      className="h-5 w-5 rounded-full border border-black/10"
                      style={{ backgroundColor: tool.color }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5">
            {BRUSH_SIZES.map((sz) => (
              <button
                key={sz.label}
                type="button"
                onClick={() => setBrushWidth(sz.width)}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                  brushWidth === sz.width
                    ? 'bg-slate-900 dark:bg-emerald-500 text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                {sz.label}
              </button>
            ))}

            <button
              type="button"
              onClick={handleClearCanvas}
              className="ml-1 inline-flex items-center gap-1 rounded-xl border border-rose-200 dark:border-rose-500/35 bg-rose-50 dark:bg-rose-500/15 px-2.5 py-1.5 text-xs font-bold text-rose-600 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-500/25 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              全消去
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleGuessSubmit} className="flex items-center gap-2">
          <input
            type="text"
            value={guessInput}
            onChange={(e) => setGuessInput(e.target.value)}
            disabled={phase !== 'playing'}
            placeholder="お題をひらがな・カタカナ・漢字で入力..."
            className="flex-1 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <button
            type="submit"
            disabled={phase !== 'playing' || !guessInput.trim()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 px-4 py-2.5 text-sm font-bold text-white transition-colors cursor-pointer shrink-0"
          >
            <Send className="w-4 h-4" />
            回答
          </button>
        </form>
      )}

      {/* Live Guess Feed */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/60 px-3 py-2 min-h-[44px] max-h-[82px] overflow-y-auto">
        {guessLog.length === 0 ? (
          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            {isDrawer
              ? '相手の回答がここにリアルタイム表示されます'
              : '絵を見て何度でも回答できます（例: ねこ / ネコ / 猫）'}
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {guessLog.map((entry) => (
              <span
                key={entry.id}
                className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-semibold ${
                  entry.isCorrect
                    ? 'bg-emerald-500 text-white'
                    : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600'
                }`}
              >
                <span className="opacity-70 text-[10px]">{entry.senderName}:</span>
                <span>{entry.text}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
