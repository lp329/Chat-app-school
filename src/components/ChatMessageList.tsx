import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown, Loader2, MessageCircle, QrCode } from 'lucide-react';
import { formatDateDivider } from '../lib/constants';
import { getStickerPreviewLabel } from '../lib/stickers';
import type { ChatMessage, ReplyReference } from '../types/chat';
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
}

function getReplyExcerptForMessage(msg: ChatMessage): string {
  if (msg.sticker_url) return getStickerPreviewLabel(msg.sticker_url);
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
