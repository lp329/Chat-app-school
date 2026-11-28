import { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  Circle,
  Gamepad2,
  Loader2,
  MessageCircle,
  Palette,
  QrCode,
  RotateCcw,
  Trophy,
  Zap,
} from 'lucide-react';
import { formatDateDivider, formatTimeHHMM } from '../lib/constants';
import {
  getMiniGameCardPreviewText,
  getMiniGameMeta,
  parseMiniGameCardContent,
} from '../lib/minigameData';
import { getStickerPreviewLabel } from '../lib/stickers';
import type {
  ChatMessage,
  MiniGameId,
  MiniGameInvitePayload,
  ReplyReference,
} from '../types/chat';
import { ChatMessageBubble } from './ChatMessageBubble';
import type { LightboxImageData } from './ImageLightbox';

interface ChatMessageListProps {
  roomCode: string;
  displayTitle: string;
  formattedCode: string;
  messages: ChatMessage[];
  loading: boolean;
  profileId: string;
  myNickname: string;
  myBubbleClass: string;
  wallpaperBgClass: string;
  onStartReply: (reply: ReplyReference) => void;
  onToggleReaction: (msg: ChatMessage, emoji: string) => void;
  onRequestDelete: (msg: ChatMessage) => void;
  onOpenReportModal: (targetUser: string) => void;
  onOpenLightbox: (data: LightboxImageData) => void;
  onOpenQrModal: () => void;
  onJoinMiniGameInvite: (invite: MiniGameInvitePayload) => void;
  onRematchMiniGame: (gameId: MiniGameId) => void;
  activeMiniGameMatchId?: string | null;
  joiningMiniGameMatchId?: string | null;
}

function getReplyExcerptForMessage(msg: ChatMessage): string {
  if (msg.sticker_url) return getStickerPreviewLabel(msg.sticker_url);
  const gamePreview = getMiniGameCardPreviewText(msg.content || '');
  if (gamePreview) return gamePreview;
  const trimmed = (msg.content || '').trim();
  if (trimmed && msg.image_url) return `[画像] ${trimmed}`;
  if (msg.image_url) return '[画像]';
  return trimmed || 'メッセージ';
}

export const ChatMessageList = memo(function ChatMessageList({
  roomCode,
  displayTitle,
  formattedCode,
  messages,
  loading,
  profileId,
  myNickname,
  myBubbleClass,
  wallpaperBgClass,
  onStartReply,
  onToggleReaction,
  onRequestDelete,
  onOpenReportModal,
  onOpenLightbox,
  onOpenQrModal,
  onJoinMiniGameInvite,
  onRematchMiniGame,
  activeMiniGameMatchId = null,
  joiningMiniGameMatchId = null,
}: ChatMessageListProps) {
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [selectedMsgId, setSelectedMsgId] = useState<string | null>(null);
  const [reactionPickerMsgId, setReactionPickerMsgId] = useState<string | null>(null);
  const [highlightedMsgId, setHighlightedMsgId] = useState<string | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const highlightTimerRef = useRef<number | null>(null);
  const isNearBottomRef = useRef(true);
  const prevRoomRef = useRef(roomCode);
  const prevMsgCountRef = useRef(messages.length);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior, block: 'end' });
    });
  }, []);

  const isOwnMessage = useCallback(
    (msg: ChatMessage): boolean => {
      if (msg.sender_id && profileId) {
        return msg.sender_id === profileId;
      }
      return msg.sender_name === myNickname;
    },
    [profileId, myNickname]
  );

  // Close reaction picker on Escape
  useEffect(() => {
    if (!reactionPickerMsgId) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setReactionPickerMsgId(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [reactionPickerMsgId]);

  useEffect(() => {
    return () => {
      if (highlightTimerRef.current) {
        window.clearTimeout(highlightTimerRef.current);
      }
    };
  }, []);

  // Reset UI state when switching rooms
  useEffect(() => {
    if (prevRoomRef.current !== roomCode) {
      prevRoomRef.current = roomCode;
      setShowScrollBottom(false);
      setSelectedMsgId(null);
      setReactionPickerMsgId(null);
      setHighlightedMsgId(null);
      isNearBottomRef.current = true;
      prevMsgCountRef.current = messages.length;
      scrollToBottom('auto');
    }
  }, [roomCode, messages.length, scrollToBottom]);

  // Auto-scroll when new messages arrive
  useEffect(() => {
    if (messages.length > prevMsgCountRef.current) {
      const latest = messages[messages.length - 1];
      if (isNearBottomRef.current || (latest && isOwnMessage(latest))) {
        scrollToBottom(prevMsgCountRef.current === 0 ? 'auto' : 'smooth');
      } else {
        setShowScrollBottom(true);
      }
    }
    prevMsgCountRef.current = messages.length;
  }, [messages, isOwnMessage, scrollToBottom]);

  useEffect(() => {
    scrollToBottom('auto');
  }, [scrollToBottom]);

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distanceFromBottom < 96;
    isNearBottomRef.current = nearBottom;
    if (nearBottom) {
      setShowScrollBottom((prev) => (prev ? false : prev));
    }
  }, []);

  const registerMessageRef = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) {
      messageRefs.current.set(id, el);
    } else {
      messageRefs.current.delete(id);
    }
  }, []);

  const handleToggleSelect = useCallback((msgId: string) => {
    setSelectedMsgId((prev) => (prev === msgId ? null : msgId));
  }, []);

  const handleToggleReactionPicker = useCallback((msgId: string) => {
    setReactionPickerMsgId((prev) => (prev === msgId ? null : msgId));
  }, []);

  const handleStartReplyForMessage = useCallback(
    (msg: ChatMessage) => {
      setSelectedMsgId(null);
      setReactionPickerMsgId(null);
      onStartReply({
        id: msg.id,
        sender_name: msg.sender_name,
        content: getReplyExcerptForMessage(msg),
      });
    },
    [onStartReply]
  );

  const handleReactionClick = useCallback(
    (msg: ChatMessage, emoji: string) => {
      setReactionPickerMsgId(null);
      setSelectedMsgId(null);
      onToggleReaction(msg, emoji);
    },
    [onToggleReaction]
  );

  const handleRequestDelete = useCallback(
    (msg: ChatMessage) => {
      setSelectedMsgId(null);
      setReactionPickerMsgId(null);
      onRequestDelete(msg);
    },
    [onRequestDelete]
  );

  const handleReportUser = useCallback(
    (targetUser: string) => {
      setSelectedMsgId(null);
      setReactionPickerMsgId(null);
      onOpenReportModal(targetUser);
    },
    [onOpenReportModal]
  );

  const handleJumpToMessage = useCallback((targetId: string) => {
    if (!targetId) return;
    const el = messageRefs.current.get(targetId);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightedMsgId(targetId);
    if (highlightTimerRef.current) {
      window.clearTimeout(highlightTimerRef.current);
    }
    highlightTimerRef.current = window.setTimeout(() => {
      setHighlightedMsgId((curr) => (curr === targetId ? null : curr));
    }, 1800);
  }, []);

  return (
    <div
      ref={scrollContainerRef}
      onScroll={handleScroll}
      onClick={() => {
        setSelectedMsgId(null);
        setReactionPickerMsgId(null);
      }}
      className={`relative flex-1 overflow-y-auto chat-scroll px-3 sm:px-6 py-5 ${wallpaperBgClass}`}
    >
      <div className="max-w-3xl mx-auto space-y-4">
        {loading && messages.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-500 dark:text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-500 dark:text-emerald-400" />
            <p className="text-xs">トーク履歴を読み込んでいます...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="py-16 sm:py-24 flex flex-col items-center justify-center text-center space-y-4 px-4">
            <div className="w-14 h-14 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-xs">
              <MessageCircle className="w-7 h-7" />
            </div>
            <div className="space-y-1.5 max-w-sm">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {displayTitle} に入室しました
              </p>
              <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                まだメッセージはありません。このルームの会話はブラウザ内でAES-256-GCM暗号化（E2EE）されます。ルーム番号（{formattedCode}）を共有して会話を始めましょう。
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={onOpenQrModal}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2 transition-colors whitespace-nowrap shadow-xs"
              >
                <QrCode className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                QRコードを表示して招待
              </button>
            </div>
          </div>
        ) : (
          messages.map((msg, index) => {
            const mine = isOwnMessage(msg);
            const prevMsg = index > 0 ? messages[index - 1] : null;
            const currentDateLabel = formatDateDivider(msg.created_at);
            const prevDateLabel = prevMsg ? formatDateDivider(prevMsg.created_at) : null;
            const dateDividerLabel =
              currentDateLabel !== prevDateLabel ? currentDateLabel : null;

            const gameCard =
              !msg.decryption_failed && !msg.sticker_url && !msg.image_url
                ? parseMiniGameCardContent(msg.content)
                : null;

            if (gameCard?.kind === 'invite') {
              const invite = gameCard.data;
              const meta = getMiniGameMeta(invite.gameId);
              const isHostSelf = invite.host.userId === profileId;
              const isJoining = joiningMiniGameMatchId === invite.matchId;
              const isActive = activeMiniGameMatchId === invite.matchId;

              return (
                <div key={msg.id} className="space-y-3">
                  {dateDividerLabel && (
                    <div className="flex justify-center">
                      <span className="px-3 py-1 rounded-full bg-white/85 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-700/70 text-[11px] font-medium text-slate-600 dark:text-slate-300 shadow-2xs">
                        {dateDividerLabel}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-center">
                    <div className="w-full max-w-sm rounded-2xl border border-emerald-200/90 dark:border-emerald-500/30 bg-white/95 dark:bg-slate-900/95 p-4 shadow-sm">
                      <div className="flex items-start gap-3">
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${meta.accentClass}`}
                        >
                          {invite.gameId === 'reaction' ? (
                            <Zap className="w-5 h-5" />
                          ) : invite.gameId === 'draw_guess' ? (
                            <Palette className="w-5 h-5" />
                          ) : (
                            <Circle className="w-5 h-5" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                              <Gamepad2 className="w-3.5 h-3.5" />
                              ミニゲーム対戦募集
                            </span>
                            <span className="text-[10px] text-slate-400 tabular-nums">
                              {formatTimeHHMM(msg.created_at)}
                            </span>
                          </div>
                          <h4 className="mt-0.5 text-sm font-extrabold text-slate-900 dark:text-white">
                            {meta.title}
                          </h4>
                          <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                            {invite.host.nickname}さんが対戦相手を募集しています！
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                        <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-300">
                          {meta.badge}
                        </span>
                        {isActive ? (
                          <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                            対戦中
                          </span>
                        ) : isHostSelf ? (
                          <span className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-500 dark:text-slate-400">
                            対戦相手を待っています...
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onJoinMiniGameInvite(invite);
                            }}
                            disabled={Boolean(joiningMiniGameMatchId) || Boolean(activeMiniGameMatchId)}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 px-4 py-2 text-xs font-bold text-white shadow-xs transition-colors cursor-pointer"
                          >
                            {isJoining ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                接続中...
                              </>
                            ) : (
                              '参加して対戦する！'
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            if (gameCard?.kind === 'result') {
              const result = gameCard.data;
              const meta = getMiniGameMeta(result.gameId);

              return (
                <div key={msg.id} className="space-y-3">
                  {dateDividerLabel && (
                    <div className="flex justify-center">
                      <span className="px-3 py-1 rounded-full bg-white/85 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-700/70 text-[11px] font-medium text-slate-600 dark:text-slate-300 shadow-2xs">
                        {dateDividerLabel}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-center">
                    <div className="w-full max-w-md rounded-2xl border border-amber-200/90 dark:border-amber-500/30 bg-gradient-to-br from-amber-50/95 via-white to-white dark:from-slate-900 dark:via-slate-900 dark:to-slate-800/90 px-4 py-3.5 shadow-sm">
                      <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-400/20 text-amber-600 dark:text-amber-300">
                          <Trophy className="w-4.5 h-4.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300">
                              {meta.shortTitle} · 対戦結果
                            </span>
                            <span className="text-[10px] text-slate-400 tabular-nums">
                              {formatTimeHHMM(msg.created_at)}
                            </span>
                          </div>
                          <p className="mt-1 text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white leading-snug">
                            {result.headline}
                          </p>
                          {result.detail && (
                            <p className="mt-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                              {result.detail}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 flex justify-end">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRematchMiniGame(result.gameId);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition-colors cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          もう1回！
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <ChatMessageBubble
                key={msg.id}
                msg={msg}
                mine={mine}
                myNickname={myNickname}
                myBubbleClass={myBubbleClass}
                dateDividerLabel={dateDividerLabel}
                isSelectedForAction={
                  selectedMsgId === msg.id || reactionPickerMsgId === msg.id
                }
                isPickerOpen={reactionPickerMsgId === msg.id}
                isHighlighted={highlightedMsgId === msg.id}
                registerMessageRef={registerMessageRef}
                onToggleSelect={handleToggleSelect}
                onToggleReactionPicker={handleToggleReactionPicker}
                onStartReply={handleStartReplyForMessage}
                onReactionClick={handleReactionClick}
                onRequestDelete={handleRequestDelete}
                onOpenReportModal={handleReportUser}
                onOpenLightbox={onOpenLightbox}
                onJumpToMessage={handleJumpToMessage}
              />
            );
          })
        )}
        <div ref={bottomRef} className="h-1" />
      </div>

      {/* Scroll to latest button */}
      {showScrollBottom && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            isNearBottomRef.current = true;
            setShowScrollBottom(false);
            scrollToBottom('smooth');
          }}
          aria-label="最新メッセージへ移動"
          className="fixed bottom-24 right-5 sm:right-8 z-30 min-h-[40px] px-3.5 py-2 rounded-full bg-white/95 dark:bg-slate-900/95 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-slate-100 shadow-lg flex items-center gap-1.5 transition-colors"
        >
          <ArrowDown className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          最新へ
        </button>
      )}
    </div>
  );
});
