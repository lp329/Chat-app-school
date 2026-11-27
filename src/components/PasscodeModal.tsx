import { useEffect, useRef, useState } from 'react';
import { Check, KeyRound, Loader2, Lock, Unlock, X } from 'lucide-react';
import { formatRoomCode, getRoomDisplayTitle } from '../lib/constants';
import { verifyRoomPasscode } from '../lib/crypto';

interface PasscodeModalProps {
  mode: 'verify' | 'manage';
  isOpen: boolean;
  roomCode: string;
  roomTitle?: string;
  currentPasscode?: string | null;
  onClose: () => void;
  onVerifySuccess?: (roomCode: string, verifiedPasscode: string) => void;
  onSavePasscode?: (roomCode: string, nextPasscode: string | null) => Promise<string | null>;
}

export function PasscodeModal({
  mode,
  isOpen,
  roomCode,
  roomTitle,
  currentPasscode,
  onClose,
  onVerifySuccess,
  onSavePasscode,
}: PasscodeModalProps) {
  const [digits, setDigits] = useState<string[]>(['', '', '', '']);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (isOpen) {
      // Passcodes are stored as SHA-256 hashes so we always start blank
      setDigits(['', '', '', '']);
      setError(null);
      setSaving(false);
      setTimeout(() => inputRefs.current[0]?.focus(), 40);
    }
  }, [isOpen, mode, currentPasscode]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const codeValue = digits.join('');
  const isComplete = codeValue.length === 4;
  const displayTitle = getRoomDisplayTitle(roomCode, roomTitle);

  const handleDigitChange = (index: number, raw: string) => {
    const cleaned = raw.replace(/\D/g, '');
    setError(null);
    if (!cleaned) {
      const next = [...digits];
      next[index] = '';
      setDigits(next);
      return;
    }

    const chars = cleaned.slice(0, 4 - index).split('');
    const next = [...digits];
    chars.forEach((ch, offset) => {
      next[index + offset] = ch;
    });
    setDigits(next);

    const nextIdx = Math.min(index + chars.length, 3);
    inputRefs.current[nextIdx]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      setError(null);
      if (digits[index]) {
        const next = [...digits];
        next[index] = '';
        setDigits(next);
      } else if (index > 0) {
        const next = [...digits];
        next[index - 1] = '';
        setDigits(next);
        inputRefs.current[index - 1]?.focus();
      }
      e.preventDefault();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    if (!pasted) return;
    const next = ['', '', '', ''];
    for (let i = 0; i < pasted.length; i++) {
      next[i] = pasted[i];
    }
    setDigits(next);
    setError(null);
    inputRefs.current[Math.min(pasted.length, 3)]?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isComplete || saving) return;

    if (mode === 'verify') {
      setSaving(true);
      setError(null);
      const ok = await verifyRoomPasscode(roomCode, codeValue, currentPasscode || '');
      setSaving(false);
      if (ok) {
        onVerifySuccess?.(roomCode, codeValue);
      } else {
        setError('合言葉が一致しません。4桁の数字を確認してください。');
        setDigits(['', '', '', '']);
        setTimeout(() => inputRefs.current[0]?.focus(), 30);
      }
      return;
    }

    if (mode === 'manage' && onSavePasscode) {
      setSaving(true);
      setError(null);
      const err = await onSavePasscode(roomCode, codeValue);
      setSaving(false);
      if (err) {
        setError(`保存エラー: ${err}`);
        return;
      }
      onClose();
    }
  };

  const handleRemoveLock = async () => {
    if (!onSavePasscode || saving) return;
    setSaving(true);
    setError(null);
    const err = await onSavePasscode(roomCode, null);
    setSaving(false);
    if (err) {
      setError(`解除エラー: ${err}`);
      return;
    }
    onClose();
  };

  const hasExistingLock = Boolean(currentPasscode && currentPasscode.trim());

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 dark:bg-slate-950/80 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="passcode-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                mode === 'verify'
                  ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                  : hasExistingLock
                    ? 'bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              {mode === 'verify' ? (
                <KeyRound className="w-4 h-4" />
              ) : (
                <Lock className="w-4 h-4" />
              )}
            </div>
            <div className="min-w-0">
              <h2
                id="passcode-modal-title"
                className="text-sm font-bold text-slate-900 dark:text-slate-50 truncate"
              >
                {mode === 'verify' ? '合言葉（4桁）の入力' : 'ルームの合言葉ロック'}
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate font-mono tabular-nums">
                {displayTitle} · #{formatRoomCode(roomCode)}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            {mode === 'verify'
              ? 'このルームは4桁の合言葉でロックされています。合言葉はメッセージのエンドツーエンド復号鍵にも使用されます。'
              : hasExistingLock
                ? '現在4桁の合言葉が設定されています（SHA-256ハッシュで保護）。新しい4桁を入力して更新するか、ロックを解除できます。'
                : '4桁の数字を設定すると入室時に認証が必要になり、SHA-256ハッシュで保存されるほかE2EE暗号化鍵の強化にも使用されます。'}
          </p>

          <div
            className="grid grid-cols-4 gap-3"
            role="group"
            aria-label="4桁の合言葉入力"
          >
            {digits.map((digit, index) => (
              <input
                key={index}
                ref={(el) => {
                  inputRefs.current[index] = el;
                }}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={digit}
                aria-label={`合言葉 ${index + 1}桁目`}
                onChange={(e) => handleDigitChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onPaste={handlePaste}
                onFocus={(e) => e.target.select()}
                placeholder="•"
                className="w-full h-14 text-center text-2xl font-bold font-mono tabular-nums rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-50 placeholder:text-slate-300 dark:placeholder:text-slate-700 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/25 transition-all"
              />
            ))}
          </div>

          {error && (
            <p className="text-xs text-rose-600 dark:text-rose-400 font-medium leading-relaxed">
              {error}
            </p>
          )}

          <div className="flex flex-col gap-2.5 pt-1">
            <button
              type="submit"
              disabled={!isComplete || saving}
              className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-500 disabled:pointer-events-none text-sm font-semibold text-white flex items-center justify-center gap-2 transition-colors shadow-xs shadow-emerald-500/20 disabled:shadow-none"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              <span>
                {mode === 'verify'
                  ? 'ロックを解除して入室'
                  : hasExistingLock
                    ? '合言葉を更新する'
                    : '合言葉を設定する'}
              </span>
            </button>

            {mode === 'manage' && hasExistingLock && (
              <button
                type="button"
                onClick={() => void handleRemoveLock()}
                disabled={saving}
                className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-600 dark:bg-slate-800 dark:hover:bg-rose-950/70 dark:hover:text-rose-200 border border-slate-200 dark:border-slate-700/60 text-xs font-medium text-slate-600 dark:text-slate-300 flex items-center justify-center gap-1.5 transition-colors"
              >
                <Unlock className="w-3.5 h-3.5" />
                合言葉ロックを解除する
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
