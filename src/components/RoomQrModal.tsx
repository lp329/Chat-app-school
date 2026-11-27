import { useEffect, useState } from 'react';
import { Check, Copy, Lock, QrCode, ShieldCheck, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { formatRoomCode } from '../lib/constants';

interface RoomQrModalProps {
  isOpen: boolean;
  roomCode: string;
  roomTitle?: string;
  hasPasscode?: boolean;
  onClose: () => void;
}

export function RoomQrModal({
  isOpen,
  roomCode,
  roomTitle,
  hasPasscode = false,
  onClose,
}: RoomQrModalProps) {
  const [copied, setCopied] = useState(false);

  // Strictly sanitize to pure 6 digits only — NEVER include URLs or extra text
  const pureSixDigits = roomCode.replace(/\D/g, '').slice(0, 6);

  useEffect(() => {
    if (isOpen) {
      setCopied(false);
    }
  }, [isOpen, pureSixDigits]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || pureSixDigits.length !== 6) return null;

  const formatted = formatRoomCode(pureSixDigits);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(pureSixDigits);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      const temp = document.createElement('input');
      try {
        temp.value = pureSixDigits;
        document.body.appendChild(temp);
        temp.select();
        document.execCommand('copy');
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      } catch {
        // Clipboard copy unsupported in this browser context
      } finally {
        if (temp.parentNode) {
          temp.parentNode.removeChild(temp);
        }
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-slate-900/55 dark:bg-slate-950/80 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="room-qr-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-sm max-h-[92dvh] flex flex-col rounded-t-3xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <QrCode className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2
                id="room-qr-modal-title"
                className="text-sm font-bold text-slate-900 dark:text-slate-50 truncate"
              >
                ルーム番号 QRコード
              </h2>
              {roomTitle?.trim() && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {roomTitle.trim()}
                </p>
              )}
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

        {/* Body */}
        <div className="p-6 flex flex-col items-center text-center space-y-5 overflow-y-auto chat-scroll">
          {/* High-contrast white QR container (keeps crisp quiet zone in both light and dark modes) */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm max-w-full">
            <QRCodeSVG
              value={pureSixDigits}
              size={208}
              level="M"
              bgColor="#FFFFFF"
              fgColor="#0F172A"
              includeMargin={false}
              className="max-w-full h-auto"
              aria-label={`ルーム番号 ${formatted} のQRコード`}
            />
          </div>

          {/* Large legible 6-digit code */}
          <div className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-3.5 flex flex-wrap items-center justify-between gap-3">
            <div className="text-left">
              <span className="block text-[10px] font-medium text-slate-500 dark:text-slate-400">
                6桁のルーム番号
              </span>
              <span className="text-3xl font-bold font-mono tabular-nums tracking-[0.14em] text-slate-900 dark:text-white">
                {formatted}
              </span>
            </div>

            <button
              type="button"
              onClick={() => void handleCopy()}
              className={`min-h-[38px] px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                copied
                  ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                  : 'bg-white hover:bg-slate-100 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>コピー済</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                  <span>コピー</span>
                </>
              )}
            </button>
          </div>

          {/* Passcode requirement alert (only when room passcode is enabled) */}
          {hasPasscode && (
            <div className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/35 text-xs font-medium text-amber-800 dark:text-amber-200">
              <Lock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>※入室には4桁の合言葉が必要です</span>
            </div>
          )}

          {/* Security reassurance: pure 6-digit string only */}
          <div className="flex items-start gap-2 text-left text-[11px] leading-relaxed text-slate-500 dark:text-slate-400 px-1">
            <ShieldCheck className="w-4 h-4 text-sky-500 dark:text-sky-400 shrink-0 mt-0.5" />
            <span>
              このQRコードには純粋な6桁の数字のみが含まれています（URLは含まれません）。「番号で参加」のカメラから読み取れます。
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-sm font-semibold text-slate-800 dark:text-slate-100 transition-colors"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
