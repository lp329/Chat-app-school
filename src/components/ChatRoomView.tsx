import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowDown,
  Check,
  Copy,
  Loader2,
  LogOut,
  MessageCircle,
  Send,
  Settings,
  Smile,
  UserPlus,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import {
  BUBBLE_THEMES,
  PRESET_AVATARS,
  QUICK_STAMPS,
  WALLPAPER_THEMES,
  formatDateDivider,
  formatRoomCode,
  formatTimeHHMM,
} from '../lib/constants';
import {
  appendMockMessage,
  loadMockMessages,
  subscribeToMockRoom,
} from '../lib/storage';
import {
  fetchRoomMessagesFromSupabase,
  sendRoomMessageToSupabase,
  subscribeToSupabaseRoom,
} from '../lib/supabaseService';
import type {
  ChatMessage,
  RealtimeStatus,
  SupabaseConfig,
  UserProfile,
} from '../types/chat';
import { Avatar } from './Avatar';

interface ChatRoomViewProps {
  roomCode: string;
  profile: UserProfile;
  supabaseConfig: SupabaseConfig;
  isSupabaseConfigured: boolean;
  onLeaveRoom: () => void;
  onOpenSettings: () => void;
  onOpenProfile: () => void;
  onLatestMessageUpdate: (roomCode: string, message: ChatMessage) => void;
}

const DEMO_PEER_SAMPLES = [
  {
    name: 'ミキ',
    avatar: PRESET_AVATARS[1].url,
    color: 'indigo',
    texts: [
      'ルーム番号ありがとう！無事に入れたよ',
      'デザインすっきりしてて見やすいね！',
      'このチャット、別タブを開いて同じ番号を入れるとリアルタイム同期も確認できるよ',
    ],
  },
  {
    name: 'レン',
    avatar: PRESET_AVATARS[2].url,
    color: 'sky',
    texts: [
      'おつかれさまです！今合流しました',
      'Shift+Enterで改行できるの便利ですね',
      'プロフィール画面からアイコンや吹き出しの色も変えられるみたい！',
    ],
  },
];

export function ChatRoomView({
  roomCode,
  profile,
  supabaseConfig,
  isSupabaseConfigured,
  onLeaveRoom,
  onOpenSettings,
  onOpenProfile,
  onLatestMessageUpdate,
}: ChatRoomViewProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>(
    isSupabaseConfigured ? 'connecting' : 'mock'
  );
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showStamps, setShowStamps] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [demoIndex, setDemoIndex] = useState(0);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const isNearBottomRef = useRef(true);

  const myBubbleTheme = useMemo(
    () => BUBBLE_THEMES.find((b) => b.id === profile.bubbleTheme) || BUBBLE_THEMES[0],
    [profile.bubbleTheme]
  );

  const wallpaperTheme = useMemo(
    () =>
      WALLPAPER_THEMES.find((w) => w.id === profile.wallpaperTheme) || WALLPAPER_THEMES[0],
    [profile.wallpaperTheme]
  );

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior, block: 'end' });
    });
  }, []);

  const mergeIncomingMessage = useCallback(
    (incoming: ChatMessage) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === incoming.id)) {
          return prev;
        }
        const next = [...prev, incoming].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        return next;
      });
      onLatestMessageUpdate(roomCode, incoming);

      if (isNearBottomRef.current) {
        scrollToBottom('smooth');
      } else {
        setShowScrollBottom(true);
      }
    },
    [onLatestMessageUpdate, roomCode, scrollToBottom]
  );

  // Initial load + Realtime subscription (Supabase or Local Mock)
  useEffect(() => {
    let active = true;
    setLoading(true);
    setErrorMsg(null);
    setMessages([]);

    if (!isSupabaseConfigured) {
      setRealtimeStatus('mock');
      const localList = loadMockMessages(roomCode);
      setMessages(localList);
      setLoading(false);
      if (localList.length > 0) {
        onLatestMessageUpdate(roomCode, localList[localList.length - 1]);
      }
      scrollToBottom('auto');

      const unsubscribeMock = subscribeToMockRoom(roomCode, (msg) => {
        if (!active) return;
        mergeIncomingMessage(msg);
      });

      return () => {
        active = false;
        unsubscribeMock();
      };
    }

    // Supabase Realtime Mode
    setRealtimeStatus('connecting');

    fetchRoomMessagesFromSupabase(supabaseConfig, roomCode).then(({ data, error }) => {
      if (!active) return;
      if (error) {
        setErrorMsg(`過去メッセージの取得に失敗しました: ${error}`);
      } else {
        setMessages(data);
        if (data.length > 0) {
          onLatestMessageUpdate(roomCode, data[data.length - 1]);
        }
        scrollToBottom('auto');
      }
      setLoading(false);
    });

    const unsubscribeSupabase = subscribeToSupabaseRoom(
      supabaseConfig,
      roomCode,
      (msg) => {
        if (!active) return;
        mergeIncomingMessage(msg);
      },
      (status) => {
        if (!active) return;
        setRealtimeStatus(status);
      }
    );

    return () => {
      active = false;
      unsubscribeSupabase();
    };
  }, [
    roomCode,
    isSupabaseConfigured,
    supabaseConfig.url,
    supabaseConfig.anonKey,
    mergeIncomingMessage,
    onLatestMessageUpdate,
    scrollToBottom,
  ]);

  // Auto-resize textarea height cleanly
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, [inputText]);

  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distanceFromBottom < 96;
    isNearBottomRef.current = nearBottom;
    if (nearBottom) {
      setShowScrollBottom(false);
    }
  };

  const handleCopyRoomCode = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback copy via temporary input
      const temp = document.createElement('input');
      temp.value = roomCode;
      document.body.appendChild(temp);
      temp.select();
      document.execCommand('copy');
      document.body.removeChild(temp);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const sendMessageContent = async (rawContent: string) => {
    const content = rawContent.trim();
    if (!content || sending) return;

    const senderName = profile.nickname.trim() || 'ゲスト';
    const senderAvatar =
      profile.avatarType === 'preset' || profile.avatarType === 'custom'
        ? profile.avatarValue
        : '';

    setErrorMsg(null);
    setShowStamps(false);

    if (!isSupabaseConfigured) {
      const mockMessage: ChatMessage = {
        id:
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        room_code: roomCode,
        sender_name: senderName,
        content,
        created_at: new Date().toISOString(),
        sender_id: profile.id,
        sender_avatar: senderAvatar || null,
        sender_color: profile.avatarColor,
      };
      appendMockMessage(roomCode, mockMessage);
      isNearBottomRef.current = true;
      mergeIncomingMessage(mockMessage);
      setInputText('');
      return;
    }

    setSending(true);
    const { data, error } = await sendRoomMessageToSupabase(supabaseConfig, {
      room_code: roomCode,
      sender_name: senderName,
      content,
      sender_id: profile.id,
      sender_avatar: senderAvatar || undefined,
      sender_color: profile.avatarColor,
    });
    setSending(false);

    if (error) {
      setErrorMsg(`送信エラー: ${error}`);
      return;
    }

    setInputText('');
    isNearBottomRef.current = true;
    if (data) {
      mergeIncomingMessage(data);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Prevent sending during Japanese IME composition
    if (e.nativeEvent.isComposing || e.keyCode === 229) {
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendMessageContent(inputText);
    }
  };

  const handleSimulatePeerMessage = () => {
    if (isSupabaseConfigured) return;
    const peer = DEMO_PEER_SAMPLES[demoIndex % DEMO_PEER_SAMPLES.length];
    const text = peer.texts[Math.floor(demoIndex / DEMO_PEER_SAMPLES.length) % peer.texts.length];
    const mockPeerMsg: ChatMessage = {
      id: `demo_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      room_code: roomCode,
      sender_name: peer.name,
      content: text,
      created_at: new Date().toISOString(),
      sender_id: `peer_${peer.name}`,
      sender_avatar: peer.avatar,
      sender_color: peer.color,
    };
    setDemoIndex((prev) => prev + 1);
    appendMockMessage(roomCode, mockPeerMsg);
    isNearBottomRef.current = true;
    mergeIncomingMessage(mockPeerMsg);
  };

  const isOwnMessage = (msg: ChatMessage): boolean => {
    if (msg.sender_id && profile.id) {
      return msg.sender_id === profile.id;
    }
    return msg.sender_name === (profile.nickname.trim() || 'ゲスト');
  };

  return (
    <div className="h-full flex flex-col bg-slate-950 overflow-hidden">
      {/* Chat Room Header */}
      <header className="shrink-0 h-16 px-3 sm:px-5 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 flex items-center justify-between gap-2 sm:gap-4 z-20">
        {/* Left: Room Number + Copy */}
        <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xl sm:text-2xl font-bold font-mono tabular-nums tracking-wider text-white whitespace-nowrap">
                  {formatRoomCode(roomCode)}
                </span>
                <button
                  type="button"
                  onClick={handleCopyRoomCode}
                  aria-label="ルーム番号をコピー"
                  className={`min-h-[36px] px-2.5 sm:px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                    copied
                      ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80'
                  }`}
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>コピー済み</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span className="hidden xs:inline sm:inline">番号コピー</span>
                    </>
                  )}
                </button>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                {realtimeStatus === 'connected' && (
                  <>
                    <Wifi className="w-3 h-3 text-emerald-400 shrink-0" />
                    <span className="text-emerald-400/90">Realtime 同期中</span>
                  </>
                )}
                {realtimeStatus === 'connecting' && (
                  <>
                    <Loader2 className="w-3 h-3 text-blue-400 animate-spin shrink-0" />
                    <span>Supabase 接続中...</span>
                  </>
                )}
                {realtimeStatus === 'error' && (
                  <>
                    <WifiOff className="w-3 h-3 text-rose-400 shrink-0" />
                    <span className="text-rose-400">接続エラー</span>
                  </>
                )}
                {realtimeStatus === 'mock' && (
                  <>
                    <MessageCircle className="w-3 h-3 text-blue-400 shrink-0" />
                    <span>ローカルモード（別タブ同期対応）</span>
                  </>
                )}
                <span aria-hidden="true" className="hidden sm:inline">
                  ·
                </span>
                <span className="hidden sm:inline tabular-nums">
                  {messages.length}件のメッセージ
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Actions (Demo peer in mock mode, Settings, Profile, Leave) */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {!isSupabaseConfigured && (
            <button
              type="button"
              onClick={handleSimulatePeerMessage}
              title="相手からのテストメッセージを受信して吹き出し表示を確認"
              className="hidden md:flex min-h-[40px] px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-xs font-medium text-slate-200 items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              <UserPlus className="w-3.5 h-3.5 text-blue-400" />
              相手メッセージテスト
            </button>
          )}

          <button
            type="button"
            onClick={onOpenProfile}
            aria-label="プロフィール設定"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl hover:bg-slate-800 transition-colors shrink-0"
          >
            <Avatar
              name={profile.nickname || 'ゲスト'}
              avatarType={profile.avatarType}
              avatarValue={profile.avatarValue}
              avatarColor={profile.avatarColor}
              size="xs"
            />
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Supabase接続設定"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors shrink-0"
          >
            <Settings className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onLeaveRoom}
            className="min-h-[40px] px-3 sm:px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-950/70 hover:text-rose-200 border border-slate-700/60 hover:border-rose-800/70 text-xs sm:text-sm font-medium text-slate-200 flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
          >
            <LogOut className="w-4 h-4" />
            <span>退室</span>
          </button>
        </div>
      </header>

      {/* Error banner if Supabase error occurs */}
      {errorMsg && (
        <div className="shrink-0 px-4 py-2.5 bg-rose-950/80 border-b border-rose-800/70 text-xs text-rose-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="truncate">{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={onOpenSettings}
            className="text-xs font-semibold text-white underline underline-offset-2 shrink-0"
          >
            接続設定を確認
          </button>
        </div>
      )}

      {/* Message Stream Area */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className={`relative flex-1 overflow-y-auto chat-scroll px-3 sm:px-6 py-5 ${wallpaperTheme.bgClass}`}
      >
        <div className="max-w-3xl mx-auto space-y-4">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
              <p className="text-xs">トーク履歴を読み込んでいます...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="py-16 sm:py-24 flex flex-col items-center justify-center text-center space-y-4 px-4">
              <div className="w-14 h-14 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center justify-center text-blue-400">
                <MessageCircle className="w-7 h-7" />
              </div>
              <div className="space-y-1.5 max-w-sm">
                <p className="text-sm font-semibold text-slate-100">
                  ルーム {formatRoomCode(roomCode)} に入室しました
                </p>
                <p className="text-xs leading-relaxed text-slate-400">
                  まだメッセージはありません。最初のメッセージを送るか、上の番号コピーボタンでルーム番号を共有して会話を始めましょう。
                </p>
              </div>

              {!isSupabaseConfigured && (
                <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={handleSimulatePeerMessage}
                    className="min-h-[42px] px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-200 flex items-center gap-2 transition-colors whitespace-nowrap"
                  >
                    <UserPlus className="w-4 h-4 text-blue-400" />
                    相手からのテストメッセージを受信
                  </button>
                  <button
                    type="button"
                    onClick={onOpenSettings}
                    className="min-h-[42px] px-4 py-2 rounded-xl bg-blue-600/15 hover:bg-blue-600/25 border border-blue-500/30 text-xs font-medium text-blue-300 flex items-center gap-2 transition-colors whitespace-nowrap"
                  >
                    <Settings className="w-4 h-4" />
                    Supabase Realtimeを設定
                  </button>
                </div>
              )}
            </div>
          ) : (
            messages.map((msg, index) => {
              const mine = isOwnMessage(msg);
              const prevMsg = index > 0 ? messages[index - 1] : null;
              const currentDateLabel = formatDateDivider(msg.created_at);
              const prevDateLabel = prevMsg ? formatDateDivider(prevMsg.created_at) : null;
              const showDateDivider = currentDateLabel !== prevDateLabel;

              const timeLabel = formatTimeHHMM(msg.created_at);

              return (
                <div key={msg.id} className="space-y-3">
                  {/* LINE-style centered date divider */}
                  {showDateDivider && currentDateLabel && (
                    <div className="flex justify-center py-2">
                      <span className="px-3.5 py-1 rounded-full bg-slate-900/85 border border-slate-800/80 text-[11px] font-medium text-slate-400 tabular-nums">
                        {currentDateLabel}
                      </span>
                    </div>
                  )}

                  {mine ? (
                    /* Own message (Right-aligned, blue accent by default) */
                    <div className="flex flex-col items-end">
                      <span className="text-[11px] text-slate-400 mb-1 pr-1">
                        {msg.sender_name}
                      </span>
                      <div className="flex items-end justify-end gap-1.5 max-w-[85%] sm:max-w-[72%]">
                        <div className="flex flex-col items-end shrink-0 pb-0.5">
                          <span className="text-[10px] text-slate-500 font-mono tabular-nums leading-none">
                            {timeLabel}
                          </span>
                        </div>
                        <div
                          className={`px-3.5 py-2.5 rounded-2xl bubble-tail-right text-sm leading-relaxed whitespace-pre-wrap break-words shadow-sm ${myBubbleTheme.bubbleClass}`}
                        >
                          {msg.content}
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Other's message (Left-aligned, dark slate-gray) */
                    <div className="flex items-start gap-2.5 max-w-[88%] sm:max-w-[75%]">
                      <Avatar
                        name={msg.sender_name}
                        avatarValue={msg.sender_avatar}
                        avatarColor={msg.sender_color}
                        size="sm"
                        className="mt-1"
                      />
                      <div className="min-w-0 flex flex-col items-start">
                        <span className="text-[11px] text-slate-400 mb-1 pl-0.5">
                          {msg.sender_name}
                        </span>
                        <div className="flex items-end gap-1.5 max-w-full">
                          <div className="px-3.5 py-2.5 rounded-2xl bubble-tail-left bg-slate-800/95 border border-slate-700/50 text-slate-100 text-sm leading-relaxed whitespace-pre-wrap break-words shadow-sm">
                            {msg.content}
                          </div>
                          <span className="text-[10px] text-slate-500 font-mono tabular-nums shrink-0 pb-0.5 leading-none">
                            {timeLabel}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
          <div ref={bottomRef} className="h-1" />
        </div>

        {/* Scroll to latest floating button */}
        {showScrollBottom && (
          <button
            type="button"
            onClick={() => {
              isNearBottomRef.current = true;
              setShowScrollBottom(false);
              scrollToBottom('smooth');
            }}
            aria-label="最新メッセージへ移動"
            className="fixed bottom-24 right-5 sm:right-8 z-30 min-h-[40px] px-3.5 py-2 rounded-full bg-slate-900/95 hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-100 shadow-lg flex items-center gap-1.5 transition-colors"
          >
            <ArrowDown className="w-3.5 h-3.5 text-blue-400" />
            最新へ
          </button>
        )}
      </div>

      {/* Quick Stamp Tray (LINE-like quick replies) */}
      {showStamps && (
        <div className="shrink-0 bg-slate-900 border-t border-slate-800 px-3 sm:px-6 py-3">
          <div className="max-w-3xl mx-auto space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">
                クイックスタンプ（タップで即送信）
              </span>
              <button
                type="button"
                onClick={() => setShowStamps(false)}
                aria-label="スタンプを閉じる"
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {QUICK_STAMPS.map((stamp) => (
                <button
                  key={stamp.id}
                  type="button"
                  onClick={() => void sendMessageContent(`${stamp.emoji} ${stamp.text}`)}
                  className="min-h-[44px] px-3 py-2 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-left flex items-center gap-2 transition-colors"
                >
                  <span className="text-lg shrink-0" aria-hidden="true">
                    {stamp.emoji}
                  </span>
                  <span className="text-xs font-medium text-slate-200 truncate">
                    {stamp.text}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Input Footer */}
      <footer className="shrink-0 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 px-3 sm:px-6 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="max-w-3xl mx-auto flex items-end gap-2">
          <button
            type="button"
            onClick={() => setShowStamps((prev) => !prev)}
            aria-label="クイックスタンプを開く"
            className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl transition-colors shrink-0 ${
              showStamps
                ? 'bg-blue-600/20 text-blue-400'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
            }`}
          >
            <Smile className="w-5 h-5" />
          </button>

          <div className="flex-1 min-w-0 bg-slate-950 border border-slate-800 focus-within:border-blue-500/80 focus-within:ring-2 focus-within:ring-blue-500/20 rounded-2xl px-3.5 py-2 transition-all">
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="メッセージを入力（Enterで送信 / Shift+Enterで改行）"
              className="w-full max-h-32 resize-none bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none leading-6"
            />
          </div>

          <button
            type="button"
            onClick={() => void sendMessageContent(inputText)}
            disabled={!inputText.trim() || sending}
            aria-label="メッセージを送信"
            className="min-h-[44px] min-w-[44px] px-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 disabled:bg-slate-800 disabled:text-slate-500 disabled:pointer-events-none text-white flex items-center justify-center transition-all shrink-0"
          >
            {sending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </footer>
    </div>
  );
}
