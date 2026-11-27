import { memo, useCallback, useMemo } from 'react';
import { Flag, Reply, SmilePlus, Trash2 } from 'lucide-react';
import { REACTION_EMOJIS, formatTimeHHMM } from '../lib/constants';
import type { ChatMessage } from '../types/chat';
import { Avatar } from './Avatar';
import type { LightboxImageData } from './ImageLightbox';
import { StickerArtwork } from './StickerArtwork';

interface ChatMessageBubbleProps {
  msg: ChatMessage;
  mine: boolean;
  myNickname: string;
  myBubbleClass: string;
  dateDividerLabel: string | null;
  isSelectedForAction: boolean;
  isPickerOpen: boolean;
  isHighlighted: boolean;
  registerMessageRef: (id: string, el: HTMLDivElement | null) => void;
  onToggleSelect: (msgId: string) => void;
  onToggleReactionPicker: (msgId: string) => void;
  onStartReply: (msg: ChatMessage) => void;
  onReactionClick: (msg: ChatMessage, emoji: string) => void;
  onRequestDelete: (msg: ChatMessage) => void;
  onOpenReportModal: (targetUser: string) => void;
  onOpenLightbox: (data: LightboxImageData) => void;
  onJumpToMessage: (targetId: string) => void;
}

function getReadReceiptLabel(msg: ChatMessage, myNickname: string): string | null {
  const readers = Array.isArray(msg.read_by) ? msg.read_by : [];
  const others = Array.from(
    new Set(
      readers.filter((name) => name && name !== myNickname && name !== msg.sender_name)
    )
  );
  if (others.length === 0) return null;
  if (others.length === 1) return '既読';
  return `既読 ${others.length}`;
}

export const ChatMessageBubble = memo(function ChatMessageBubble({
  msg,
  mine,
  myNickname,
  myBubbleClass,
  dateDividerLabel,
  isSelectedForAction,
  isPickerOpen,
  isHighlighted,
  registerMessageRef,
  onToggleSelect,
  onToggleReactionPicker,
  onStartReply,
  onReactionClick,
  onRequestDelete,
  onOpenReportModal,
  onOpenLightbox,
  onJumpToMessage,
}: ChatMessageBubbleProps) {
  const setContainerRef = useCallback(
    (el: HTMLDivElement | null) => {
      registerMessageRef(msg.id, el);
    },
    [msg.id, registerMessageRef]
  );

  const timeLabel = useMemo(() => formatTimeHHMM(msg.created_at), [msg.created_at]);
  const readLabel = useMemo(
    () => (mine ? getReadReceiptLabel(msg, myNickname) : null),
    [mine, msg, myNickname]
  );

  const reactionEntries = useMemo(() => {
    if (!msg.reactions) return [];
    return Object.entries(msg.reactions).filter(
      ([, users]) => Array.isArray(users) && users.length > 0
    );
  }, [msg.reactions]);

  const renderReplyQuote = (insideOwnBubble: boolean) => {
    if (!msg.reply_to) return null;
    const replyTargetId = msg.reply_to.id;
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onJumpToMessage(replyTargetId);
        }}
        className={`w-full text-left mb-2 px-2.5 py-1.5 rounded-lg border-l-2 transition-colors ${
          insideOwnBubble
            ? 'bg-black/15 hover:bg-black/25 border-white/70 text-white'
            : 'bg-slate-100 dark:bg-slate-900/75 hover:bg-slate-200/80 dark:hover:bg-slate-900 border-emerald-500 dark:border-emerald-400/80 text-slate-700 dark:text-slate-200'
        }`}
      >
        <div className="flex items-center gap-1 text-[10px] font-semibold opacity-90 truncate">
          <Reply className="w-2.5 h-2.5 shrink-0" />
          <span className="truncate">{msg.reply_to.sender_name}</span>
        </div>
        <p className="text-[11px] opacity-85 line-clamp-2 break-words mt-0.5">
          {msg.reply_to.content}
        </p>
      </button>
    );
  };

  const renderReactionBadges = (alignRight: boolean) => {
    if (reactionEntries.length === 0) return null;
    return (
      <div
        className={`flex flex-wrap items-center gap-1 mt-1.5 ${
          alignRight ? 'justify-end' : 'justify-start'
        }`}
      >
        {reactionEntries.map(([emoji, users]) => {
          const reactedByMe = users.includes(myNickname);
          return (
            <button
              key={emoji}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onReactionClick(msg, emoji);
              }}
              title={users.join('、')}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border shadow-2xs transition-colors ${
                reactedByMe
                  ? 'bg-emerald-50 dark:bg-emerald-600/25 border-emerald-400 dark:border-emerald-500/60 text-emerald-800 dark:text-emerald-100'
                  : 'bg-white/95 dark:bg-slate-900/90 border-slate-200 dark:border-slate-700/75 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <span className="leading-none">{emoji}</span>
              <span className="text-[11px] font-medium tabular-nums leading-none">
                {users.length}
              </span>
            </button>
          );
        })}
      </div>
    );
  };

  const renderReactionPickerPopover = (alignRight: boolean) => {
    if (!isPickerOpen) return null;
    return (
      <div
        onClick={(e) => e.stopPropagation()}
        className={`absolute bottom-full mb-1.5 z-30 flex items-center gap-1 px-2 py-1.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/90 shadow-xl dark:shadow-2xl ${
          alignRight ? 'right-0' : 'left-0'
        }`}
      >
        {REACTION_EMOJIS.map((emoji) => {
          const users = msg.reactions?.[emoji] || [];
          const reactedByMe = users.includes(myNickname);
          return (
            <button
              key={emoji}
              type="button"
              onClick={() => onReactionClick(msg, emoji)}
              aria-label={`${emoji} でリアクション`}
              className={`w-8 h-8 rounded-xl text-base flex items-center justify-center transition-transform hover:scale-115 active:scale-95 ${
                reactedByMe
                  ? 'bg-emerald-100 dark:bg-emerald-600/30 ring-1 ring-emerald-400/70'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {emoji}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div
      ref={setContainerRef}
      className={`space-y-3 transition-all duration-300 rounded-2xl ${
        isHighlighted
          ? 'ring-2 ring-emerald-500/70 bg-emerald-500/10 p-1.5 -mx-1.5'
          : ''
      }`}
    >
      {dateDividerLabel && (
        <div className="flex justify-center py-2">
          <span className="px-3.5 py-1 rounded-full bg-white/90 dark:bg-slate-900/85 border border-slate-200/90 dark:border-slate-800/80 text-[11px] font-medium text-slate-600 dark:text-slate-400 tabular-nums shadow-2xs">
            {dateDividerLabel}
          </span>
        </div>
      )}

      {mine ? (
        <div className="group flex flex-col items-end">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 mb-1 pr-1 font-medium">
            {msg.sender_name}
          </span>
          <div className="relative flex items-end justify-end gap-1.5 max-w-[92%] sm:max-w-[78%]">
            {/* Hover/Tap Action Bar (Reply + Reaction + Delete) */}
            <div
              className={`relative flex items-center gap-0.5 mb-0.5 transition-opacity shrink-0 ${
                isSelectedForAction
                  ? 'opacity-100'
                  : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'
              }`}
            >
              {renderReactionPickerPopover(false)}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onStartReply(msg);
                }}
                title="このメッセージに返信"
                aria-label="このメッセージに返信"
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-300 hover:bg-white/90 dark:hover:bg-slate-800/90 transition-colors"
              >
                <Reply className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleReactionPicker(msg.id);
                }}
                title="絵文字リアクション"
                aria-label="絵文字リアクション"
                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                  isPickerOpen
                    ? 'text-emerald-600 dark:text-emerald-300 bg-white dark:bg-slate-800'
                    : 'text-slate-500 dark:text-slate-400 hover:text-amber-500 dark:hover:text-amber-300 hover:bg-white/90 dark:hover:bg-slate-800/90'
                }`}
              >
                <SmilePlus className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRequestDelete(msg);
                }}
                title="このメッセージを送信取消（削除）"
                aria-label="このメッセージを削除"
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-white/90 dark:hover:bg-slate-800/90 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Read Receipt + Timestamp stacked LINE-style */}
            <div className="flex flex-col items-end shrink-0 pb-0.5 gap-0.5">
              {readLabel && (
                <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300/90 leading-none tabular-nums whitespace-nowrap">
                  {readLabel}
                </span>
              )}
              <span className="text-[10px] text-slate-500 dark:text-slate-500 font-mono tabular-nums leading-none">
                {timeLabel}
              </span>
            </div>

            {/* Own Message Bubble OR Frameless Sticker */}
            {msg.sticker_url ? (
              <div className="flex flex-col items-end">
                {msg.reply_to && (
                  <div className="max-w-[200px] mb-1">{renderReplyQuote(false)}</div>
                )}
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleSelect(msg.id);
                  }}
                  className="cursor-pointer transition-transform active:scale-95"
                >
                  <StickerArtwork stickerUrl={msg.sticker_url} size="chat" />
                </div>
              </div>
            ) : (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSelect(msg.id);
                }}
                className={`rounded-2xl bubble-tail-right shadow-xs overflow-hidden ${
                  msg.image_url && !msg.content && !msg.reply_to
                    ? 'bg-white/90 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/60 p-1'
                    : `px-3.5 py-2.5 ${myBubbleClass}`
                }`}
              >
                {renderReplyQuote(true)}
                {msg.image_url && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenLightbox({
                        url: msg.image_url!,
                        senderName: msg.sender_name,
                        createdAt: msg.created_at,
                        caption: msg.content || undefined,
                      });
                    }}
                    className={`block overflow-hidden rounded-xl cursor-zoom-in focus:outline-none ${
                      msg.content ? 'mb-2' : ''
                    }`}
                  >
                    <img
                      src={msg.image_url}
                      alt={msg.content || `${msg.sender_name}の画像`}
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      className="max-w-[220px] sm:max-w-[270px] max-h-[260px] object-cover rounded-xl hover:opacity-95 transition-opacity"
                    />
                  </button>
                )}
                {msg.content && (
                  <p
                    className={`text-sm leading-relaxed whitespace-pre-wrap break-words ${
                      msg.decryption_failed ? 'italic opacity-80 text-xs' : ''
                    }`}
                  >
                    {msg.content}
                  </p>
                )}
              </div>
            )}
          </div>
          {renderReactionBadges(true)}
        </div>
      ) : (
        <div className="group flex items-start gap-2.5 max-w-[92%] sm:max-w-[78%]">
          <Avatar
            name={msg.sender_name}
            avatarValue={msg.sender_avatar}
            avatarColor={msg.sender_color}
            size="sm"
            className="mt-1"
          />
          <div className="min-w-0 flex flex-col items-start">
            <span className="text-[11px] text-slate-600 dark:text-slate-400 mb-1 pl-0.5 font-medium">
              {msg.sender_name}
            </span>
            <div className="relative flex items-end gap-1.5 max-w-full">
              {msg.sticker_url ? (
                <div className="flex flex-col items-start">
                  {msg.reply_to && (
                    <div className="max-w-[200px] mb-1">{renderReplyQuote(false)}</div>
                  )}
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleSelect(msg.id);
                    }}
                    className="cursor-pointer transition-transform active:scale-95"
                  >
                    <StickerArtwork stickerUrl={msg.sticker_url} size="chat" />
                  </div>
                </div>
              ) : (
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleSelect(msg.id);
                  }}
                  className={`rounded-2xl bubble-tail-left bg-white dark:bg-slate-800/95 border border-slate-200/90 dark:border-slate-700/50 text-slate-900 dark:text-slate-100 shadow-xs overflow-hidden ${
                    msg.image_url && !msg.content && !msg.reply_to
                      ? 'p-1'
                      : 'px-3.5 py-2.5'
                  }`}
                >
                  {renderReplyQuote(false)}
                  {msg.image_url && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenLightbox({
                          url: msg.image_url!,
                          senderName: msg.sender_name,
                          createdAt: msg.created_at,
                          caption: msg.content || undefined,
                        });
                      }}
                      className={`block overflow-hidden rounded-xl cursor-zoom-in focus:outline-none ${
                        msg.content ? 'mb-2' : ''
                      }`}
                    >
                      <img
                        src={msg.image_url}
                        alt={msg.content || `${msg.sender_name}の画像`}
                        loading="lazy"
                        decoding="async"
                        referrerPolicy="no-referrer"
                        className="max-w-[220px] sm:max-w-[270px] max-h-[260px] object-cover rounded-xl hover:opacity-95 transition-opacity"
                      />
                    </button>
                  )}
                  {msg.content && (
                    <p
                      className={`text-sm leading-relaxed whitespace-pre-wrap break-words ${
                        msg.decryption_failed
                          ? 'italic text-slate-500 dark:text-slate-400 text-xs'
                          : ''
                      }`}
                    >
                      {msg.content}
                    </p>
                  )}
                </div>
              )}

              <span className="text-[10px] text-slate-500 dark:text-slate-500 font-mono tabular-nums shrink-0 pb-0.5 leading-none">
                {timeLabel}
              </span>

              {/* Hover/Tap Action Bar (Reply + Reaction + Report) */}
              <div
                className={`relative flex items-center gap-0.5 mb-0.5 transition-opacity shrink-0 ${
                  isSelectedForAction
                    ? 'opacity-100'
                    : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'
                }`}
              >
                {renderReactionPickerPopover(true)}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onStartReply(msg);
                  }}
                  title="このメッセージに返信"
                  aria-label="このメッセージに返信"
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-300 hover:bg-white/90 dark:hover:bg-slate-800/90 transition-colors"
                >
                  <Reply className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleReactionPicker(msg.id);
                  }}
                  title="絵文字リアクション"
                  aria-label="絵文字リアクション"
                  className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                    isPickerOpen
                      ? 'text-emerald-600 dark:text-emerald-300 bg-white dark:bg-slate-800'
                      : 'text-slate-500 dark:text-slate-400 hover:text-amber-500 dark:hover:text-amber-300 hover:bg-white/90 dark:hover:bg-slate-800/90'
                  }`}
                >
                  <SmilePlus className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenReportModal(msg.sender_name);
                  }}
                  title={`${msg.sender_name}を通報`}
                  aria-label={`${msg.sender_name}を通報`}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-white/90 dark:hover:bg-slate-800/90 transition-colors"
                >
                  <Flag className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            {renderReactionBadges(false)}
          </div>
        </div>
      )}
    </div>
  );
});
