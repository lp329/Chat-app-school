export type AvatarType = 'preset' | 'initial' | 'custom';

export type BubbleThemeId = 'blue' | 'line-green' | 'sky' | 'indigo' | 'rose' | 'amber';

export type CoverThemeId = 'midnight' | 'ocean' | 'forest' | 'twilight' | 'crimson' | 'slate';

export type WallpaperThemeId = 'slate' | 'midnight' | 'dots' | 'grid' | 'charcoal';

export interface UserProfile {
  id: string;
  nickname: string;
  statusMessage: string;
  avatarType: AvatarType;
  avatarValue: string; // preset image URL or base64 data URL (for custom) or initial text
  avatarColor: string; // hex/tailwind class key for initial avatars
  coverTheme: CoverThemeId;
  bubbleTheme: BubbleThemeId;
  wallpaperTheme: WallpaperThemeId;
}

export interface ChatMessage {
  id: string;
  room_code: string;
  sender_name: string;
  content: string;
  created_at: string;
  sender_id?: string | null;
  sender_avatar?: string | null;
  sender_color?: string | null;
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

export type ConnectionMode = 'supabase' | 'mock';

export type RealtimeStatus = 'idle' | 'connecting' | 'connected' | 'error' | 'mock';

export interface RoomHistoryItem {
  roomCode: string;
  lastMessage: string;
  lastSender: string;
  lastAt: string;
}

export type ActiveTab = 'rooms' | 'profile';
