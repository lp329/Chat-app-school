import {
  Hash,
  MessageCircle,
  Plus,
  Settings,
  Trash2,
  User,
} from 'lucide-react';
import { formatRoomCode, formatTimeHHMM } from '../lib/constants';
import type { ActiveTab, RoomHistoryItem, UserProfile } from '../types/chat';
import { Avatar } from './Avatar';

interface SidebarProps {
  profile: UserProfile;
  activeTab: ActiveTab;
  activeRoomCode: string | null;
  recentRooms: RoomHistoryItem[];
  isSupabaseConfigured: boolean;
  onSelectTab: (tab: ActiveTab) => void;
  onSelectRoom: (roomCode: string) => void;
  onDeleteRecentRoom: (roomCode: string) => void;
  onOpenLobby: () => void;
  onOpenSettings: () => void;
}

export function Sidebar({
  profile,
  activeTab,
  activeRoomCode,
  recentRooms,
  isSupabaseConfigured,
  onSelectTab,
  onSelectRoom,
  onDeleteRecentRoom,
  onOpenLobby,
  onOpenSettings,
}: SidebarProps) {
  return (
    <>
      {/* Desktop LINE-style Left Navigation Rail + Talk List */}
      <div className="hidden lg:flex h-full shrink-0 border-r border-slate-800/90 bg-slate-900/90">
        {/* Slim Icon Rail */}
        <nav
          aria-label="メインナビゲーション"
          className="w-16 flex flex-col items-center justify-between py-4 bg-slate-950 border-r border-slate-800/90 shrink-0"
        >
          <div className="flex flex-col items-center gap-3">
            {/* Brand mark */}
            <button
              type="button"
              onClick={onOpenLobby}
              title="RoomLine ロビー"
              className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-base shadow-sm hover:bg-blue-500 transition-colors"
            >
              R
            </button>

            <div className="w-6 h-px bg-slate-800 my-1" />

            <button
              type="button"
              onClick={() => onSelectTab('rooms')}
              title="トーク / ロビー"
              aria-label="トークとロビー"
              className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors ${
                activeTab === 'rooms'
                  ? 'bg-slate-800 text-blue-400'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900'
              }`}
            >
              <MessageCircle className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() => onSelectTab('profile')}
              title="プロフィール設定"
              aria-label="プロフィール設定"
              className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors ${
                activeTab === 'profile'
                  ? 'bg-slate-800 text-blue-400'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900'
              }`}
            >
              <User className="w-5 h-5" />
            </button>
          </div>

          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={onOpenSettings}
              title="Supabase接続設定"
              aria-label="Supabase接続設定"
              className="w-11 h-11 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-100 hover:bg-slate-900 transition-colors"
            >
              <Settings className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() => onSelectTab('profile')}
              title={profile.nickname || 'プロフィールを編集'}
              className="rounded-full hover:opacity-90 transition-opacity"
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

        {/* LINE-style Chats Sidebar Column */}
        <aside className="w-72 flex flex-col bg-slate-900/70 shrink-0">
          {/* Sidebar Header */}
          <div className="h-16 px-4 border-b border-slate-800/90 flex items-center justify-between gap-2 shrink-0">
            <div className="min-w-0">
              <span className="text-base font-bold text-slate-50 tracking-tight block truncate">
                RoomLine
              </span>
              <span className="text-[11px] text-slate-400 block truncate">
                {isSupabaseConfigured ? 'Supabase Realtime' : 'ローカルモード'}
              </span>
            </div>
            <button
              type="button"
              onClick={onOpenLobby}
              title="ルーム作成・参加ロビーへ"
              className="min-h-[38px] px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-100 flex items-center gap-1 transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5 text-blue-400" />
              ロビー
            </button>
          </div>

          {/* Mini Profile Summary Row (LINE Home feel) */}
          <button
            type="button"
            onClick={() => onSelectTab('profile')}
            className={`px-4 py-3.5 border-b border-slate-800/80 flex items-center gap-3 text-left transition-colors ${
              activeTab === 'profile' ? 'bg-slate-800/60' : 'hover:bg-slate-800/40'
            }`}
          >
            <Avatar
              name={profile.nickname || 'ゲスト'}
              avatarType={profile.avatarType}
              avatarValue={profile.avatarValue}
              avatarColor={profile.avatarColor}
              size="md"
            />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-slate-100 truncate">
                {profile.nickname.trim() || 'ニックネーム未設定'}
              </div>
              <div className="text-xs text-slate-400 truncate mt-0.5">
                {profile.statusMessage.trim() || 'ひとことを設定...'}
              </div>
            </div>
          </button>

          {/* Recent Rooms List */}
          <div className="flex-1 overflow-y-auto chat-scroll">
            <div className="px-4 pt-4 pb-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400">
                トーク履歴
              </span>
              <span className="text-[11px] text-slate-500 font-mono tabular-nums">
                {recentRooms.length}
              </span>
            </div>

            {recentRooms.length === 0 ? (
              <div className="px-4 py-8 text-center space-y-2">
                <p className="text-xs text-slate-400">
                  参加したルームがここに表示されます
                </p>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  右側のロビーから6桁の番号を入力するか、新規ルームを作成してください。
                </p>
              </div>
            ) : (
              <div className="px-2 pb-4 space-y-1">
                {recentRooms.map((item) => {
                  const isActive = activeTab === 'rooms' && activeRoomCode === item.roomCode;
                  return (
                    <div
                      key={item.roomCode}
                      className={`group relative rounded-xl transition-colors ${
                        isActive ? 'bg-blue-600/15' : 'hover:bg-slate-800/60'
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
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          <Hash className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`text-sm font-semibold font-mono tabular-nums ${
                                isActive ? 'text-white' : 'text-slate-100'
                              }`}
                            >
                              {formatRoomCode(item.roomCode)}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono tabular-nums shrink-0">
                              {formatTimeHHMM(item.lastAt)}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 truncate mt-0.5">
                            {item.lastSender
                              ? `${item.lastSender}: ${item.lastMessage}`
                              : item.lastMessage}
                          </p>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteRecentRoom(item.roomCode);
                        }}
                        aria-label={`ルーム ${item.roomCode} を履歴から削除`}
                        className="opacity-0 group-hover:opacity-100 focus:opacity-100 absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-900/80 flex items-center justify-center transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Mobile Bottom Tab Bar (Hidden when actively inside a Chat Room so composer stays unobstructed and sticky height <= 15%) */}
      {!activeRoomCode && (
        <nav
          aria-label="モバイルナビゲーション"
          className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 pb-[env(safe-area-inset-bottom)]"
        >
          <div className="grid grid-cols-3 h-15">
            <button
              type="button"
              onClick={() => onSelectTab('rooms')}
              className={`flex flex-col items-center justify-center gap-0.5 transition-colors ${
                activeTab === 'rooms' ? 'text-blue-400' : 'text-slate-400'
              }`}
            >
              <MessageCircle className="w-5 h-5" />
              <span className="text-[10px] font-medium">トーク</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectTab('profile')}
              className={`flex flex-col items-center justify-center gap-0.5 transition-colors ${
                activeTab === 'profile' ? 'text-blue-400' : 'text-slate-400'
              }`}
            >
              <User className="w-5 h-5" />
              <span className="text-[10px] font-medium">プロフィール</span>
            </button>

            <button
              type="button"
              onClick={onOpenSettings}
              className="flex flex-col items-center justify-center gap-0.5 text-slate-400 hover:text-slate-200 transition-colors"
            >
              <Settings className="w-5 h-5" />
              <span className="text-[10px] font-medium">接続設定</span>
            </button>
          </div>
        </nav>
      )}
    </>
  );
}
