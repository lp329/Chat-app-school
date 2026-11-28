import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccountTransferModal } from './components/AccountTransferModal';
import { AdminPortal } from './components/AdminPortal';
import { BoomFeedView } from './components/BoomFeedView';
import { CallOverlay } from './components/CallOverlay';
import { CamouflageCalculator } from './components/CamouflageCalculator';
import { ChatRoomView } from './components/ChatRoomView';
import { CreateRoomModal } from './components/CreateRoomModal';
import { FeatureRequestModal } from './components/FeatureRequestModal';
import { JoinRoomModal } from './components/JoinRoomModal';
import { LeaveRoomModal } from './components/LeaveRoomModal';
import { MaintenanceOverlay } from './components/MaintenanceOverlay';
import { MiniGameLauncherModal } from './components/MiniGameLauncherModal';
import { MiniGameOverlay } from './components/MiniGameOverlay';
import { NotificationBanner } from './components/NotificationBanner';
import { OfficialChatView } from './components/OfficialChatView';
import { PasscodeModal } from './components/PasscodeModal';
import { ProfileEditModal } from './components/ProfileEditModal';
import { ReportModal } from './components/ReportModal';
import { Sidebar } from './components/Sidebar';
import { TalkListEmptyOrMobile } from './components/TalkListEmptyOrMobile';
import { WelcomeOnboarding } from './components/WelcomeOnboarding';
import { useMiniGameSession } from './hooks/useMiniGameSession';
import { useWebRtcCall } from './hooks/useWebRtcCall';
import {
  OFFICIAL_ROOM_ID,
  formatRoomCode,
  generateGuestName,
  getRoomDisplayTitle,
} from './lib/constants';
import {
  clearDecryptedMessageCache,
  decryptMessagePayloadCached,
  encryptReplyReference,
  encryptRoomText,
  evictDecryptedMessageCache,
  evictDecryptedMessageCacheBatch,
  hashRoomCode,
  hashRoomPasscode,
  isEncryptedPayload,
  resolveRawRoomCodeFromHash,
} from './lib/crypto';
import { getMiniGameCardPreviewText } from './lib/minigameData';
import { getStickerPreviewLabel } from './lib/stickers';
import {
  addMockBoomComment,
  appendMockMessage,
  createMockBoomPost,
  createMockFeatureRequest,
  createMockReport,
  deleteMockBoomPost,
  deleteMockMessage,
  fileToCompactDataUrl,
  getMockRoomMeta,
  hasCompletedOnboarding,
  loadCustomStickers,
  loadMockAnnouncements,
  loadMockBoomPosts,
  loadMockFeatureRequests,
  loadMockMaintenanceMode,
  loadMockMessages,
  loadMockRoomsMeta,
  loadOfficialLastReadAt,
  loadRecentRooms,
  loadSupabaseConfig,
  loadThemeMode,
  loadUserProfile,
  markOnboardingCompleted,
  saveCustomStickers,
  saveMockRoomMeta,
  saveOfficialLastReadAt,
  saveRecentRooms,
  saveThemeMode,
  saveUserProfile,
  subscribeToAllMockEvents,
  subscribeToMockPresence,
  updateMockBoomPost,
  updateMockFeatureRequest,
  updateMockMessageReactions,
  updateMockMessageReadBy,
} from './lib/storage';
import {
  createBoomPostInSupabase,
  createFeatureRequestInSupabase,
  createReportInSupabase,
  deleteBoomPostFromSupabase,
  deleteRoomMessageFromSupabase,
  fetchBoomPostsFromSupabase,
  fetchFeatureRequestsFromSupabase,
  fetchMaintenanceModeFromSupabase,
  fetchOfficialAnnouncementsFromSupabase,
  fetchRoomMessagesFromSupabase,
  fetchRoomsMetadataFromSupabase,
  fetchSingleRoomFromSupabase,
  markMessageReadInSupabase,
  normalizeReactionsMap,
  sendRoomMessageToSupabase,
  subscribeToBoomPostsRealtime,
  subscribeToFeatureRequestsRealtime,
  subscribeToGlobalMessageDeletes,
  subscribeToMaintenanceModeRealtime,
  subscribeToOfficialAnnouncementsRealtime,
  subscribeToSupabasePresence,
  subscribeToSupabaseRoom,
  updateBoomPostCommentsInSupabase,
  updateBoomPostLikesInSupabase,
  updateFeatureRequestVotesInSupabase,
  updateMessageReactionsInSupabase,
  uploadChatImageToSupabase,
  uploadStorageImageToSupabase,
  upsertRoomMetaToSupabase,
  type PresenceController,
  type RawDbMessage,
} from './lib/supabaseService';
import type {
  AccountTransferPayload,
  ActiveTab,
  BoomComment,
  BoomPost,
  ChatMessage,
  CustomSticker,
  FeatureRequest,
  OfficialAnnouncement,
  OnlineMember,
  ReactionMap,
  RealtimeStatus,
  ReplyReference,
  ReportReason,
  RoomHistoryItem,
  RoomNotification,
  RoomRecord,
  ThemeMode,
  UserProfile,
  UserReport,
} from './types/chat';

function isOwnMessage(msg: ChatMessage, profile: UserProfile): boolean {
  if (msg.sender_id && profile.id) {
    return msg.sender_id === profile.id;
  }
  return msg.sender_name === (profile.nickname.trim() || 'ゲスト');
}

function getMessagePreviewText(msg: ChatMessage): string {
  if (msg.sticker_url) return getStickerPreviewLabel(msg.sticker_url);
  if (msg.decryption_failed) return '🔒 暗号化されたメッセージ';
  const gamePreview = getMiniGameCardPreviewText(msg.content || '');
  if (gamePreview) return gamePreview;
  const trimmed = (msg.content || '').trim();
  if (trimmed && msg.image_url) return `[画像] ${trimmed}`;
  if (msg.image_url) return '画像を送信しました';
  return trimmed;
}

function sortRecentRoomsDesc(rooms: RoomHistoryItem[]): RoomHistoryItem[] {
  return [...rooms].sort(
    (a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime()
  );
}

function sortBoomPostsDesc(posts: BoomPost[]): BoomPost[] {
  return [...posts].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

function sortAnnouncementsDesc(items: OfficialAnnouncement[]): OfficialAnnouncement[] {
  return [...items].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

function isAdminPathname(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.pathname.replace(/\/+$/, '') === '/admin';
}

interface PasscodeGateState {
  roomCode: string;
  roomTitle?: string;
  expectedPasscode: string;
}

const EMPTY_MESSAGES: ChatMessage[] = [];

function pickInitialActiveRoom(rooms: RoomHistoryItem[]): string {
  const firstUnlocked = rooms.find((r) => !(r.passcode && r.passcode.trim()));
  return firstUnlocked ? firstUnlocked.roomCode : OFFICIAL_ROOM_ID;
}

export default function App() {
  const [isAdminRoute, setIsAdminRoute] = useState<boolean>(() => isAdminPathname());
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => loadThemeMode());
  const [onboardingDone, setOnboardingDone] = useState<boolean>(() =>
    hasCompletedOnboarding()
  );
  const [profile, setProfile] = useState<UserProfile>(() => loadUserProfile());
  const supabaseState = useMemo(() => loadSupabaseConfig(), []);
  const [recentRooms, setRecentRooms] = useState<RoomHistoryItem[]>(() =>
    sortRecentRoomsDesc(loadRecentRooms())
  );
  const [customStickers, setCustomStickers] = useState<CustomSticker[]>(() =>
    loadCustomStickers()
  );
  const [activeTab, setActiveTab] = useState<ActiveTab>('rooms');
  const [activeRoomCode, setActiveRoomCode] = useState<string | null>(() =>
    pickInitialActiveRoom(sortRecentRoomsDesc(loadRecentRooms()))
  );
  const [isCreateRoomOpen, setIsCreateRoomOpen] = useState(false);
  const [isJoinRoomOpen, setIsJoinRoomOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Centralized message cache, loading states, errors, statuses & Presence
  const [messagesByRoom, setMessagesByRoom] = useState<Record<string, ChatMessage[]>>({});
  const [loadingRooms, setLoadingRooms] = useState<Record<string, boolean>>({});
  const [roomErrors, setRoomErrors] = useState<Record<string, string | null>>({});
  const [roomStatuses, setRoomStatuses] = useState<Record<string, RealtimeStatus>>({});
  const [onlineMembers, setOnlineMembers] = useState<OnlineMember[]>([]);

  // BOOM Timeline state
  const [boomPosts, setBoomPosts] = useState<BoomPost[]>([]);
  const [loadingBoom, setLoadingBoom] = useState(false);
  const [boomError, setBoomError] = useState<string | null>(null);
  const [boomStatus, setBoomStatus] = useState<RealtimeStatus>('mock');

  // Official ROOMLINE Announcements & System Maintenance state
  const [officialAnnouncements, setOfficialAnnouncements] = useState<OfficialAnnouncement[]>(
    []
  );
  const [officialLastReadAt, setOfficialLastReadAt] = useState<string | null>(() =>
    loadOfficialLastReadAt()
  );
  const [isMaintenanceMode, setIsMaintenanceMode] = useState<boolean>(false);

  // Feature Requests & Voting Box state
  const [featureRequests, setFeatureRequests] = useState<FeatureRequest[]>([]);
  const [loadingFeatureRequests, setLoadingFeatureRequests] = useState(false);
  const [featureRequestsError, setFeatureRequestsError] = useState<string | null>(null);
  const [isFeatureRequestModalOpen, setIsFeatureRequestModalOpen] = useState(false);

  // Account Transfer Modal & Restore Revision state
  const [accountTransferModalState, setAccountTransferModalState] = useState<{
    open: boolean;
    tab: 'export' | 'import';
    importOnly?: boolean;
  }>({ open: false, tab: 'export' });
  const [restoreRevision, setRestoreRevision] = useState(0);

  // Modals, Passcode Gate, Report Modal, Notification Banner & Camouflage Mode
  const [notification, setNotification] = useState<RoomNotification | null>(null);
  const [leaveModalRoomCode, setLeaveModalRoomCode] = useState<string | null>(null);
  const [passcodeGate, setPasscodeGate] = useState<PasscodeGateState | null>(null);
  const [isPasscodeManageOpen, setIsPasscodeManageOpen] = useState(false);
  const [reportModalState, setReportModalState] = useState<{
    open: boolean;
    targetUser: string;
  }>({ open: false, targetUser: '' });
  const [isCamouflaged, setIsCamouflaged] = useState(false);

  // Refs for fresh state inside long-lived Realtime callbacks
  const activeRoomCodeRef = useRef<string | null>(activeRoomCode);
  const activeTabRef = useRef<ActiveTab>(activeTab);
  const profileRef = useRef<UserProfile>(profile);
  const recentRoomsRef = useRef<RoomHistoryItem[]>(recentRooms);
  const messagesByRoomRef = useRef<Record<string, ChatMessage[]>>(messagesByRoom);
  const isMaintenanceModeRef = useRef<boolean>(isMaintenanceMode);
  const isCamouflagedRef = useRef<boolean>(isCamouflaged);
  const subscriptionsRef = useRef<Map<string, () => void>>(new Map());
  const presenceControllerRef = useRef<PresenceController | null>(null);
  const fetchedRoomsRef = useRef<Set<string>>(new Set());
  const seenMessageIdsRef = useRef<Set<string>>(new Set());
  const markedReadKeysRef = useRef<Set<string>>(new Set());
  const unlockedRoomsRef = useRef<Set<string>>(new Set());
  /** In-memory plaintext 4-digit passcodes for PBKDF2/AES-GCM key derivation (never persisted) */
  const roomPasscodeSecretsRef = useRef<Map<string, string>>(new Map());
  const notificationTimerRef = useRef<number | null>(null);

  activeRoomCodeRef.current = activeRoomCode;
  activeTabRef.current = activeTab;
  profileRef.current = profile;
  recentRoomsRef.current = recentRooms;
  messagesByRoomRef.current = messagesByRoom;
  isMaintenanceModeRef.current = isMaintenanceMode;
  isCamouflagedRef.current = isCamouflaged;

  const isSupabaseConfigured = Boolean(
    supabaseState.config.url && supabaseState.config.anonKey
  );

  // Sync `/admin` pathname on browser navigation
  useEffect(() => {
    const handlePopState = () => {
      setIsAdminRoute(isAdminPathname());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleExitAdminToLobby = useCallback(() => {
    window.history.pushState({}, '', '/');
    setIsAdminRoute(false);
    setActiveRoomCode(pickInitialActiveRoom(recentRoomsRef.current));
    setActiveTab('rooms');
  }, []);

  const updateRecentRooms = useCallback(
    (updater: (prev: RoomHistoryItem[]) => RoomHistoryItem[]) => {
      setRecentRooms((prev) => {
        const next = sortRecentRoomsDesc(updater(prev));
        saveRecentRooms(next);
        return next;
      });
    },
    []
  );

  const showNotificationBanner = useCallback((next: RoomNotification) => {
    setNotification(next);
    if (notificationTimerRef.current) {
      window.clearTimeout(notificationTimerRef.current);
    }
    notificationTimerRef.current = window.setTimeout(() => {
      setNotification((curr) => (curr?.id === next.id ? null : curr));
    }, 5200);
  }, []);

  useEffect(() => {
    return () => {
      if (notificationTimerRef.current) {
        window.clearTimeout(notificationTimerRef.current);
      }
    };
  }, []);

  // --- Zero-Knowledge Message Decryption Helpers ---

  const decryptRawDbMessage = useCallback(
    async (
      raw: RawDbMessage,
      explicitRawRoomCode?: string
    ): Promise<ChatMessage | null> => {
      const rawRoomCode =
        explicitRawRoomCode || resolveRawRoomCodeFromHash(raw.room_code);
      if (!rawRoomCode) return null;

      const msgId = String(raw.id || '');
      const rawPasscode = roomPasscodeSecretsRef.current.get(rawRoomCode) || null;
      const rawContentStr = typeof raw.content === 'string' ? raw.content : '';
      const rawReplyStr = typeof raw.reply_to === 'string' ? raw.reply_to : null;

      const decrypted = await decryptMessagePayloadCached({
        messageId: msgId,
        rawContent: rawContentStr,
        rawReplyTo: raw.reply_to,
        rawRoomCode,
        rawPasscode,
      });

      return {
        id: msgId,
        room_code: rawRoomCode,
        sender_name: String(raw.sender_name || 'ゲスト'),
        content: decrypted.content,
        created_at: String(raw.created_at || new Date().toISOString()),
        sender_id: raw.sender_id ?? null,
        sender_avatar: raw.sender_avatar ?? null,
        sender_color: raw.sender_color ?? null,
        read_by: Array.isArray(raw.read_by) ? raw.read_by : [],
        image_url: raw.image_url ?? null,
        sticker_url: raw.sticker_url ?? null,
        reply_to: decrypted.replyTo,
        reactions: normalizeReactionsMap(raw.reactions),
        encrypted_content: isEncryptedPayload(rawContentStr) ? rawContentStr : null,
        encrypted_reply_to:
          rawReplyStr && isEncryptedPayload(rawReplyStr) ? rawReplyStr : null,
        decryption_failed: !decrypted.contentOk,
      };
    },
    []
  );

  const redecryptCachedRoomMessages = useCallback(
    async (rawRoomCode: string) => {
      const cached = messagesByRoomRef.current[rawRoomCode];
      if (!cached || cached.length === 0) return;

      const rawPasscode = roomPasscodeSecretsRef.current.get(rawRoomCode) || null;
      const redecrypted = await Promise.all(
        cached.map(async (msg) => {
          if (!msg.encrypted_content && !msg.encrypted_reply_to) return msg;
          // Skip messages that were already successfully decrypted (cache hit / no re-decrypt)
          if (
            !msg.decryption_failed &&
            (!msg.reply_to ||
              msg.reply_to.content !== '🔒 合言葉を入力すると引用内容が表示されます')
          ) {
            return msg;
          }

          const decrypted = await decryptMessagePayloadCached({
            messageId: msg.id,
            rawContent: msg.encrypted_content ?? msg.content,
            rawReplyTo: msg.encrypted_reply_to ?? msg.reply_to,
            rawRoomCode,
            rawPasscode,
          });

          return {
            ...msg,
            content: decrypted.content,
            reply_to: decrypted.replyTo,
            decryption_failed: !decrypted.contentOk,
          };
        })
      );

      setMessagesByRoom((prev) => ({ ...prev, [rawRoomCode]: redecrypted }));

      const latest = redecrypted[redecrypted.length - 1];
      if (latest) {
        updateRecentRooms((prev) =>
          prev.map((r) =>
            r.roomCode === rawRoomCode
              ? {
                  ...r,
                  lastMessage: getMessagePreviewText(latest),
                  lastSender: latest.sender_name,
                  lastAt: latest.created_at,
                }
              : r
          )
        );
      }
    },
    [updateRecentRooms]
  );

  // --- Chat Room Realtime Handlers ---

  const handleIncomingMessage = useCallback(
    (incoming: ChatMessage) => {
      const code = incoming.room_code;
      if (!code || !incoming.id) return;

      const isTracked =
        activeRoomCodeRef.current === code ||
        recentRoomsRef.current.some((r) => r.roomCode === code);
      if (!isTracked) return;

      if (seenMessageIdsRef.current.has(incoming.id)) {
        return;
      }
      seenMessageIdsRef.current.add(incoming.id);

      setMessagesByRoom((prev) => {
        const existing = prev[code] || [];
        if (existing.some((m) => m.id === incoming.id)) {
          return prev;
        }
        const nextList = [...existing, incoming].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        return { ...prev, [code]: nextList };
      });

      const isCurrentlyViewingRoom =
        activeTabRef.current === 'rooms' && activeRoomCodeRef.current === code;
      const fromSelf = isOwnMessage(incoming, profileRef.current);
      const shouldNotify = !isCurrentlyViewingRoom && !fromSelf;
      const previewText = getMessagePreviewText(incoming);

      const existingRoomMeta = recentRoomsRef.current.find((r) => r.roomCode === code);

      updateRecentRooms((prev) => {
        const found = prev.find((r) => r.roomCode === code);
        const nextUnread = found
          ? shouldNotify
            ? (found.unreadCount || 0) + 1
            : isCurrentlyViewingRoom
              ? 0
              : found.unreadCount || 0
          : shouldNotify
            ? 1
            : 0;

        const updatedItem: RoomHistoryItem = {
          roomCode: code,
          title: found?.title || '',
          passcode: found?.passcode ?? null,
          lastMessage: previewText,
          lastSender: incoming.sender_name,
          lastAt: incoming.created_at,
          unreadCount: nextUnread,
        };

        return [updatedItem, ...prev.filter((r) => r.roomCode !== code)];
      });

      if (shouldNotify) {
        const titleLabel =
          existingRoomMeta?.title?.trim() || formatRoomCode(code);
        showNotificationBanner({
          id: incoming.id,
          roomCode: code,
          roomTitle: titleLabel,
          senderName: incoming.sender_name,
          content: previewText,
          createdAt: incoming.created_at,
        });
      }
    },
    [showNotificationBanner, updateRecentRooms]
  );

  const handleIncomingMessageUpdate = useCallback((updated: ChatMessage) => {
    const code = updated.room_code;
    if (!code || !updated.id) return;

    setMessagesByRoom((prev) => {
      const list = prev[code];
      if (!list) return prev;
      const idx = list.findIndex((m) => m.id === updated.id);
      if (idx === -1) return prev;
      const existing = list[idx];
      const nextList = [...list];
      // Preserve decrypted content/reply if the incoming update somehow couldn't decrypt
      nextList[idx] = {
        ...existing,
        ...updated,
        content:
          updated.decryption_failed && !existing.decryption_failed
            ? existing.content
            : updated.content,
        reply_to:
          updated.decryption_failed && !existing.decryption_failed
            ? existing.reply_to
            : updated.reply_to,
        decryption_failed:
          updated.decryption_failed && !existing.decryption_failed
            ? false
            : updated.decryption_failed,
      };
      return { ...prev, [code]: nextList };
    });
  }, []);

  const handleIncomingMessageDelete = useCallback(
    (messageId: string, hintedRoomCode?: string) => {
      if (!messageId) return;
      seenMessageIdsRef.current.delete(messageId);
      evictDecryptedMessageCache(messageId);

      const resolvedHint = resolveRawRoomCodeFromHash(hintedRoomCode) || hintedRoomCode;

      setMessagesByRoom((prev) => {
        let targetRoom = resolvedHint;
        if (!targetRoom || !prev[targetRoom]) {
          targetRoom = Object.keys(prev).find((code) =>
            prev[code].some((m) => m.id === messageId)
          );
        }
        if (!targetRoom) return prev;

        const existing = prev[targetRoom] || [];
        if (!existing.some((m) => m.id === messageId)) return prev;

        const nextList = existing.filter((m) => m.id !== messageId);
        const latest = nextList[nextList.length - 1];

        const codeForUpdate = targetRoom;
        updateRecentRooms((rooms) =>
          rooms.map((r) => {
            if (r.roomCode !== codeForUpdate) return r;
            return {
              ...r,
              lastMessage: latest ? getMessagePreviewText(latest) : 'メッセージはありません',
              lastSender: latest ? latest.sender_name : '',
              lastAt: latest ? latest.created_at : r.lastAt,
            };
          })
        );

        return { ...prev, [targetRoom]: nextList };
      });
    },
    [updateRecentRooms]
  );

  const handleIncomingRoomUpdate = useCallback(
    (room: RoomRecord) => {
      const code = resolveRawRoomCodeFromHash(room.room_code) || room.room_code;
      if (!code || code.length !== 6) return;
      const cleanTitle = (room.title || '').trim();
      const nextPasscode =
        room.passcode !== undefined ? room.passcode : undefined;

      updateRecentRooms((prev) => {
        if (!prev.some((r) => r.roomCode === code)) return prev;
        return prev.map((r) =>
          r.roomCode === code
            ? {
                ...r,
                title: cleanTitle,
                passcode: nextPasscode !== undefined ? nextPasscode : r.passcode,
              }
            : r
        );
      });
    },
    [updateRecentRooms]
  );

  // --- BOOM Feed Realtime Handlers ---

  const handleBoomInsert = useCallback((post: BoomPost) => {
    setBoomPosts((prev) => {
      if (prev.some((p) => p.id === post.id)) return prev;
      return sortBoomPostsDesc([post, ...prev]);
    });
  }, []);

  const handleBoomUpdate = useCallback((post: BoomPost) => {
    setBoomPosts((prev) => {
      const exists = prev.some((p) => p.id === post.id);
      if (!exists) return sortBoomPostsDesc([post, ...prev]);
      return prev.map((p) => (p.id === post.id ? post : p));
    });
  }, []);

  const handleBoomDelete = useCallback((postId: string) => {
    setBoomPosts((prev) => prev.filter((p) => p.id !== postId));
  }, []);

  // --- Feature Requests Realtime Handlers ---

  const handleFeatureRequestInsert = useCallback((item: FeatureRequest) => {
    setFeatureRequests((prev) => {
      if (prev.some((r) => r.id === item.id)) return prev;
      return [item, ...prev];
    });
  }, []);

  const handleFeatureRequestUpdate = useCallback((item: FeatureRequest) => {
    setFeatureRequests((prev) => {
      if (!prev.some((r) => r.id === item.id)) return [item, ...prev];
      return prev.map((r) => (r.id === item.id ? item : r));
    });
  }, []);

  const handleFeatureRequestDelete = useCallback((requestId: string) => {
    setFeatureRequests((prev) => prev.filter((r) => r.id !== requestId));
  }, []);

  // --- Official ROOMLINE Announcements & Maintenance Mode Realtime Handlers ---

  const markOfficialAsRead = useCallback((referenceIso?: string) => {
    const nowMs = Date.now();
    const refMs = referenceIso ? new Date(referenceIso).getTime() : 0;
    const nextIso = new Date(Math.max(nowMs, Number.isNaN(refMs) ? 0 : refMs)).toISOString();
    setOfficialLastReadAt(nextIso);
    saveOfficialLastReadAt(nextIso);
  }, []);

  const handleIncomingOfficialAnnouncement = useCallback(
    (item: OfficialAnnouncement) => {
      setOfficialAnnouncements((prev) => {
        if (prev.some((a) => a.id === item.id)) return prev;
        return sortAnnouncementsDesc([item, ...prev]);
      });

      const isViewingOfficial =
        activeTabRef.current === 'rooms' &&
        activeRoomCodeRef.current === OFFICIAL_ROOM_ID &&
        !isCamouflagedRef.current;

      if (isViewingOfficial) {
        markOfficialAsRead(item.created_at);
        return;
      }

      // Visual notification banner only (strictly no notification sounds)
      showNotificationBanner({
        id: `official_${item.id}`,
        roomCode: OFFICIAL_ROOM_ID,
        roomTitle: 'ROOMLINE公式',
        senderName: item.is_important ? '【重要】ROOMLINE公式' : 'ROOMLINE公式',
        content: item.title,
        createdAt: item.created_at,
        isOfficial: true,
      });
    },
    [markOfficialAsRead, showNotificationBanner]
  );

  const handleDeleteOfficialAnnouncement = useCallback((announcementId: string) => {
    setOfficialAnnouncements((prev) => prev.filter((a) => a.id !== announcementId));
  }, []);

  // Load & subscribe to Official Announcements + Maintenance Mode (General Users only)
  useEffect(() => {
    if (isAdminRoute) return;
    let active = true;

    if (!isSupabaseConfigured) {
      setOfficialAnnouncements(loadMockAnnouncements());
      setIsMaintenanceMode(loadMockMaintenanceMode());
      return;
    }

    void fetchOfficialAnnouncementsFromSupabase(supabaseState.config).then(({ data }) => {
      if (!active) return;
      setOfficialAnnouncements(sortAnnouncementsDesc(data));
    });

    void fetchMaintenanceModeFromSupabase(supabaseState.config).then(({ enabled }) => {
      if (!active) return;
      setIsMaintenanceMode(enabled);
    });

    const unsubAnn = subscribeToOfficialAnnouncementsRealtime(supabaseState.config, {
      onInsert: (item) => {
        if (active) handleIncomingOfficialAnnouncement(item);
      },
      onDelete: (id) => {
        if (active) handleDeleteOfficialAnnouncement(id);
      },
    });

    const unsubMaint = subscribeToMaintenanceModeRealtime(
      supabaseState.config,
      (enabled) => {
        if (active) setIsMaintenanceMode(enabled);
      }
    );

    return () => {
      active = false;
      unsubAnn();
      unsubMaint();
    };
  }, [
    isAdminRoute,
    isSupabaseConfigured,
    supabaseState.config,
    handleIncomingOfficialAnnouncement,
    handleDeleteOfficialAnnouncement,
  ]);

  // Keep ROOMLINE公式 marked as read while actively open
  useEffect(() => {
    if (
      onboardingDone &&
      !isAdminRoute &&
      activeTab === 'rooms' &&
      activeRoomCode === OFFICIAL_ROOM_ID &&
      !isCamouflaged &&
      officialAnnouncements.length > 0
    ) {
      markOfficialAsRead(officialAnnouncements[0].created_at);
    }
  }, [
    onboardingDone,
    isAdminRoute,
    activeTab,
    activeRoomCode,
    isCamouflaged,
    officialAnnouncements,
    markOfficialAsRead,
  ]);

  const latestOfficialAnnouncement = officialAnnouncements[0] || null;
  const officialUnreadCount = useMemo(() => {
    if (officialAnnouncements.length === 0) return 0;
    if (!officialLastReadAt) return officialAnnouncements.length;
    const lastReadMs = new Date(officialLastReadAt).getTime();
    if (Number.isNaN(lastReadMs)) return officialAnnouncements.length;
    return officialAnnouncements.filter(
      (a) => new Date(a.created_at).getTime() > lastReadMs
    ).length;
  }, [officialAnnouncements, officialLastReadAt]);

  // Load & subscribe BOOM timeline posts (Supabase Realtime or Local Mock)
  useEffect(() => {
    if (isAdminRoute) return;
    let active = true;
    setBoomError(null);

    if (!isSupabaseConfigured) {
      setBoomStatus('mock');
      setLoadingBoom(false);
      setBoomPosts(loadMockBoomPosts());
      return;
    }

    setLoadingBoom(true);
    setBoomStatus('connecting');

    void fetchBoomPostsFromSupabase(supabaseState.config).then(({ data, error }) => {
      if (!active) return;
      setLoadingBoom(false);
      if (error) {
        setBoomError(`BOOMフィード取得エラー: ${error}`);
      } else {
        setBoomPosts(sortBoomPostsDesc(data));
      }
    });

    const unsub = subscribeToBoomPostsRealtime(supabaseState.config, {
      onInsert: (post) => {
        if (active) handleBoomInsert(post);
      },
      onUpdate: (post) => {
        if (active) handleBoomUpdate(post);
      },
      onDelete: (postId) => {
        if (active) handleBoomDelete(postId);
      },
      onStatusChange: (status) => {
        if (active) setBoomStatus(status);
      },
    });

    return () => {
      active = false;
      unsub();
    };
  }, [
    isAdminRoute,
    isSupabaseConfigured,
    supabaseState.config,
    handleBoomInsert,
    handleBoomUpdate,
    handleBoomDelete,
  ]);

  // Load & subscribe Feature Requests (Supabase Realtime or Local Mock)
  useEffect(() => {
    if (isAdminRoute) return;
    let active = true;
    setFeatureRequestsError(null);

    if (!isSupabaseConfigured) {
      setLoadingFeatureRequests(false);
      setFeatureRequests(loadMockFeatureRequests());
      return;
    }

    setLoadingFeatureRequests(true);
    void fetchFeatureRequestsFromSupabase(supabaseState.config).then(
      ({ data, error }) => {
        if (!active) return;
        setLoadingFeatureRequests(false);
        if (error) {
          setFeatureRequestsError(`改善要望の取得に失敗しました: ${error}`);
        } else {
          setFeatureRequests(data);
        }
      }
    );

    const unsub = subscribeToFeatureRequestsRealtime(supabaseState.config, {
      onInsert: (item) => {
        if (active) handleFeatureRequestInsert(item);
      },
      onUpdate: (item) => {
        if (active) handleFeatureRequestUpdate(item);
      },
      onDelete: (requestId) => {
        if (active) handleFeatureRequestDelete(requestId);
      },
    });

    return () => {
      active = false;
      unsub();
    };
  }, [
    isAdminRoute,
    isSupabaseConfigured,
    supabaseState.config,
    handleFeatureRequestInsert,
    handleFeatureRequestUpdate,
    handleFeatureRequestDelete,
  ]);

  // --- Tracked Chat Rooms Hydration & Subscriptions (Hashed Room IDs + E2EE Decryption) ---

  const trackedRoomCodes = useMemo(() => {
    if (isAdminRoute) return [];
    const set = new Set<string>();
    recentRooms.forEach((r) => {
      if (r.roomCode && r.roomCode !== OFFICIAL_ROOM_ID) {
        set.add(r.roomCode);
      }
    });
    if (activeRoomCode && activeRoomCode !== OFFICIAL_ROOM_ID) {
      set.add(activeRoomCode);
    }
    return Array.from(set).sort();
  }, [isAdminRoute, recentRooms, activeRoomCode]);

  const trackedKey = trackedRoomCodes.join(',');

  useEffect(() => {
    subscriptionsRef.current.forEach((unsub) => unsub());
    subscriptionsRef.current.clear();
    fetchedRoomsRef.current.clear();
    seenMessageIdsRef.current.clear();
    markedReadKeysRef.current.clear();
    clearDecryptedMessageCache();
    setMessagesByRoom({});
    setLoadingRooms({});
    setRoomErrors({});
    setRoomStatuses({});
  }, [
    isSupabaseConfigured,
    supabaseState.config.url,
    supabaseState.config.anonKey,
    restoreRevision,
  ]);

  useEffect(() => {
    if (isAdminRoute) return;
    let cancelled = false;
    const codes = trackedKey ? trackedKey.split(',') : [];
    const codeSet = new Set(codes);

    subscriptionsRef.current.forEach((unsub, code) => {
      if (!codeSet.has(code)) {
        unsub();
        subscriptionsRef.current.delete(code);
        fetchedRoomsRef.current.delete(code);
      }
    });

    if (codes.length === 0) return;

    const newCodes = codes.filter((code) => !fetchedRoomsRef.current.has(code));
    if (newCodes.length === 0) return;

    if (!isSupabaseConfigured) {
      const mockMeta = loadMockRoomsMeta();
      newCodes.forEach((code) => {
        fetchedRoomsRef.current.add(code);
        void hashRoomCode(code); // Register hash mapping
        const rawList = loadMockMessages(code).slice(-50);
        void Promise.all(
          rawList.map((m) =>
            decryptRawDbMessage(m as unknown as RawDbMessage, code)
          )
        ).then((decryptedResults) => {
          if (cancelled) return;
          const list = decryptedResults.filter((m): m is ChatMessage => Boolean(m));
          list.forEach((m) => seenMessageIdsRef.current.add(m.id));
          setMessagesByRoom((prev) => ({ ...prev, [code]: list }));
          setRoomStatuses((prev) => ({ ...prev, [code]: 'mock' }));
          setLoadingRooms((prev) => ({ ...prev, [code]: false }));
          setRoomErrors((prev) => ({ ...prev, [code]: null }));

          const latest = list[list.length - 1];
          const savedMeta = mockMeta[code];
          if (latest || savedMeta) {
            updateRecentRooms((prev) =>
              prev.map((r) => {
                if (r.roomCode !== code) return r;
                return {
                  ...r,
                  title: savedMeta ? savedMeta.title : r.title,
                  passcode: savedMeta ? savedMeta.passcode ?? null : r.passcode ?? null,
                  lastMessage: latest ? getMessagePreviewText(latest) : r.lastMessage,
                  lastSender: latest ? latest.sender_name : r.lastSender,
                  lastAt: latest ? latest.created_at : r.lastAt,
                };
              })
            );
          }
        });
      });
      return () => {
        cancelled = true;
      };
    }

    // Supabase mode: hash every 6-digit room code with SHA-256 before any DB query or Realtime subscription
    newCodes.forEach((code) => {
      fetchedRoomsRef.current.add(code);
      setLoadingRooms((prev) => ({ ...prev, [code]: true }));
      setRoomErrors((prev) => ({ ...prev, [code]: null }));
    });

    void (async () => {
      const hashedPairs = await Promise.all(
        newCodes.map(async (code) => ({
          rawCode: code,
          hashedCode: await hashRoomCode(code),
        }))
      );
      if (cancelled) return;

      const hashedIds = hashedPairs.map((p) => p.hashedCode);
      void fetchRoomsMetadataFromSupabase(supabaseState.config, hashedIds).then(
        ({ data }) => {
          if (cancelled || !data || data.length === 0) return;
          const mapByRaw = new Map<string, RoomRecord>();
          data.forEach((rec) => {
            const raw = resolveRawRoomCodeFromHash(rec.room_code);
            if (raw) mapByRaw.set(raw, rec);
          });
          updateRecentRooms((prev) =>
            prev.map((item) => {
              const rec = mapByRaw.get(item.roomCode);
              if (!rec) return item;
              return {
                ...item,
                title: (rec.title || '').trim(),
                passcode: rec.passcode ?? null,
              };
            })
          );
        }
      );

      hashedPairs.forEach(({ rawCode, hashedCode }) => {
        void fetchRoomMessagesFromSupabase(supabaseState.config, hashedCode).then(
          async ({ data, error }) => {
            if (cancelled) return;
            setLoadingRooms((prev) => ({ ...prev, [rawCode]: false }));
            if (error) {
              setRoomErrors((prev) => ({
                ...prev,
                [rawCode]: `過去メッセージの取得に失敗しました: ${error}`,
              }));
              return;
            }

            const decryptedList = (
              await Promise.all(
                data.map((row) => decryptRawDbMessage(row, rawCode))
              )
            ).filter((m): m is ChatMessage => Boolean(m));

            if (cancelled) return;

            decryptedList.forEach((m) => seenMessageIdsRef.current.add(m.id));

            setMessagesByRoom((prev) => {
              const existing = prev[rawCode] || [];
              const mergedMap = new Map<string, ChatMessage>();
              decryptedList.forEach((m) => mergedMap.set(m.id, m));
              existing.forEach((m) => mergedMap.set(m.id, m));
              const sorted = Array.from(mergedMap.values()).sort(
                (a, b) =>
                  new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
              );
              return { ...prev, [rawCode]: sorted };
            });

            if (decryptedList.length > 0) {
              const latest = decryptedList[decryptedList.length - 1];
              updateRecentRooms((prev) =>
                prev.map((r) =>
                  r.roomCode === rawCode
                    ? {
                        ...r,
                        lastMessage: getMessagePreviewText(latest),
                        lastSender: latest.sender_name,
                        lastAt: latest.created_at,
                      }
                    : r
                )
              );
            }
          }
        );

        if (!subscriptionsRef.current.has(rawCode)) {
          const unsub = subscribeToSupabaseRoom(supabaseState.config, hashedCode, {
            onMessageInsert: (rawRow) => {
              void decryptRawDbMessage(rawRow, rawCode).then((msg) => {
                if (msg) handleIncomingMessage(msg);
              });
            },
            onMessageUpdate: (rawRow) => {
              void decryptRawDbMessage(rawRow, rawCode).then((msg) => {
                if (msg) handleIncomingMessageUpdate(msg);
              });
            },
            onMessageDelete: (messageId, hashedRoom) => {
              handleIncomingMessageDelete(
                messageId,
                resolveRawRoomCodeFromHash(hashedRoom) || rawCode
              );
            },
            onRoomUpdate: (room) => {
              handleIncomingRoomUpdate({ ...room, room_code: rawCode });
            },
            onStatusChange: (status) => {
              setRoomStatuses((prev) => ({ ...prev, [rawCode]: status }));
            },
          });
          subscriptionsRef.current.set(rawCode, unsub);
        }
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [
    isAdminRoute,
    trackedKey,
    restoreRevision,
    isSupabaseConfigured,
    supabaseState.config,
    decryptRawDbMessage,
    handleIncomingMessage,
    handleIncomingMessageUpdate,
    handleIncomingMessageDelete,
    handleIncomingRoomUpdate,
    updateRecentRooms,
  ]);

  useEffect(() => {
    if (isAdminRoute || !isSupabaseConfigured) return;
    const unsub = subscribeToGlobalMessageDeletes(
      supabaseState.config,
      handleIncomingMessageDelete
    );
    return unsub;
  }, [isAdminRoute, isSupabaseConfigured, supabaseState.config, handleIncomingMessageDelete]);

  useEffect(() => {
    if (isAdminRoute || isSupabaseConfigured) return;
    const unsub = subscribeToAllMockEvents({
      onMessageInsert: (rawMsg) => {
        void decryptRawDbMessage(rawMsg as unknown as RawDbMessage, rawMsg.room_code).then(
          (dec) => {
            if (dec) handleIncomingMessage(dec);
          }
        );
      },
      onMessageUpdate: (rawMsg) => {
        void decryptRawDbMessage(rawMsg as unknown as RawDbMessage, rawMsg.room_code).then(
          (dec) => {
            if (dec) handleIncomingMessageUpdate(dec);
          }
        );
      },
      onMessageDelete: handleIncomingMessageDelete,
      onRoomUpdate: handleIncomingRoomUpdate,
      onBoomInsert: handleBoomInsert,
      onBoomUpdate: handleBoomUpdate,
      onBoomDelete: handleBoomDelete,
      onAnnouncementInsert: handleIncomingOfficialAnnouncement,
      onAnnouncementDelete: handleDeleteOfficialAnnouncement,
      onFeatureRequestInsert: handleFeatureRequestInsert,
      onFeatureRequestUpdate: handleFeatureRequestUpdate,
      onFeatureRequestDelete: handleFeatureRequestDelete,
      onMaintenanceUpdate: setIsMaintenanceMode,
    });
    return unsub;
  }, [
    isAdminRoute,
    isSupabaseConfigured,
    decryptRawDbMessage,
    handleIncomingMessage,
    handleIncomingMessageUpdate,
    handleIncomingMessageDelete,
    handleIncomingRoomUpdate,
    handleBoomInsert,
    handleBoomUpdate,
    handleBoomDelete,
    handleIncomingOfficialAnnouncement,
    handleDeleteOfficialAnnouncement,
    handleFeatureRequestInsert,
    handleFeatureRequestUpdate,
    handleFeatureRequestDelete,
  ]);

  // Active Room Presence (Uses SHA-256 Hashed Room ID + supports isTyping)
  useEffect(() => {
    if (isAdminRoute || !activeRoomCode || activeRoomCode === OFFICIAL_ROOM_ID) {
      presenceControllerRef.current?.unsubscribe();
      presenceControllerRef.current = null;
      setOnlineMembers([]);
      return;
    }

    let cancelled = false;
    const selfMember: OnlineMember = {
      userId: profile.id,
      nickname: profile.nickname.trim() || 'ゲスト',
      avatar:
        profile.avatarType === 'preset' || profile.avatarType === 'custom'
          ? profile.avatarValue
          : null,
      avatarColor: profile.avatarColor,
      joinedAt: new Date().toISOString(),
      isTyping: false,
    };

    void hashRoomCode(activeRoomCode).then((hashedRoomId) => {
      if (cancelled) return;
      const controller = !isSupabaseConfigured
        ? subscribeToMockPresence(hashedRoomId, selfMember, setOnlineMembers)
        : subscribeToSupabasePresence(
            supabaseState.config,
            hashedRoomId,
            selfMember,
            setOnlineMembers
          );
      presenceControllerRef.current = controller;
    });

    return () => {
      cancelled = true;
      presenceControllerRef.current?.unsubscribe();
      presenceControllerRef.current = null;
    };
  }, [
    isAdminRoute,
    activeRoomCode,
    isSupabaseConfigured,
    supabaseState.config,
    profile.id,
    profile.nickname,
    profile.avatarType,
    profile.avatarValue,
    profile.avatarColor,
  ]);

  const handleTypingChange = useCallback((isTyping: boolean) => {
    presenceControllerRef.current?.updateTyping(isTyping);
  }, []);

  // Stop typing state when camouflaging screen
  useEffect(() => {
    if (isCamouflaged) {
      presenceControllerRef.current?.updateTyping(false);
    }
  }, [isCamouflaged]);

  // Automatic Read Receipt (`read_by`) marking
  const activeMessages = useMemo(
    () =>
      activeRoomCode && activeRoomCode !== OFFICIAL_ROOM_ID
        ? messagesByRoom[activeRoomCode] || EMPTY_MESSAGES
        : EMPTY_MESSAGES,
    [activeRoomCode, messagesByRoom]
  );

  useEffect(() => {
    if (
      isAdminRoute ||
      !activeRoomCode ||
      activeRoomCode === OFFICIAL_ROOM_ID ||
      activeTab !== 'rooms' ||
      isCamouflaged
    ) {
      return;
    }
    const readerName = profile.nickname.trim() || 'ゲスト';

    activeMessages.forEach((msg) => {
      if (isOwnMessage(msg, profile)) return;
      const currentReadBy = Array.isArray(msg.read_by) ? msg.read_by : [];
      if (currentReadBy.includes(readerName)) return;

      const dedupeKey = `${msg.id}::${readerName}`;
      if (markedReadKeysRef.current.has(dedupeKey)) return;
      markedReadKeysRef.current.add(dedupeKey);

      if (!isSupabaseConfigured) {
        const updated = updateMockMessageReadBy(activeRoomCode, msg.id, readerName);
        if (updated) {
          void decryptRawDbMessage(
            updated as unknown as RawDbMessage,
            activeRoomCode
          ).then((dec) => {
            if (dec) handleIncomingMessageUpdate(dec);
          });
        }
        return;
      }

      void markMessageReadInSupabase(
        supabaseState.config,
        msg.id,
        currentReadBy,
        readerName
      ).then(({ data }) => {
        if (data) {
          void decryptRawDbMessage(data, activeRoomCode).then((dec) => {
            if (dec) handleIncomingMessageUpdate(dec);
          });
        }
      });
    });
  }, [
    isAdminRoute,
    activeRoomCode,
    activeTab,
    activeMessages,
    isCamouflaged,
    profile,
    isSupabaseConfigured,
    supabaseState.config,
    decryptRawDbMessage,
    handleIncomingMessageUpdate,
  ]);

  useEffect(() => {
    return () => {
      subscriptionsRef.current.forEach((unsub) => unsub());
      subscriptionsRef.current.clear();
      presenceControllerRef.current?.unsubscribe();
      presenceControllerRef.current = null;
    };
  }, []);

  // --- Profile, Onboarding & Room Actions ---

  const handleCompleteOnboarding = useCallback((nextProfile: UserProfile) => {
    setProfile(nextProfile);
    saveUserProfile(nextProfile);
    markOnboardingCompleted();
    setOnboardingDone(true);
    setActiveTab('rooms');
    setActiveRoomCode((curr) => curr || pickInitialActiveRoom(recentRoomsRef.current));
  }, []);

  const handleUpdateProfile = useCallback((next: UserProfile) => {
    setProfile(next);
    saveUserProfile(next);
  }, []);

  const commitEnterRoom = useCallback(
    (roomCode: string, initialMeta?: { title?: string; passcode?: string | null }) => {
      const cleanCode = roomCode.replace(/\D/g, '').slice(0, 6);
      if (cleanCode.length !== 6) return;

      if (!profileRef.current.nickname.trim()) {
        const autoName = generateGuestName();
        const updated = { ...profileRef.current, nickname: autoName };
        setProfile(updated);
        saveUserProfile(updated);
      }

      unlockedRoomsRef.current.add(cleanCode);
      setActiveRoomCode(cleanCode);
      setActiveTab('rooms');
      setNotification((curr) => (curr?.roomCode === cleanCode ? null : curr));

      updateRecentRooms((prev) => {
        const existing = prev.find((r) => r.roomCode === cleanCode);
        if (existing) {
          return prev.map((r) =>
            r.roomCode === cleanCode
              ? {
                  ...r,
                  title:
                    initialMeta?.title !== undefined ? initialMeta.title : r.title,
                  passcode:
                    initialMeta?.passcode !== undefined
                      ? initialMeta.passcode
                      : r.passcode,
                  unreadCount: 0,
                }
              : r
          );
        }
        return [
          {
            roomCode: cleanCode,
            title: initialMeta?.title || '',
            passcode: initialMeta?.passcode ?? null,
            lastMessage: 'ルームに入室しました',
            lastSender: '',
            lastAt: new Date().toISOString(),
            unreadCount: 0,
          },
          ...prev,
        ];
      });
    },
    [updateRecentRooms]
  );

  const handleCreateRoom = useCallback(
    async (roomCode: string, optionalPasscode: string | null) => {
      const cleanCode = roomCode.replace(/\D/g, '').slice(0, 6);
      if (cleanCode.length !== 6) return;

      const hashedRoomId = await hashRoomCode(cleanCode);
      let passcodeHash: string | null = null;

      if (optionalPasscode) {
        const cleanPass = optionalPasscode.replace(/\D/g, '').slice(0, 4);
        if (cleanPass.length === 4) {
          roomPasscodeSecretsRef.current.set(cleanCode, cleanPass);
          passcodeHash = await hashRoomPasscode(cleanCode, cleanPass);

          if (!isSupabaseConfigured) {
            saveMockRoomMeta(cleanCode, { passcode: passcodeHash });
          } else {
            await upsertRoomMetaToSupabase(supabaseState.config, hashedRoomId, {
              passcode: passcodeHash,
            });
          }
        }
      }

      commitEnterRoom(cleanCode, { passcode: passcodeHash });
    },
    [commitEnterRoom, isSupabaseConfigured, supabaseState.config]
  );

  const handleRequestEnterRoom = useCallback(
    async (roomCode: string) => {
      const cleanCode = roomCode.replace(/\D/g, '').slice(0, 6);
      if (cleanCode.length !== 6) return;

      if (unlockedRoomsRef.current.has(cleanCode)) {
        commitEnterRoom(cleanCode);
        return;
      }

      let remoteMeta: RoomRecord | null = null;

      if (!isSupabaseConfigured) {
        remoteMeta = getMockRoomMeta(cleanCode);
      } else {
        const hashedRoomId = await hashRoomCode(cleanCode);
        const { data } = await fetchSingleRoomFromSupabase(
          supabaseState.config,
          hashedRoomId
        );
        remoteMeta = data;
      }

      const expectedPasscode = (remoteMeta?.passcode || '').trim();
      if (expectedPasscode) {
        setPasscodeGate({
          roomCode: cleanCode,
          roomTitle: remoteMeta?.title || '',
          expectedPasscode,
        });
        return;
      }

      commitEnterRoom(cleanCode, {
        title: remoteMeta?.title,
        passcode: null,
      });
    },
    [commitEnterRoom, isSupabaseConfigured, supabaseState.config]
  );

  const handleConfirmLeaveRoom = useCallback(
    (roomCode: string) => {
      setLeaveModalRoomCode(null);
      unlockedRoomsRef.current.delete(roomCode);
      roomPasscodeSecretsRef.current.delete(roomCode);

      updateRecentRooms((prev) => prev.filter((r) => r.roomCode !== roomCode));

      setMessagesByRoom((prev) => {
        const removed = prev[roomCode] || [];
        const removedIds = removed.map((m) => m.id);
        removedIds.forEach((id) => seenMessageIdsRef.current.delete(id));
        evictDecryptedMessageCacheBatch(removedIds);
        const next = { ...prev };
        delete next[roomCode];
        return next;
      });
      setRoomStatuses((prev) => {
        const next = { ...prev };
        delete next[roomCode];
        return next;
      });
      setRoomErrors((prev) => {
        const next = { ...prev };
        delete next[roomCode];
        return next;
      });
      setNotification((curr) => (curr?.roomCode === roomCode ? null : curr));

      if (activeRoomCodeRef.current === roomCode) {
        setActiveRoomCode(null);
        setActiveTab('rooms');
      }
    },
    [updateRecentRooms]
  );

  const handleSelectOfficialRoom = useCallback(() => {
    setActiveRoomCode(OFFICIAL_ROOM_ID);
    setActiveTab('rooms');
    setNotification((curr) => (curr?.roomCode === OFFICIAL_ROOM_ID ? null : curr));
    markOfficialAsRead(officialAnnouncements[0]?.created_at);
  }, [markOfficialAsRead, officialAnnouncements]);

  // --- Chat Send (E2EE AES-GCM), Sticker Send, Reactions, Custom Sticker CRUD, Delete ---

  const handleSendMessage = useCallback(
    async (
      roomCode: string,
      content: string,
      imageFile?: File | null,
      replyTo?: ReplyReference | null
    ): Promise<string | null> => {
      if (isMaintenanceModeRef.current) {
        return '現在ROOMLINEはシステムメンテナンス中のため送信できません。';
      }
      const currentProfile = profileRef.current;
      const senderName = currentProfile.nickname.trim() || 'ゲスト';
      const senderAvatar =
        currentProfile.avatarType === 'preset' || currentProfile.avatarType === 'custom'
          ? currentProfile.avatarValue
          : '';

      const hashedRoomId = await hashRoomCode(roomCode);
      const rawPasscode = roomPasscodeSecretsRef.current.get(roomCode) || null;

      let uploadedImageUrl: string | null = null;

      if (imageFile) {
        if (!isSupabaseConfigured) {
          try {
            uploadedImageUrl = await fileToCompactDataUrl(imageFile);
          } catch (err) {
            return err instanceof Error ? err.message : '画像の処理に失敗しました。';
          }
        } else {
          const { url, error } = await uploadChatImageToSupabase(
            supabaseState.config,
            hashedRoomId,
            imageFile
          );
          if (error || !url) {
            return error || '画像のアップロードに失敗しました。';
          }
          uploadedImageUrl = url;
        }
      }

      // Encrypt content and reply_to with AES-256-GCM inside the browser before leaving the client
      let encryptedContent = '';
      let encryptedReplyTo: string | null = null;
      try {
        [encryptedContent, encryptedReplyTo] = await Promise.all([
          content ? encryptRoomText(content, roomCode, rawPasscode) : Promise.resolve(''),
          replyTo
            ? encryptReplyReference(replyTo, roomCode, rawPasscode)
            : Promise.resolve(null),
        ]);
      } catch (err) {
        return err instanceof Error
          ? `暗号化エラー: ${err.message}`
          : 'メッセージの暗号化に失敗しました。';
      }

      if (!isSupabaseConfigured) {
        const msgId =
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const createdAt = new Date().toISOString();

        // Store encrypted content/reply_to in localStorage so mock mode exercises full E2EE roundtrip
        const storedMockMessage = {
          id: msgId,
          room_code: roomCode,
          sender_name: senderName,
          content: encryptedContent,
          created_at: createdAt,
          sender_id: currentProfile.id,
          sender_avatar: senderAvatar || null,
          sender_color: currentProfile.avatarColor,
          read_by: [senderName],
          image_url: uploadedImageUrl,
          sticker_url: null,
          reply_to: encryptedReplyTo,
          reactions: {},
        } as unknown as ChatMessage;

        appendMockMessage(roomCode, storedMockMessage);
        const decryptedLocal = await decryptRawDbMessage(
          storedMockMessage as unknown as RawDbMessage,
          roomCode
        );
        if (decryptedLocal) {
          handleIncomingMessage(decryptedLocal);
        }
        return null;
      }

      const { data, error } = await sendRoomMessageToSupabase(supabaseState.config, {
        room_code: hashedRoomId,
        sender_name: senderName,
        content: encryptedContent,
        sender_id: currentProfile.id,
        sender_avatar: senderAvatar || undefined,
        sender_color: currentProfile.avatarColor,
        image_url: uploadedImageUrl,
        reply_to: encryptedReplyTo,
      });

      if (error) return `送信エラー: ${error}`;
      if (data) {
        const decrypted = await decryptRawDbMessage(data, roomCode);
        if (decrypted) {
          handleIncomingMessage(decrypted);
        }
      }
      return null;
    },
    [
      isSupabaseConfigured,
      supabaseState.config,
      decryptRawDbMessage,
      handleIncomingMessage,
    ]
  );

  const handleSendSticker = useCallback(
    async (
      roomCode: string,
      stickerUrl: string,
      replyTo?: ReplyReference | null
    ): Promise<string | null> => {
      if (isMaintenanceModeRef.current) {
        return '現在ROOMLINEはシステムメンテナンス中のため送信できません。';
      }
      const currentProfile = profileRef.current;
      const senderName = currentProfile.nickname.trim() || 'ゲスト';
      const senderAvatar =
        currentProfile.avatarType === 'preset' || currentProfile.avatarType === 'custom'
          ? currentProfile.avatarValue
          : '';

      const hashedRoomId = await hashRoomCode(roomCode);
      const rawPasscode = roomPasscodeSecretsRef.current.get(roomCode) || null;
      let encryptedReplyTo: string | null = null;
      if (replyTo) {
        try {
          encryptedReplyTo = await encryptReplyReference(replyTo, roomCode, rawPasscode);
        } catch (err) {
          return err instanceof Error ? err.message : '引用情報の暗号化に失敗しました。';
        }
      }

      if (!isSupabaseConfigured) {
        const storedMockMessage = {
          id:
            typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
              ? crypto.randomUUID()
              : `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          room_code: roomCode,
          sender_name: senderName,
          content: '',
          created_at: new Date().toISOString(),
          sender_id: currentProfile.id,
          sender_avatar: senderAvatar || null,
          sender_color: currentProfile.avatarColor,
          read_by: [senderName],
          image_url: null,
          sticker_url: stickerUrl,
          reply_to: encryptedReplyTo,
          reactions: {},
        } as unknown as ChatMessage;

        appendMockMessage(roomCode, storedMockMessage);
        const decryptedLocal = await decryptRawDbMessage(
          storedMockMessage as unknown as RawDbMessage,
          roomCode
        );
        if (decryptedLocal) {
          handleIncomingMessage(decryptedLocal);
        }
        return null;
      }

      const { data, error } = await sendRoomMessageToSupabase(supabaseState.config, {
        room_code: hashedRoomId,
        sender_name: senderName,
        content: '',
        sender_id: currentProfile.id,
        sender_avatar: senderAvatar || undefined,
        sender_color: currentProfile.avatarColor,
        sticker_url: stickerUrl,
        reply_to: encryptedReplyTo,
      });

      if (error) return `スタンプ送信エラー: ${error}`;
      if (data) {
        const decrypted = await decryptRawDbMessage(data, roomCode);
        if (decrypted) {
          handleIncomingMessage(decrypted);
        }
      }
      return null;
    },
    [
      isSupabaseConfigured,
      supabaseState.config,
      decryptRawDbMessage,
      handleIncomingMessage,
    ]
  );

  const handleToggleReaction = useCallback(
    async (
      roomCode: string,
      message: ChatMessage,
      emoji: string
    ): Promise<string | null> => {
      const reactorName = profileRef.current.nickname.trim() || 'ゲスト';
      const currentReactions: ReactionMap = { ...(message.reactions || {}) };
      const existingUsers = Array.isArray(currentReactions[emoji])
        ? [...currentReactions[emoji]]
        : [];

      const hasReacted = existingUsers.includes(reactorName);
      if (hasReacted) {
        const filtered = existingUsers.filter((u) => u !== reactorName);
        if (filtered.length > 0) {
          currentReactions[emoji] = filtered;
        } else {
          delete currentReactions[emoji];
        }
      } else {
        currentReactions[emoji] = Array.from(new Set([...existingUsers, reactorName]));
      }

      const optimisticMsg: ChatMessage = { ...message, reactions: currentReactions };
      handleIncomingMessageUpdate(optimisticMsg);

      if (!isSupabaseConfigured) {
        updateMockMessageReactions(roomCode, message.id, currentReactions);
        return null;
      }

      const { data, error } = await updateMessageReactionsInSupabase(
        supabaseState.config,
        message.id,
        currentReactions
      );
      if (error) {
        // Revert optimistic update on DB error
        handleIncomingMessageUpdate(message);
        return error;
      }
      if (data) {
        const decrypted = await decryptRawDbMessage(data, roomCode);
        if (decrypted) {
          handleIncomingMessageUpdate(decrypted);
        }
      }
      return null;
    },
    [
      isSupabaseConfigured,
      supabaseState.config,
      decryptRawDbMessage,
      handleIncomingMessageUpdate,
    ]
  );

  const handleAddCustomSticker = useCallback(
    async (file: File): Promise<string | null> => {
      let stickerUrl: string | null = null;

      if (!isSupabaseConfigured) {
        try {
          stickerUrl = await fileToCompactDataUrl(file, 360, true);
        } catch (err) {
          return err instanceof Error ? err.message : '画像の読み込みに失敗しました。';
        }
      } else {
        const { url, error } = await uploadStorageImageToSupabase(
          supabaseState.config,
          'stickers',
          file
        );
        if (error || !url) {
          return error || 'マイスタンプのアップロードに失敗しました。';
        }
        stickerUrl = url;
      }

      const newSticker: CustomSticker = {
        id:
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `sticker_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        url: stickerUrl,
        label: file.name,
        createdAt: new Date().toISOString(),
      };

      setCustomStickers((prev) => {
        const next = [newSticker, ...prev];
        saveCustomStickers(next);
        return next;
      });
      return null;
    },
    [isSupabaseConfigured, supabaseState.config]
  );

  const handleDeleteCustomSticker = useCallback((stickerId: string) => {
    setCustomStickers((prev) => {
      const next = prev.filter((s) => s.id !== stickerId);
      saveCustomStickers(next);
      return next;
    });
  }, []);

  const handleDeleteMessage = useCallback(
    async (roomCode: string, messageId: string): Promise<string | null> => {
      if (!isSupabaseConfigured) {
        deleteMockMessage(roomCode, messageId);
        handleIncomingMessageDelete(messageId, roomCode);
        return null;
      }

      const { error } = await deleteRoomMessageFromSupabase(
        supabaseState.config,
        messageId
      );
      if (error) return error;
      handleIncomingMessageDelete(messageId, roomCode);
      return null;
    },
    [isSupabaseConfigured, supabaseState.config, handleIncomingMessageDelete]
  );

  const handleUpdateRoomTitle = useCallback(
    async (roomCode: string, nextTitle: string): Promise<string | null> => {
      const trimmed = nextTitle.trim();

      if (!isSupabaseConfigured) {
        const record = saveMockRoomMeta(roomCode, { title: trimmed });
        handleIncomingRoomUpdate(record);
        return null;
      }

      const hashedRoomId = await hashRoomCode(roomCode);
      const { data, error } = await upsertRoomMetaToSupabase(
        supabaseState.config,
        hashedRoomId,
        { title: trimmed }
      );
      if (error) return error;
      if (data) {
        handleIncomingRoomUpdate({ ...data, room_code: roomCode });
      }
      return null;
    },
    [isSupabaseConfigured, supabaseState.config, handleIncomingRoomUpdate]
  );

  const handleUpdateRoomPasscode = useCallback(
    async (roomCode: string, nextPasscode: string | null): Promise<string | null> => {
      let passcodeHash: string | null = null;
      if (nextPasscode) {
        const cleanPass = nextPasscode.replace(/\D/g, '').slice(0, 4);
        if (cleanPass.length !== 4) {
          return '4桁の数字を入力してください。';
        }
        passcodeHash = await hashRoomPasscode(roomCode, cleanPass);
        roomPasscodeSecretsRef.current.set(roomCode, cleanPass);
      } else {
        roomPasscodeSecretsRef.current.delete(roomCode);
      }

      if (!isSupabaseConfigured) {
        const record = saveMockRoomMeta(roomCode, { passcode: passcodeHash });
        handleIncomingRoomUpdate(record);
        if (passcodeHash) {
          unlockedRoomsRef.current.add(roomCode);
        }
        return null;
      }

      const hashedRoomId = await hashRoomCode(roomCode);
      const { data, error } = await upsertRoomMetaToSupabase(
        supabaseState.config,
        hashedRoomId,
        { passcode: passcodeHash }
      );
      if (error) return error;
      if (data) {
        handleIncomingRoomUpdate({ ...data, room_code: roomCode });
        if (passcodeHash) {
          unlockedRoomsRef.current.add(roomCode);
        }
      }
      return null;
    },
    [isSupabaseConfigured, supabaseState.config, handleIncomingRoomUpdate]
  );

  // --- BOOM Timeline Actions ---

  const handleCreateBoomPost = useCallback(
    async (content: string, imageFile?: File | null): Promise<string | null> => {
      if (isMaintenanceModeRef.current) {
        return '現在ROOMLINEはシステムメンテナンス中のため投稿できません。';
      }
      const currentProfile = profileRef.current;
      const authorName = currentProfile.nickname.trim() || 'ゲスト';
      const authorAvatar =
        currentProfile.avatarType === 'preset' || currentProfile.avatarType === 'custom'
          ? currentProfile.avatarValue
          : null;

      let imageUrl: string | null = null;
      if (imageFile) {
        if (!isSupabaseConfigured) {
          try {
            imageUrl = await fileToCompactDataUrl(imageFile);
          } catch (err) {
            return err instanceof Error ? err.message : '画像の処理に失敗しました。';
          }
        } else {
          const { url, error } = await uploadStorageImageToSupabase(
            supabaseState.config,
            'boom',
            imageFile
          );
          if (error || !url) {
            return error || '画像のアップロードに失敗しました。';
          }
          imageUrl = url;
        }
      }

      if (!isSupabaseConfigured) {
        const post: BoomPost = {
          id:
            typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
              ? crypto.randomUUID()
              : `boom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          author_name: authorName,
          author_id: currentProfile.id,
          author_avatar: authorAvatar,
          author_color: currentProfile.avatarColor,
          content,
          image_url: imageUrl,
          likes: [],
          comments: [],
          created_at: new Date().toISOString(),
        };
        createMockBoomPost(post);
        handleBoomInsert(post);
        return null;
      }

      const { data, error } = await createBoomPostInSupabase(supabaseState.config, {
        author_name: authorName,
        author_id: currentProfile.id,
        author_avatar: authorAvatar,
        author_color: currentProfile.avatarColor,
        content,
        image_url: imageUrl,
      });

      if (error) return `投稿エラー: ${error}`;
      if (data) handleBoomInsert(data);
      return null;
    },
    [isSupabaseConfigured, supabaseState.config, handleBoomInsert]
  );

  const handleToggleBoomLike = useCallback(
    async (post: BoomPost): Promise<string | null> => {
      const currentProfile = profileRef.current;
      const likerKey = currentProfile.nickname.trim() || 'ゲスト';
      const hasLiked =
        post.likes.includes(likerKey) || post.likes.includes(currentProfile.id);

      const nextLikes = hasLiked
        ? post.likes.filter((v) => v !== likerKey && v !== currentProfile.id)
        : Array.from(new Set([...post.likes, likerKey]));

      handleBoomUpdate({ ...post, likes: nextLikes });

      if (!isSupabaseConfigured) {
        updateMockBoomPost(post.id, (p) => ({ ...p, likes: nextLikes }));
        return null;
      }

      const { data, error } = await updateBoomPostLikesInSupabase(
        supabaseState.config,
        post.id,
        nextLikes
      );
      if (error) {
        handleBoomUpdate(post);
        return error;
      }
      if (data) handleBoomUpdate(data);
      return null;
    },
    [isSupabaseConfigured, supabaseState.config, handleBoomUpdate]
  );

  const handleAddBoomComment = useCallback(
    async (post: BoomPost, content: string): Promise<string | null> => {
      if (isMaintenanceModeRef.current) {
        return '現在ROOMLINEはシステムメンテナンス中のためコメントできません。';
      }
      const currentProfile = profileRef.current;
      const authorName = currentProfile.nickname.trim() || 'ゲスト';
      const authorAvatar =
        currentProfile.avatarType === 'preset' || currentProfile.avatarType === 'custom'
          ? currentProfile.avatarValue
          : null;

      const newComment: BoomComment = {
        id:
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `cmt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        author_name: authorName,
        author_id: currentProfile.id,
        author_avatar: authorAvatar,
        author_color: currentProfile.avatarColor,
        content,
        created_at: new Date().toISOString(),
      };

      const nextComments = [...post.comments, newComment];
      handleBoomUpdate({ ...post, comments: nextComments });

      if (!isSupabaseConfigured) {
        addMockBoomComment(post.id, newComment);
        return null;
      }

      const { data, error } = await updateBoomPostCommentsInSupabase(
        supabaseState.config,
        post.id,
        nextComments
      );
      if (error) {
        handleBoomUpdate(post);
        return error;
      }
      if (data) handleBoomUpdate(data);
      return null;
    },
    [isSupabaseConfigured, supabaseState.config, handleBoomUpdate]
  );

  const handleDeleteBoomPost = useCallback(
    async (postId: string): Promise<string | null> => {
      handleBoomDelete(postId);

      if (!isSupabaseConfigured) {
        deleteMockBoomPost(postId);
        return null;
      }

      const { error } = await deleteBoomPostFromSupabase(supabaseState.config, postId);
      return error;
    },
    [isSupabaseConfigured, supabaseState.config, handleBoomDelete]
  );

  // --- User Report Submission (Zero-Knowledge: sends ONLY reporter-entered fields) ---

  const handleSubmitReport = useCallback(
    async (payload: {
      targetUserName: string;
      reason: ReportReason;
      details: string;
    }): Promise<string | null> => {
      const reporterName = profileRef.current.nickname.trim() || 'ゲスト';

      if (!isSupabaseConfigured) {
        const mockReport: UserReport = {
          id:
            typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
              ? crypto.randomUUID()
              : `rep_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          reporter_name: reporterName,
          target_user_name: payload.targetUserName,
          reason: payload.reason,
          details: payload.details,
          status: 'pending',
          created_at: new Date().toISOString(),
        };
        createMockReport(mockReport);
        return null;
      }

      const { error } = await createReportInSupabase(supabaseState.config, {
        reporter_name: reporterName,
        target_user_name: payload.targetUserName,
        reason: payload.reason,
        details: payload.details,
      });
      return error;
    },
    [isSupabaseConfigured, supabaseState.config]
  );

  // --- Feature Requests & Voting Actions ---

  const handleCreateFeatureRequest = useCallback(
    async (payload: {
      title: string;
      description: string;
      anonymous: boolean;
    }): Promise<string | null> => {
      if (isMaintenanceModeRef.current) {
        return '現在ROOMLINEはシステムメンテナンス中のため投稿できません。';
      }
      const authorName = payload.anonymous
        ? '匿名'
        : profileRef.current.nickname.trim() || 'ゲスト';

      if (!isSupabaseConfigured) {
        const created: FeatureRequest = {
          id:
            typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
              ? crypto.randomUUID()
              : `feat_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          title: payload.title,
          description: payload.description,
          author_name: authorName,
          votes: 0,
          voted_user_ids: [],
          status: '検討中',
          created_at: new Date().toISOString(),
        };
        createMockFeatureRequest(created);
        handleFeatureRequestInsert(created);
        return null;
      }

      const { data, error } = await createFeatureRequestInSupabase(
        supabaseState.config,
        {
          title: payload.title,
          description: payload.description,
          author_name: authorName,
        }
      );
      if (error) return `要望の投稿に失敗しました: ${error}`;
      if (data) handleFeatureRequestInsert(data);
      return null;
    },
    [isSupabaseConfigured, supabaseState.config, handleFeatureRequestInsert]
  );

  const handleToggleFeatureRequestVote = useCallback(
    async (request: FeatureRequest): Promise<string | null> => {
      if (isMaintenanceModeRef.current) {
        return '現在ROOMLINEはシステムメンテナンス中のため投票できません。';
      }
      const userId = profileRef.current.id;
      const alreadyVoted = request.voted_user_ids.includes(userId);
      const nextVotedIds = alreadyVoted
        ? request.voted_user_ids.filter((id) => id !== userId)
        : Array.from(new Set([...request.voted_user_ids, userId]));

      const optimistic: FeatureRequest = {
        ...request,
        voted_user_ids: nextVotedIds,
        votes: nextVotedIds.length,
      };
      handleFeatureRequestUpdate(optimistic);

      if (!isSupabaseConfigured) {
        updateMockFeatureRequest(request.id, () => optimistic);
        return null;
      }

      const { data, error } = await updateFeatureRequestVotesInSupabase(
        supabaseState.config,
        request.id,
        nextVotedIds
      );
      if (error) {
        handleFeatureRequestUpdate(request);
        return `投票の更新に失敗しました: ${error}`;
      }
      if (data) handleFeatureRequestUpdate(data);
      return null;
    },
    [isSupabaseConfigured, supabaseState.config, handleFeatureRequestUpdate]
  );

  // --- Account Transfer Export & Restore Actions ---

  const getRoomPasscodes = useCallback((): Record<string, string> => {
    const out: Record<string, string> = {};
    roomPasscodeSecretsRef.current.forEach((pass, code) => {
      out[code] = pass;
    });
    return out;
  }, []);

  const handleRestoreAccount = useCallback(
    (payload: AccountTransferPayload) => {
      const sortedRooms = sortRecentRoomsDesc(payload.recentRooms);

      // Persist all restored state to localStorage
      saveUserProfile(payload.profile);
      saveRecentRooms(sortedRooms);
      saveCustomStickers(payload.customStickers);
      saveThemeMode(payload.themeMode);
      if (payload.officialLastReadAt) {
        saveOfficialLastReadAt(payload.officialLastReadAt);
      }
      markOnboardingCompleted();

      // Hydrate in-memory E2EE passcodes & unlocked room state
      roomPasscodeSecretsRef.current.clear();
      unlockedRoomsRef.current.clear();
      Object.entries(payload.roomPasscodes).forEach(([code, pass]) => {
        roomPasscodeSecretsRef.current.set(code, pass);
        unlockedRoomsRef.current.add(code);
      });

      // Update React state
      setProfile(payload.profile);
      setRecentRooms(sortedRooms);
      setCustomStickers(payload.customStickers);
      setThemeMode(payload.themeMode);
      setOfficialLastReadAt(payload.officialLastReadAt);
      setOnboardingDone(true);
      setActiveTab('rooms');

      const firstAccessible = sortedRooms.find(
        (r) =>
          !(r.passcode && r.passcode.trim()) ||
          Boolean(payload.roomPasscodes[r.roomCode])
      );
      setActiveRoomCode(
        firstAccessible ? firstAccessible.roomCode : OFFICIAL_ROOM_ID
      );

      // Force clean room subscription & decryption cache refresh
      setRestoreRevision((v) => v + 1);
      setIsProfileModalOpen(false);
      setAccountTransferModalState({ open: false, tab: 'export' });

      showNotificationBanner({
        id: `restore_${Date.now()}`,
        roomCode: firstAccessible ? firstAccessible.roomCode : OFFICIAL_ROOM_ID,
        roomTitle: 'アカウント引き継ぎ完了',
        senderName: payload.profile.nickname || 'ゲスト',
        content: `プロフィールとトーク履歴（${sortedRooms.length}件）を復元しました`,
        createdAt: new Date().toISOString(),
        isOfficial: true,
      });
    },
    [showNotificationBanner]
  );

  const suggestedReportTargets = useMemo(() => {
    const selfName = profile.nickname.trim() || 'ゲスト';
    const names = new Set<string>();
    onlineMembers.forEach((m) => {
      const n = m.nickname.trim();
      if (n && n !== selfName && m.userId !== profile.id) names.add(n);
    });
    activeMessages.forEach((m) => {
      const n = m.sender_name.trim();
      if (n && !isOwnMessage(m, profile)) names.add(n);
    });
    return Array.from(names);
  }, [onlineMembers, activeMessages, profile]);

  const handleChangeThemeMode = useCallback((mode: ThemeMode) => {
    setThemeMode(mode);
    saveThemeMode(mode);
  }, []);

  // Stable UI callbacks so React.memo on Sidebar & ChatRoomView prevents wasted re-renders
  const handleSelectTab = useCallback((tab: ActiveTab) => {
    if (tab === 'profile') {
      setIsProfileModalOpen(true);
      return;
    }
    setActiveTab(tab);
  }, []);

  const handleSelectRoom = useCallback(
    (code: string) => {
      void handleRequestEnterRoom(code);
    },
    [handleRequestEnterRoom]
  );

  const handleRequestLeaveRoomModal = useCallback((code: string) => {
    setLeaveModalRoomCode(code);
  }, []);

  const handleOpenCreateRoom = useCallback(() => setIsCreateRoomOpen(true), []);
  const handleCloseCreateRoom = useCallback(() => setIsCreateRoomOpen(false), []);
  const handleOpenJoinRoom = useCallback(() => setIsJoinRoomOpen(true), []);
  const handleCloseJoinRoom = useCallback(() => setIsJoinRoomOpen(false), []);
  const handleOpenProfileModal = useCallback(() => setIsProfileModalOpen(true), []);
  const handleCloseProfileModal = useCallback(() => setIsProfileModalOpen(false), []);
  const handleOpenFeatureRequests = useCallback(() => {
    setIsProfileModalOpen(false);
    setIsFeatureRequestModalOpen(true);
  }, []);
  const handleCloseFeatureRequests = useCallback(
    () => setIsFeatureRequestModalOpen(false),
    []
  );
  const handleOpenAccountTransfer = useCallback((tab: 'export' | 'import') => {
    setIsProfileModalOpen(false);
    setAccountTransferModalState({ open: true, tab, importOnly: false });
  }, []);
  const handleOpenOnboardingRestore = useCallback(() => {
    setAccountTransferModalState({ open: true, tab: 'import', importOnly: true });
  }, []);
  const handleCloseAccountTransfer = useCallback(() => {
    setAccountTransferModalState((prev) => ({ ...prev, open: false }));
  }, []);
  const handleOpenPasscodeManage = useCallback(() => setIsPasscodeManageOpen(true), []);
  const handleClosePasscodeManage = useCallback(() => setIsPasscodeManageOpen(false), []);
  const handleActivateCamouflage = useCallback(() => setIsCamouflaged(true), []);
  const handleExitCamouflage = useCallback(() => setIsCamouflaged(false), []);
  const handleBackToLobby = useCallback(() => {
    setActiveRoomCode(null);
    setActiveTab('rooms');
  }, []);
  const handleOpenReportModal = useCallback((targetUser?: string) => {
    setReportModalState({ open: true, targetUser: targetUser || '' });
  }, []);
  const handleCloseReportModal = useCallback(() => {
    setReportModalState({ open: false, targetUser: '' });
  }, []);
  const handleDismissNotification = useCallback(() => setNotification(null), []);

  // WebRTC Voice & Video Call controller (scoped to active room, auto-terminated on Camouflage or Maintenance)
  const callController = useWebRtcCall({
    activeRoomCode: activeTab === 'rooms' ? activeRoomCode : null,
    profile,
    supabaseConfig: supabaseState.config,
    isSupabaseConfigured,
    isDisabled: isAdminRoute || !onboardingDone,
    isStealthOrMaintenance: isCamouflaged || isMaintenanceMode,
  });

  const { startCall: startWebRtcCall } = callController;

  const handleStartAudioCall = useCallback(() => {
    void startWebRtcCall('audio');
  }, [startWebRtcCall]);

  const handleStartVideoCall = useCallback(() => {
    void startWebRtcCall('video');
  }, [startWebRtcCall]);

  // Online Mini-Games session controller (Supabase Realtime Broadcast `minigame-sync`, auto-closed on Camouflage or Maintenance)
  const handleSendMiniGameRoomText = useCallback(
    async (roomCode: string, text: string) => {
      await handleSendMessage(roomCode, text, null, null);
    },
    [handleSendMessage]
  );

  const miniGameSession = useMiniGameSession({
    activeRoomCode: activeTab === 'rooms' ? activeRoomCode : null,
    profile,
    supabaseConfig: supabaseState.config,
    isSupabaseConfigured,
    isDisabled: isAdminRoute || !onboardingDone,
    isStealthOrMaintenance: isCamouflaged || isMaintenanceMode,
    onSendRoomText: handleSendMiniGameRoomText,
  });

  const handleRematchMiniGameFromCard = useCallback(
    (gameId: 'reaction' | 'draw_guess' | 'reversi') => {
      void miniGameSession.createInvite(gameId);
    },
    [miniGameSession]
  );

  useEffect(() => {
    document.documentElement.classList.toggle('dark', themeMode === 'dark');
  }, [themeMode]);

  // =========================================================================
  // STRICT ROUTE ISOLATION: `/admin` displays ONLY the Admin Portal
  // =========================================================================
  if (isAdminRoute) {
    return (
      <AdminPortal
        supabaseConfig={supabaseState.config}
        isSupabaseConfigured={isSupabaseConfigured}
        themeMode={themeMode}
        onChangeThemeMode={handleChangeThemeMode}
        onExitToLobby={handleExitAdminToLobby}
      />
    );
  }

  // =========================================================================
  // FIRST-LAUNCH ONBOARDING: Shown only when initial profile setup is not saved
  // =========================================================================
  if (!onboardingDone) {
    return (
      <>
        <WelcomeOnboarding
          initialProfile={profile}
          onComplete={handleCompleteOnboarding}
          onOpenRestoreModal={handleOpenOnboardingRestore}
        />
        {accountTransferModalState.open && (
          <AccountTransferModal
            isOpen={accountTransferModalState.open}
            initialTab="import"
            importOnly
            profile={profile}
            recentRooms={recentRooms}
            customStickers={customStickers}
            themeMode={themeMode}
            officialLastReadAt={officialLastReadAt}
            getRoomPasscodes={getRoomPasscodes}
            onRestoreAccount={handleRestoreAccount}
            onClose={handleCloseAccountTransfer}
          />
        )}
        {isMaintenanceMode && <MaintenanceOverlay />}
      </>
    );
  }

  const isViewingOfficialRoom = activeRoomCode === OFFICIAL_ROOM_ID;
  const activeRoomMeta =
    activeRoomCode && !isViewingOfficialRoom
      ? recentRooms.find((r) => r.roomCode === activeRoomCode)
      : undefined;

  const leaveModalRoomMeta = leaveModalRoomCode
    ? recentRooms.find((r) => r.roomCode === leaveModalRoomCode)
    : undefined;

  return (
    <div className="h-[100dvh] w-full flex overflow-hidden bg-[#F8FAFC] dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <Sidebar
        profile={profile}
        activeTab={activeTab}
        activeRoomCode={activeRoomCode}
        recentRooms={recentRooms}
        latestOfficialAnnouncement={latestOfficialAnnouncement}
        officialUnreadCount={officialUnreadCount}
        themeMode={themeMode}
        onChangeThemeMode={handleChangeThemeMode}
        onSelectTab={handleSelectTab}
        onSelectRoom={handleSelectRoom}
        onSelectOfficialRoom={handleSelectOfficialRoom}
        onRequestLeaveRoom={handleRequestLeaveRoomModal}
        onOpenCreateRoom={handleOpenCreateRoom}
        onOpenJoinRoom={handleOpenJoinRoom}
        onOpenProfileModal={handleOpenProfileModal}
        onOpenSettings={handleOpenProfileModal}
        onOpenFeatureRequests={handleOpenFeatureRequests}
        onActivateCamouflage={handleActivateCamouflage}
      />

      <main className="flex-1 min-w-0 h-full overflow-hidden">
        {activeTab === 'boom' ? (
          <BoomFeedView
            posts={boomPosts}
            loading={loadingBoom}
            realtimeStatus={boomStatus}
            errorMsg={boomError}
            profile={profile}
            onCreatePost={handleCreateBoomPost}
            onToggleLike={handleToggleBoomLike}
            onAddComment={handleAddBoomComment}
            onDeletePost={handleDeleteBoomPost}
            onOpenSettings={handleOpenProfileModal}
            onOpenProfile={handleOpenProfileModal}
            onActivateCamouflage={handleActivateCamouflage}
          />
        ) : isViewingOfficialRoom ? (
          <OfficialChatView
            announcements={officialAnnouncements}
            profile={profile}
            onBackToLobby={handleBackToLobby}
            onOpenSettings={handleOpenProfileModal}
            onActivateCamouflage={handleActivateCamouflage}
          />
        ) : activeRoomCode ? (
          <ChatRoomView
            roomCode={activeRoomCode}
            roomTitle={activeRoomMeta?.title}
            roomPasscode={activeRoomMeta?.passcode}
            messages={activeMessages}
            onlineMembers={onlineMembers}
            customStickers={customStickers}
            loading={Boolean(loadingRooms[activeRoomCode])}
            realtimeStatus={
              roomStatuses[activeRoomCode] ||
              (isSupabaseConfigured ? 'connecting' : 'mock')
            }
            errorMsg={roomErrors[activeRoomCode] || null}
            profile={profile}
            onSendMessage={handleSendMessage}
            onSendSticker={handleSendSticker}
            onToggleReaction={handleToggleReaction}
            onTypingChange={handleTypingChange}
            onAddCustomSticker={handleAddCustomSticker}
            onDeleteCustomSticker={handleDeleteCustomSticker}
            onDeleteMessage={handleDeleteMessage}
            onUpdateRoomTitle={handleUpdateRoomTitle}
            onOpenPasscodeManage={handleOpenPasscodeManage}
            onOpenReportModal={handleOpenReportModal}
            onRequestLeaveRoom={handleRequestLeaveRoomModal}
            onBackToLobby={handleBackToLobby}
            onOpenSettings={handleOpenProfileModal}
            onOpenProfile={handleOpenProfileModal}
            onActivateCamouflage={handleActivateCamouflage}
            onStartAudioCall={handleStartAudioCall}
            onStartVideoCall={handleStartVideoCall}
            isCallBusy={callController.status !== 'idle'}
            pendingMiniGameInvite={miniGameSession.pendingInvite}
            joiningMiniGameMatchId={miniGameSession.joiningMatchId}
            activeMiniGameMatchId={miniGameSession.activeMatch?.matchId ?? null}
            miniGameNotice={miniGameSession.miniGameNotice}
            onDismissMiniGameNotice={miniGameSession.dismissNotice}
            onCancelPendingMiniGame={miniGameSession.cancelPendingInvite}
            onOpenMiniGameLauncher={miniGameSession.openLauncher}
            onJoinMiniGameInvite={miniGameSession.joinInvite}
            onRematchMiniGame={handleRematchMiniGameFromCard}
          />
        ) : (
          <TalkListEmptyOrMobile
            profile={profile}
            themeMode={themeMode}
            onChangeThemeMode={handleChangeThemeMode}
            recentRooms={recentRooms}
            latestOfficialAnnouncement={latestOfficialAnnouncement}
            officialUnreadCount={officialUnreadCount}
            onSelectRoom={handleSelectRoom}
            onSelectOfficialRoom={handleSelectOfficialRoom}
            onRequestLeaveRoom={handleRequestLeaveRoomModal}
            onOpenCreateRoom={handleOpenCreateRoom}
            onOpenJoinRoom={handleOpenJoinRoom}
            onOpenProfileModal={handleOpenProfileModal}
            onOpenSettings={handleOpenProfileModal}
            onOpenFeatureRequests={handleOpenFeatureRequests}
            onActivateCamouflage={handleActivateCamouflage}
          />
        )}
      </main>

      {/* Top notification banner (visual only, no sound; mounted only when active) */}
      {!isCamouflaged && !isMaintenanceMode && notification && (
        <NotificationBanner
          notification={notification}
          onSelectRoom={(code) => {
            setNotification(null);
            if (code === OFFICIAL_ROOM_ID) {
              handleSelectOfficialRoom();
            } else {
              void handleRequestEnterRoom(code);
            }
          }}
          onDismiss={handleDismissNotification}
        />
      )}

      {/* Centered Create Room Popup Modal (mounted only when open) */}
      {isCreateRoomOpen && (
        <CreateRoomModal
          isOpen={isCreateRoomOpen}
          onClose={handleCloseCreateRoom}
          onCreateRoom={handleCreateRoom}
        />
      )}

      {/* Centered Join Room Popup Modal with QR scanner (mounted only when open) */}
      {isJoinRoomOpen && (
        <JoinRoomModal
          isOpen={isJoinRoomOpen}
          isSupabaseConfigured={isSupabaseConfigured}
          supabaseConfig={supabaseState.config}
          onClose={handleCloseJoinRoom}
          onJoinResolved={({
            roomCode,
            title,
            storedPasscodeHash,
            verifiedRawPasscode,
          }) => {
            if (verifiedRawPasscode) {
              roomPasscodeSecretsRef.current.set(roomCode, verifiedRawPasscode);
            }
            commitEnterRoom(roomCode, {
              title,
              passcode: storedPasscodeHash ?? null,
            });
            if (verifiedRawPasscode) {
              void redecryptCachedRoomMessages(roomCode);
            }
          }}
        />
      )}

      {/* Unified User Settings Modal (mounted only when open) */}
      {isProfileModalOpen && (
        <ProfileEditModal
          isOpen={isProfileModalOpen}
          profile={profile}
          themeMode={themeMode}
          onUpdateProfile={handleUpdateProfile}
          onChangeThemeMode={handleChangeThemeMode}
          onOpenAccountTransfer={handleOpenAccountTransfer}
          onOpenFeatureRequests={handleOpenFeatureRequests}
          onClose={handleCloseProfileModal}
        />
      )}

      {/* Feature Request & Voting Box Modal (mounted only when open) */}
      {isFeatureRequestModalOpen && (
        <FeatureRequestModal
          isOpen={isFeatureRequestModalOpen}
          requests={featureRequests}
          loading={loadingFeatureRequests}
          errorMsg={featureRequestsError}
          profile={profile}
          onCreateRequest={handleCreateFeatureRequest}
          onToggleVote={handleToggleFeatureRequestVote}
          onClose={handleCloseFeatureRequests}
        />
      )}

      {/* Encrypted Account Transfer (Backup & Restore) Modal (mounted only when open) */}
      {accountTransferModalState.open && (
        <AccountTransferModal
          isOpen={accountTransferModalState.open}
          initialTab={accountTransferModalState.tab}
          importOnly={accountTransferModalState.importOnly}
          profile={profile}
          recentRooms={recentRooms}
          customStickers={customStickers}
          themeMode={themeMode}
          officialLastReadAt={officialLastReadAt}
          getRoomPasscodes={getRoomPasscodes}
          onRestoreAccount={handleRestoreAccount}
          onClose={handleCloseAccountTransfer}
        />
      )}

      {/* 2-step confirmation modal for leaving a room (mounted only when open) */}
      {leaveModalRoomCode && (
        <LeaveRoomModal
          roomCode={leaveModalRoomCode}
          roomTitle={leaveModalRoomMeta?.title}
          onCancel={() => setLeaveModalRoomCode(null)}
          onConfirmLeave={handleConfirmLeaveRoom}
        />
      )}

      {/* 4-digit passcode verification modal (mounted only when open) */}
      {passcodeGate && (
        <PasscodeModal
          mode="verify"
          isOpen={Boolean(passcodeGate)}
          roomCode={passcodeGate.roomCode}
          roomTitle={passcodeGate.roomTitle}
          currentPasscode={passcodeGate.expectedPasscode}
          onClose={() => setPasscodeGate(null)}
          onVerifySuccess={(code, verifiedPasscode) => {
            const gate = passcodeGate;
            setPasscodeGate(null);
            roomPasscodeSecretsRef.current.set(code, verifiedPasscode);
            commitEnterRoom(code, {
              title: gate.roomTitle,
              passcode: gate.expectedPasscode,
            });
            void redecryptCachedRoomMessages(code);
          }}
        />
      )}

      {/* 4-digit passcode management modal (mounted only when open) */}
      {isPasscodeManageOpen && activeRoomCode && !isViewingOfficialRoom && (
        <PasscodeModal
          mode="manage"
          isOpen={isPasscodeManageOpen}
          roomCode={activeRoomCode}
          roomTitle={activeRoomMeta?.title}
          currentPasscode={activeRoomMeta?.passcode}
          onClose={handleClosePasscodeManage}
          onSavePasscode={handleUpdateRoomPasscode}
        />
      )}

      {/* Zero-Knowledge User Report Modal (mounted only when open) */}
      {reportModalState.open && (
        <ReportModal
          isOpen={reportModalState.open}
          reporterName={profile.nickname.trim() || 'ゲスト'}
          initialTargetUser={reportModalState.targetUser}
          suggestedTargets={suggestedReportTargets}
          onClose={handleCloseReportModal}
          onSubmitReport={handleSubmitReport}
        />
      )}

      {/* Emergency Maintenance Mode Overlay (blocks general users; never shown on /admin) */}
      {isMaintenanceMode && !isCamouflaged && <MaintenanceOverlay />}

      {/* WebRTC Voice & Video Call Overlay (auto-hidden & terminated on Camouflage or Maintenance) */}
      {!isCamouflaged &&
        !isMaintenanceMode &&
        (callController.status !== 'idle' || Boolean(callController.callNotice)) && (
          <CallOverlay
            call={callController}
            roomDisplayTitle={
              activeRoomCode && !isViewingOfficialRoom
                ? getRoomDisplayTitle(activeRoomCode, activeRoomMeta?.title)
                : 'トークルーム'
            }
            onActivateCamouflage={handleActivateCamouflage}
          />
        )}

      {/* Online Mini-Games Launcher Modal & Active Game Overlay (auto-hidden & terminated on Camouflage or Maintenance) */}
      {!isCamouflaged && !isMaintenanceMode && miniGameSession.isLauncherOpen && (
        <MiniGameLauncherModal
          isOpen={miniGameSession.isLauncherOpen}
          onClose={miniGameSession.closeLauncher}
          onSelectGame={(gameId) => {
            void miniGameSession.createInvite(gameId);
          }}
        />
      )}

      {!isCamouflaged && !isMaintenanceMode && miniGameSession.activeMatch && (
        <MiniGameOverlay
          match={miniGameSession.activeMatch}
          selfPlayer={miniGameSession.selfPlayer}
          rematchPendingFromSelf={miniGameSession.rematchPendingFromSelf}
          rematchRequestedByOpponent={miniGameSession.rematchRequestedByOpponent}
          registerEventListener={miniGameSession.registerEventListener}
          sendEvent={miniGameSession.sendEvent}
          onReportMatchResult={miniGameSession.reportMatchResult}
          onRequestRematch={miniGameSession.requestRematch}
          onLeaveMatch={() => miniGameSession.leaveActiveMatch(true)}
          onTriggerCamouflage={handleActivateCamouflage}
        />
      )}

      {/* One-tap Boss Key Camouflage Calculator screen */}
      {isCamouflaged && <CamouflageCalculator onExit={handleExitCamouflage} />}
    </div>
  );
}
