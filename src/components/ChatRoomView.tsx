import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Calculator,
  Check,
  ChevronLeft,
  Copy,
  Flag,
  Gamepad2,
  Loader2,
  Lock,
  LogOut,
  Pencil,
  Phone,
  QrCode,
  Settings,
  ShieldCheck,
  Unlock,
  Users,
  Video,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import {
  BUBBLE_THEMES,
  WALLPAPER_THEMES,
  formatRoomCode,
  getRoomDisplayTitle,
} from '../lib/constants';
import { getMiniGameMeta } from '../lib/minigameData';
import type { PendingMiniGameInvite } from '../hooks/useMiniGameSession';
import type {
  ChatMessage,
  CustomSticker,
  MiniGameId,
  MiniGameInvitePayload,
  OnlineMember,
  RealtimeStatus,
  ReplyReference,
  UserProfile,
} from '../types/chat';
import { Avatar } from './Avatar';
import { ChatComposer } from './ChatComposer';
import { ChatMessageList } from './ChatMessageList';
import { DeleteMessageModal } from './DeleteMessageModal';
import { ImageLightbox, type LightboxImageData } from './ImageLightbox';
import { RoomQrModal } from './RoomQrModal';

interface ChatRoomViewProps {
  roomCode: string;
  roomTitle?: string;
  roomPasscode?: string | null;
  messages: ChatMessage[];
  onlineMembers: OnlineMember[];
  customStickers: CustomSticker[];
  loading: boolean;
  realtimeStatus: RealtimeStatus;
  errorMsg: string | null;
  profile: UserProfile;
  onSendMessage: (
    roomCode: string,
    content: string,
    imageFile?: File | null,
    replyTo?: ReplyReference | null
  ) => Promise<string | null>;
  onSendSticker: (
    roomCode: string,
    stickerUrl: string,
    replyTo?: ReplyReference | null
  ) => Promise<string | null>;
  onToggleReaction: (
    roomCode: string,
    message: ChatMessage,
    emoji: string
  ) => Promise<string | null>;
  onTypingChange: (isTyping: boolean) => void;
  onAddCustomSticker: (file: File) => Promise<string | null>;
  onDeleteCustomSticker: (stickerId: string) => void;
  onDeleteMessage: (roomCode: string, messageId: string) => Promise<string | null>;
  onUpdateRoomTitle: (roomCode: string, nextTitle: string) => Promise<string | null>;
  onOpenPasscodeManage: () => void;
  onOpenReportModal: (initialTargetUser?: string) => void;
  onRequestLeaveRoom: (roomCode: string) => void;
  onBackToLobby: () => void;
  onOpenSettings: () => void;
  onOpenProfile: () => void;
  onActivateCamouflage: () => void;
  onStartAudioCall: () => void;
  onStartVideoCall: () => void;
  isCallBusy?: boolean;
  pendingMiniGameInvite?: PendingMiniGameInvite | null;
  joiningMiniGameMatchId?: string | null;
  activeMiniGameMatchId?: string | null;
  miniGameNotice?: string | null;
  onDismissMiniGameNotice: () => void;
  onCancelPendingMiniGame: () => void;
  onOpenMiniGameLauncher: () => void;
  onJoinMiniGameInvite: (invite: MiniGameInvitePayload) => void;
  onRematchMiniGame: (gameId: MiniGameId) => void;
}

export const ChatRoomView = memo(function ChatRoomView({
  roomCode,
  roomTitle,
  roomPasscode,
  messages,
  onlineMembers,
  customStickers,
  loading,
  realtimeStatus,
  errorMsg,
  profile,
  onSendMessage,
  onSendSticker,
  onToggleReaction,
  onTypingChange,
  onAddCustomSticker,
  onDeleteCustomSticker,
  onDeleteMessage,
  onUpdateRoomTitle,
  onOpenPasscodeManage,
  onOpenReportModal,
  onRequestLeaveRoom,
  onBackToLobby,
  onOpenSettings,
  onOpenProfile,
  onActivateCamouflage,
  onStartAudioCall,
  onStartVideoCall,
  isCallBusy = false,
  pendingMiniGameInvite = null,
  joiningMiniGameMatchId = null,
  activeMiniGameMatchId = null,
  miniGameNotice = null,
  onDismissMiniGameNotice,
  onCancelPendingMiniGame,
  onOpenMiniGameLauncher,
  onJoinMiniGameInvite,
  onRematchMiniGame,
}: ChatRoomViewProps) {
  const [replyingTo, setReplyingTo] = useState<ReplyReference | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [showOnlinePopover, setShowOnlinePopover] = useState(false);

  // Modals inside ChatRoom (conditionally mounted only when open)
  const [deleteTarget, setDeleteTarget] = useState<ChatMessage | null>(null);
  const [deletingMsg, setDeletingMsg] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<LightboxImageData | null>(null);

  // Room title inline editing state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(roomTitle || '');
  const [savingTitle, setSavingTitle] = useState(false);

  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const presenceContainerRef = useRef<HTMLDivElement | null>(null);
  const prevRoomRef = useRef(roomCode);

  const displayTitle = getRoomDisplayTitle(roomCode, roomTitle);
  const formattedCode = formatRoomCode(roomCode);
  const isLocked = Boolean(roomPasscode && roomPasscode.trim());
  const myNickname = profile.nickname.trim() || 'ゲスト';

  const typingPeers = useMemo(
    () => onlineMembers.filter((m) => m.userId !== profile.id && Boolean(m.isTyping)),
    [onlineMembers, profile.id]
  );

  const typingIndicatorText = useMemo(() => {
    if (typingPeers.length === 0) return null;
    if (typingPeers.length === 1) {
      return `${typingPeers[0].nickname}さんが入力中...`;
    }
    return `${typingPeers[0].nickname}さん他が入力中...`;
  }, [typingPeers]);

  const myBubbleTheme = useMemo(
    () => BUBBLE_THEMES.find((b) => b.id === profile.bubbleTheme) || BUBBLE_THEMES[0],
    [profile.bubbleTheme]
  );

  const wallpaperTheme = useMemo(
    () =>
      WALLPAPER_THEMES.find((w) => w.id === profile.wallpaperTheme) || WALLPAPER_THEMES[0],
    [profile.wallpaperTheme]
  );

  // Close presence popover when clicking outside
  useEffect(() => {
    if (!showOnlinePopover) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        presenceContainerRef.current &&
        !presenceContainerRef.current.contains(e.target as Node)
      ) {
        setShowOnlinePopover(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showOnlinePopover]);

  // Reset room-scoped UI state when switching rooms
  useEffect(() => {
    if (prevRoomRef.current !== roomCode) {
      prevRoomRef.current = roomCode;
      setIsEditingTitle(false);
      setTitleDraft(roomTitle || '');
      setLocalError(null);
      setIsQrModalOpen(false);
      setShowOnlinePopover(false);
      setReplyingTo(null);
      setDeleteTarget(null);
      setLightboxImage(null);
    }
  }, [roomCode, roomTitle]);

  useEffect(() => {
    if (!isEditingTitle) {
      setTitleDraft(roomTitle || '');
    }
  }, [roomTitle, isEditingTitle]);

  useEffect(() => {
    if (isEditingTitle) {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
  }, [isEditingTitle]);

  const handleCopyRoomCode = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const temp = document.createElement('input');
      try {
        temp.value = roomCode;
        document.body.appendChild(temp);
        temp.select();
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // Clipboard copy unsupported in this browser context
      } finally {
        if (temp.parentNode) {
          temp.parentNode.removeChild(temp);
        }
      }
    }
  };

  const handleSaveTitle = async () => {
    if (savingTitle) return;
    setSavingTitle(true);
    setLocalError(null);
    const err = await onUpdateRoomTitle(roomCode, titleDraft.trim());
    setSavingTitle(false);
    if (err) {
      setLocalError(`タイトルの保存に失敗しました: ${err}`);
      return;
    }
    setIsEditingTitle(false);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      void handleSaveTitle();
    } else if (e.key === 'Escape') {
      setIsEditingTitle(false);
      setTitleDraft(roomTitle || '');
    }
  };

  const handleConfirmDeleteMessage = useCallback(
    async (msg: ChatMessage) => {
      if (deletingMsg) return;
      setDeletingMsg(true);
      setLocalError(null);
      const err = await onDeleteMessage(roomCode, msg.id);
      setDeletingMsg(false);
      if (err) {
        setLocalError(`削除エラー: ${err}`);
        return;
      }
      setDeleteTarget(null);
    },
    [deletingMsg, onDeleteMessage, roomCode]
  );

  const handleReactionFromList = useCallback(
    (msg: ChatMessage, emoji: string) => {
      void onToggleReaction(roomCode, msg, emoji).then((err) => {
        if (err) {
          setLocalError(`リアクション更新エラー: ${err}`);
        }
      });
    },
    [onToggleReaction, roomCode]
  );

  const handleClearReply = useCallback(() => {
    setReplyingTo(null);
  }, []);

  const handleOpenQrModal = useCallback(() => {
    setIsQrModalOpen(true);
  }, []);

  const handleCloseQrModal = useCallback(() => {
    setIsQrModalOpen(false);
  }, []);

  const handleCloseLightbox = useCallback(() => {
    setLightboxImage(null);
  }, []);

  const handleCancelDelete = useCallback(() => {
    setDeleteTarget(null);
  }, []);

  const combinedError = localError || errorMsg;

  return (
    <div className="h-full flex flex-col bg-[#F8FAFC] dark:bg-slate-950 overflow-hidden">
      {/* Chat Room Header */}
      <header className="shrink-0 min-h-[68px] px-3 sm:px-5 py-2 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 sm:gap-3 z-20">
        {/* Left: Back (mobile) + Room Title (editable) + 6-digit Code + Presence */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <button
            type="button"
            onClick={onBackToLobby}
            aria-label="トーク一覧へ戻る"
            className="lg:hidden min-h-[40px] min-w-[40px] -ml-1 flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="min-w-0 flex-1 space-y-1">
            {/* Row 1: Editable Talk Title + Passcode indicator */}
            {isEditingTitle ? (
              <div className="flex items-center gap-1.5 max-w-md">
                <input
                  ref={titleInputRef}
                  type="text"
                  maxLength={40}
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onKeyDown={handleTitleKeyDown}
                  placeholder={`ルーム ${formattedCode}`}
                  className="flex-1 min-w-0 h-9 px-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-emerald-500 text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/25"
                />
                <button
                  type="button"
                  onClick={() => void handleSaveTitle()}
                  disabled={savingTitle}
                  aria-label="タイトルを保存"
                  className="h-9 px-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-medium flex items-center gap-1 transition-colors shrink-0"
                >
                  {savingTitle ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  <span className="hidden sm:inline">保存</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingTitle(false);
                    setTitleDraft(roomTitle || '');
                  }}
                  aria-label="タイトル編集をキャンセル"
                  className="h-9 w-9 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-colors shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 min-w-0">
                {isLocked && (
                  <Lock
                    className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 shrink-0"
                    aria-label="合言葉ロック有効"
                  />
                )}
                <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">
                  {displayTitle}
                </h1>
                <button
                  type="button"
                  onClick={() => {
                    setTitleDraft(roomTitle || '');
                    setIsEditingTitle(true);
                  }}
                  title="トークタイトルを編集"
                  aria-label="トークタイトルを編集"
                  className="w-7 h-7 rounded-lg text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors shrink-0"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Row 2: 6-digit code + copy + QR + Online Presence + Connection status */}
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
              <div className="inline-flex items-center gap-1.5">
                <span className="font-mono tabular-nums font-semibold text-slate-700 dark:text-slate-200 tracking-wider">
                  {formattedCode}
                </span>
                <button
                  type="button"
                  onClick={handleCopyRoomCode}
                  aria-label="ルーム番号をコピー"
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                    copied
                      ? 'bg-emerald-100 dark:bg-emerald-600/20 text-emerald-700 dark:text-emerald-300'
                      : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3" />
                      <span>コピー済み</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>コピー</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleOpenQrModal}
                  title="6桁ルーム番号のQRコードを表示"
                  aria-label="QR表示"
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-50 dark:bg-emerald-500/15 hover:bg-emerald-100 dark:hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 transition-colors whitespace-nowrap shrink-0"
                >
                  <QrCode className="w-3 h-3" />
                  <span>QR表示</span>
                </button>
              </div>

              <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                ·
              </span>

              {/* Online Members Presence Trigger + Popover */}
              <div
                ref={presenceContainerRef}
                className="relative inline-flex items-center"
                onMouseEnter={() => setShowOnlinePopover(true)}
                onMouseLeave={() => setShowOnlinePopover(false)}
              >
                <button
                  type="button"
                  onClick={() => setShowOnlinePopover((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-300 hover:text-emerald-700 dark:hover:text-emerald-200 transition-colors whitespace-nowrap"
                >
                  <span
                    className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 shrink-0"
                    aria-hidden="true"
                  />
                  <span className="tabular-nums">
                    {Math.max(onlineMembers.length, 1)}人オンライン
                  </span>
                </button>

                {showOnlinePopover && (
                  <div className="absolute left-0 top-full pt-2 z-40">
                    <div className="w-60 max-w-[calc(100vw-2rem)] rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 shadow-xl dark:shadow-2xl p-3 space-y-2.5">
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-800 dark:text-slate-200 pb-1.5 border-b border-slate-100 dark:border-slate-800">
                        <span className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          オンラインメンバー
                        </span>
                        <span className="font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                          {Math.max(onlineMembers.length, 1)}
                        </span>
                      </div>

                      <div className="max-h-48 overflow-y-auto chat-scroll space-y-1.5">
                        {onlineMembers.map((member) => {
                          const isMe = member.userId === profile.id;
                          return (
                            <div
                              key={member.userId}
                              className="flex items-center gap-2.5 py-1 px-1.5 rounded-lg"
                            >
                              <Avatar
                                name={member.nickname}
                                avatarValue={member.avatar}
                                avatarColor={member.avatarColor}
                                size="xs"
                              />
                              <span className="text-xs text-slate-900 dark:text-slate-100 truncate flex-1">
                                {member.nickname}
                              </span>
                              {isMe && (
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 shrink-0">
                                  あなた
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {(realtimeStatus === 'connected' ||
                realtimeStatus === 'connecting' ||
                realtimeStatus === 'error') && (
                <>
                  <span
                    aria-hidden="true"
                    className="hidden md:inline text-slate-300 dark:text-slate-600"
                  >
                    ·
                  </span>
                  <div className="hidden md:inline-flex items-center gap-1">
                    {realtimeStatus === 'connected' && (
                      <>
                        <Wifi className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span className="text-emerald-600 dark:text-emerald-400/90 font-medium">
                          同期中
                        </span>
                      </>
                    )}
                    {realtimeStatus === 'connecting' && (
                      <>
                        <Loader2 className="w-3 h-3 text-sky-500 dark:text-sky-400 animate-spin shrink-0" />
                        <span>接続中</span>
                      </>
                    )}
                    {realtimeStatus === 'error' && (
                      <>
                        <WifiOff className="w-3 h-3 text-rose-500 dark:text-rose-400 shrink-0" />
                        <span className="text-rose-600 dark:text-rose-400">エラー</span>
                      </>
                    )}
                  </div>
                </>
              )}

              <span aria-hidden="true" className="hidden sm:inline text-slate-300 dark:text-slate-600">
                ·
              </span>

              <span
                title="ゼロ知識セキュリティ: ルーム番号・合言葉はSHA-256ハッシュ化、メッセージと引用はブラウザ内でAES-256-GCM暗号化されています"
                className="hidden sm:inline-flex items-center gap-1 text-[11px] font-medium text-sky-600 dark:text-sky-300/90 whitespace-nowrap"
              >
                <ShieldCheck className="w-3 h-3 text-sky-500 dark:text-sky-400 shrink-0" />
                <span>E2EE</span>
              </span>
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-0.5 sm:gap-1.5 shrink-0">
          {/* Voice Call Button */}
          <button
            type="button"
            onClick={onStartAudioCall}
            disabled={isCallBusy}
            title="音声通話を開始"
            aria-label="音声通話を開始"
            className="min-h-[36px] min-w-[36px] sm:min-h-[40px] sm:min-w-[40px] flex items-center justify-center rounded-xl text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/15 disabled:opacity-40 disabled:pointer-events-none transition-colors shrink-0"
          >
            <Phone className="w-4 h-4" />
          </button>

          {/* Video Call Button */}
          <button
            type="button"
            onClick={onStartVideoCall}
            disabled={isCallBusy}
            title="ビデオ通話を開始"
            aria-label="ビデオ通話を開始"
            className="min-h-[36px] min-w-[36px] sm:min-h-[40px] sm:min-w-[40px] flex items-center justify-center rounded-xl text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-500/15 disabled:opacity-40 disabled:pointer-events-none transition-colors shrink-0"
          >
            <Video className="w-4 h-4" />
          </button>

          {/* 4-Digit Passcode Lock Button */}
          <button
            type="button"
            onClick={onOpenPasscodeManage}
            title={
              isLocked
                ? '合言葉ロック設定中（クリックで変更・解除）'
                : '4桁の合言葉ロックを設定'
            }
            aria-label="ルームの合言葉ロック設定"
            className={`min-h-[36px] min-w-[36px] sm:min-h-[40px] sm:min-w-[40px] flex items-center justify-center rounded-xl transition-colors shrink-0 ${
              isLocked
                ? 'bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 hover:bg-amber-200/80 dark:hover:bg-amber-500/25'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
          </button>

          {/* Report User Button */}
          <button
            type="button"
            onClick={() => onOpenReportModal()}
            title="問題のあるユーザーを通報する"
            aria-label="通報する"
            className="min-h-[36px] min-w-[36px] sm:min-h-[40px] sm:min-w-[40px] flex items-center justify-center rounded-xl text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
          >
            <Flag className="w-4 h-4" />
          </button>

          {/* One-Tap Camouflage (Boss Key Calculator) Button */}
          <button
            type="button"
            onClick={onActivateCamouflage}
            title="電卓画面へ切り替え（緊急隠蔽）"
            aria-label="電卓画面へ切り替え"
            className="min-h-[36px] min-w-[36px] sm:min-h-[40px] sm:min-w-[40px] flex items-center justify-center rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
          >
            <Calculator className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onOpenProfile}
            aria-label="プロフィール設定"
            className="hidden sm:flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
          >
            <Avatar
              name={myNickname}
              avatarType={profile.avatarType}
              avatarValue={profile.avatarValue}
              avatarColor={profile.avatarColor}
              size="xs"
            />
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="ユーザー設定を開く"
            className="min-h-[36px] min-w-[36px] sm:min-h-[40px] sm:min-w-[40px] flex items-center justify-center rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
          >
            <Settings className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => onRequestLeaveRoom(roomCode)}
            className="min-h-[36px] sm:min-h-[40px] px-2 sm:px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 dark:bg-slate-800 dark:hover:bg-rose-950/70 hover:text-rose-600 dark:hover:text-rose-200 border border-slate-200 dark:border-slate-700/60 hover:border-rose-200 dark:hover:border-rose-800/70 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200 flex items-center gap-1 sm:gap-1.5 transition-colors whitespace-nowrap shrink-0"
          >
            <LogOut className="w-4 h-4" />
            <span>退室</span>
          </button>
        </div>
      </header>

      {/* Error banner */}
      {combinedError && (
        <div className="shrink-0 px-4 py-2.5 bg-rose-50 dark:bg-rose-950/80 border-b border-rose-200 dark:border-rose-800/70 text-xs text-rose-700 dark:text-rose-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-500 dark:text-rose-400 shrink-0" />
          <span className="truncate">{combinedError}</span>
        </div>
      )}

      {/* Pending Mini-Game Invite Waiting Strip */}
      {pendingMiniGameInvite && (
        <div className="shrink-0 px-4 py-2 bg-emerald-50 dark:bg-emerald-950/60 border-b border-emerald-200 dark:border-emerald-800/70 text-xs text-emerald-800 dark:text-emerald-200 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Gamepad2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="truncate font-semibold">
              {getMiniGameMeta(pendingMiniGameInvite.gameId).shortTitle}の対戦相手を募集中...
            </span>
          </div>
          <button
            type="button"
            onClick={onCancelPendingMiniGame}
            className="shrink-0 rounded-lg px-2 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors cursor-pointer"
          >
            募集を閉じる
          </button>
        </div>
      )}

      {/* Mini-Game Status Notice */}
      {miniGameNotice && (
        <div className="shrink-0 px-4 py-2 bg-amber-50 dark:bg-amber-950/60 border-b border-amber-200 dark:border-amber-800/70 text-xs text-amber-800 dark:text-amber-200 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Gamepad2 className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="truncate font-medium">{miniGameNotice}</span>
          </div>
          <button
            type="button"
            onClick={onDismissMiniGameNotice}
            aria-label="通知を閉じる"
            className="shrink-0 p-1 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/60 transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Memoized Message Stream Area (Never re-renders on inputText or onlineMembers typing changes) */}
      <ChatMessageList
        roomCode={roomCode}
        displayTitle={displayTitle}
        formattedCode={formattedCode}
        messages={messages}
        loading={loading}
        profileId={profile.id}
        myNickname={myNickname}
        myBubbleClass={myBubbleTheme.bubbleClass}
        wallpaperBgClass={wallpaperTheme.bgClass}
        onStartReply={setReplyingTo}
        onToggleReaction={handleReactionFromList}
        onRequestDelete={setDeleteTarget}
        onOpenReportModal={onOpenReportModal}
        onOpenLightbox={setLightboxImage}
        onOpenQrModal={handleOpenQrModal}
        onJoinMiniGameInvite={onJoinMiniGameInvite}
        onRematchMiniGame={onRematchMiniGame}
        activeMiniGameMatchId={activeMiniGameMatchId}
        joiningMiniGameMatchId={joiningMiniGameMatchId}
      />

      {/* Real-time Typing Indicator Bar (just above input footer) */}
      {typingIndicatorText && (
        <div
          aria-live="polite"
          className="shrink-0 bg-white/90 dark:bg-slate-950/90 border-t border-slate-200/80 dark:border-slate-800/70 px-4 sm:px-6 py-1.5"
        >
          <div className="max-w-3xl mx-auto flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-0.5" aria-hidden="true">
              <span
                className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-bounce"
                style={{ animationDelay: '0ms', animationDuration: '900ms' }}
              />
              <span
                className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-bounce"
                style={{ animationDelay: '150ms', animationDuration: '900ms' }}
              />
              <span
                className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-bounce"
                style={{ animationDelay: '300ms', animationDuration: '900ms' }}
              />
            </span>
            <span className="truncate font-medium text-slate-700 dark:text-slate-300">
              {typingIndicatorText}
            </span>
          </div>
        </div>
      )}

      {/* Isolated Memoized Input Composer */}
      <ChatComposer
        roomCode={roomCode}
        customStickers={customStickers}
        replyingTo={replyingTo}
        onClearReply={handleClearReply}
        onOpenMiniGameLauncher={onOpenMiniGameLauncher}
        onSendMessage={onSendMessage}
        onSendSticker={onSendSticker}
        onTypingChange={onTypingChange}
        onAddCustomSticker={onAddCustomSticker}
        onDeleteCustomSticker={onDeleteCustomSticker}
        onError={setLocalError}
      />

      {/* Delete Message Confirmation Modal (Mounted only when open) */}
      {deleteTarget && (
        <DeleteMessageModal
          message={deleteTarget}
          deleting={deletingMsg}
          onCancel={handleCancelDelete}
          onConfirm={(msg) => void handleConfirmDeleteMessage(msg)}
        />
      )}

      {/* Pure 6-digit Room QR Code Modal (Mounted only when open) */}
      {isQrModalOpen && (
        <RoomQrModal
          isOpen={isQrModalOpen}
          roomCode={roomCode}
          roomTitle={displayTitle}
          hasPasscode={isLocked}
          onClose={handleCloseQrModal}
        />
      )}

      {/* Image Lightbox Modal (Mounted only when open) */}
      {lightboxImage && (
        <ImageLightbox image={lightboxImage} onClose={handleCloseLightbox} />
      )}
    </div>
  );
});
