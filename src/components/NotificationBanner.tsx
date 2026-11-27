import { BadgeCheck, MessageCircle, X } from 'lucide-react';
import { formatTimeHHMM } from '../lib/constants';
import type { RoomNotification } from '../types/chat';

interface NotificationBannerProps {
  notification: RoomNotification | null;
  onSelectRoom: (roomCode: string) => void;
  onDismiss: () => void;
}

export function NotificationBanner({
  notification,
  onSelectRoom,
  onDismiss,
}: NotificationBannerProps) {
  if (!notification) return null;

  const isOfficial = Boolean(notification.isOfficial);

  return (
    <div
      className="fixed top-3 sm:top-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-1.5rem)] max-w-lg pointer-events-none"
      role="status"
      aria-live="polite"
    >
      <div
        className={`pointer-events-auto flex items-center gap-2 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border shadow-xl shadow-slate-900/10 dark:shadow-2xl dark:shadow-slate-950/80 pl-3.5 pr-2 py-2.5 ${
          isOfficial
            ? 'border-sky-300 dark:border-sky-500/50'
            : 'border-emerald-300 dark:border-emerald-500/40'
        }`}
      >
        <button
          type="button"
          onClick={() => onSelectRoom(notification.roomCode)}
          className="flex-1 min-w-0 flex items-center gap-3 text-left group focus:outline-none"
        >
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              isOfficial
                ? 'bg-sky-50 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400'
                : 'bg-emerald-50 dark:bg-emerald-600/20 text-emerald-600 dark:text-emerald-400'
            }`}
          >
            {isOfficial ? (
              <BadgeCheck className="w-5 h-5" />
            ) : (
              <MessageCircle className="w-4 h-4" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span
                className={`text-xs font-semibold truncate transition-colors inline-flex items-center gap-1 ${
                  isOfficial
                    ? 'text-sky-700 dark:text-sky-300 group-hover:text-sky-800 dark:group-hover:text-sky-200'
                    : 'text-emerald-700 dark:text-emerald-300 group-hover:text-emerald-800 dark:group-hover:text-emerald-200'
                }`}
              >
                【{notification.roomTitle}】
              </span>
              <span className="text-[10px] font-mono tabular-nums text-slate-400 dark:text-slate-500 shrink-0">
                {formatTimeHHMM(notification.createdAt)}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-100 truncate mt-0.5">
              <span className="font-semibold text-slate-900 dark:text-slate-200">
                {notification.senderName}:
              </span>{' '}
              <span className="text-slate-600 dark:text-slate-300">
                {notification.content}
              </span>
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={onDismiss}
          aria-label="通知を閉じる"
          className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
