import { useEffect, useMemo, useRef } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  Calculator,
  ChevronLeft,
  Info,
  Megaphone,
  Settings,
  ShieldCheck,
} from 'lucide-react';
import {
  WALLPAPER_THEMES,
  formatDateDivider,
  formatTimeHHMM,
} from '../lib/constants';
import type { OfficialAnnouncement, UserProfile } from '../types/chat';

interface OfficialChatViewProps {
  announcements: OfficialAnnouncement[];
  profile: UserProfile;
  onBackToLobby: () => void;
  onOpenSettings: () => void;
  onActivateCamouflage: () => void;
}

export function OfficialChatView({
  announcements,
  profile,
  onBackToLobby,
  onOpenSettings,
  onActivateCamouflage,
}: OfficialChatViewProps) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const wallpaperTheme = useMemo(
    () =>
      WALLPAPER_THEMES.find((w) => w.id === profile.wallpaperTheme) || WALLPAPER_THEMES[0],
    [profile.wallpaperTheme]
  );

  // Chronological order (oldest -> newest) like a LINE official chat stream
  const chronological = useMemo(
    () =>
      [...announcements].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      ),
    [announcements]
  );

  useEffect(() => {
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
    });
  }, [chronological.length]);

  return (
    <div className="h-full flex flex-col bg-[#F8FAFC] dark:bg-slate-950 overflow-hidden">
      {/* Header */}
      <header className="shrink-0 min-h-[68px] px-3 sm:px-5 py-2 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 sm:gap-3 z-20">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
          <button
            type="button"
            onClick={onBackToLobby}
            aria-label="トーク一覧へ戻る"
            className="lg:hidden min-h-[40px] min-w-[40px] -ml-1 flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-sky-500 text-white flex items-center justify-center font-bold text-base shadow-xs shrink-0">
            R
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">
                ROOMLINE公式
              </h1>
              <BadgeCheck
                className="w-4 h-4 text-sky-500 dark:text-sky-400 shrink-0"
                aria-label="公式認証済みアカウント"
              />
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
              <span className="truncate">運営からのお知らせ・メンテナンス配信</span>
              <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                ·
              </span>
              <span className="inline-flex items-center gap-1 text-sky-600 dark:text-sky-300/90 font-medium shrink-0">
                <ShieldCheck className="w-3 h-3" />
                公式配信
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onActivateCamouflage}
            title="電卓画面へ切り替え（緊急隠蔽）"
            aria-label="電卓画面へ切り替え"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
          >
            <Calculator className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="ユーザー設定を開く"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Announcements Stream */}
      <div
        className={`flex-1 overflow-y-auto chat-scroll px-3 sm:px-6 py-5 ${wallpaperTheme.bgClass}`}
      >
        <div className="max-w-3xl mx-auto space-y-4">
          {chronological.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-center space-y-3 px-4">
              <div className="w-14 h-14 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-sky-500 dark:text-sky-400 shadow-xs">
                <Megaphone className="w-7 h-7" />
              </div>
              <div className="space-y-1 max-w-sm">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  まだ公式メッセージはありません
                </p>
                <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  運営からの重要なお知らせやアップデート情報が届くと、ここにリアルタイムで表示されます。
                </p>
              </div>
            </div>
          ) : (
            chronological.map((item, idx) => {
              const prev = idx > 0 ? chronological[idx - 1] : null;
              const currentDate = formatDateDivider(item.created_at);
              const prevDate = prev ? formatDateDivider(prev.created_at) : null;
              const showDateDivider = currentDate !== prevDate;
              const timeLabel = formatTimeHHMM(item.created_at);

              return (
                <div key={item.id} className="space-y-3">
                  {showDateDivider && currentDate && (
                    <div className="flex justify-center py-2">
                      <span className="px-3.5 py-1 rounded-full bg-white/90 dark:bg-slate-900/85 border border-slate-200/90 dark:border-slate-800/80 text-[11px] font-medium text-slate-600 dark:text-slate-400 tabular-nums shadow-2xs">
                        {currentDate}
                      </span>
                    </div>
                  )}

                  <div className="flex items-start gap-2.5 max-w-[92%] sm:max-w-[80%]">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-sky-500 text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0 mt-1">
                      R
                    </div>

                    <div className="min-w-0 flex flex-col items-start">
                      <div className="flex items-center gap-1 mb-1 pl-0.5">
                        <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                          ROOMLINE公式
                        </span>
                        <BadgeCheck className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400 shrink-0" />
                      </div>

                      <div className="flex items-end gap-2 max-w-full">
                        <article
                          className={`rounded-2xl bubble-tail-left shadow-xs overflow-hidden px-4 py-3 space-y-2 border ${
                            item.is_important
                              ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-500/50 text-slate-900 dark:text-slate-100'
                              : 'bg-white dark:bg-slate-800/95 border-slate-200/90 dark:border-slate-700/60 text-slate-900 dark:text-slate-100'
                          }`}
                        >
                          {item.is_important && (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-500/20 border border-rose-300 dark:border-rose-500/40 text-[11px] font-bold text-rose-700 dark:text-rose-300">
                              <AlertTriangle className="w-3 h-3 shrink-0" />
                              重要・緊急のお知らせ
                            </div>
                          )}

                          <h2 className="text-sm sm:text-[15px] font-bold text-slate-900 dark:text-white leading-snug break-words">
                            {item.title}
                          </h2>

                          <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200 whitespace-pre-wrap break-words">
                            {item.content}
                          </p>
                        </article>

                        <span className="text-[10px] text-slate-500 dark:text-slate-500 font-mono tabular-nums shrink-0 pb-0.5 leading-none">
                          {timeLabel}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} className="h-1" />
        </div>
      </div>

      {/* Read-only Footer */}
      <footer className="shrink-0 bg-white/95 dark:bg-slate-900/95 border-t border-slate-200 dark:border-slate-800 px-4 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))]">
        <div className="max-w-3xl mx-auto flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <Info className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
          <span>「ROOMLINE公式」は配信専用アカウントのため、返信はできません。</span>
        </div>
      </footer>
    </div>
  );
}
