import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { QRCodeSVG } from 'qrcode.react';
import {
  AlertCircle,
  Camera,
  Check,
  Copy,
  Download,
  Eye,
  EyeOff,
  FileText,
  KeyRound,
  Loader2,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Upload,
  X,
} from 'lucide-react';
import {
  buildCompactQrPayload,
  decryptAccountTransferPayload,
  encryptAccountTransferPayload,
  isValidTransferCodeFormat,
} from '../lib/accountTransfer';
import type {
  AccountTransferPayload,
  CustomSticker,
  RoomHistoryItem,
  ThemeMode,
  UserProfile,
} from '../types/chat';

interface AccountTransferModalProps {
  isOpen: boolean;
  initialTab: 'export' | 'import';
  importOnly?: boolean;
  profile: UserProfile;
  recentRooms: RoomHistoryItem[];
  customStickers: CustomSticker[];
  themeMode: ThemeMode;
  officialLastReadAt: string | null;
  getRoomPasscodes: () => Record<string, string>;
  onRestoreAccount: (payload: AccountTransferPayload) => void;
  onClose: () => void;
}

const MAX_QR_CODE_CHARS = 1800;

interface TransferQrScannerProps {
  onDetected: (transferCode: string) => void;
  onCancel: () => void;
}

function TransferQrScanner({ onDetected, onCancel }: TransferQrScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const detectedRef = useRef<boolean>(false);

  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);

  useEffect(() => {
    let active = true;
    detectedRef.current = false;

    const stopCamera = () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch {
            // ignore track stop failure
          }
        });
        streamRef.current = null;
      }
    };

    const startScanner = async () => {
      if (
        typeof navigator === 'undefined' ||
        !navigator.mediaDevices ||
        typeof navigator.mediaDevices.getUserMedia !== 'function'
      ) {
        setCameraError(
          'このブラウザ環境ではカメラを利用できません。コードの貼り付けまたはファイル読込をご利用ください。'
        );
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });

        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) {
          stopCamera();
          return;
        }

        video.srcObject = stream;
        await video.play();
        if (!active) {
          stopCamera();
          return;
        }
        setCameraReady(true);

        const tick = () => {
          if (!active || detectedRef.current) return;
          try {
            const v = videoRef.current;
            const canvas = canvasRef.current;
            if (
              v &&
              canvas &&
              v.readyState === v.HAVE_ENOUGH_DATA &&
              v.videoWidth > 0 &&
              v.videoHeight > 0
            ) {
              canvas.width = v.videoWidth;
              canvas.height = v.videoHeight;
              const ctx = canvas.getContext('2d', { willReadFrequently: true });
              if (ctx) {
                ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
                const imgData = ctx.getImageData(
                  0,
                  0,
                  canvas.width,
                  canvas.height
                );
                const decoded = jsQR(
                  imgData.data,
                  imgData.width,
                  imgData.height,
                  { inversionAttempts: 'dontInvert' }
                );
                if (decoded && decoded.data) {
                  const candidate = decoded.data.trim();
                  if (isValidTransferCodeFormat(candidate)) {
                    detectedRef.current = true;
                    stopCamera();
                    onDetected(candidate);
                    return;
                  }
                }
              }
            }
          } catch {
            // Ignore transient decode frame errors on mobile Safari
          }
          rafRef.current = window.requestAnimationFrame(tick);
        };

        rafRef.current = window.requestAnimationFrame(tick);
      } catch (err) {
        if (!active) return;
        const name = err instanceof Error ? err.name : '';
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
          setCameraError(
            'カメラのアクセスが許可されませんでした。ブラウザ設定からカメラ権限を許可するか、コードを直接貼り付けてください。'
          );
        } else {
          setCameraError(
            'カメラの起動に失敗しました。コードの貼り付けまたはバックアップファイルの読込をご利用ください。'
          );
        }
      }
    };

    void startScanner();

    return () => {
      active = false;
      stopCamera();
    };
  }, [onDetected]);

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-950 overflow-hidden space-y-3 p-3.5">
      <div className="flex items-center justify-between gap-2 text-white">
        <span className="text-xs font-semibold flex items-center gap-1.5">
          <Camera className="w-4 h-4 text-emerald-400" />
          引き継ぎQRコードをカメラで読み取る
        </span>
        <button
          type="button"
          onClick={onCancel}
          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-medium text-slate-200 transition-colors"
        >
          停止
        </button>
      </div>

      {cameraError ? (
        <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-800/70 text-xs text-rose-200 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <span className="leading-relaxed">{cameraError}</span>
        </div>
      ) : (
        <div className="relative aspect-square max-h-64 mx-auto w-full rounded-xl overflow-hidden bg-black flex items-center justify-center">
          <video
            ref={videoRef}
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          <canvas ref={canvasRef} className="hidden" />
          {!cameraReady && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-950/80 text-slate-300">
              <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
              <span className="text-xs">カメラを起動しています...</span>
            </div>
          )}
          <div className="pointer-events-none absolute inset-6 border-2 border-emerald-400/80 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
        </div>
      )}
    </div>
  );
}

async function copyTextSafely(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Fallback below
  }
  try {
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export function AccountTransferModal({
  isOpen,
  initialTab,
  importOnly = false,
  profile,
  recentRooms,
  customStickers,
  themeMode,
  officialLastReadAt,
  getRoomPasscodes,
  onRestoreAccount,
  onClose,
}: AccountTransferModalProps) {
  const [activeTab, setActiveTab] = useState<'export' | 'import'>(
    importOnly ? 'import' : initialTab
  );

  // Export state
  const [exportPassword, setExportPassword] = useState('');
  const [showExportPassword, setShowExportPassword] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [qrCodeValue, setQrCodeValue] = useState<string | null>(null);
  const [qrIsCompact, setQrIsCompact] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Import state
  const [importCode, setImportCode] = useState('');
  const [importPassword, setImportPassword] = useState('');
  const [showImportPassword, setShowImportPassword] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanSuccessNotice, setScanSuccessNotice] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab(importOnly ? 'import' : initialTab);
    setExportError(null);
    setImportError(null);
    setScannerOpen(false);
    setScanSuccessNotice(false);
  }, [isOpen, initialTab, importOnly]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const activePasscodes = getRoomPasscodes();
  const savedPasscodeCount = Object.keys(activePasscodes).length;

  const handleGenerateExport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (generating) return;

    setGenerating(true);
    setExportError(null);
    setCopiedCode(false);

    try {
      const fullPayload: AccountTransferPayload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        profile,
        recentRooms,
        roomPasscodes: activePasscodes,
        customStickers,
        themeMode,
        officialLastReadAt,
      };

      const fullCode = await encryptAccountTransferPayload(
        fullPayload,
        exportPassword
      );
      setGeneratedCode(fullCode);

      if (fullCode.length <= MAX_QR_CODE_CHARS) {
        setQrCodeValue(fullCode);
        setQrIsCompact(false);
      } else {
        const compactPayload = buildCompactQrPayload(fullPayload);
        const compactCode = await encryptAccountTransferPayload(
          compactPayload,
          exportPassword
        );
        if (compactCode.length <= MAX_QR_CODE_CHARS) {
          setQrCodeValue(compactCode);
          setQrIsCompact(true);
        } else {
          setQrCodeValue(null);
          setQrIsCompact(false);
        }
      }
    } catch (err) {
      setExportError(
        err instanceof Error
          ? err.message
          : '引き継ぎコードの生成に失敗しました。'
      );
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyCode = async () => {
    if (!generatedCode) return;
    const ok = await copyTextSafely(generatedCode);
    if (ok) {
      setCopiedCode(true);
      window.setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleDownloadBackupFile = () => {
    if (!generatedCode) return;
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const blob = new Blob([generatedCode], {
      type: 'text/plain;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `roomline-backup-${y}${m}${d}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleReadBackupFile = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    setScanSuccessNotice(false);
    try {
      const content = (await file.text()).trim();
      if (!isValidTransferCodeFormat(content)) {
        setImportError(
          '選択されたファイルに有効な引き継ぎコード（RLBK1:...）が含まれていません。'
        );
        return;
      }
      setImportCode(content);
      setScanSuccessNotice(true);
    } catch {
      setImportError('バックアップファイルの読み込みに失敗しました。');
    } finally {
      e.target.value = '';
    }
  };

  const handleRestoreSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (restoring) return;
    setRestoring(true);
    setImportError(null);

    try {
      const payload = await decryptAccountTransferPayload(
        importCode,
        importPassword
      );
      onRestoreAccount(payload);
      setImportCode('');
      setImportPassword('');
      onClose();
    } catch (err) {
      setImportError(
        err instanceof Error ? err.message : 'アカウントの復元に失敗しました。'
      );
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 dark:bg-slate-950/80 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-transfer-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg max-h-[92dvh] flex flex-col rounded-t-3xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <KeyRound className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2
                id="account-transfer-modal-title"
                className="text-sm font-bold text-slate-900 dark:text-slate-50 truncate"
              >
                {importOnly
                  ? '引き継ぎコードからアカウント復元'
                  : 'アカウント引き継ぎ設定'}
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                端末変更・ブラウザ移行用の暗号化バックアップ＆復元
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

        {/* Mode Switch Tabs (hidden in onboarding importOnly mode) */}
        {!importOnly && (
          <div className="px-5 pt-3.5 pb-2 border-b border-slate-200/80 dark:border-slate-800/80 shrink-0">
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('export');
                  setScannerOpen(false);
                }}
                className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                  activeTab === 'export'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <QrCode className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>コード・QRを発行</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('import')}
                className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                  activeTab === 'import'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <RefreshCw className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                <span>アカウントを復元</span>
              </button>
            </div>
          </div>
        )}

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden chat-scroll p-5 space-y-5">
          {activeTab === 'export' ? (
            <>
              {/* Backup Scope Summary */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-950/60 p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    引き継ぎ対象データ
                  </span>
                  <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
                    ID: {profile.id.slice(0, 8)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 dark:text-slate-400">
                  <div className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
                    <span>プロフィール</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100 truncate max-w-[90px]">
                      {profile.nickname || 'ゲスト'}
                    </span>
                  </div>
                  <div className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
                    <span>トーク履歴</span>
                    <span className="font-mono font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                      {recentRooms.length}件
                    </span>
                  </div>
                  <div className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
                    <span>入室済の合言葉</span>
                    <span className="font-mono font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                      {savedPasscodeCount}件
                    </span>
                  </div>
                  <div className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
                    <span>スタンプ</span>
                    <span className="font-mono font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                      {customStickers.length}件
                    </span>
                  </div>
                </div>
              </div>

              {!generatedCode ? (
                <form onSubmit={handleGenerateExport} className="space-y-4">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="transfer-export-password"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                    >
                      引き継ぎ用パスワード（4文字以上）
                    </label>
                    <div className="relative">
                      <input
                        id="transfer-export-password"
                        type={showExportPassword ? 'text' : 'password'}
                        required
                        minLength={4}
                        maxLength={32}
                        value={exportPassword}
                        onChange={(e) => {
                          setExportPassword(e.target.value);
                          setExportError(null);
                        }}
                        placeholder="例: 4〜8桁のPINまたは合言葉"
                        className="w-full h-11 pl-3.5 pr-11 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                      />
                      <button
                        type="button"
                        onClick={() => setShowExportPassword((prev) => !prev)}
                        aria-label={
                          showExportPassword
                            ? 'パスワードを隠す'
                            : 'パスワードを表示'
                        }
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                      >
                        {showExportPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      ブラウザ内で AES-256-GCM 暗号化されます。新しい端末で復元する際にこのパスワードが必ず必要です。
                    </p>
                  </div>

                  {exportError && (
                    <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/70 text-xs text-rose-700 dark:text-rose-200">
                      <AlertCircle className="w-4 h-4 text-rose-500 dark:text-rose-400 shrink-0 mt-0.5" />
                      <span>{exportError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={exportPassword.trim().length < 4 || generating}
                    className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 text-sm font-semibold text-white flex items-center justify-center gap-2 transition-colors shadow-xs"
                  >
                    {generating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ShieldCheck className="w-4 h-4" />
                    )}
                    <span>暗号化して引き継ぎコードを発行</span>
                  </button>
                </form>
              ) : (
                <div className="space-y-4">
                  {/* QR Code Output */}
                  {qrCodeValue ? (
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 p-4 flex flex-col items-center gap-3 text-center">
                      <div className="p-3 rounded-2xl bg-white shadow-sm border border-slate-200/80">
                        <QRCodeSVG
                          value={qrCodeValue}
                          size={196}
                          level="L"
                          includeMargin={false}
                        />
                      </div>
                      <p className="text-xs font-medium text-slate-700 dark:text-slate-200">
                        新しい端末のカメラでスキャンして復元できます
                      </p>
                      {qrIsCompact && (
                        <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-relaxed">
                          ※データ容量の都合上、QRコードにはカスタム画像のみ省略されています。完全バックアップには下のコピーまたはファイル保存をご利用ください。
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
                      データ容量が大きいためQR表示を省略しました。下の「コードをコピー」または「バックアップ保存」をご利用ください。
                    </div>
                  )}

                  {/* Transfer Code Text Preview */}
                  <div className="space-y-1.5">
                    <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      暗号化済み引き継ぎコード
                    </span>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-[11px] text-slate-700 dark:text-slate-300 break-all max-h-24 overflow-y-auto select-all">
                      {generatedCode}
                    </div>
                  </div>

                  {/* Action Buttons: Copy + Download */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => void handleCopyCode()}
                      className="min-h-[44px] px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-xs font-semibold text-white flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                    >
                      {copiedCode ? (
                        <>
                          <Check className="w-4 h-4" />
                          コピーしました
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          コードをコピー
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleDownloadBackupFile}
                      className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-100 flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      ファイル保存 (.txt)
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setGeneratedCode(null);
                      setQrCodeValue(null);
                      setExportPassword('');
                      setCopiedCode(false);
                    }}
                    className="w-full min-h-[38px] rounded-xl text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/70 transition-colors"
                  >
                    別のパスワードで再発行する
                  </button>
                </div>
              )}
            </>
          ) : (
            <form onSubmit={handleRestoreSubmit} className="space-y-4">
              {/* Quick Input Helpers: Camera QR + File Load */}
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setScannerOpen((prev) => !prev);
                    setImportError(null);
                  }}
                  className={`min-h-[42px] px-3 py-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                    scannerOpen
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  <Camera className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>QRをスキャン</span>
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="min-h-[42px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <FileText className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                  <span>ファイル読込</span>
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.json,text/plain"
                  onChange={(e) => void handleReadBackupFile(e)}
                  className="hidden"
                />
              </div>

              {scannerOpen && (
                <TransferQrScanner
                  onDetected={(scanned) => {
                    setImportCode(scanned);
                    setScannerOpen(false);
                    setScanSuccessNotice(true);
                    setImportError(null);
                  }}
                  onCancel={() => setScannerOpen(false)}
                />
              )}

              {scanSuccessNotice && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/70 text-xs text-emerald-800 dark:text-emerald-200">
                  <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>
                    引き継ぎコードを読み込みました。パスワードを入力して復元してください。
                  </span>
                </div>
              )}

              <div className="space-y-1.5">
                <label
                  htmlFor="transfer-import-code"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  引き継ぎコード（RLBK1:...）
                </label>
                <textarea
                  id="transfer-import-code"
                  rows={4}
                  required
                  value={importCode}
                  onChange={(e) => {
                    setImportCode(e.target.value);
                    setImportError(null);
                  }}
                  placeholder="RLBK1: から始まる引き継ぎコードを貼り付け..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="transfer-import-password"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  引き継ぎ用パスワード
                </label>
                <div className="relative">
                  <input
                    id="transfer-import-password"
                    type={showImportPassword ? 'text' : 'password'}
                    required
                    minLength={4}
                    value={importPassword}
                    onChange={(e) => {
                      setImportPassword(e.target.value);
                      setImportError(null);
                    }}
                    placeholder="発行時に設定したパスワードを入力"
                    className="w-full h-11 pl-3.5 pr-11 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowImportPassword((prev) => !prev)}
                    aria-label={
                      showImportPassword
                        ? 'パスワードを隠す'
                        : 'パスワードを表示'
                    }
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  >
                    {showImportPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {importError && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/70 text-xs text-rose-700 dark:text-rose-200">
                  <AlertCircle className="w-4 h-4 text-rose-500 dark:text-rose-400 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{importError}</span>
                </div>
              )}

              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                ※復元を実行すると、このブラウザに保存されている現在のプロフィール・トーク履歴は復元データで上書きされます。
              </p>

              <button
                type="submit"
                disabled={
                  !importCode.trim() ||
                  importPassword.trim().length < 4 ||
                  restoring
                }
                className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 text-sm font-semibold text-white flex items-center justify-center gap-2 transition-colors shadow-xs"
              >
                {restoring ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                <span>復号してアカウントを復元</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
