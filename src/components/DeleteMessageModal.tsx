import { useEffect } from 'react';
import { Loader2, Trash2, X } from 'lucide-react';
import type { ChatMessage } from '../types/chat';
import { StickerArtwork } from './StickerArtwork';

interface DeleteMessageModalProps {
  message: ChatMessage | null;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: (message: ChatMessage) => void;
}

export function DeleteMessageModal({
  message,
  deleting,
  onCancel,
  onConfirm,
}: DeleteMessageModalProps) {
  useEffect(() => {
    if (!message) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !deleting) onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [message, deleting, onCancel]);

  if (!message) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 dark:bg-slate-950/80 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-msg-title"
      onClick={() => {
        if (!deleting) onCancel();
      }}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <div className="flex items-center gap-2 text-xs font-medium text-rose-600 dark:text-rose-400">
            <Trash2 className="w-4 h-4" />
            <span>メッセージの送信取消</span>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            aria-label="閉じる"
            className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-3 space-y-3">
          <h2 id="delete-msg-title" className="text-base font-bold text-slate-900 dark:text-slate-50">
            このメッセージを削除しますか？
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            削除すると、自分の画面だけでなく参加している全員の画面から即座に消去されます。
          </p>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 space-y-2">
            {message.sticker_url ? (
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 shrink-0">
                  <StickerArtwork stickerUrl={message.sticker_url} size="picker" />
                </div>
                <span className="text-xs text-slate-600 dark:text-slate-300">スタンプ</span>
              </div>
            ) : (
              <>
                {message.image_url && (
                  <img
                    src={message.image_url}
                    alt="削除対象の画像"
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                    className="w-20 h-20 rounded-lg object-cover border border-slate-200 dark:border-slate-800"
                  />
                )}
                {message.content ? (
                  <p className="text-xs text-slate-800 dark:text-slate-200 line-clamp-3 whitespace-pre-wrap break-words">
                    {message.content}
                  </p>
                ) : (
                  <p className="text-xs text-slate-500 dark:text-slate-400">画像メッセージ</p>
                )}
              </>
            )}
          </div>
        </div>

        <div className="px-5 py-4 bg-slate-50 dark:bg-slate-950/50 border-t border-slate-200 dark:border-slate-800/90 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-slate-200/80 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200 transition-colors whitespace-nowrap"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={() => onConfirm(message)}
            disabled={deleting}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-xs sm:text-sm font-semibold text-white flex items-center gap-1.5 transition-colors whitespace-nowrap"
          >
            {deleting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            送信を取り消す
          </button>
        </div>
      </div>
    </div>
  );
}
