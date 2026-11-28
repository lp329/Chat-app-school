import { memo } from 'react';
import {
  BadgeCheck,
  Calculator,
  Hash,
  Lightbulb,
  Lock,
  MessageCircle,
  Moon,
  PlaySquare,
  Plus,
  Settings,
  Sun,
  Trash2,
  User,
} from 'lucide-react';
import {
  OFFICIAL_ROOM_ID,
  formatRoomCode,
  formatTimeHHMM,
  getRoomDisplayTitle,
} from '../lib/constants';
import type {
  ActiveTab,
  OfficialAnnouncement,
  RoomHistoryItem,
  ThemeMode,
  UserProfile,
} from '../types/chat';
import { Avatar } from './Avatar';

interface SidebarProps {
  profile: UserProfile;
  themeMode: ThemeMode;
  activeTab: ActiveTab;
  activeRoomCode: string | null;
  recentRooms: RoomHistoryItem[];
  latestOfficialAnnouncement: OfficialAnnouncement | null;
  officialUnreadCount: number;
  onChangeThemeMode: (mode: ThemeMode) => void;
  onSelectTab: (tab: ActiveTab) => void;
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

export const Sidebar = memo(function Sidebar({
  profile,
  themeMode,
  activeTab,
  activeRoomCode,
  recentRooms,
  latestOfficialAnnouncement,
  officialUnreadCount,
  onChangeThemeMode,
  onSelectTab,
  onSelectRoom,
  onSelectOfficialRoom,
  onRequestLeaveRoom,
  onOpenCreateRoom,
  onOpenJoinRoom,
  onOpenProfileModal,
  onOpenSettings,
  onOpenFeatureRequests,
  onActivateCamouflage,
}: SidebarProps) {
  const isOfficialActive =
    activeTab === 'rooms' && activeRoomCode === OFFICIAL_ROOM_ID;
  const effectiveOfficialUnread = isOfficialActive ? 0 : officialUnreadCount;
  const totalUnread =
    effectiveOfficialUnread +
    recentRooms.reduce((sum, item) => sum + (item.unreadCount || 0), 0);

  return (
    <>
      {/* Desktop Slim 2-Pane Navigation Rail + Spacious Talk List */}
      <div className="hidden lg:flex h-full shrink-0 border-r border-slate-200 dark:border-slate-800/90 bg-white dark:bg-slate-900/90">
        {/* Slim Icon Rail */}
        <nav
          aria-label="メインナビゲーション"
          className="w-16 flex flex-col items-center justify-between py-4 bg-[#F8FAFC] dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800/90 shrink-0"
        >
          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={() => onSelectTab('rooms')}
              title="RoomLine トーク"
              className="w-10 h-10 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center font-bold text-base shadow-sm transition-colors"
            >
              R
            </button>

            <div className="w-6 h-px bg-slate-200 dark:bg-slate-800 my-1" />

            <button
              type="button"
              onClick={() => onSelectTab('rooms')}
              title="トーク"
              aria-label="トーク"
              className={`relative w-11 h-11 rounded-xl flex items-center justify-center transition-colors ${
                activeTab === 'rooms'
                  ? 'bg-emerald-50 dark:bg-slate-800 text-emerald-600 dark:text-emerald-400'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-900'
              }`}
            >
              <MessageCircle className="w-5 h-5" />
              {totalUnread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-500 text-white text-[10px] font-bold font-mono tabular-nums flex items-center justify-center ring-2 ring-[#F8FAFC] dark:ring-slate-950">
                  {totalUnread > 99 ? '99+' : totalUnread}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => onSelectTab('boom')}
              title="BOOM タイムライン"
              aria-label="BOOM タイムライン"
              className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors ${
                activeTab === 'boom'
                  ? 'bg-emerald-50 dark:bg-slate-800 text-emerald-600 dark:text-emerald-400'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-900'
              }`}
            >
              <PlaySquare className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={onOpenFeatureRequests}
              title="改善要望・投票ボックス"
              aria-label="改善要望・投票ボックスを開く"
              className="w-11 h-11 rounded-xl flex items-center justify-center text-amber-500 dark:text-amber-400 hover:text-amber-600 dark:hover:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-colors"
            >
              <Lightbulb className="w-5 h-5" />
            </button>
          </div>

          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() =>
                onChangeThemeMode(themeMode === 'dark' ? 'light' : 'dark')
              }
              title={
                themeMode === 'dark'
                  ? 'ライトモードに切り替え'
                  : 'ダークモードに切り替え'
              }
              aria-label={
                themeMode === 'dark'
                  ? 'ライトモードに切り替え'
                  : 'ダークモードに切り替え'
              }
              className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/70 dark:hover:bg-slate-900 transition-colors"
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
              title="電卓画面へ切り替え（緊急隠蔽）"
              aria-label="電卓画面へ切り替え"
              className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-500 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/70 dark:hover:bg-slate-900 transition-colors"
            >
              <Calculator className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={onOpenSettings}
              title="ユーザー設定（プロフィール・テーマ）"
              aria-label="ユーザー設定を開く"
              className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/70 dark:hover:bg-slate-900 transition-colors"
            >
              <Settings className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={onOpenProfileModal}
              title={`${profile.nickname || 'ゲスト'}（プロフィールを編集）`}
              aria-label="プロフィールを編集"
              className="mt-0.5 rounded-full ring-2 ring-transparent hover:ring-emerald-500/60 transition-all"
            >
              <Avatar
                name={profile.nickname || 'ゲスト'}
                avatarType={profile.avatarType}
                avatarValue={profile.avatarValue}
                avatarColor={profile.avatarColor}
                size="sm"
              />
            </button>
          </div>
        </nav>

        {/* Slimmed Talk History Column */}
        <aside className="w-76 flex flex-col bg-white dark:bg-slate-900/70 shrink-0">
          {/* Compact Sidebar Header */}
          <div className="h-[60px] px-4 border-b border-slate-200 dark:border-slate-800/90 flex items-center justify-between gap-2 shrink-0">
            <span className="text-base font-bold text-slate-900 dark:text-slate-50 tracking-tight truncate">
              RoomLine
            </span>
            <span className="text-[11px] text-slate-400 dark:text-slate-500 truncate whitespace-nowrap">
              E2EE チャット
            </span>
          </div>

          {/* Compact Create / Join Action Pair directly above Talk History */}
          <div className="px-3 pt-3 pb-2.5 border-b border-slate-200/80 dark:border-slate-800/70 grid grid-cols-2 gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenCreateRoom}
              className="min-h-[40px] px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-xs font-semibold text-white flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shadow-xs"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span>新規作成</span>
            </button>
            <button
              type="button"
              onClick={onOpenJoinRoom}
              className="min-h-[40px] px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700/60 text-xs font-semibold text-slate-800 dark:text-slate-100 flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <Hash className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>番号で参加</span>
            </button>
          </div>

          {/* Spacious Full-Height Talk History List */}
          <div className="flex-1 overflow-y-auto chat-scroll">
            <div className="px-4 pt-3 pb-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                トーク履歴
              </span>
              <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono tabular-nums">
                {recentRooms.length + 1}
              </span>
            </div>

            <div className="px-2 pb-4 space-y-1">
              {/* Pinned ROOMLINE Official Verified Channel */}
              <div
                className={`rounded-xl transition-colors ${
                  isOfficialActive
                    ? 'bg-sky-50 dark:bg-sky-600/20 ring-1 ring-sky-200 dark:ring-sky-500/30'
                    : 'bg-slate-50/80 dark:bg-slate-800/35 hover:bg-slate-100 dark:hover:bg-slate-800/70'
                }`}
              >
                <button
                  type="button"
                  onClick={onSelectOfficialRoom}
                  className="w-full px-3 py-2.5 flex items-center gap-3 text-left"
                >
                  <div className="relative w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-sky-500 text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
                    R
                    <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-white dark:bg-slate-950 flex items-center justify-center">
                      <BadgeCheck className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400" />
                    </span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1 min-w-0">
                        <span
                          className={`text-sm font-bold truncate ${
                            isOfficialActive
                              ? 'text-sky-900 dark:text-white'
                              : 'text-slate-900 dark:text-slate-100'
                          }`}
                        >
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
                          effectiveOfficialUnread > 0
                            ? 'text-slate-900 dark:text-slate-100 font-medium'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {latestOfficialAnnouncement
                          ? `${latestOfficialAnnouncement.is_important ? '[重要] ' : ''}${latestOfficialAnnouncement.title}`
                          : '運営からのお知らせを受信'}
                      </p>

                      {effectiveOfficialUnread > 0 && (
                        <span
                          aria-label={`公式未読 ${effectiveOfficialUnread}件`}
                          className="min-w-[20px] h-5 px-1.5 rounded-full bg-emerald-500 text-white text-[11px] font-bold font-mono tabular-nums flex items-center justify-center shrink-0"
                        >
                          {effectiveOfficialUnread > 99 ? '99+' : effectiveOfficialUnread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              </div>

              {recentRooms.length === 0 ? (
                <div className="px-3 py-6 text-center space-y-1.5">
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    参加したトークルームがここに並びます
                  </p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">
                    上の「新規作成」または「番号で参加」からルームを開いてください。
                  </p>
                </div>
              ) : (
                recentRooms.map((item) => {
                  const isActive = activeTab === 'rooms' && activeRoomCode === item.roomCode;
                  const hasCustomTitle = Boolean(item.title && item.title.trim());
                  const primaryTitle = getRoomDisplayTitle(item.roomCode, item.title);
                  const unread = isActive ? 0 : item.unreadCount || 0;
                  const locked = Boolean(item.passcode && item.passcode.trim());

                  return (
                    <div
                      key={item.roomCode}
                      className={`group relative rounded-xl transition-colors ${
                        isActive
                          ? 'bg-emerald-50 dark:bg-emerald-500/15 ring-1 ring-emerald-200/80 dark:ring-emerald-500/30'
                          : 'hover:bg-slate-100/90 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => onSelectRoom(item.roomCode)}
                        className="w-full px-3 py-2.5 flex items-center gap-3 text-left pr-9"
                      >
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                            isActive
                              ? 'bg-emerald-500 text-white'
                              : unread > 0
                                ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {locked ? (
                            <Lock className="w-4 h-4" />
                          ) : (
                            <Hash className="w-4 h-4" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`text-sm font-semibold truncate ${
                                !hasCustomTitle ? 'font-mono tabular-nums' : ''
                              } ${
                                isActive
                                  ? 'text-emerald-950 dark:text-white'
                                  : 'text-slate-900 dark:text-slate-100'
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
                                  ? 'text-slate-900 dark:text-slate-200 font-medium'
                                  : 'text-slate-500 dark:text-slate-400'
                              }`}
                            >
                              {item.lastSender
                                ? `${item.lastSender}: ${item.lastMessage}`
                                : item.lastMessage}
                            </p>

                            {unread > 0 && (
                              <span
                                aria-label={`未読 ${unread}件`}
                                className="min-w-[20px] h-5 px-1.5 rounded-full bg-emerald-500 text-white text-[11px] font-bold font-mono tabular-nums flex items-center justify-center shrink-0"
                              >
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
                        aria-label={`${primaryTitle} から退室して履歴から削除`}
                        className="opacity-0 group-hover:opacity-100 focus:opacity-100 absolute right-2 top-2.5 w-7 h-7 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-white dark:hover:bg-slate-900/80 flex items-center justify-center transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* Mobile Bottom Tab Bar (shown when on Talk List or BOOM) */}
      {!(activeTab === 'rooms' && activeRoomCode) && (
        <nav
          aria-label="モバイルナビゲーション"
          className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 pb-[env(safe-area-inset-bottom)]"
        >
          <div className="grid grid-cols-4 h-15">
            <button
              type="button"
              onClick={() => onSelectTab('rooms')}
              className={`flex flex-col items-center justify-center gap-0.5 transition-colors ${
                activeTab === 'rooms'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <span className="relative">
                <MessageCircle className="w-5 h-5" />
                {totalUnread > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-emerald-500 text-white text-[10px] font-bold font-mono tabular-nums flex items-center justify-center">
                    {totalUnread > 99 ? '99+' : totalUnread}
                  </span>
                )}
              </span>
              <span className="text-[10px] font-medium">トーク</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectTab('boom')}
              className={`flex flex-col items-center justify-center gap-0.5 transition-colors ${
                activeTab === 'boom'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <PlaySquare className="w-5 h-5" />
              <span className="text-[10px] font-medium">BOOM</span>
            </button>

            <button
              type="button"
              onClick={onOpenProfileModal}
              className="flex flex-col items-center justify-center gap-0.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
            >
              <User className="w-5 h-5" />
              <span className="text-[10px] font-medium">プロフィール</span>
            </button>

            <button
              type="button"
              onClick={onOpenSettings}
              className="flex flex-col items-center justify-center gap-0.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
            >
              <Settings className="w-5 h-5" />
              <span className="text-[10px] font-medium">設定</span>
            </button>
          </div>
        </nav>
      )}
    </>
  );
});
