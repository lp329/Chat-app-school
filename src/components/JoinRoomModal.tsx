import { useCallback, useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import {
  AlertCircle,
  ArrowRight,
  Camera,
  Hash,
  Loader2,
  Lock,
  QrCode,
  X,
} from 'lucide-react';
import { formatRoomCode } from '../lib/constants';
import { hashRoomCode, verifyRoomPasscode } from '../lib/crypto';
import { getMockRoomMeta } from '../lib/storage';
import { fetchSingleRoomFromSupabase } from '../lib/supabaseService';
import type { RoomRecord, SupabaseConfig } from '../types/chat';

interface QrCameraScannerProps {
  onDecodedCode: (sixDigitCode: string) => void;
  onCameraError: (message: string) => void;
  onCancel: () => void;
}

const QR_DECODE_INTERVAL_MS = 120;

/**
 * Isolated camera scanner component.
 * Mounted ONLY while scanning so MediaStream, <video>, <canvas>, and rAF loop
 * are completely destroyed when closed.
 */
function QrCameraScanner({
  onDecodedCode,
  onCameraError,
  onCancel,
}: QrCameraScannerProps) {
  const [cameraReady, setCameraReady] = useState(false);
  const [scanWarning, setScanWarning] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    let lastDecodeAt = 0;

    const cleanupStream = () => {
      if (rafIdRef.current !== null) {
        window.cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch {
            // Ignore track stop errors
          }
        });
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };

    const startScanner = async () => {
      try {
        if (
          typeof navigator === 'undefined' ||
          !navigator.mediaDevices ||
          typeof navigator.mediaDevices.getUserMedia !== 'function'
        ) {
          if (!cancelled) {
            onCameraError(
              'このブラウザまたは環境ではカメラ機能が利用できません。6桁の番号を手入力してください。'
            );
          }
          return;
        }

        let stream: MediaStream | null = null;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: 'environment' },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          });
        } catch {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: true,
              audio: false,
            });
          } catch (fallbackErr) {
            if (!cancelled) {
              const isDenied =
                fallbackErr instanceof DOMException &&
                (fallbackErr.name === 'NotAllowedError' ||
                  fallbackErr.name === 'PermissionDeniedError');
              onCameraError(
                isDenied
                  ? 'カメラへのアクセスが拒否されました。ブラウザの設定でカメラを許可するか、6桁の番号を手入力してください。'
                  : 'カメラを起動できませんでした。別のアプリがカメラを使用していないか確認してください。'
              );
            }
            return;
          }
        }

        if (cancelled) {
          stream.getTracks().forEach((t) => {
            try {
              t.stop();
            } catch {
              // Ignore track stop errors
            }
          });
          return;
        }

        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) {
          cleanupStream();
          return;
        }

        video.srcObject = stream;
        video.setAttribute('playsinline', 'true');
        try {
          await video.play();
        } catch {
          // iOS Safari may autoplay on muted playsinline once metadata loads
        }

        if (!cancelled) {
          setCameraReady(true);
        }

        const tick = (now: number) => {
          if (cancelled) return;
          const vid = videoRef.current;
          const canvas = canvasRef.current;

          if (
            now - lastDecodeAt >= QR_DECODE_INTERVAL_MS &&
            vid &&
            canvas &&
            vid.readyState >= vid.HAVE_ENOUGH_DATA
          ) {
            lastDecodeAt = now;
            const width = vid.videoWidth;
            const height = vid.videoHeight;
            if (width > 0 && height > 0) {
              try {
                if (canvas.width !== width || canvas.height !== height) {
                  canvas.width = width;
                  canvas.height = height;
                }
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                if (ctx) {
                  ctx.drawImage(vid, 0, 0, width, height);
                  const imageData = ctx.getImageData(0, 0, width, height);
                  const decoded = jsQR(imageData.data, width, height, {
                    inversionAttempts: 'dontInvert',
                  });

                  if (decoded && decoded.data) {
                    const rawText = decoded.data.trim();
                    // Strictly accept ONLY pure 6-digit numeric strings (reject URLs or other payloads)
                    if (/^\d{6}$/.test(rawText)) {
                      cancelled = true;
                      cleanupStream();
                      onDecodedCode(rawText);
                      return;
                    }
                    setScanWarning(
                      'RoomLine専用の6桁ルーム番号QRコードをかざしてください（URL等は読み込めません）'
                    );
                  }
                }
              } catch {
                // Skip transient iOS/iPad Safari canvas or frame read errors
              }
            }
          }

          if (!cancelled) {
            rafIdRef.current = window.requestAnimationFrame(tick);
          }
        };

        rafIdRef.current = window.requestAnimationFrame(tick);
      } catch {
        cleanupStream();
        if (!cancelled) {
          onCameraError(
            'カメラの起動中にエラーが発生しました。6桁の番号を手入力してください。'
          );
        }
      }
    };

    void startScanner();

    return () => {
      cancelled = true;
      cleanupStream();
    };
  }, [onDecodedCode, onCameraError]);

  return (
    <div className="p-5 sm:p-6 space-y-4 overflow-y-auto chat-scroll">
      {/* Live Camera Viewport */}
      <div className="relative w-full aspect-square max-h-[300px] sm:max-h-[320px] rounded-2xl overflow-hidden bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-center">
        <video
          ref={videoRef}
          muted
          playsInline
          autoPlay
          className="w-full h-full object-cover"
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Scanning guide frame */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="w-48 h-48 rounded-2xl border-2 border-emerald-400/90 shadow-[0_0_0_9999px_rgba(15,23,42,0.45)] relative">
            <span className="absolute -top-0.5 -left-0.5 w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-xl" />
            <span className="absolute -top-0.5 -right-0.5 w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-xl" />
            <span className="absolute -bottom-0.5 -left-0.5 w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-xl" />
            <span className="absolute -bottom-0.5 -right-0.5 w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br-xl" />
          </div>
        </div>

        {!cameraReady && (
          <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center gap-2.5 text-slate-200">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
            <span className="text-xs">カメラを起動しています...</span>
          </div>
        )}
      </div>

      {scanWarning && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/70 text-xs text-amber-800 dark:text-amber-200">
          <AlertCircle className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" />
          <span>{scanWarning}</span>
        </div>
      )}

      <button
        type="button"
        onClick={onCancel}
        className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 transition-colors"
      >
        カメラを閉じて番号入力に戻る
      </button>
    </div>
  );
}

interface JoinRoomModalProps {
  isOpen: boolean;
  isSupabaseConfigured: boolean;
  supabaseConfig: SupabaseConfig;
  onClose: () => void;
  onJoinResolved: (payload: {
    roomCode: string;
    title?: string;
    storedPasscodeHash?: string | null;
    verifiedRawPasscode?: string | null;
  }) => void;
}

export function JoinRoomModal({
  isOpen,
  isSupabaseConfigured,
  supabaseConfig,
  onClose,
  onJoinResolved,
}: JoinRoomModalProps) {
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [passcodeInput, setPasscodeInput] = useState('');
  const [lockedMeta, setLockedMeta] = useState<{
    roomCode: string;
    title?: string;
    expectedPasscode: string;
  } | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  const digitRefs = useRef<Array<HTMLInputElement | null>>([]);
  const passcodeInputRef = useRef<HTMLInputElement | null>(null);
  const passcodeRef = useRef(passcodeInput);
  passcodeRef.current = passcodeInput;

  const attemptJoinWithCode = useCallback(
    async (targetCode: string, currentPasscode: string) => {
      if (targetCode.length !== 6) return;
      setError(null);
      setChecking(true);

      try {
        let remoteMeta: RoomRecord | null = null;
        if (!isSupabaseConfigured) {
          remoteMeta = getMockRoomMeta(targetCode);
        } else {
          const hashedRoomId = await hashRoomCode(targetCode);
          const { data } = await fetchSingleRoomFromSupabase(supabaseConfig, hashedRoomId);
          remoteMeta = data;
        }

        const expectedPasscode = (remoteMeta?.passcode || '').trim();
        if (expectedPasscode) {
          if (currentPasscode.length === 4) {
            const ok = await verifyRoomPasscode(
              targetCode,
              currentPasscode,
              expectedPasscode
            );
            if (ok) {
              onJoinResolved({
                roomCode: targetCode,
                title: remoteMeta?.title,
                storedPasscodeHash: expectedPasscode,
                verifiedRawPasscode: currentPasscode,
              });
              onClose();
              return;
            }
            setLockedMeta({
              roomCode: targetCode,
              title: remoteMeta?.title || '',
              expectedPasscode,
            });
            setError('合言葉が正しくありません。4桁の合言葉を再入力してください。');
            setPasscodeInput('');
            window.setTimeout(() => passcodeInputRef.current?.focus(), 50);
            return;
          }

          setLockedMeta({
            roomCode: targetCode,
            title: remoteMeta?.title || '',
            expectedPasscode,
          });
          window.setTimeout(() => passcodeInputRef.current?.focus(), 60);
          return;
        }

        onJoinResolved({
          roomCode: targetCode,
          title: remoteMeta?.title,
          storedPasscodeHash: null,
          verifiedRawPasscode: null,
        });
        onClose();
      } catch {
        setError('ルーム情報の確認に失敗しました。通信状況をご確認のうえ再度お試しください。');
      } finally {
        setChecking(false);
      }
    },
    [isSupabaseConfigured, supabaseConfig, onJoinResolved, onClose]
  );

  // Reset modal state on open/close
  useEffect(() => {
    if (isOpen) {
      setDigits(['', '', '', '', '', '']);
      setPasscodeInput('');
      setLockedMeta(null);
      setChecking(false);
      setError(null);
      setIsScanning(false);
      window.setTimeout(() => digitRefs.current[0]?.focus(), 40);
    } else {
      setIsScanning(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !checking) {
        if (isScanning) {
          setIsScanning(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, checking, isScanning, onClose]);

  const handleDecodedQrCode = useCallback(
    (sixDigitCode: string) => {
      setIsScanning(false);
      setDigits(sixDigitCode.split(''));
      setLockedMeta(null);
      setError(null);
      void attemptJoinWithCode(sixDigitCode, passcodeRef.current);
    },
    [attemptJoinWithCode]
  );

  const handleScannerError = useCallback((message: string) => {
    setIsScanning(false);
    setError(message);
  }, []);

  const handleStopScanning = useCallback(() => {
    setIsScanning(false);
  }, []);

  if (!isOpen) return null;

  const joinedCode = digits.join('');
  const isCodeComplete = joinedCode.length === 6;

  const handleDigitChange = (index: number, raw: string) => {
    const cleaned = raw.replace(/\D/g, '');
    setError(null);
    setLockedMeta(null);

    if (!cleaned) {
      const next = [...digits];
      next[index] = '';
      setDigits(next);
      return;
    }

    const chars = cleaned.slice(0, 6 - index).split('');
    const next = [...digits];
    chars.forEach((ch, offset) => {
      next[index + offset] = ch;
    });
    setDigits(next);

    const nextFocus = Math.min(index + chars.length, 5);
    digitRefs.current[nextFocus]?.focus();
  };

  const handleDigitKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === 'Backspace') {
      setError(null);
      setLockedMeta(null);
      if (digits[index]) {
        const next = [...digits];
        next[index] = '';
        setDigits(next);
      } else if (index > 0) {
        const next = [...digits];
        next[index - 1] = '';
        setDigits(next);
        digitRefs.current[index - 1]?.focus();
      }
      e.preventDefault();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      digitRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      digitRefs.current[index + 1]?.focus();
    }
  };

  const handleDigitPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const next = ['', '', '', '', '', ''];
    for (let i = 0; i < pasted.length; i++) {
      next[i] = pasted[i];
    }
    setDigits(next);
    setError(null);
    setLockedMeta(null);
    digitRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isCodeComplete || checking) return;
    setError(null);

    // If we already know this room is locked, verify the entered 4-digit passcode
    if (lockedMeta && lockedMeta.roomCode === joinedCode) {
      if (passcodeInput.length !== 4) {
        setError('4桁の合言葉を入力してください。');
        passcodeInputRef.current?.focus();
        return;
      }
      setChecking(true);
      try {
        const ok = await verifyRoomPasscode(
          joinedCode,
          passcodeInput,
          lockedMeta.expectedPasscode
        );
        if (!ok) {
          setError('合言葉が正しくありません。もう一度ご確認ください。');
          setPasscodeInput('');
          passcodeInputRef.current?.focus();
          return;
        }
        onJoinResolved({
          roomCode: joinedCode,
          title: lockedMeta.title,
          storedPasscodeHash: lockedMeta.expectedPasscode,
          verifiedRawPasscode: passcodeInput,
        });
        onClose();
      } catch {
        setError('合言葉の照合に失敗しました。もう一度お試しください。');
      } finally {
        setChecking(false);
      }
      return;
    }

    await attemptJoinWithCode(joinedCode, passcodeInput);
  };

  const handleCloseModal = () => {
    if (checking) return;
    setIsScanning(false);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 dark:bg-slate-950/80 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="join-room-modal-title"
      onClick={handleCloseModal}
    >
      <div
        className="w-full sm:max-w-md max-h-[92dvh] flex flex-col rounded-t-3xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              {isScanning ? <QrCode className="w-4 h-4" /> : <Hash className="w-4 h-4" />}
            </div>
            <div className="min-w-0">
              <h2
                id="join-room-modal-title"
                className="text-sm font-bold text-slate-900 dark:text-slate-50 truncate"
              >
                {isScanning ? 'QRコードをスキャン' : '番号でルームに参加'}
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {isScanning
                  ? '6桁のルーム番号QRコードを枠内に合わせてください'
                  : '共有された6桁の数字を入力、またはQRを読み取ってください'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCloseModal}
            disabled={checking}
            aria-label="閉じる"
            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Camera scanner mounted strictly ONLY while scanning */}
        {isScanning ? (
          <QrCameraScanner
            onDecodedCode={handleDecodedQrCode}
            onCameraError={handleScannerError}
            onCancel={handleStopScanning}
          />
        ) : (
          <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5 overflow-y-auto chat-scroll">
            {/* QR Camera Scan Trigger Button */}
            <button
              type="button"
              onClick={() => {
                setError(null);
                setIsScanning(true);
              }}
              disabled={checking}
              className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100/80 dark:bg-emerald-500/15 dark:hover:bg-emerald-500/25 border border-emerald-200 dark:border-emerald-500/35 text-xs sm:text-sm font-semibold text-emerald-700 dark:text-emerald-300 flex items-center justify-center gap-2 transition-colors"
            >
              <Camera className="w-4 h-4 shrink-0" />
              <span>カメラでQRコードを読み取る</span>
            </button>

            {/* 6-digit input boxes */}
            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                6桁のルーム番号
              </label>
              <div
                className="grid grid-cols-6 gap-2"
                role="group"
                aria-label="6桁のルーム番号入力"
              >
                {digits.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => {
                      digitRefs.current[index] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={digit}
                    aria-label={`ルーム番号 ${index + 1}桁目`}
                    onChange={(e) => handleDigitChange(index, e.target.value)}
                    onKeyDown={(e) => handleDigitKeyDown(index, e)}
                    onPaste={handleDigitPaste}
                    onFocus={(e) => e.target.select()}
                    placeholder="•"
                    className="w-full h-14 text-center text-2xl font-bold font-mono tabular-nums rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-50 placeholder:text-slate-300 dark:placeholder:text-slate-700 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/25 transition-all"
                  />
                ))}
              </div>
            </div>

            {/* 4-digit Passcode Field (Always available for pre-entry, highlighted when locked) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="join-room-passcode"
                  className={`flex items-center gap-1.5 text-xs font-medium ${
                    lockedMeta
                      ? 'text-amber-600 dark:text-amber-300'
                      : 'text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <Lock className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                  {lockedMeta
                    ? `ルーム ${formatRoomCode(lockedMeta.roomCode)} の4桁の合言葉（必須）`
                    : '4桁の合言葉（設定されている場合）'}
                </label>
                {!lockedMeta && (
                  <span className="text-[11px] text-slate-400 dark:text-slate-500">
                    任意
                  </span>
                )}
              </div>
              <input
                ref={passcodeInputRef}
                id="join-room-passcode"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={passcodeInput}
                onChange={(e) => {
                  setPasscodeInput(e.target.value.replace(/\D/g, '').slice(0, 4));
                  setError(null);
                }}
                placeholder={
                  lockedMeta
                    ? '4桁の合言葉を入力してください'
                    : 'ロック付きルームの場合は4桁入力'
                }
                className={`w-full h-11 px-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border text-sm font-mono tabular-nums tracking-[0.28em] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 placeholder:font-sans placeholder:tracking-normal focus:outline-none focus:ring-2 ${
                  lockedMeta
                    ? 'border-amber-500/60 focus:border-amber-500 focus:ring-amber-500/25'
                    : 'border-slate-200 dark:border-slate-800 focus:border-emerald-500 focus:ring-emerald-500/20'
                }`}
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/70 text-xs text-rose-700 dark:text-rose-200">
                <AlertCircle className="w-4 h-4 text-rose-500 dark:text-rose-400 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleCloseModal}
                disabled={checking}
                className="min-h-[44px] px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={
                  !isCodeComplete ||
                  checking ||
                  (Boolean(lockedMeta) && passcodeInput.length !== 4)
                }
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-500 disabled:pointer-events-none text-sm font-semibold text-white flex items-center gap-2 transition-colors whitespace-nowrap shadow-xs shadow-emerald-500/20 disabled:shadow-none"
              >
                {checking ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ArrowRight className="w-4 h-4" />
                )}
                <span>{lockedMeta ? 'ロックを解除して入室' : 'ルームに参加'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
