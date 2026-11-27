import { useEffect, useState } from 'react';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  Loader2,
  Lock,
  MessageSquarePlus,
  QrCode,
  RefreshCw,
  ShieldCheck,
  X,
} from 'lucide-react';
import { formatRoomCode, generateRoomCode } from '../lib/constants';
import { RoomQrModal } from './RoomQrModal';

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateRoom: (roomCode: string, optionalPasscode: string | null) => Promise<void>;
}

export function CreateRoomModal({
  isOpen,
  onClose,
  onCreateRoom,
}: CreateRoomModalProps) {
  const [roomCode, setRoomCode] = useState<string>(() => generateRoomCode());
  const [passcode, setPasscode] = useState('');
  const [copied, setCopied] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createdResult, setCreatedResult] = useState<{
    roomCode: string;
    hasPasscode: boolean;
  } | null>(null);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setRoomCode(generateRoomCode());
      setPasscode('');
      setCopied(false);
      setCreating(false);
      setCreatedResult(null);
      setIsQrModalOpen(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || isQrModalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !creating) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, isQrModalOpen, creating, onClose]);

  if (!isOpen) return null;

  const isPasscodeValid = passcode.length === 0 || passcode.length === 4;
  const activeCode = createdResult ? createdResult.roomCode : roomCode;

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(activeCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      const temp = document.createElement('input');
      try {
        temp.value = activeCode;
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPasscodeValid || creating) return;
    setCreating(true);
    try {
      const optPasscode = passcode.length === 4 ? passcode : null;
      await onCreateRoom(roomCode, optPasscode);
      setCopied(false);
      setCreatedResult({
        roomCode,
        hasPasscode: Boolean(optPasscode),
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 dark:bg-slate-950/80 backdrop-blur-sm p-0 sm:p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-room-modal-title"
        onClick={() => {
          if (!creating) onClose();
        }}
      >
        <div
          className="w-full sm:max-w-md max-h-[92dvh] flex flex-col rounded-t-3xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {createdResult ? (
            <>
              {/* Completion Screen Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h2
                      id="create-room-modal-title"
                      className="text-sm font-bold text-slate-900 dark:text-slate-50 truncate"
                    >
                      ルームを作成しました
                    </h2>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      番号またはQRコードを相手に共有して招待できます
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

              {/* Completion Body */}
              <div className="p-5 sm:p-6 space-y-5 overflow-y-auto chat-scroll">
                <div className="space-y-2">
                  <span className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    作成された6桁のルーム番号
                  </span>
                  <div className="rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/50 dark:bg-slate-950 px-4 py-4 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-3xl font-bold font-mono tabular-nums tracking-wider text-slate-900 dark:text-white">
                      {formatRoomCode(createdResult.roomCode)}
                    </span>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => void handleCopyCode()}
                        title="番号をコピー"
                        aria-label="番号をコピー"
                        className="min-h-[38px] px-3 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 dark:border-transparent dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-colors whitespace-nowrap"
                      >
                        {copied ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                            <span className="text-emerald-600 dark:text-emerald-300">
                              コピー済
                            </span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-slate-400" />
                            <span>コピー</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsQrModalOpen(true)}
                        title="6桁番号のQRコードを表示"
                        aria-label="QR表示"
                        className="min-h-[38px] px-3 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-xs font-semibold text-white flex items-center gap-1.5 transition-colors whitespace-nowrap shadow-xs"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        <span>QR表示</span>
                      </button>
                    </div>
                  </div>
                </div>

                {createdResult.hasPasscode && (
                  <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/35 text-xs font-medium text-amber-800 dark:text-amber-200">
                    <Lock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>※入室には4桁の合言葉が必要です</span>
                  </div>
                )}

                <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                  <ShieldCheck className="w-4 h-4 text-sky-500 dark:text-sky-400 shrink-0" />
                  <span>
                    QRコードにはURLを含めず、6桁の数字のみが安全にエンコードされます
                  </span>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsQrModalOpen(true)}
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-colors whitespace-nowrap"
                  >
                    <QrCode className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>QR表示</span>
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="min-h-[44px] px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-sm font-semibold text-white flex items-center gap-2 transition-colors whitespace-nowrap shadow-xs shadow-emerald-500/20"
                  >
                    <span>チャット画面へ進む</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Creation Form Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <MessageSquarePlus className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h2
                      id="create-room-modal-title"
                      className="text-sm font-bold text-slate-900 dark:text-slate-50 truncate"
                    >
                      新規ルームを作成
                    </h2>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      6桁の番号を相手に伝えるだけで合流できます
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  disabled={creating}
                  aria-label="閉じる"
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5 overflow-y-auto chat-scroll">
                {/* Auto-generated 6-digit number */}
                <div className="space-y-2">
                  <span className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    発行された6桁のルーム番号
                  </span>
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-4 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-3xl font-bold font-mono tabular-nums tracking-wider text-slate-900 dark:text-white">
                      {formatRoomCode(roomCode)}
                    </span>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => void handleCopyCode()}
                        title="番号をコピー"
                        aria-label="番号をコピー"
                        className="min-h-[38px] px-3 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 dark:border-transparent dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-colors whitespace-nowrap"
                      >
                        {copied ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                            <span className="text-emerald-600 dark:text-emerald-300">
                              コピー済
                            </span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-slate-400" />
                            <span>コピー</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRoomCode(generateRoomCode());
                          setCopied(false);
                        }}
                        title="別の番号を再生成"
                        aria-label="別の番号を再生成"
                        className="w-9 h-9 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 dark:border-transparent dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors shrink-0"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Optional 4-digit passcode */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="create-room-passcode"
                      className="flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300"
                    >
                      <Lock className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                      4桁の合言葉ロック
                    </label>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500">
                      任意
                    </span>
                  </div>
                  <input
                    id="create-room-passcode"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    value={passcode}
                    onChange={(e) =>
                      setPasscode(e.target.value.replace(/\D/g, '').slice(0, 4))
                    }
                    placeholder="設定する場合のみ4桁の数字（例: 2025）"
                    className="w-full h-11 px-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm font-mono tabular-nums tracking-widest text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 placeholder:font-sans placeholder:tracking-normal focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                  />
                  {passcode.length > 0 && passcode.length < 4 && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400">
                      4桁すべて入力してください（空欄のままロックなしで作成も可能）
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                  <ShieldCheck className="w-4 h-4 text-sky-500 dark:text-sky-400 shrink-0" />
                  <span>
                    番号は SHA-256 ハッシュ化、会話は AES-256-GCM で自動暗号化されます
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={creating}
                    className="min-h-[44px] px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
                  >
                    キャンセル
                  </button>
                  <button
                    type="submit"
                    disabled={!isPasscodeValid || creating}
                    className="min-h-[44px] px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-500 disabled:pointer-events-none text-sm font-semibold text-white flex items-center gap-2 transition-colors whitespace-nowrap shadow-xs shadow-emerald-500/20 disabled:shadow-none"
                  >
                    {creating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <MessageSquarePlus className="w-4 h-4" />
                    )}
                    <span>ルームを作成して入室</span>
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>

      {/* Pure 6-digit QR Code Popup Modal (Mounted only when open) */}
      {createdResult && isQrModalOpen && (
        <RoomQrModal
          isOpen={isQrModalOpen}
          roomCode={createdResult.roomCode}
          hasPasscode={createdResult.hasPasscode}
          onClose={() => setIsQrModalOpen(false)}
        />
      )}
    </>
  );
}
