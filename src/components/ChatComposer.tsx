import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Gamepad2, ImagePlus, Loader2, Reply, Send, Smile, X } from 'lucide-react';
import type { CustomSticker, ReplyReference } from '../types/chat';
import { StickerPicker } from './StickerPicker';

interface ChatComposerProps {
  roomCode: string;
  customStickers: CustomSticker[];
  replyingTo: ReplyReference | null;
  onClearReply: () => void;
  onOpenMiniGameLauncher: () => void;
  onSendMessage: (
    roomCode: string,
    content: string,
    imageFile?: File | null,
    replyTo?: ReplyReference | null
  ) => Promise<string | null>;
  onSendSticker: (
    roomCode: string,
    stickerUrl: string,
    replyTo?: ReplyReference | null
  ) => Promise<string | null>;
  onTypingChange: (isTyping: boolean) => void;
  onAddCustomSticker: (file: File) => Promise<string | null>;
  onDeleteCustomSticker: (stickerId: string) => void;
  onError: (message: string | null) => void;
}

const TYPING_EMIT_THROTTLE_MS = 1500;
const TYPING_IDLE_TIMEOUT_MS = 2500;

export const ChatComposer = memo(function ChatComposer({
  roomCode,
  customStickers,
  replyingTo,
  onClearReply,
  onOpenMiniGameLauncher,
  onSendMessage,
  onSendSticker,
  onTypingChange,
  onAddCustomSticker,
  onDeleteCustomSticker,
  onError,
}: ChatComposerProps) {
  const [inputText, setInputText] = useState('');
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [pendingImagePreview, setPendingImagePreview] = useState<string | null>(null);
  const [showStamps, setShowStamps] = useState(false);
  const [sending, setSending] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const typingTimerRef = useRef<number | null>(null);
  const lastTypingEmitRef = useRef<number>(0);
  const isTypingActiveRef = useRef<boolean>(false);
  const prevRoomRef = useRef(roomCode);

  const stopTypingImmediately = useCallback(() => {
    if (typingTimerRef.current) {
      window.clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
    if (isTypingActiveRef.current) {
      isTypingActiveRef.current = false;
      onTypingChange(false);
    }
  }, [onTypingChange]);

  // Reset composer state when switching rooms
  useEffect(() => {
    if (prevRoomRef.current !== roomCode) {
      prevRoomRef.current = roomCode;
      stopTypingImmediately();
      setShowStamps(false);
      setPendingImage(null);
      setInputText('');
    }
  }, [roomCode, stopTypingImmediately]);

  // Focus textarea when starting a reply
  useEffect(() => {
    if (replyingTo) {
      setShowStamps(false);
      requestAnimationFrame(() => {
        textareaRef.current?.focus();
      });
    }
  }, [replyingTo]);

  // Cleanup timers and typing state on unmount
  useEffect(() => {
    return () => {
      if (typingTimerRef.current) {
        window.clearTimeout(typingTimerRef.current);
      }
      if (isTypingActiveRef.current) {
        isTypingActiveRef.current = false;
        onTypingChange(false);
      }
    };
  }, [onTypingChange]);

  // Manage object URL lifecycle for pending image preview
  useEffect(() => {
    if (!pendingImage) {
      setPendingImagePreview(null);
      return;
    }
    try {
      const url = URL.createObjectURL(pendingImage);
      setPendingImagePreview(url);
      return () => {
        try {
          URL.revokeObjectURL(url);
        } catch {
          // Ignore revoke errors
        }
      };
    } catch {
      setPendingImagePreview(null);
      return undefined;
    }
  }, [pendingImage]);

  // Auto-resize textarea height
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, [inputText]);

  const handleInputChange = (nextValue: string) => {
    setInputText(nextValue);

    if (typingTimerRef.current) {
      window.clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }

    if (!nextValue.trim()) {
      if (isTypingActiveRef.current) {
        isTypingActiveRef.current = false;
        onTypingChange(false);
      }
      return;
    }

    const now = Date.now();
    if (!isTypingActiveRef.current || now - lastTypingEmitRef.current >= TYPING_EMIT_THROTTLE_MS) {
      isTypingActiveRef.current = true;
      lastTypingEmitRef.current = now;
      onTypingChange(true);
    }

    typingTimerRef.current = window.setTimeout(() => {
      typingTimerRef.current = null;
      if (isTypingActiveRef.current) {
        isTypingActiveRef.current = false;
        onTypingChange(false);
      }
    }, TYPING_IDLE_TIMEOUT_MS);
  };

  const handleImageFileSelect = (file: File | null | undefined) => {
    if (!file) return;
    onError(null);
    if (!file.type.startsWith('image/')) {
      onError('画像ファイル（PNG / JPG / WebP / GIF）を選択してください。');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      onError('画像サイズは10MB以下にしてください。');
      return;
    }
    setPendingImage(file);
  };

  const handleTextareaPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          handleImageFileSelect(file);
          return;
        }
      }
    }
  };

  const sendMessageContent = async (rawContent: string, overrideImage?: File | null) => {
    const content = rawContent.trim();
    const imageToSend = overrideImage !== undefined ? overrideImage : pendingImage;
    if ((!content && !imageToSend) || sending) return;

    stopTypingImmediately();
    onError(null);
    setShowStamps(false);
    setSending(true);

    try {
      const err = await onSendMessage(roomCode, content, imageToSend, replyingTo);
      if (err) {
        onError(err);
        return;
      }
      setInputText('');
      setPendingImage(null);
      onClearReply();
    } catch {
      onError('メッセージの送信中にエラーが発生しました。');
    } finally {
      setSending(false);
    }
  };

  const handleSendStickerClick = async (stickerUrl: string) => {
    if (sending) return;
    stopTypingImmediately();
    onError(null);
    setShowStamps(false);
    setSending(true);
    try {
      const err = await onSendSticker(roomCode, stickerUrl, replyingTo);
      if (err) {
        onError(err);
        return;
      }
      onClearReply();
    } catch {
      onError('スタンプの送信中にエラーが発生しました。');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing || e.keyCode === 229) {
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendMessageContent(inputText);
    }
  };

  const canSend = Boolean(inputText.trim() || pendingImage) && !sending;

  return (
    <>
      {/* Sticker & Quick Reply Picker (Mounted only when open) */}
      {showStamps && (
        <StickerPicker
          customStickers={customStickers}
          onSendSticker={(url) => void handleSendStickerClick(url)}
          onSendQuickText={(text) => void sendMessageContent(text, null)}
          onAddCustomSticker={onAddCustomSticker}
          onDeleteCustomSticker={onDeleteCustomSticker}
          onClose={() => setShowStamps(false)}
        />
      )}

      {/* Active Reply Quote Preview Bar (just above input footer) */}
      {replyingTo && (
        <div className="shrink-0 bg-slate-50 dark:bg-slate-900/95 border-t border-slate-200 dark:border-slate-800 px-3 sm:px-6 py-2">
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-3 pl-2.5 border-l-2 border-emerald-500">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5 truncate">
                <Reply className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{replyingTo.sender_name}への返信:</span>
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-300 truncate mt-0.5">
                {replyingTo.content}
              </p>
            </div>
            <button
              type="button"
              onClick={onClearReply}
              aria-label="返信をキャンセル"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-300 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Pending Image Attachment Preview Bar */}
      {pendingImage && pendingImagePreview && (
        <div className="shrink-0 bg-slate-50 dark:bg-slate-900/95 border-t border-slate-200 dark:border-slate-800 px-3 sm:px-6 py-2.5">
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <img
                src={pendingImagePreview}
                alt="送信予定の画像プレビュー"
                loading="lazy"
                decoding="async"
                className="w-12 h-12 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
              />
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate">
                  {pendingImage.name || 'スクリーンショット画像'}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                  {(pendingImage.size / 1024).toFixed(0)} KB · テキストなしでも送信可能
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPendingImage(null)}
              aria-label="添付画像を削除"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-300 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Input Footer */}
      <footer className="shrink-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-3 sm:px-6 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="max-w-3xl mx-auto flex items-end gap-1.5 sm:gap-2">
          {/* Image / Screenshot Attachment Button */}
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            disabled={sending}
            title="画像・スクリーンショットを添付（貼り付けにも対応）"
            aria-label="画像を添付"
            className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl transition-colors shrink-0 ${
              pendingImage
                ? 'bg-emerald-100 dark:bg-emerald-600/20 text-emerald-700 dark:text-emerald-400'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <ImagePlus className="w-5 h-5" />
          </button>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => {
              handleImageFileSelect(e.target.files?.[0]);
              e.target.value = '';
            }}
            className="hidden"
          />

          {/* Quick Stamps Button */}
          <button
            type="button"
            onClick={() => setShowStamps((prev) => !prev)}
            aria-label="スタンプピッカーを開く"
            className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl transition-colors shrink-0 ${
              showStamps
                ? 'bg-emerald-100 dark:bg-emerald-600/20 text-emerald-700 dark:text-emerald-400'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Smile className="w-5 h-5" />
          </button>

          {/* Online Mini-Games Launcher Button */}
          <button
            type="button"
            onClick={() => {
              setShowStamps(false);
              onOpenMiniGameLauncher();
            }}
            disabled={sending}
            title="ミニゲームで対戦"
            aria-label="ミニゲームを開く"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/15 transition-colors shrink-0"
          >
            <Gamepad2 className="w-5 h-5" />
          </button>

          {/* Message Input */}
          <div className="flex-1 min-w-0 bg-slate-100/90 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus-within:bg-white dark:focus-within:bg-slate-950 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20 rounded-2xl px-3.5 py-2 transition-all">
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputText}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handleTextareaPaste}
              placeholder={
                replyingTo
                  ? `${replyingTo.sender_name}への返信を入力...`
                  : pendingImage
                    ? '画像に添えるメッセージ（省略可）'
                    : 'メッセージを入力（E2EE暗号化 / Shift+Enterで改行）'
              }
              className="w-full max-h-32 resize-none bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none leading-6"
            />
          </div>

          {/* Send Button */}
          <button
            type="button"
            onClick={() => void sendMessageContent(inputText)}
            disabled={!canSend}
            aria-label="メッセージを送信"
            className="min-h-[44px] min-w-[44px] px-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:scale-95 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-500 disabled:pointer-events-none text-white flex items-center justify-center transition-all shrink-0 shadow-xs"
          >
            {sending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </footer>
    </>
  );
});
