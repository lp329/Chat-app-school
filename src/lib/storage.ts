import {
  DEFAULT_SUPABASE_ANON_KEY,
  DEFAULT_SUPABASE_URL,
  PRESET_AVATARS,
} from './constants';
import type {
  ChatMessage,
  RoomHistoryItem,
  SupabaseConfig,
  UserProfile,
} from '../types/chat';

const PROFILE_KEY = 'roomline_user_profile_v1';
const SUPABASE_CONFIG_KEY = 'roomline_supabase_config_v1';
const RECENT_ROOMS_KEY = 'roomline_recent_rooms_v1';
const MOCK_MESSAGES_PREFIX = 'roomline_mock_room_v1_';
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
    statusMessage: 'ルーム番号でいつでもトークできます',
    avatarType: 'preset',
    avatarValue: PRESET_AVATARS[0].url,
    avatarColor: 'blue',
    coverTheme: 'midnight',
    bubbleTheme: 'blue',
    wallpaperTheme: 'slate',
  };
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
  source: 'localStorage' | 'env' | 'none';
} {
  try {
    const raw = localStorage.getItem(SUPABASE_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SupabaseConfig>;
      const url = (parsed.url || '').trim();
      const anonKey = (parsed.anonKey || '').trim();
      if (url && anonKey) {
        return { config: { url, anonKey }, source: 'localStorage' };
      }
    }
  } catch {
    // Fall through to env check
  }

  if (DEFAULT_SUPABASE_URL && DEFAULT_SUPABASE_ANON_KEY) {
    return {
      config: { url: DEFAULT_SUPABASE_URL, anonKey: DEFAULT_SUPABASE_ANON_KEY },
      source: 'env',
    };
  }

  return { config: { url: '', anonKey: '' }, source: 'none' };
}

export function saveSupabaseConfig(config: SupabaseConfig): void {
  const cleaned: SupabaseConfig = {
    url: config.url.trim(),
    anonKey: config.anonKey.trim(),
  };
  if (!cleaned.url || !cleaned.anonKey) {
    localStorage.removeItem(SUPABASE_CONFIG_KEY);
    return;
  }
  localStorage.setItem(SUPABASE_CONFIG_KEY, JSON.stringify(cleaned));
}

export function clearSupabaseConfig(): void {
  localStorage.removeItem(SUPABASE_CONFIG_KEY);
}

export function loadRecentRooms(): RoomHistoryItem[] {
  try {
    const raw = localStorage.getItem(RECENT_ROOMS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function upsertRecentRoom(item: RoomHistoryItem): RoomHistoryItem[] {
  const current = loadRecentRooms().filter((r) => r.roomCode !== item.roomCode);
  const next = [item, ...current].slice(0, 15);
  try {
    localStorage.setItem(RECENT_ROOMS_KEY, JSON.stringify(next));
  } catch {
    // Ignore
  }
  return next;
}

export function removeRecentRoom(roomCode: string): RoomHistoryItem[] {
  const next = loadRecentRooms().filter((r) => r.roomCode !== roomCode);
  try {
    localStorage.setItem(RECENT_ROOMS_KEY, JSON.stringify(next));
  } catch {
    // Ignore
  }
  return next;
}

// --- Local Mock Room Storage + BroadcastChannel Realtime ---

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
  broadcastMockMessage(message);
  return next;
}

export function broadcastMockMessage(message: ChatMessage): void {
  if (typeof BroadcastChannel === 'undefined') return;
  try {
    const channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
    channel.postMessage({ type: 'MOCK_INSERT', message });
    channel.close();
  } catch {
    // Ignore BroadcastChannel errors
  }
}

export function subscribeToMockRoom(
  roomCode: string,
  onInsert: (message: ChatMessage) => void
): () => void {
  const handleStorage = (event: StorageEvent) => {
    if (event.key !== `${MOCK_MESSAGES_PREFIX}${roomCode}` || !event.newValue) return;
    try {
      const list = JSON.parse(event.newValue) as ChatMessage[];
      const latest = list[list.length - 1];
      if (latest) onInsert(latest);
    } catch {
      // Ignore
    }
  };

  window.addEventListener('storage', handleStorage);

  let channel: BroadcastChannel | null = null;
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      channel.onmessage = (event) => {
        const data = event.data as { type?: string; message?: ChatMessage } | null;
        if (data?.type === 'MOCK_INSERT' && data.message?.room_code === roomCode) {
          onInsert(data.message);
        }
      };
    } catch {
      channel = null;
    }
  }

  return () => {
    window.removeEventListener('storage', handleStorage);
    if (channel) {
      channel.close();
    }
  };
}
