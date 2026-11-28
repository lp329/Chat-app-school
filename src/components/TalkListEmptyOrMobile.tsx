import {
  BadgeCheck,
  Calculator,
  Hash,
  Lightbulb,
  Lock,
  MessageCircle,
  Moon,
  Plus,
  Settings,
  Sun,
  Trash2,
} from 'lucide-react';
import {
  formatRoomCode,
  formatTimeHHMM,
  getRoomDisplayTitle,
} from '../lib/constants';
import type {
  OfficialAnnouncement,
  RoomHistoryItem,
  ThemeMode,
  UserProfile,
} from '../types/chat';
import { Avatar } from './Avatar';

interface TalkListEmptyOrMobileProps {
  profile: UserProfile;
  themeMode: ThemeMode;
  recentRooms: RoomHistoryItem[];
  latestOfficialAnnouncement: OfficialAnnouncement | null;
  officialUnreadCount: number;
  onChangeThemeMode: (mode: ThemeMode) => void;
  onSelectRoom: (roomCode: string) => void;
  onSelectOfficialRoom: () => void;
  onRequestLeaveRoom: (roomCode: string) => void;
  onOpenCreateRoom: () => void;
  onOpenJoinRoom: () => void;
  onOpenProfileModal: () => void;
  onOpenSettings: () => void;
  onOpenFeatureRequests: () => void;
  onActivateCamouflage: () => void;
}

export function TalkListEmptyOrMobile({
  profile,
  themeMode,
  recentRooms,
  latestOfficialAnnouncement,
  officialUnreadCount,
  onChangeThemeMode,
  onSelectRoom,
  onSelectOfficialRoom,
  onRequestLeaveRoom,
  onOpenCreateRoom,
  onOpenJoinRoom,
  onOpenProfileModal,
  onOpenSettings,
  onOpenFeatureRequests,
  onActivateCamouflage,
}: TalkListEmptyOrMobileProps) {
  return (
    <div className="h-full w-full bg-[#F8FAFC] dark:bg-slate-950 overflow-hidden">
      {/* Desktop: Minimal Unselected Guidance Only */}
      <div className="hidden lg:flex h-full w-full flex-col items-center justify-center px-8 text-center bg-[#F1F5F9] dark:bg-slate-950">
        <div className="max-w-md space-y-5">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-xs">
            <MessageCircle className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              トークが選択されていません
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              左のリストからトークを選択するか、左上のボタンから新しいルームを作成・参加してください
            </p>
          </div>
          <div className="flex items-center justify-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={onOpenCreateRoom}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-xs font-semibold text-white flex items-center gap-1.5 transition-colors whitespace-nowrap shadow-xs"
            >
              <Plus className="w-4 h-4" />
              新規作成
            </button>
            <button
              type="button"
              onClick={onOpenJoinRoom}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 transition-colors whitespace-nowrap shadow-xs"
            >
              <Hash className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              番号で参加
            </button>
          </div>
        </div>
      </div>

      {/* Mobile / Tablet (< lg): Clean, Full-Height Talk List */}
      <div className="lg:hidden h-full flex flex-col bg-[#F8FAFC] dark:bg-slate-950">
        {/* Compact Header */}
        <header className="shrink-0 h-15 px-4 border-b border-slate-200 dark:border-slate-800/90 bg-white dark:bg-slate-900/95 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
              R
            </div>
            <div className="min-w-0">
              <span className="text-sm font-bold text-slate-900 dark:text-slate-50 tracking-tight block truncate">
                RoomLine
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate leading-tight">
                E2EE チャット
              </span>
            </div>
          </div>

          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              onClick={onOpenFeatureRequests}
              title="改善要望・投票"
              aria-label="改善要望・投票ボックスを開く"
              className="w-9 h-9 rounded-xl flex items-center justify-center text-amber-500 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-colors"
            >
              <Lightbulb className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() =>
                onChangeThemeMode(themeMode === 'dark' ? 'light' : 'dark')
              }
              aria-label={
                themeMode === 'dark'
                  ? 'ライトモードに切り替え'
                  : 'ダークモードに切り替え'
              }
              className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {themeMode === 'dark' ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>
            <button
              type="button"
              onClick={onActivateCamouflage}
              aria-label="電卓画面へ切り替え"
              className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Calculator className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onOpenSettings}
              aria-label="ユーザー設定を開く"
              className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onOpenProfileModal}
              aria-label="プロフィールを編集"
              className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Avatar
                name={profile.nickname || 'ゲスト'}
                avatarType={profile.avatarType}
                avatarValue={profile.avatarValue}
                avatarColor={profile.avatarColor}
                size="xs"
              />
            </button>
          </div>
        </header>

        {/* Action Buttons Row: Create & Join */}
        <div className="shrink-0 px-4 pt-3.5 pb-2 grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={onOpenCreateRoom}
            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-xs font-semibold text-white flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shadow-xs"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>新規作成</span>
          </button>
          <button
            type="button"
            onClick={onOpenJoinRoom}
            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-100 flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shadow-xs"
          >
            <Hash className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>番号で参加</span>
          </button>
        </div>

        {/* Talk History Heading */}
        <div className="shrink-0 px-4 pt-2 pb-1.5 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            トーク履歴
          </span>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono tabular-nums">
            {recentRooms.length + 1}
          </span>
        </div>

        {/* Scrollable Talk List */}
        <div className="flex-1 overflow-y-auto chat-scroll px-2.5 pb-20 space-y-1.5">
          {/* Pinned ROOMLINE Official Verified Channel */}
          <div className="rounded-xl bg-white dark:bg-slate-900/90 hover:bg-slate-50 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-800/80 shadow-xs transition-colors">
            <button
              type="button"
              onClick={onSelectOfficialRoom}
              className="w-full px-3.5 py-3 flex items-center gap-3 text-left"
            >
              <div className="relative w-11 h-11 rounded-full bg-gradient-to-br from-emerald-500 to-sky-500 text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
                R
                <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-white dark:bg-slate-950 flex items-center justify-center">
                  <BadgeCheck className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400" />
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1 min-w-0">
                    <span className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                      ROOMLINE公式
                    </span>
                    <BadgeCheck
                      className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400 shrink-0"
                      aria-label="公式認証バッジ"
                    />
                  </span>
                  {latestOfficialAnnouncement && (
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono tabular-nums shrink-0">
                      {formatTimeHHMM(latestOfficialAnnouncement.created_at)}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <p
                    className={`text-xs truncate ${
                      officialUnreadCount > 0
                        ? 'text-slate-900 dark:text-slate-100 font-medium'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {latestOfficialAnnouncement
                      ? `${latestOfficialAnnouncement.is_important ? '[重要] ' : ''}${latestOfficialAnnouncement.title}`
                      : '運営からのお知らせを受信'}
                  </p>

                  {officialUnreadCount > 0 && (
                    <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-emerald-500 text-white text-[11px] font-bold font-mono tabular-nums flex items-center justify-center shrink-0">
                      {officialUnreadCount > 99 ? '99+' : officialUnreadCount}
                    </span>
                  )}
                </div>
              </div>
            </button>
          </div>

          {recentRooms.map((item) => {
            const hasCustomTitle = Boolean(item.title && item.title.trim());
            const primaryTitle = getRoomDisplayTitle(item.roomCode, item.title);
            const unread = item.unreadCount || 0;
            const locked = Boolean(item.passcode && item.passcode.trim());

            return (
              <div
                key={item.roomCode}
                className="relative rounded-xl bg-white dark:bg-slate-900/50 hover:bg-slate-50 dark:hover:bg-slate-800/70 border border-slate-200/80 dark:border-slate-800/60 shadow-2xs transition-colors"
              >
                <button
                  type="button"
                  onClick={() => onSelectRoom(item.roomCode)}
                  className="w-full px-3.5 py-3 pr-12 flex items-center gap-3 text-left"
                >
                  <div
                    className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${
                      unread > 0
                        ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {locked ? (
                      <Lock className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                    ) : (
                      <Hash className="w-4 h-4" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-sm font-semibold text-slate-900 dark:text-slate-100 truncate ${
                          !hasCustomTitle ? 'font-mono tabular-nums' : ''
                        }`}
                      >
                        {primaryTitle}
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono tabular-nums shrink-0">
                        {formatTimeHHMM(item.lastAt)}
                      </span>
                    </div>

                    {hasCustomTitle && (
                      <div className="text-[10px] font-mono tabular-nums text-slate-400 dark:text-slate-500 leading-tight mt-0.5">
                        #{formatRoomCode(item.roomCode)}
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <p
                        className={`text-xs truncate ${
                          unread > 0
                            ? 'text-slate-900 dark:text-slate-100 font-medium'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {item.lastSender
                          ? `${item.lastSender}: ${item.lastMessage}`
                          : item.lastMessage}
                      </p>

                      {unread > 0 && (
                        <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-emerald-500 text-white text-[11px] font-bold font-mono tabular-nums flex items-center justify-center shrink-0">
                          {unread > 99 ? '99+' : unread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRequestLeaveRoom(item.roomCode);
                  }}
                  aria-label={`${primaryTitle} から退室`}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-900/80 flex items-center justify-center transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
