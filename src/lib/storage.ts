import {
  DEFAULT_SUPABASE_ANON_KEY,
  DEFAULT_SUPABASE_URL,
  PRESET_AVATARS,
} from './constants';
import type {
  AdminSystemStats,
  BoomComment,
  BoomPost,
  ChatMessage,
  CustomSticker,
  FeatureRequest,
  FeatureRequestStatus,
  OfficialAnnouncement,
  OnlineMember,
  ReactionMap,
  ReportStatus,
  RoomHistoryItem,
  RoomRecord,
  SupabaseConfig,
  ThemeMode,
  UserProfile,
  UserReport,
} from '../types/chat';
import type { PresenceController } from './supabaseService';

const PROFILE_KEY = 'roomline_user_profile_v1';
const ONBOARDING_COMPLETED_KEY = 'roomline_onboarding_completed_v1';
const THEME_MODE_KEY = 'roomline_theme_mode_v1';
const RECENT_ROOMS_KEY = 'roomline_recent_rooms_v1';
const CUSTOM_STICKERS_KEY = 'roomline_custom_stickers_v1';
const OFFICIAL_LAST_READ_KEY = 'roomline_official_last_read_v1';
const MOCK_MESSAGES_PREFIX = 'roomline_mock_room_v1_';
const MOCK_ROOMS_META_KEY = 'roomline_mock_rooms_meta_v2';
const MOCK_BOOM_POSTS_KEY = 'roomline_mock_boom_posts_v1';
const MOCK_OFFICIAL_ANNOUNCEMENTS_KEY = 'roomline_mock_official_announcements_v1';
const MOCK_REPORTS_KEY = 'roomline_mock_reports_v1';
const MOCK_FEATURE_REQUESTS_KEY = 'roomline_mock_feature_requests_v1';
const MOCK_MAINTENANCE_KEY = 'roomline_mock_maintenance_mode_v1';
const LEGACY_MOCK_TITLES_KEY = 'roomline_mock_room_titles_v1';
const BROADCAST_CHANNEL_NAME = 'roomline_mock_realtime_channel';

function createClientId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `user_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function getDefaultProfile(): UserProfile {
  return {
    id: createClientId(),
    nickname: '',
    statusMessage: '',
    avatarType: 'preset',
    avatarValue: PRESET_AVATARS[0].url,
    avatarColor: 'emerald',
    coverTheme: 'forest',
    bubbleTheme: 'line-green',
    wallpaperTheme: 'slate',
  };
}

export function loadThemeMode(): ThemeMode {
  try {
    const raw = localStorage.getItem(THEME_MODE_KEY);
    return raw === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function saveThemeMode(mode: ThemeMode): void {
  try {
    localStorage.setItem(THEME_MODE_KEY, mode);
  } catch {
    // Ignore storage quota errors
  }
}

export function hasCompletedOnboarding(): boolean {
  try {
    if (localStorage.getItem(ONBOARDING_COMPLETED_KEY) === 'true') {
      return true;
    }
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as Partial<UserProfile>;
    return Boolean(typeof parsed.nickname === 'string' && parsed.nickname.trim().length > 0);
  } catch {
    return false;
  }
}

export function markOnboardingCompleted(): void {
  try {
    localStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true');
  } catch {
    // Ignore quota errors gracefully
  }
}

export function loadUserProfile(): UserProfile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return getDefaultProfile();
    const parsed = JSON.parse(raw) as Partial<UserProfile>;
    const defaults = getDefaultProfile();
    return {
      ...defaults,
      ...parsed,
      id: parsed.id || defaults.id,
    };
  } catch {
    return getDefaultProfile();
  }
}

export function saveUserProfile(profile: UserProfile): void {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // Ignore quota errors gracefully
  }
}

export function loadSupabaseConfig(): {
  config: SupabaseConfig;
  source: 'env' | 'none';
} {
  if (DEFAULT_SUPABASE_URL && DEFAULT_SUPABASE_ANON_KEY) {
    return {
      config: { url: DEFAULT_SUPABASE_URL, anonKey: DEFAULT_SUPABASE_ANON_KEY },
      source: 'env',
    };
  }

  return { config: { url: '', anonKey: '' }, source: 'none' };
}

// --- Recent Rooms History Persistence ---

export function loadRecentRooms(): RoomHistoryItem[] {
  try {
    const raw = localStorage.getItem(RECENT_ROOMS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item: Partial<RoomHistoryItem>) => ({
        roomCode: String(item.roomCode || ''),
        title: typeof item.title === 'string' ? item.title : '',
        passcode: typeof item.passcode === 'string' ? item.passcode : null,
        lastMessage: String(item.lastMessage || ''),
        lastSender: String(item.lastSender || ''),
        lastAt: String(item.lastAt || new Date().toISOString()),
        unreadCount: typeof item.unreadCount === 'number' ? Math.max(0, item.unreadCount) : 0,
      }))
      .filter((item) => item.roomCode.length === 6);
  } catch {
    return [];
  }
}

export function saveRecentRooms(rooms: RoomHistoryItem[]): void {
  try {
    localStorage.setItem(RECENT_ROOMS_KEY, JSON.stringify(rooms.slice(0, 20)));
  } catch {
    // Ignore quota errors
  }
}

// --- Custom My Stickers Persistence (localStorage) ---

export function loadCustomStickers(): CustomSticker[] {
  try {
    const raw = localStorage.getItem(CUSTOM_STICKERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is CustomSticker =>
        Boolean(item && typeof item.id === 'string' && typeof item.url === 'string')
    );
  } catch {
    return [];
  }
}

export function saveCustomStickers(stickers: CustomSticker[]): void {
  try {
    localStorage.setItem(CUSTOM_STICKERS_KEY, JSON.stringify(stickers.slice(0, 30)));
  } catch {
    // Ignore quota errors
  }
}

// --- Local Mock Rooms Metadata (title + passcode) ---

export function loadMockRoomsMeta(): Record<string, RoomRecord> {
  const result: Record<string, RoomRecord> = {};
  try {
    const legacyRaw = localStorage.getItem(LEGACY_MOCK_TITLES_KEY);
    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw) as Record<string, string>;
      Object.entries(legacy).forEach(([code, title]) => {
        result[code] = {
          room_code: code,
          title: title || '',
          passcode: null,
          updated_at: new Date().toISOString(),
        };
      });
    }
    const raw = localStorage.getItem(MOCK_ROOMS_META_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, RoomRecord>;
      Object.entries(parsed).forEach(([code, rec]) => {
        result[code] = rec;
      });
    }
  } catch {
    // Ignore
  }
  return result;
}

export function getMockRoomMeta(roomCode: string): RoomRecord | null {
  const all = loadMockRoomsMeta();
  return all[roomCode] || null;
}

export function saveMockRoomMeta(
  roomCode: string,
  patch: { title?: string; passcode?: string | null }
): RoomRecord {
  const all = loadMockRoomsMeta();
  const prev = all[roomCode] || {
    room_code: roomCode,
    title: '',
    passcode: null,
    updated_at: new Date().toISOString(),
  };

  const nextRecord: RoomRecord = {
    room_code: roomCode,
    title: patch.title !== undefined ? patch.title.trim() : prev.title,
    passcode: patch.passcode !== undefined ? patch.passcode : prev.passcode ?? null,
    updated_at: new Date().toISOString(),
  };

  all[roomCode] = nextRecord;
  try {
    localStorage.setItem(MOCK_ROOMS_META_KEY, JSON.stringify(all));
  } catch {
    // Ignore
  }
  broadcastMockEvent({ type: 'MOCK_ROOM_UPDATE', room: nextRecord });
  return nextRecord;
}

// --- Local Mock Messages (Insert, Update ReadBy, Delete) ---

export function loadMockMessages(roomCode: string): ChatMessage[] {
  try {
    const raw = localStorage.getItem(`${MOCK_MESSAGES_PREFIX}${roomCode}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatMessage[];
    if (!Array.isArray(parsed)) return [];
    return parsed.sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  } catch {
    return [];
  }
}

export function appendMockMessage(roomCode: string, message: ChatMessage): ChatMessage[] {
  const existing = loadMockMessages(roomCode);
  if (existing.some((m) => m.id === message.id)) {
    return existing;
  }
  const next = [...existing, message].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  try {
    localStorage.setItem(`${MOCK_MESSAGES_PREFIX}${roomCode}`, JSON.stringify(next));
  } catch {
    // Ignore
  }
  broadcastMockEvent({ type: 'MOCK_INSERT', message });
  return next;
}

export function updateMockMessageReadBy(
  roomCode: string,
  messageId: string,
  readerName: string
): ChatMessage | null {
  const existing = loadMockMessages(roomCode);
  let updatedMsg: ChatMessage | null = null;
  const next = existing.map((m) => {
    if (m.id !== messageId) return m;
    const currentReadBy = Array.isArray(m.read_by) ? m.read_by : [];
    if (currentReadBy.includes(readerName)) {
      updatedMsg = m;
      return m;
    }
    updatedMsg = { ...m, read_by: [...currentReadBy, readerName] };
    return updatedMsg;
  });

  if (updatedMsg) {
    try {
      localStorage.setItem(`${MOCK_MESSAGES_PREFIX}${roomCode}`, JSON.stringify(next));
    } catch {
      // Ignore
    }
    broadcastMockEvent({ type: 'MOCK_UPDATE', message: updatedMsg });
  }
  return updatedMsg;
}

export function updateMockMessageReactions(
  roomCode: string,
  messageId: string,
  reactions: ReactionMap
): ChatMessage | null {
  const existing = loadMockMessages(roomCode);
  let updatedMsg: ChatMessage | null = null;
  const next = existing.map((m) => {
    if (m.id !== messageId) return m;
    updatedMsg = { ...m, reactions };
    return updatedMsg;
  });

  if (updatedMsg) {
    try {
      localStorage.setItem(`${MOCK_MESSAGES_PREFIX}${roomCode}`, JSON.stringify(next));
    } catch {
      // Ignore
    }
    broadcastMockEvent({ type: 'MOCK_UPDATE', message: updatedMsg });
  }
  return updatedMsg;
}

export function deleteMockMessage(roomCode: string, messageId: string): void {
  const existing = loadMockMessages(roomCode);
  const next = existing.filter((m) => m.id !== messageId);
  try {
    localStorage.setItem(`${MOCK_MESSAGES_PREFIX}${roomCode}`, JSON.stringify(next));
  } catch {
    // Ignore
  }
  broadcastMockEvent({ type: 'MOCK_DELETE', roomCode, messageId });
}

// --- Local Mock BOOM Posts ---

function getInitialMockBoomPosts(): BoomPost[] {
  const now = Date.now();
  return [
    {
      id: 'mock_boom_welcome_1',
      author_name: 'ミキ',
      author_id: 'peer_miki',
      author_avatar: PRESET_AVATARS[1].url,
      author_color: 'indigo',
      content:
        'RoomLine の BOOM タイムラインへようこそ！\n日々のちょっとした出来事や写真をシェアしたり、いいね・コメントでリアクションできます。',
      image_url: null,
      likes: ['レン', 'はるき'],
      comments: [
        {
          id: 'mock_comment_1',
          author_name: 'レン',
          author_id: 'peer_ren',
          author_avatar: PRESET_AVATARS[2].url,
          author_color: 'sky',
          content: 'リアルタイム同期されるので別タブでも即反映されますね！',
          created_at: new Date(now - 1000 * 60 * 12).toISOString(),
        },
      ],
      created_at: new Date(now - 1000 * 60 * 28).toISOString(),
    },
    {
      id: 'mock_boom_coffee_2',
      author_name: 'レン',
      author_id: 'peer_ren',
      author_avatar: PRESET_AVATARS[2].url,
      author_color: 'sky',
      content: '夜作業のお供にハンドドリップ珈琲を淹れました。みんな今日も一日おつかれさま！',
      image_url: PRESET_AVATARS[3].url,
      likes: ['ミキ'],
      comments: [],
      created_at: new Date(now - 1000 * 60 * 75).toISOString(),
    },
  ];
}

export function loadMockBoomPosts(): BoomPost[] {
  try {
    const raw = localStorage.getItem(MOCK_BOOM_POSTS_KEY);
    if (!raw) {
      const seeded = getInitialMockBoomPosts();
      localStorage.setItem(MOCK_BOOM_POSTS_KEY, JSON.stringify(seeded));
      return seeded;
    }
    const parsed = JSON.parse(raw) as BoomPost[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((p) => ({
        ...p,
        likes: Array.isArray(p.likes) ? p.likes : [],
        comments: Array.isArray(p.comments) ? p.comments : [],
      }))
      .sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
  } catch {
    return [];
  }
}

function persistMockBoomPosts(posts: BoomPost[]): void {
  try {
    localStorage.setItem(MOCK_BOOM_POSTS_KEY, JSON.stringify(posts.slice(0, 60)));
  } catch {
    // Ignore
  }
}

export function createMockBoomPost(post: BoomPost): BoomPost {
  const existing = loadMockBoomPosts();
  const next = [post, ...existing.filter((p) => p.id !== post.id)];
  persistMockBoomPosts(next);
  broadcastMockEvent({ type: 'MOCK_BOOM_INSERT', post });
  return post;
}

export function updateMockBoomPost(
  postId: string,
  updater: (post: BoomPost) => BoomPost
): BoomPost | null {
  const existing = loadMockBoomPosts();
  let updated: BoomPost | null = null;
  const next = existing.map((p) => {
    if (p.id !== postId) return p;
    updated = updater(p);
    return updated;
  });
  if (updated) {
    persistMockBoomPosts(next);
    broadcastMockEvent({ type: 'MOCK_BOOM_UPDATE', post: updated });
  }
  return updated;
}

export function addMockBoomComment(
  postId: string,
  comment: BoomComment
): BoomPost | null {
  return updateMockBoomPost(postId, (post) => ({
    ...post,
    comments: [...post.comments, comment],
  }));
}

export function deleteMockBoomPost(postId: string): void {
  const existing = loadMockBoomPosts();
  const next = existing.filter((p) => p.id !== postId);
  persistMockBoomPosts(next);
  broadcastMockEvent({ type: 'MOCK_BOOM_DELETE', postId });
}

// --- Official Last Read Tracking ---

export function loadOfficialLastReadAt(): string | null {
  try {
    return localStorage.getItem(OFFICIAL_LAST_READ_KEY);
  } catch {
    return null;
  }
}

export function saveOfficialLastReadAt(isoString: string): void {
  try {
    localStorage.setItem(OFFICIAL_LAST_READ_KEY, isoString);
  } catch {
    // Ignore
  }
}

// --- Local Mock Official Announcements ---

function getInitialMockAnnouncements(): OfficialAnnouncement[] {
  return [
    {
      id: 'official_welcome_zk_1',
      title: 'ROOMLINE公式アカウントへようこそ',
      content:
        'RoomLineをご利用いただきありがとうございます。\nすべてのトークルームはゼロ知識セキュリティ（SHA-256ハッシュ化＋AES-256-GCMエンドツーエンド暗号化）で保護されています。\n今後、メンテナンス情報や重要なお知らせはこの公式チャットへ配信されます。',
      is_important: false,
      created_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    },
  ];
}

export function loadMockAnnouncements(): OfficialAnnouncement[] {
  try {
    const raw = localStorage.getItem(MOCK_OFFICIAL_ANNOUNCEMENTS_KEY);
    if (!raw) {
      const seeded = getInitialMockAnnouncements();
      localStorage.setItem(MOCK_OFFICIAL_ANNOUNCEMENTS_KEY, JSON.stringify(seeded));
      return seeded;
    }
    const parsed = JSON.parse(raw) as OfficialAnnouncement[];
    if (!Array.isArray(parsed)) return [];
    return parsed.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  } catch {
    return [];
  }
}

export function createMockAnnouncement(item: OfficialAnnouncement): OfficialAnnouncement {
  const existing = loadMockAnnouncements();
  const next = [item, ...existing.filter((a) => a.id !== item.id)];
  try {
    localStorage.setItem(MOCK_OFFICIAL_ANNOUNCEMENTS_KEY, JSON.stringify(next));
  } catch {
    // Ignore
  }
  broadcastMockEvent({ type: 'MOCK_ANNOUNCEMENT_INSERT', announcement: item });
  return item;
}

export function deleteMockAnnouncement(announcementId: string): void {
  const existing = loadMockAnnouncements();
  const next = existing.filter((a) => a.id !== announcementId);
  try {
    localStorage.setItem(MOCK_OFFICIAL_ANNOUNCEMENTS_KEY, JSON.stringify(next));
  } catch {
    // Ignore
  }
  broadcastMockEvent({ type: 'MOCK_ANNOUNCEMENT_DELETE', announcementId });
}

// --- Local Mock Reports ---

export function loadMockReports(): UserReport[] {
  try {
    const raw = localStorage.getItem(MOCK_REPORTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as UserReport[];
    if (!Array.isArray(parsed)) return [];
    return parsed.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  } catch {
    return [];
  }
}

export function createMockReport(report: UserReport): UserReport {
  const existing = loadMockReports();
  const next = [report, ...existing.filter((r) => r.id !== report.id)];
  try {
    localStorage.setItem(MOCK_REPORTS_KEY, JSON.stringify(next));
  } catch {
    // Ignore
  }
  broadcastMockEvent({ type: 'MOCK_REPORT_INSERT', report });
  return report;
}

export function updateMockReportStatus(
  reportId: string,
  status: ReportStatus
): UserReport | null {
  const existing = loadMockReports();
  let updated: UserReport | null = null;
  const next = existing.map((r) => {
    if (r.id !== reportId) return r;
    updated = { ...r, status };
    return updated;
  });
  if (updated) {
    try {
      localStorage.setItem(MOCK_REPORTS_KEY, JSON.stringify(next));
    } catch {
      // Ignore
    }
    broadcastMockEvent({ type: 'MOCK_REPORT_UPDATE', report: updated });
  }
  return updated;
}

export function deleteMockReport(reportId: string): void {
  const existing = loadMockReports();
  const next = existing.filter((r) => r.id !== reportId);
  try {
    localStorage.setItem(MOCK_REPORTS_KEY, JSON.stringify(next));
  } catch {
    // Ignore
  }
  broadcastMockEvent({ type: 'MOCK_REPORT_DELETE', reportId });
}

// --- Local Mock Feature Requests (`feature_requests`) ---

function getInitialMockFeatureRequests(): FeatureRequest[] {
  const now = Date.now();
  return [
    {
      id: 'mock_feat_search_1',
      title: 'トークルーム内のキーワード検索機能',
      description: '過去のメッセージから特定の言葉や日付ですぐに探せるようにしてほしいです。',
      author_name: 'ミキ',
      votes: 5,
      voted_user_ids: ['seed_u1', 'seed_u2', 'seed_u3', 'seed_u4', 'seed_u5'],
      status: '開発中',
      created_at: new Date(now - 1000 * 60 * 60 * 5).toISOString(),
    },
    {
      id: 'mock_feat_pin_2',
      title: '大事なメッセージをルーム上部にピン留めしたい',
      description: '待ち合わせ場所や日程調整の連絡を見失わないようにピン留めできると嬉しいです。',
      author_name: 'レン',
      votes: 3,
      voted_user_ids: ['seed_u1', 'seed_u2', 'seed_u3'],
      status: '検討中',
      created_at: new Date(now - 1000 * 60 * 60 * 14).toISOString(),
    },
  ];
}

export function loadMockFeatureRequests(): FeatureRequest[] {
  try {
    const raw = localStorage.getItem(MOCK_FEATURE_REQUESTS_KEY);
    if (!raw) {
      const seeded = getInitialMockFeatureRequests();
      localStorage.setItem(MOCK_FEATURE_REQUESTS_KEY, JSON.stringify(seeded));
      return seeded;
    }
    const parsed = JSON.parse(raw) as FeatureRequest[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        const votedIds = Array.isArray(item.voted_user_ids)
          ? item.voted_user_ids.filter((v): v is string => typeof v === 'string')
          : [];
        const status: FeatureRequestStatus =
          item.status === '開発中' || item.status === '実装済み' ? item.status : '検討中';
        return {
          ...item,
          description: typeof item.description === 'string' ? item.description : '',
          author_name: typeof item.author_name === 'string' ? item.author_name : '匿名',
          voted_user_ids: votedIds,
          votes: typeof item.votes === 'number' ? item.votes : votedIds.length,
          status,
        };
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  } catch {
    return [];
  }
}

export function createMockFeatureRequest(item: FeatureRequest): FeatureRequest {
  const existing = loadMockFeatureRequests();
  const next = [item, ...existing.filter((r) => r.id !== item.id)];
  try {
    localStorage.setItem(MOCK_FEATURE_REQUESTS_KEY, JSON.stringify(next));
  } catch {
    // Ignore
  }
  broadcastMockEvent({ type: 'MOCK_FEATURE_REQUEST_INSERT', request: item });
  return item;
}

export function updateMockFeatureRequest(
  requestId: string,
  updater: (req: FeatureRequest) => FeatureRequest
): FeatureRequest | null {
  const existing = loadMockFeatureRequests();
  let updated: FeatureRequest | null = null;
  const next = existing.map((r) => {
    if (r.id !== requestId) return r;
    updated = updater(r);
    return updated;
  });
  if (updated) {
    try {
      localStorage.setItem(MOCK_FEATURE_REQUESTS_KEY, JSON.stringify(next));
    } catch {
      // Ignore
    }
    broadcastMockEvent({ type: 'MOCK_FEATURE_REQUEST_UPDATE', request: updated });
  }
  return updated;
}

export function deleteMockFeatureRequest(requestId: string): void {
  const existing = loadMockFeatureRequests();
  const next = existing.filter((r) => r.id !== requestId);
  try {
    localStorage.setItem(MOCK_FEATURE_REQUESTS_KEY, JSON.stringify(next));
  } catch {
    // Ignore
  }
  broadcastMockEvent({ type: 'MOCK_FEATURE_REQUEST_DELETE', requestId });
}

// --- Local Mock Maintenance Mode & Admin Stats / Purge ---

export function loadMockMaintenanceMode(): boolean {
  try {
    return localStorage.getItem(MOCK_MAINTENANCE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function saveMockMaintenanceMode(enabled: boolean): void {
  try {
    localStorage.setItem(MOCK_MAINTENANCE_KEY, enabled ? 'true' : 'false');
  } catch {
    // Ignore
  }
  broadcastMockEvent({ type: 'MOCK_MAINTENANCE_UPDATE', enabled });
}

export function loadMockAdminStats(): AdminSystemStats {
  let totalMessages = 0;
  const roomSet = new Set<string>();

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(MOCK_MESSAGES_PREFIX)) {
        const code = key.slice(MOCK_MESSAGES_PREFIX.length);
        const list = loadMockMessages(code);
        if (list.length > 0) {
          totalMessages += list.length;
          roomSet.add(code);
        }
      }
    }
    Object.keys(loadMockRoomsMeta()).forEach((code) => roomSet.add(code));
  } catch {
    // Ignore
  }

  const pendingReports = loadMockReports().filter((r) => r.status === 'pending').length;

  return {
    totalMessages,
    activeEncryptedRooms: roomSet.size,
    pendingReports,
  };
}

export function purgeOldMockMessages(olderThanHours = 24): number {
  const cutoffMs = Date.now() - olderThanHours * 60 * 60 * 1000;
  let deletedCount = 0;

  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(MOCK_MESSAGES_PREFIX)) {
        keys.push(key);
      }
    }
    keys.forEach((key) => {
      const code = key.slice(MOCK_MESSAGES_PREFIX.length);
      const list = loadMockMessages(code);
      const kept = list.filter((m) => new Date(m.created_at).getTime() >= cutoffMs);
      const removed = list.length - kept.length;
      if (removed > 0) {
        deletedCount += removed;
        localStorage.setItem(key, JSON.stringify(kept));
      }
    });
  } catch {
    // Ignore
  }

  return deletedCount;
}

type MockBroadcastPayload =
  | { type: 'MOCK_INSERT'; message: ChatMessage }
  | { type: 'MOCK_UPDATE'; message: ChatMessage }
  | { type: 'MOCK_DELETE'; roomCode: string; messageId: string }
  | { type: 'MOCK_ROOM_UPDATE'; room: RoomRecord }
  | { type: 'MOCK_PRESENCE_PING'; roomCode: string; member: OnlineMember }
  | { type: 'MOCK_PRESENCE_LEAVE'; roomCode: string; userId: string }
  | { type: 'MOCK_BOOM_INSERT'; post: BoomPost }
  | { type: 'MOCK_BOOM_UPDATE'; post: BoomPost }
  | { type: 'MOCK_BOOM_DELETE'; postId: string }
  | { type: 'MOCK_ANNOUNCEMENT_INSERT'; announcement: OfficialAnnouncement }
  | { type: 'MOCK_ANNOUNCEMENT_DELETE'; announcementId: string }
  | { type: 'MOCK_REPORT_INSERT'; report: UserReport }
  | { type: 'MOCK_REPORT_UPDATE'; report: UserReport }
  | { type: 'MOCK_REPORT_DELETE'; reportId: string }
  | { type: 'MOCK_FEATURE_REQUEST_INSERT'; request: FeatureRequest }
  | { type: 'MOCK_FEATURE_REQUEST_UPDATE'; request: FeatureRequest }
  | { type: 'MOCK_FEATURE_REQUEST_DELETE'; requestId: string }
  | { type: 'MOCK_MAINTENANCE_UPDATE'; enabled: boolean };

function broadcastMockEvent(payload: MockBroadcastPayload): void {
  if (typeof BroadcastChannel === 'undefined') return;
  try {
    const channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
    channel.postMessage(payload);
    channel.close();
  } catch {
    // Ignore BroadcastChannel errors
  }
}

export function subscribeToAllMockEvents(handlers: {
  onMessageInsert?: (message: ChatMessage) => void;
  onMessageUpdate?: (message: ChatMessage) => void;
  onMessageDelete?: (messageId: string, roomCode?: string) => void;
  onRoomUpdate?: (room: RoomRecord) => void;
  onBoomInsert?: (post: BoomPost) => void;
  onBoomUpdate?: (post: BoomPost) => void;
  onBoomDelete?: (postId: string) => void;
  onAnnouncementInsert?: (announcement: OfficialAnnouncement) => void;
  onAnnouncementDelete?: (announcementId: string) => void;
  onReportInsert?: (report: UserReport) => void;
  onReportUpdate?: (report: UserReport) => void;
  onReportDelete?: (reportId: string) => void;
  onFeatureRequestInsert?: (request: FeatureRequest) => void;
  onFeatureRequestUpdate?: (request: FeatureRequest) => void;
  onFeatureRequestDelete?: (requestId: string) => void;
  onMaintenanceUpdate?: (enabled: boolean) => void;
}): () => void {
  let channel: BroadcastChannel | null = null;
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      channel.onmessage = (event) => {
        const data = event.data as MockBroadcastPayload | null;
        if (!data) return;
        if (data.type === 'MOCK_INSERT' && data.message) {
          handlers.onMessageInsert?.(data.message);
        } else if (data.type === 'MOCK_UPDATE' && data.message) {
          handlers.onMessageUpdate?.(data.message);
        } else if (data.type === 'MOCK_DELETE' && data.messageId) {
          handlers.onMessageDelete?.(data.messageId, data.roomCode);
        } else if (data.type === 'MOCK_ROOM_UPDATE' && data.room) {
          handlers.onRoomUpdate?.(data.room);
        } else if (data.type === 'MOCK_BOOM_INSERT' && data.post) {
          handlers.onBoomInsert?.(data.post);
        } else if (data.type === 'MOCK_BOOM_UPDATE' && data.post) {
          handlers.onBoomUpdate?.(data.post);
        } else if (data.type === 'MOCK_BOOM_DELETE' && data.postId) {
          handlers.onBoomDelete?.(data.postId);
        } else if (data.type === 'MOCK_ANNOUNCEMENT_INSERT' && data.announcement) {
          handlers.onAnnouncementInsert?.(data.announcement);
        } else if (data.type === 'MOCK_ANNOUNCEMENT_DELETE' && data.announcementId) {
          handlers.onAnnouncementDelete?.(data.announcementId);
        } else if (data.type === 'MOCK_REPORT_INSERT' && data.report) {
          handlers.onReportInsert?.(data.report);
        } else if (data.type === 'MOCK_REPORT_UPDATE' && data.report) {
          handlers.onReportUpdate?.(data.report);
        } else if (data.type === 'MOCK_REPORT_DELETE' && data.reportId) {
          handlers.onReportDelete?.(data.reportId);
        } else if (data.type === 'MOCK_FEATURE_REQUEST_INSERT' && data.request) {
          handlers.onFeatureRequestInsert?.(data.request);
        } else if (data.type === 'MOCK_FEATURE_REQUEST_UPDATE' && data.request) {
          handlers.onFeatureRequestUpdate?.(data.request);
        } else if (data.type === 'MOCK_FEATURE_REQUEST_DELETE' && data.requestId) {
          handlers.onFeatureRequestDelete?.(data.requestId);
        } else if (data.type === 'MOCK_MAINTENANCE_UPDATE') {
          handlers.onMaintenanceUpdate?.(Boolean(data.enabled));
        }
      };
    } catch {
      channel = null;
    }
  }

  return () => {
    if (channel) {
      channel.close();
    }
  };
}

// Local Mock Presence across tabs for the active room (supports isTyping)
export function subscribeToMockPresence(
  roomCode: string,
  selfMember: OnlineMember,
  onPresenceChange: (members: OnlineMember[]) => void
): PresenceController {
  let currentSelf: OnlineMember = { ...selfMember, isTyping: false };
  const peers = new Map<string, { member: OnlineMember; lastSeen: number }>();
  peers.set(currentSelf.userId, { member: currentSelf, lastSeen: Date.now() });

  const emitList = () => {
    const now = Date.now();
    peers.forEach((entry, key) => {
      if (key !== currentSelf.userId && now - entry.lastSeen > 12000) {
        peers.delete(key);
      }
    });
    onPresenceChange(Array.from(peers.values()).map((v) => v.member));
  };

  emitList();

  let channel: BroadcastChannel | null = null;
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      channel.onmessage = (event) => {
        const data = event.data as MockBroadcastPayload | null;
        if (!data) return;
        if (data.type === 'MOCK_PRESENCE_PING' && data.roomCode === roomCode) {
          const isNew = !peers.has(data.member.userId);
          peers.set(data.member.userId, {
            member: data.member,
            lastSeen: Date.now(),
          });
          emitList();
          if (isNew && data.member.userId !== currentSelf.userId) {
            channel?.postMessage({
              type: 'MOCK_PRESENCE_PING',
              roomCode,
              member: currentSelf,
            });
          }
        } else if (data.type === 'MOCK_PRESENCE_LEAVE' && data.roomCode === roomCode) {
          peers.delete(data.userId);
          emitList();
        }
      };
      channel.postMessage({
        type: 'MOCK_PRESENCE_PING',
        roomCode,
        member: currentSelf,
      });
    } catch {
      channel = null;
    }
  }

  const intervalId = window.setInterval(() => {
    peers.set(currentSelf.userId, { member: currentSelf, lastSeen: Date.now() });
    channel?.postMessage({
      type: 'MOCK_PRESENCE_PING',
      roomCode,
      member: currentSelf,
    });
    emitList();
  }, 5000);

  let lastTypingTrueSentAt = 0;
  const TYPING_TRUE_THROTTLE_MS = 1500;

  return {
    updateTyping: (isTyping: boolean) => {
      const now = Date.now();
      if (isTyping) {
        if (
          Boolean(currentSelf.isTyping) ||
          now - lastTypingTrueSentAt < TYPING_TRUE_THROTTLE_MS
        ) {
          return;
        }
        lastTypingTrueSentAt = now;
      } else if (!currentSelf.isTyping) {
        return;
      }
      currentSelf = { ...currentSelf, isTyping };
      peers.set(currentSelf.userId, { member: currentSelf, lastSeen: Date.now() });
      channel?.postMessage({
        type: 'MOCK_PRESENCE_PING',
        roomCode,
        member: currentSelf,
      });
      emitList();
    },
    unsubscribe: () => {
      window.clearInterval(intervalId);
      channel?.postMessage({
        type: 'MOCK_PRESENCE_LEAVE',
        roomCode,
        userId: currentSelf.userId,
      });
      channel?.close();
    },
  };
}

// Helper to convert an image File into a compact Data URL for local mock mode
export function fileToCompactDataUrl(
  file: File,
  maxDimension = 1080,
  preservePngTransparency = false
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(maxDimension / img.width, maxDimension / img.height, 1);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        if (preservePngTransparency && file.type === 'image/png') {
          resolve(canvas.toDataURL('image/png'));
        } else {
          resolve(canvas.toDataURL('image/jpeg', 0.84));
        }
      };
      img.onerror = () => reject(new Error('画像の読み込みに失敗しました'));
      img.src = String(reader.result);
    };
    reader.onerror = () => reject(new Error('ファイルの読み込みに失敗しました'));
    reader.readAsDataURL(file);
  });
}
