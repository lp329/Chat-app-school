export type AvatarType = 'preset' | 'initial' | 'custom';

export type BubbleThemeId = 'blue' | 'line-green' | 'sky' | 'indigo' | 'rose' | 'amber';

export type CoverThemeId = 'midnight' | 'ocean' | 'forest' | 'twilight' | 'crimson' | 'slate';

export type WallpaperThemeId = 'slate' | 'midnight' | 'dots' | 'grid' | 'charcoal';

export interface UserProfile {
  id: string;
  nickname: string;
  statusMessage: string;
  avatarType: AvatarType;
  avatarValue: string;
  avatarColor: string;
  coverTheme: CoverThemeId;
  bubbleTheme: BubbleThemeId;
  wallpaperTheme: WallpaperThemeId;
}

export interface ReplyReference {
  id: string;
  sender_name: string;
  content: string;
}

export type ReactionMap = Record<string, string[]>;

export interface ChatMessage {
  id: string;
  room_code: string;
  sender_name: string;
  content: string;
  created_at: string;
  sender_id?: string | null;
  sender_avatar?: string | null;
  sender_color?: string | null;
  read_by?: string[] | null;
  image_url?: string | null;
  sticker_url?: string | null;
  reply_to?: ReplyReference | null;
  reactions?: ReactionMap | null;
  /** Raw encrypted wire strings retained locally so locked rooms can re-decrypt once unlocked */
  encrypted_content?: string | null;
  encrypted_reply_to?: string | null;
  decryption_failed?: boolean;
}

export interface RoomRecord {
  room_code: string;
  title: string;
  passcode?: string | null;
  updated_at: string;
}

export interface OnlineMember {
  userId: string;
  nickname: string;
  avatar?: string | null;
  avatarColor?: string | null;
  joinedAt: string;
  isTyping?: boolean;
}

export interface BoomComment {
  id: string;
  author_name: string;
  author_id?: string | null;
  author_avatar?: string | null;
  author_color?: string | null;
  content: string;
  created_at: string;
}

export interface BoomPost {
  id: string;
  author_name: string;
  author_id?: string | null;
  author_avatar?: string | null;
  author_color?: string | null;
  content: string;
  image_url?: string | null;
  likes: string[];
  comments: BoomComment[];
  created_at: string;
}

export interface CustomSticker {
  id: string;
  url: string;
  label?: string;
  createdAt: string;
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

export type ConnectionMode = 'supabase' | 'mock';

export type RealtimeStatus = 'idle' | 'connecting' | 'connected' | 'error' | 'mock';

export interface RoomHistoryItem {
  roomCode: string;
  title?: string;
  passcode?: string | null;
  lastMessage: string;
  lastSender: string;
  lastAt: string;
  unreadCount: number;
}

export interface RoomNotification {
  id: string;
  roomCode: string;
  roomTitle: string;
  senderName: string;
  content: string;
  createdAt: string;
  isOfficial?: boolean;
}

export interface OfficialAnnouncement {
  id: string;
  title: string;
  content: string;
  is_important: boolean;
  created_at: string;
}

export type ReportReason = 'スパム・荒らし' | '不適切な発言' | 'その他';

export type ReportStatus = 'pending' | 'reviewed' | 'resolved';

export interface UserReport {
  id: string;
  reporter_name: string;
  target_user_name: string;
  reason: ReportReason;
  details: string;
  status: ReportStatus;
  created_at: string;
}

export interface AdminSystemStats {
  totalMessages: number;
  activeEncryptedRooms: number;
  pendingReports: number;
}

export type ActiveTab = 'rooms' | 'boom' | 'profile';

export type ThemeMode = 'light' | 'dark';
