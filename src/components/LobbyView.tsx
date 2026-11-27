import { useRef, useState } from 'react';
import {
  ArrowRight,
  Clock,
  Dices,
  Hash,
  MessageSquarePlus,
  Settings,
  UserCog,
} from 'lucide-react';
import {
  formatRoomCode,
  formatTimeHHMM,
  generateGuestName,
  generateRoomCode,
} from '../lib/constants';
import type { RoomHistoryItem, UserProfile } from '../types/chat';
import { Avatar } from './Avatar';

interface LobbyViewProps {
  profile: UserProfile;
  isSupabaseConfigured: boolean;
  recentRooms: RoomHistoryItem[];
  onNicknameChange: (nickname: string) => void;
  onEnterRoom: (roomCode: string) => void;
  onOpenProfile: () => void;
  onOpenSettings: () => void;
}

export function LobbyView({
  profile,
  isSupabaseConfigured,
  recentRooms,
  onNicknameChange,
  onEnterRoom,
  onOpenProfile,
  onOpenSettings,
}: LobbyViewProps) {
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [nicknameError, setNicknameError] = useState<string | null>(null);
  const nicknameInputRef = useRef<HTMLInputElement | null>(null);
  const digitRefs = useRef<Array<HTMLInputElement | null>>([]);

  const roomCode = digits.join('');
  const isSixDigits = roomCode.length === 6;

  const ensureNickname = (): boolean => {
    if (!profile.nickname.trim()) {
      setNicknameError('入室前にニックネームを入力するか、ランダム生成を押してください。');
      nicknameInputRef.current?.focus();
      return false;
    }
    setNicknameError(null);
    return true;
  };

  const handleCreateRoom = () => {
    if (!ensureNickname()) return;
    const newCode = generateRoomCode();
    onEnterRoom(newCode);
  };

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSixDigits) return;
    if (!ensureNickname()) return;
    onEnterRoom(roomCode);
  };

  const handleDigitChange = (index: number, rawValue: string) => {
    const cleaned = rawValue.replace(/\D/g, '');
    if (!cleaned) {
      const next = [...digits];
      next[index] = '';
      setDigits(next);
      return;
    }

    // Handle multi-digit paste or fast input across cells
    const chars = cleaned.slice(0, 6 - index).split('');
    const next = [...digits];
    chars.forEach((char, offset) => {
      next[index + offset] = char;
    });
    setDigits(next);

    const nextFocus = Math.min(index + chars.length, 5);
    digitRefs.current[nextFocus]?.focus();
  };

  const handleDigitKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
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

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const next = ['', '', '', '', '', ''];
    for (let i = 0; i < pasted.length; i++) {
      next[i] = pasted[i];
    }
    setDigits(next);
    const focusIndex = Math.min(pasted.length, 5);
    digitRefs.current[focusIndex]?.focus();
  };

  return (
    <div className="h-full overflow-y-auto chat-scroll bg-slate-950">
      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-6 sm:py-10 pb-24 lg:pb-12 space-y-7">
        {/* Top welcome + quick status row */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-50 tracking-tight text-balance">
              6桁の番号で、すぐトーク。
            </h1>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm text-slate-400">
              <span>登録不要・ルーム番号共有で即時同期</span>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                onClick={onOpenSettings}
                className="inline-flex items-center gap-1.5 text-slate-300 hover:text-white underline-offset-4 hover:underline transition-colors"
              >
                <span
                  className={isSupabaseConfigured ? 'text-emerald-400' : 'text-blue-400'}
                >
                  {isSupabaseConfigured ? 'Supabase Realtime 接続中' : 'ローカルモード動作中'}
                </span>
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Supabase接続設定を開く"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition-colors shrink-0 lg:hidden"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>

        {/* Step 1: Nickname & Profile Bar */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Avatar
                name={profile.nickname || 'ゲスト'}
                avatarType={profile.avatarType}
                avatarValue={profile.avatarValue}
                avatarColor={profile.avatarColor}
                size="md"
              />
              <div className="min-w-0">
                <label
                  htmlFor="lobby-nickname"
                  className="block text-sm font-semibold text-slate-100"
                >
                  ニックネーム <span className="text-rose-400 text-xs font-normal">必須</span>
                </label>
                <p className="text-xs text-slate-400 truncate">
                  {profile.statusMessage || 'トーク画面に表示される名前を設定'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onOpenProfile}
              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-xs font-medium text-slate-200 flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              <UserCog className="w-4 h-4 text-blue-400" />
              プロフィール編集
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5">
            <input
              ref={nicknameInputRef}
              id="lobby-nickname"
              type="text"
              maxLength={24}
              value={profile.nickname}
              onChange={(e) => {
                onNicknameChange(e.target.value);
                if (nicknameError && e.target.value.trim()) {
                  setNicknameError(null);
                }
              }}
              placeholder="ニックネームを入力（例: はるき）"
              className={`flex-1 h-12 px-4 rounded-xl bg-slate-950 border text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 transition-colors ${
                nicknameError
                  ? 'border-rose-500/80 focus:border-rose-500 focus:ring-rose-500/20'
                  : 'border-slate-800 focus:border-blue-500 focus:ring-blue-500/20'
              }`}
            />
            <button
              type="button"
              onClick={() => {
                const generated = generateGuestName();
                onNicknameChange(generated);
                setNicknameError(null);
              }}
              className="min-h-[48px] px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-medium text-slate-100 flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0"
            >
              <Dices className="w-4 h-4 text-blue-400" />
              ゲスト名を自動生成
            </button>
          </div>

          {nicknameError && (
            <p className="text-xs text-rose-400 font-medium">{nicknameError}</p>
          )}
        </section>

        {/* Step 2: Create New Room + Join by 6-Digit Code */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch">
          {/* Join by 6-digit number (Primary focal anchor) */}
          <section className="md:col-span-7 rounded-2xl border border-slate-800 bg-slate-900/90 p-5 sm:p-6 flex flex-col justify-between space-y-5">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-slate-100 font-semibold text-base">
                <Hash className="w-4 h-4 text-blue-400" />
                ルーム番号で参加
              </div>
              <p className="text-xs text-slate-400">
                共有された6桁の数字を入力してください（ペースト対応）
              </p>
            </div>

            <form onSubmit={handleJoinSubmit} className="space-y-5">
              {/* 6-digit segmented numeric input */}
              <div
                className="grid grid-cols-6 gap-2 sm:gap-2.5"
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
                    onPaste={handlePaste}
                    onFocus={(e) => e.target.select()}
                    placeholder="0"
                    className="w-full h-14 sm:h-16 text-center text-2xl sm:text-3xl font-bold font-mono tabular-nums rounded-xl bg-slate-950 border border-slate-800 text-slate-50 placeholder:text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25 transition-all"
                  />
                ))}
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-slate-500 font-mono tabular-nums">
                  {roomCode.length} / 6 桁入力済み
                </span>
                {roomCode.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setDigits(['', '', '', '', '', '']);
                      digitRefs.current[0]?.focus();
                    }}
                    className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    クリア
                  </button>
                )}
              </div>

              <button
                type="submit"
                disabled={!isSixDigits}
                className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-[0.99] disabled:bg-slate-800 disabled:text-slate-500 disabled:pointer-events-none text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all whitespace-nowrap"
              >
                <span>ルームに参加する</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </section>

          {/* Create New Room */}
          <section className="md:col-span-5 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:p-6 flex flex-col justify-between space-y-5">
            <div className="space-y-2">
              <div className="w-11 h-11 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                <MessageSquarePlus className="w-5 h-5" />
              </div>
              <h2 className="text-base font-semibold text-slate-100">
                新規ルームを作成
              </h2>
              <p className="text-xs leading-relaxed text-slate-400">
                ランダムな6桁のルーム番号を自動発行し、そのままトークルームへ入室します。発行された番号を仲間に送るだけで会話が始まります。
              </p>
            </div>

            <div className="space-y-3">
              <div className="px-3.5 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between text-xs">
                <span className="text-slate-400">発行フォーマット</span>
                <span className="font-mono tabular-nums text-slate-200 font-semibold">
                  例: 482 910
                </span>
              </div>

              <button
                type="button"
                onClick={handleCreateRoom}
                className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all whitespace-nowrap"
              >
                <MessageSquarePlus className="w-4 h-4" />
                <span>新規ルームを作成して入室</span>
              </button>
            </div>
          </section>
        </div>

        {/* Recent Rooms quick list (visible on mobile/tablet where sidebar is hidden) */}
        {recentRooms.length > 0 && (
          <section className="lg:hidden space-y-3 pt-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
              <Clock className="w-3.5 h-3.5" />
              最近参加したトーク
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 divide-y divide-slate-800/80 overflow-hidden">
              {recentRooms.slice(0, 5).map((item) => (
                <button
                  key={item.roomCode}
                  type="button"
                  onClick={() => {
                    if (!ensureNickname()) return;
                    onEnterRoom(item.roomCode);
                  }}
                  className="w-full min-h-[60px] px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-800/60 transition-colors text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-blue-600/15 text-blue-400 font-mono text-xs font-bold flex items-center justify-center shrink-0">
                      #
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-100 font-mono tabular-nums">
                        {formatRoomCode(item.roomCode)}
                      </div>
                      <p className="text-xs text-slate-400 truncate">
                        {item.lastSender ? `${item.lastSender}: ${item.lastMessage}` : item.lastMessage}
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] text-slate-500 font-mono tabular-nums shrink-0">
                    {formatTimeHHMM(item.lastAt)}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
