import { useEffect, useState } from 'react';
import { AlertTriangle, LogOut, ShieldAlert, X } from 'lucide-react';
import { formatRoomCode, getRoomDisplayTitle } from '../lib/constants';

interface LeaveRoomModalProps {
  roomCode: string | null;
  roomTitle?: string;
  onCancel: () => void;
  onConfirmLeave: (roomCode: string) => void;
}

export function LeaveRoomModal({
  roomCode,
  roomTitle,
  onCancel,
  onConfirmLeave,
}: LeaveRoomModalProps) {
  const [step, setStep] = useState<1 | 2>(1);

  useEffect(() => {
    if (roomCode) {
      setStep(1);
    }
  }, [roomCode]);

  useEffect(() => {
    if (!roomCode) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [roomCode, onCancel]);

  if (!roomCode) return null;

  const displayTitle = getRoomDisplayTitle(roomCode, roomTitle);
  const formattedCode = formatRoomCode(roomCode);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 dark:bg-slate-950/80 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="leave-modal-title"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top bar with step indicator & close */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-mono tabular-nums text-slate-700 dark:text-slate-300 font-medium">
              ステップ {step} / 2
            </span>
            <span aria-hidden="true">·</span>
            <span className="truncate max-w-[200px] text-slate-500 dark:text-slate-400">
              {displayTitle}
            </span>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="閉じる"
            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4">
          <div className="flex items-start gap-3.5">
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                step === 1
                  ? 'bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400'
                  : 'bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400'
              }`}
            >
              {step === 1 ? (
                <AlertTriangle className="w-5 h-5" />
              ) : (
                <ShieldAlert className="w-5 h-5" />
              )}
            </div>

            <div className="space-y-1.5 min-w-0">
              <h2
                id="leave-modal-title"
                className="text-base font-bold text-slate-900 dark:text-slate-50 leading-snug"
              >
                {step === 1
                  ? '本当にこのルームから退室しますか？'
                  : '【最終確認】本当に履歴から消去して退室しますか？'}
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {step === 1
                  ? '退室するとトーク履歴一覧からこのルームが削除されます。'
                  : '同じルーム番号を再度入力すれば再入室できますが、一覧からは消去されます。'}
              </p>
            </div>
          </div>

          {/* Target room summary */}
          <div className="px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
            <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">対象ルーム</span>
            <div className="min-w-0 text-right">
              <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                {displayTitle}
              </div>
              <div className="text-[11px] font-mono tabular-nums text-slate-500">
                #{formattedCode}
              </div>
            </div>
          </div>
        </div>

        {/* Footer buttons */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950/50 border-t border-slate-200 dark:border-slate-800/90 flex items-center justify-end gap-2.5">
          {step === 1 ? (
            <>
              <button
                type="button"
                onClick={onCancel}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-200/80 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200 transition-colors whitespace-nowrap shrink-0"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-sm font-semibold text-white transition-colors whitespace-nowrap shrink-0"
              >
                退室する（次へ）
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onCancel}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-200/80 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200 transition-colors whitespace-nowrap shrink-0"
              >
                やめる（キャンセル）
              </button>
              <button
                type="button"
                onClick={() => onConfirmLeave(roomCode)}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-sm font-semibold text-white flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
              >
                <LogOut className="w-4 h-4" />
                完全に退室する
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
