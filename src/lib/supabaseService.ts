import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SYSTEM_MAINTENANCE_ROOM_KEY } from './constants';
import type {
  AdminSystemStats,
  BoomComment,
  BoomPost,
  OfficialAnnouncement,
  OnlineMember,
  ReactionMap,
  RealtimeStatus,
  ReportReason,
  ReportStatus,
  RoomRecord,
  SupabaseConfig,
  UserReport,
} from '../types/chat';

let cachedClient: SupabaseClient | null = null;
let cachedKey = '';
let supportsExtendedColumns: boolean | null = null;

const CHAT_IMAGES_BUCKET = 'CHAT-IMAGES';

export interface RawDbMessage {
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
  reply_to?: unknown;
  reactions?: unknown;
}

export interface PresenceController {
  updateTyping: (isTyping: boolean) => void;
  unsubscribe: () => void;
}

export function normalizeReactionsMap(raw: unknown): ReactionMap {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }
  const result: ReactionMap = {};
  Object.entries(raw as Record<string, unknown>).forEach(([emoji, users]) => {
    if (!emoji || !Array.isArray(users)) return;
    const cleaned = Array.from(
      new Set(users.filter((u): u is string => typeof u === 'string' && u.trim().length > 0))
    );
    if (cleaned.length > 0) {
      result[emoji] = cleaned;
    }
  });
  return result;
}

export function getSupabaseClient(config: SupabaseConfig): SupabaseClient | null {
  const url = config.url.trim();
  const anonKey = config.anonKey.trim();
  if (!url || !anonKey) return null;

  const cacheSignature = `${url}::${anonKey}`;
  if (cachedClient && cachedKey === cacheSignature) {
    return cachedClient;
  }

  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
      return null;
    }

    cachedClient = createClient(url, anonKey, {
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
    cachedKey = cacheSignature;
    supportsExtendedColumns = null;
    return cachedClient;
  } catch {
    return null;
  }
}



// --- Chat Messages (All room_code params MUST be SHA-256 hashed room IDs) ---

export async function fetchRoomMessagesFromSupabase(
  config: SupabaseConfig,
  hashedRoomCode: string
): Promise<{ data: RawDbMessage[]; error: string | null }> {
  const client = getSupabaseClient(config);
  if (!client) {
    return { data: [], error: 'Supabase設定が無効です。' };
  }

  const { data, error } = await client
    .from('messages')
    .select('*')
    .eq('room_code', hashedRoomCode)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    return { data: [], error: error.message };
  }

  const rows = Array.isArray(data) ? [...(data as RawDbMessage[])].reverse() : [];
  return { data: rows, error: null };
}

export async function fetchRoomsMetadataFromSupabase(
  config: SupabaseConfig,
  hashedRoomCodes: string[]
): Promise<{ data: RoomRecord[]; error: string | null }> {
  if (hashedRoomCodes.length === 0) {
    return { data: [], error: null };
  }
  const client = getSupabaseClient(config);
  if (!client) {
    return { data: [], error: 'Supabase設定が無効です。' };
  }

  const { data, error } = await client
    .from('rooms')
    .select('room_code, title, passcode, updated_at')
    .in('room_code', hashedRoomCodes);

  if (error) {
    if (error.code === '42703' || error.message.includes('passcode')) {
      const fallback = await client
        .from('rooms')
        .select('room_code, title, updated_at')
        .in('room_code', hashedRoomCodes);
      if (fallback.error) {
        return { data: [], error: fallback.error.message };
      }
      return { data: (fallback.data as RoomRecord[]) || [], error: null };
    }
    return { data: [], error: error.message };
  }

  return { data: (data as RoomRecord[]) || [], error: null };
}

export async function fetchSingleRoomFromSupabase(
  config: SupabaseConfig,
  hashedRoomCode: string
): Promise<{ data: RoomRecord | null; error: string | null }> {
  const { data, error } = await fetchRoomsMetadataFromSupabase(config, [hashedRoomCode]);
  if (error) return { data: null, error };
  return { data: data[0] || null, error: null };
}

export async function upsertRoomMetaToSupabase(
  config: SupabaseConfig,
  hashedRoomCode: string,
  patch: { title?: string; passcode?: string | null }
): Promise<{ data: RoomRecord | null; error: string | null }> {
  const client = getSupabaseClient(config);
  if (!client) {
    return { data: null, error: 'Supabase設定が無効です。' };
  }

  const existing = await fetchSingleRoomFromSupabase(config, hashedRoomCode);
  const nextTitle =
    patch.title !== undefined ? patch.title.trim() : existing.data?.title || '';
  const nextPasscode =
    patch.passcode !== undefined
      ? patch.passcode
      : existing.data?.passcode ?? null;

  const payload: Record<string, unknown> = {
    room_code: hashedRoomCode,
    title: nextTitle,
    updated_at: new Date().toISOString(),
  };
  if (patch.passcode !== undefined || existing.data?.passcode !== undefined) {
    payload.passcode = nextPasscode;
  }

  const { data, error } = await client
    .from('rooms')
    .upsert(payload, { onConflict: 'room_code' })
    .select('room_code, title, passcode, updated_at')
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: data as RoomRecord, error: null };
}

export interface SendMessagePayload {
  /** SHA-256 hashed room ID */
  room_code: string;
  sender_name: string;
  /** AES-256-GCM encrypted content string (or empty string for sticker/image-only) */
  content: string;
  sender_id?: string;
  sender_avatar?: string;
  sender_color?: string;
  image_url?: string | null;
  sticker_url?: string | null;
  /** AES-256-GCM encrypted ReplyReference JSON string */
  reply_to?: string | null;
}

export async function sendRoomMessageToSupabase(
  config: SupabaseConfig,
  payload: SendMessagePayload
): Promise<{ data: RawDbMessage | null; error: string | null }> {
  const client = getSupabaseClient(config);
  if (!client) {
    return { data: null, error: 'Supabase設定が無効です。' };
  }

  const basePayload: Record<string, unknown> = {
    room_code: payload.room_code,
    sender_name: payload.sender_name,
    content: payload.content,
  };

  if (payload.image_url) {
    basePayload.image_url = payload.image_url;
  }
  if (payload.sticker_url) {
    basePayload.sticker_url = payload.sticker_url;
  }

  const safeAvatar =
    payload.sender_avatar && payload.sender_avatar.length < 48000
      ? payload.sender_avatar
      : null;

  const fullPayload: Record<string, unknown> = {
    ...basePayload,
    sender_id: payload.sender_id || null,
    sender_avatar: safeAvatar,
    sender_color: payload.sender_color || null,
    read_by: [payload.sender_name],
    reply_to: payload.reply_to || null,
    reactions: {},
  };

  if (supportsExtendedColumns !== false) {
    const { data, error } = await client
      .from('messages')
      .insert([fullPayload])
      .select()
      .single();

    if (!error && data) {
      supportsExtendedColumns = true;
      return { data: data as RawDbMessage, error: null };
    }

    const isMissingColumn =
      error &&
      (error.code === '42703' ||
        error.code === 'PGRST204' ||
        error.message.includes('column') ||
        error.message.includes('schema cache'));

    if (!isMissingColumn) {
      return { data: null, error: error?.message || '送信に失敗しました。' };
    }

    // Retry without reply_to/reactions if user hasn't run latest ALTER TABLE yet
    const midPayload: Record<string, unknown> = {
      ...basePayload,
      sender_id: payload.sender_id || null,
      sender_avatar: safeAvatar,
      sender_color: payload.sender_color || null,
      read_by: [payload.sender_name],
    };
    const midRes = await client.from('messages').insert([midPayload]).select().single();
    if (!midRes.error && midRes.data) {
      return { data: midRes.data as RawDbMessage, error: null };
    }

    supportsExtendedColumns = false;
  }

  const { data: fallbackData, error: fallbackError } = await client
    .from('messages')
    .insert([basePayload])
    .select()
    .single();

  if (fallbackError) {
    return { data: null, error: fallbackError.message };
  }

  return { data: fallbackData as RawDbMessage, error: null };
}

export async function markMessageReadInSupabase(
  config: SupabaseConfig,
  messageId: string,
  currentReadBy: string[],
  readerName: string
): Promise<{ data: RawDbMessage | null; error: string | null }> {
  const client = getSupabaseClient(config);
  if (!client) return { data: null, error: 'Supabase設定が無効です。' };

  const cleanReader = readerName.trim();
  if (!cleanReader || currentReadBy.includes(cleanReader)) {
    return { data: null, error: null };
  }

  const nextReadBy = Array.from(new Set([...currentReadBy, cleanReader]));

  const { data, error } = await client
    .from('messages')
    .update({ read_by: nextReadBy })
    .eq('id', messageId)
    .select()
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: data as RawDbMessage, error: null };
}

export async function updateMessageReactionsInSupabase(
  config: SupabaseConfig,
  messageId: string,
  reactions: ReactionMap
): Promise<{ data: RawDbMessage | null; error: string | null }> {
  const client = getSupabaseClient(config);
  if (!client) return { data: null, error: 'Supabase設定が無効です。' };

  const { data, error } = await client
    .from('messages')
    .update({ reactions })
    .eq('id', messageId)
    .select()
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: data as RawDbMessage, error: null };
}

export async function deleteRoomMessageFromSupabase(
  config: SupabaseConfig,
  messageId: string
): Promise<{ error: string | null }> {
  const client = getSupabaseClient(config);
  if (!client) return { error: 'Supabase設定が無効です。' };

  const { error } = await client.from('messages').delete().eq('id', messageId);
  if (error) {
    return { error: error.message };
  }
  return { error: null };
}

// --- Supabase Storage (CHAT-IMAGES bucket) ---

export async function uploadStorageImageToSupabase(
  config: SupabaseConfig,
  folder: string,
  file: File
): Promise<{ url: string | null; error: string | null }> {
  const client = getSupabaseClient(config);
  if (!client) return { url: null, error: 'Supabase設定が無効です。' };

  const extMatch = file.name.match(/\.([a-zA-Z0-9]+)$/);
  const ext = extMatch ? extMatch[1].toLowerCase() : file.type.split('/')[1] || 'png';
  const safeFolder = folder.replace(/[^a-zA-Z0-9_-]/g, '') || 'misc';
  const filePath = `${safeFolder}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error: uploadError } = await client.storage
    .from(CHAT_IMAGES_BUCKET)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || 'image/png',
    });

  if (uploadError) {
    return {
      url: null,
      error: `画像アップロード失敗（バケット ${CHAT_IMAGES_BUCKET} の設定を確認してください）: ${uploadError.message}`,
    };
  }

  const { data } = client.storage.from(CHAT_IMAGES_BUCKET).getPublicUrl(filePath);
  return { url: data.publicUrl, error: null };
}

export async function uploadChatImageToSupabase(
  config: SupabaseConfig,
  hashedRoomCode: string,
  file: File
): Promise<{ url: string | null; error: string | null }> {
  // Store under hashed prefix so original 6-digit room code never appears in Storage paths
  return uploadStorageImageToSupabase(
    config,
    `room_${hashedRoomCode.slice(0, 24)}`,
    file
  );
}

// --- BOOM Timeline (`boom_posts` table) ---

function normalizeBoomPost(raw: Record<string, unknown>): BoomPost {
  return {
    id: String(raw.id || ''),
    author_name: String(raw.author_name || 'ゲスト'),
    author_id: typeof raw.author_id === 'string' ? raw.author_id : null,
    author_avatar: typeof raw.author_avatar === 'string' ? raw.author_avatar : null,
    author_color: typeof raw.author_color === 'string' ? raw.author_color : null,
    content: String(raw.content || ''),
    image_url: typeof raw.image_url === 'string' ? raw.image_url : null,
    likes: Array.isArray(raw.likes)
      ? raw.likes.filter((v): v is string => typeof v === 'string')
      : [],
    comments: Array.isArray(raw.comments) ? (raw.comments as BoomComment[]) : [],
    created_at: String(raw.created_at || new Date().toISOString()),
  };
}

export async function fetchBoomPostsFromSupabase(
  config: SupabaseConfig
): Promise<{ data: BoomPost[]; error: string | null }> {
  const client = getSupabaseClient(config);
  if (!client) return { data: [], error: 'Supabase設定が無効です。' };

  const { data, error } = await client
    .from('boom_posts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(60);

  if (error) {
    return { data: [], error: error.message };
  }

  const normalized = ((data || []) as Record<string, unknown>[]).map(normalizeBoomPost);
  return { data: normalized, error: null };
}

export interface CreateBoomPostPayload {
  author_name: string;
  author_id?: string;
  author_avatar?: string | null;
  author_color?: string | null;
  content: string;
  image_url?: string | null;
}

export async function createBoomPostInSupabase(
  config: SupabaseConfig,
  payload: CreateBoomPostPayload
): Promise<{ data: BoomPost | null; error: string | null }> {
  const client = getSupabaseClient(config);
  if (!client) return { data: null, error: 'Supabase設定が無効です。' };

  const safeAvatar =
    payload.author_avatar && payload.author_avatar.length < 48000
      ? payload.author_avatar
      : null;

  const fullPayload = {
    author_name: payload.author_name,
    author_id: payload.author_id || null,
    author_avatar: safeAvatar,
    author_color: payload.author_color || null,
    content: payload.content,
    image_url: payload.image_url || null,
    likes: [],
    comments: [],
  };

  const { data, error } = await client
    .from('boom_posts')
    .insert([fullPayload])
    .select()
    .single();

  if (!error && data) {
    return { data: normalizeBoomPost(data as Record<string, unknown>), error: null };
  }

  const isMissingColumn =
    error &&
    (error.code === '42703' ||
      error.code === 'PGRST204' ||
      error.message.includes('column') ||
      error.message.includes('schema cache'));

  if (isMissingColumn) {
    const minimalPayload = {
      author_name: payload.author_name,
      content: payload.content,
      image_url: payload.image_url || null,
      likes: [],
      comments: [],
    };
    const fallback = await client
      .from('boom_posts')
      .insert([minimalPayload])
      .select()
      .single();
    if (fallback.error) {
      return { data: null, error: fallback.error.message };
    }
    return {
      data: normalizeBoomPost(fallback.data as Record<string, unknown>),
      error: null,
    };
  }

  return { data: null, error: error?.message || '投稿に失敗しました。' };
}

export async function updateBoomPostLikesInSupabase(
  config: SupabaseConfig,
  postId: string,
  likes: string[]
): Promise<{ data: BoomPost | null; error: string | null }> {
  const client = getSupabaseClient(config);
  if (!client) return { data: null, error: 'Supabase設定が無効です。' };

  const { data, error } = await client
    .from('boom_posts')
    .update({ likes })
    .eq('id', postId)
    .select()
    .single();

  if (error) return { data: null, error: error.message };
  return { data: normalizeBoomPost(data as Record<string, unknown>), error: null };
}

export async function updateBoomPostCommentsInSupabase(
  config: SupabaseConfig,
  postId: string,
  comments: BoomComment[]
): Promise<{ data: BoomPost | null; error: string | null }> {
  const client = getSupabaseClient(config);
  if (!client) return { data: null, error: 'Supabase設定が無効です。' };

  const { data, error } = await client
    .from('boom_posts')
    .update({ comments })
    .eq('id', postId)
    .select()
    .single();

  if (error) return { data: null, error: error.message };
  return { data: normalizeBoomPost(data as Record<string, unknown>), error: null };
}

export async function deleteBoomPostFromSupabase(
  config: SupabaseConfig,
  postId: string
): Promise<{ error: string | null }> {
  const client = getSupabaseClient(config);
  if (!client) return { error: 'Supabase設定が無効です。' };

  const { error } = await client.from('boom_posts').delete().eq('id', postId);
  if (error) return { error: error.message };
  return { error: null };
}

export function subscribeToBoomPostsRealtime(
  config: SupabaseConfig,
  callbacks: {
    onInsert: (post: BoomPost) => void;
    onUpdate: (post: BoomPost) => void;
    onDelete: (postId: string) => void;
    onStatusChange?: (status: RealtimeStatus) => void;
  }
): () => void {
  const client = getSupabaseClient(config);
  if (!client) {
    callbacks.onStatusChange?.('error');
    return () => {};
  }

  callbacks.onStatusChange?.('connecting');

  const channel = client
    .channel(`roomline_boom_feed_${Math.random().toString(36).slice(2, 8)}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'boom_posts',
      },
      (payload) => {
        if (payload.new) {
          callbacks.onInsert(normalizeBoomPost(payload.new as Record<string, unknown>));
        }
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'boom_posts',
      },
      (payload) => {
        if (payload.new) {
          callbacks.onUpdate(normalizeBoomPost(payload.new as Record<string, unknown>));
        }
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'boom_posts',
      },
      (payload) => {
        const oldRow = payload.old as { id?: string } | null;
        if (oldRow?.id) {
          callbacks.onDelete(oldRow.id);
        }
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        callbacks.onStatusChange?.('connected');
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        callbacks.onStatusChange?.('error');
      }
    });

  return () => {
    client.removeChannel(channel);
  };
}

// --- Room Realtime Subscriptions & Presence (Strictly Hashed Room IDs) ---

export function subscribeToSupabaseRoom(
  config: SupabaseConfig,
  hashedRoomCode: string,
  callbacks: {
    onMessageInsert: (message: RawDbMessage) => void;
    onMessageUpdate: (message: RawDbMessage) => void;
    onMessageDelete: (messageId: string, hashedRoomCode?: string) => void;
    onRoomUpdate: (room: RoomRecord) => void;
    onStatusChange: (status: RealtimeStatus) => void;
  }
): () => void {
  const client = getSupabaseClient(config);
  if (!client) {
    callbacks.onStatusChange('error');
    return () => {};
  }

  callbacks.onStatusChange('connecting');

  const channelName = `roomline_sync_${hashedRoomCode.slice(0, 24)}_${Math.random().toString(36).slice(2, 8)}`;
  const channel = client
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `room_code=eq.${hashedRoomCode}`,
      },
      (payload) => {
        if (payload.new) {
          callbacks.onMessageInsert(payload.new as RawDbMessage);
        }
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `room_code=eq.${hashedRoomCode}`,
      },
      (payload) => {
        if (payload.new) {
          callbacks.onMessageUpdate(payload.new as RawDbMessage);
        }
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'messages',
        filter: `room_code=eq.${hashedRoomCode}`,
      },
      (payload) => {
        const oldRow = payload.old as { id?: string; room_code?: string } | null;
        if (oldRow?.id) {
          callbacks.onMessageDelete(oldRow.id, oldRow.room_code || hashedRoomCode);
        }
      }
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'rooms',
        filter: `room_code=eq.${hashedRoomCode}`,
      },
      (payload) => {
        if (payload.new && typeof payload.new === 'object' && 'room_code' in payload.new) {
          callbacks.onRoomUpdate(payload.new as RoomRecord);
        }
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        callbacks.onStatusChange('connected');
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        callbacks.onStatusChange('error');
      }
    });

  return () => {
    client.removeChannel(channel);
  };
}

export function subscribeToGlobalMessageDeletes(
  config: SupabaseConfig,
  onDelete: (messageId: string, hashedRoomCode?: string) => void
): () => void {
  const client = getSupabaseClient(config);
  if (!client) return () => {};

  const channel = client
    .channel(`roomline_global_deletes_${Math.random().toString(36).slice(2, 8)}`)
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'messages',
      },
      (payload) => {
        const oldRow = payload.old as { id?: string; room_code?: string } | null;
        if (oldRow?.id) {
          onDelete(oldRow.id, oldRow.room_code);
        }
      }
    )
    .subscribe();

  return () => {
    client.removeChannel(channel);
  };
}

export function subscribeToSupabasePresence(
  config: SupabaseConfig,
  hashedRoomCode: string,
  selfMember: OnlineMember,
  onPresenceChange: (members: OnlineMember[]) => void
): PresenceController {
  const client = getSupabaseClient(config);
  if (!client) {
    onPresenceChange([selfMember]);
    return {
      updateTyping: () => {},
      unsubscribe: () => {},
    };
  }

  let currentSelfState: OnlineMember = { ...selfMember, isTyping: false };
  let isSubscribed = false;
  let lastTypingTrueSentAt = 0;
  const TYPING_TRUE_THROTTLE_MS = 1500;

  const channel = client.channel(`roomline_presence_${hashedRoomCode}`, {
    config: {
      presence: {
        key: selfMember.userId,
      },
    },
  });

  const syncMembers = () => {
    const state = channel.presenceState<OnlineMember>();
    const byUser = new Map<string, OnlineMember>();
    Object.values(state).forEach((presences) => {
      presences.forEach((p) => {
        if (p && p.userId) {
          byUser.set(p.userId, {
            userId: p.userId,
            nickname: p.nickname || 'ゲスト',
            avatar: p.avatar || null,
            avatarColor: p.avatarColor || null,
            joinedAt: p.joinedAt || new Date().toISOString(),
            isTyping: Boolean(p.isTyping),
          });
        }
      });
    });
    if (!byUser.has(currentSelfState.userId)) {
      byUser.set(currentSelfState.userId, currentSelfState);
    }
    onPresenceChange(Array.from(byUser.values()));
  };

  channel
    .on('presence', { event: 'sync' }, syncMembers)
    .on('presence', { event: 'join' }, syncMembers)
    .on('presence', { event: 'leave' }, syncMembers)
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        isSubscribed = true;
        await channel.track(currentSelfState);
        syncMembers();
      }
    });

  return {
    updateTyping: (isTyping: boolean) => {
      const now = Date.now();
      if (isTyping) {
        if (
          Boolean(currentSelfState.isTyping) ||
          now - lastTypingTrueSentAt < TYPING_TRUE_THROTTLE_MS
        ) {
          return;
        }
        lastTypingTrueSentAt = now;
      } else if (!currentSelfState.isTyping) {
        return;
      }
      currentSelfState = { ...currentSelfState, isTyping };
      if (isSubscribed) {
        void channel.track(currentSelfState);
      }
    },
    unsubscribe: () => {
      isSubscribed = false;
      void channel.untrack();
      client.removeChannel(channel);
    },
  };
}

// --- Official Announcements (`official_announcements` table) ---

function normalizeAnnouncement(raw: Record<string, unknown>): OfficialAnnouncement {
  return {
    id: String(raw.id || ''),
    title: String(raw.title || ''),
    content: String(raw.content || ''),
    is_important: Boolean(raw.is_important),
    created_at: String(raw.created_at || new Date().toISOString()),
  };
}

export async function fetchOfficialAnnouncementsFromSupabase(
  config: SupabaseConfig
): Promise<{ data: OfficialAnnouncement[]; error: string | null }> {
  const client = getSupabaseClient(config);
  if (!client) return { data: [], error: 'Supabase設定が無効です。' };

  const { data, error } = await client
    .from('official_announcements')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) return { data: [], error: error.message };
  return {
    data: ((data || []) as Record<string, unknown>[]).map(normalizeAnnouncement),
    error: null,
  };
}

export async function createOfficialAnnouncementInSupabase(
  config: SupabaseConfig,
  payload: { title: string; content: string; is_important: boolean }
): Promise<{ data: OfficialAnnouncement | null; error: string | null }> {
  const client = getSupabaseClient(config);
  if (!client) return { data: null, error: 'Supabase設定が無効です。' };

  const { data, error } = await client
    .from('official_announcements')
    .insert([
      {
        title: payload.title.trim(),
        content: payload.content.trim(),
        is_important: payload.is_important,
      },
    ])
    .select()
    .single();

  if (error) return { data: null, error: error.message };
  return { data: normalizeAnnouncement(data as Record<string, unknown>), error: null };
}

export async function deleteOfficialAnnouncementFromSupabase(
  config: SupabaseConfig,
  announcementId: string
): Promise<{ error: string | null }> {
  const client = getSupabaseClient(config);
  if (!client) return { error: 'Supabase設定が無効です。' };

  const { error } = await client
    .from('official_announcements')
    .delete()
    .eq('id', announcementId);
  if (error) return { error: error.message };
  return { error: null };
}

export function subscribeToOfficialAnnouncementsRealtime(
  config: SupabaseConfig,
  callbacks: {
    onInsert: (item: OfficialAnnouncement) => void;
    onDelete: (id: string) => void;
  }
): () => void {
  const client = getSupabaseClient(config);
  if (!client) return () => {};

  const channel = client
    .channel(`roomline_official_ann_${Math.random().toString(36).slice(2, 8)}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'official_announcements' },
      (payload) => {
        if (payload.new) {
          callbacks.onInsert(normalizeAnnouncement(payload.new as Record<string, unknown>));
        }
      }
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'official_announcements' },
      (payload) => {
        const oldRow = payload.old as { id?: string } | null;
        if (oldRow?.id) {
          callbacks.onDelete(oldRow.id);
        }
      }
    )
    .subscribe();

  return () => {
    client.removeChannel(channel);
  };
}

// --- User Reports (`reports` table) ---

function normalizeReport(raw: Record<string, unknown>): UserReport {
  const rawReason = String(raw.reason || 'その他');
  const validReason: ReportReason =
    rawReason === 'スパム・荒らし' || rawReason === '不適切な発言'
      ? rawReason
      : 'その他';

  const rawStatus = String(raw.status || 'pending');
  const validStatus: ReportStatus =
    rawStatus === 'reviewed' || rawStatus === 'resolved' ? rawStatus : 'pending';

  return {
    id: String(raw.id || ''),
    reporter_name: String(raw.reporter_name || 'ゲスト'),
    target_user_name: String(raw.target_user_name || '不明'),
    reason: validReason,
    details: String(raw.details || ''),
    status: validStatus,
    created_at: String(raw.created_at || new Date().toISOString()),
  };
}

export async function fetchReportsFromSupabase(
  config: SupabaseConfig
): Promise<{ data: UserReport[]; error: string | null }> {
  const client = getSupabaseClient(config);
  if (!client) return { data: [], error: 'Supabase設定が無効です。' };

  const { data, error } = await client
    .from('reports')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) return { data: [], error: error.message };
  return {
    data: ((data || []) as Record<string, unknown>[]).map(normalizeReport),
    error: null,
  };
}

export async function createReportInSupabase(
  config: SupabaseConfig,
  payload: {
    reporter_name: string;
    target_user_name: string;
    reason: ReportReason;
    details: string;
  }
): Promise<{ data: UserReport | null; error: string | null }> {
  const client = getSupabaseClient(config);
  if (!client) return { data: null, error: 'Supabase設定が無効です。' };

  const { data, error } = await client
    .from('reports')
    .insert([
      {
        reporter_name: payload.reporter_name.trim() || 'ゲスト',
        target_user_name: payload.target_user_name.trim(),
        reason: payload.reason,
        details: payload.details.trim(),
        status: 'pending',
      },
    ])
    .select()
    .single();

  if (error) return { data: null, error: error.message };
  return { data: normalizeReport(data as Record<string, unknown>), error: null };
}

export async function updateReportStatusInSupabase(
  config: SupabaseConfig,
  reportId: string,
  status: ReportStatus
): Promise<{ data: UserReport | null; error: string | null }> {
  const client = getSupabaseClient(config);
  if (!client) return { data: null, error: 'Supabase設定が無効です。' };

  const { data, error } = await client
    .from('reports')
    .update({ status })
    .eq('id', reportId)
    .select()
    .single();

  if (error) return { data: null, error: error.message };
  return { data: normalizeReport(data as Record<string, unknown>), error: null };
}

export async function deleteReportFromSupabase(
  config: SupabaseConfig,
  reportId: string
): Promise<{ error: string | null }> {
  const client = getSupabaseClient(config);
  if (!client) return { error: 'Supabase設定が無効です。' };

  const { error } = await client.from('reports').delete().eq('id', reportId);
  if (error) return { error: error.message };
  return { error: null };
}

export function subscribeToReportsRealtime(
  config: SupabaseConfig,
  callbacks: {
    onInsert: (report: UserReport) => void;
    onUpdate: (report: UserReport) => void;
    onDelete: (reportId: string) => void;
  }
): () => void {
  const client = getSupabaseClient(config);
  if (!client) return () => {};

  const channel = client
    .channel(`roomline_admin_reports_${Math.random().toString(36).slice(2, 8)}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'reports' },
      (payload) => {
        if (payload.new) {
          callbacks.onInsert(normalizeReport(payload.new as Record<string, unknown>));
        }
      }
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'reports' },
      (payload) => {
        if (payload.new) {
          callbacks.onUpdate(normalizeReport(payload.new as Record<string, unknown>));
        }
      }
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'reports' },
      (payload) => {
        const oldRow = payload.old as { id?: string } | null;
        if (oldRow?.id) callbacks.onDelete(oldRow.id);
      }
    )
    .subscribe();

  return () => {
    client.removeChannel(channel);
  };
}

// --- Maintenance Mode (stored in `rooms` table under SYSTEM_MAINTENANCE_ROOM_KEY) ---

export async function fetchMaintenanceModeFromSupabase(
  config: SupabaseConfig
): Promise<{ enabled: boolean; error: string | null }> {
  const client = getSupabaseClient(config);
  if (!client) return { enabled: false, error: 'Supabase設定が無効です。' };

  const { data, error } = await client
    .from('rooms')
    .select('title')
    .eq('room_code', SYSTEM_MAINTENANCE_ROOM_KEY)
    .maybeSingle();

  if (error) return { enabled: false, error: error.message };
  return { enabled: data?.title === 'MAINTENANCE_ON', error: null };
}

export async function setMaintenanceModeInSupabase(
  config: SupabaseConfig,
  enabled: boolean
): Promise<{ enabled: boolean; error: string | null }> {
  const client = getSupabaseClient(config);
  if (!client) return { enabled: false, error: 'Supabase設定が無効です。' };

  const { error } = await client.from('rooms').upsert(
    {
      room_code: SYSTEM_MAINTENANCE_ROOM_KEY,
      title: enabled ? 'MAINTENANCE_ON' : 'MAINTENANCE_OFF',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'room_code' }
  );

  if (error) return { enabled: !enabled, error: error.message };
  return { enabled, error: null };
}

export function subscribeToMaintenanceModeRealtime(
  config: SupabaseConfig,
  onChange: (enabled: boolean) => void
): () => void {
  const client = getSupabaseClient(config);
  if (!client) return () => {};

  const channel = client
    .channel(`roomline_maintenance_${Math.random().toString(36).slice(2, 8)}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'rooms',
        filter: `room_code=eq.${SYSTEM_MAINTENANCE_ROOM_KEY}`,
      },
      (payload) => {
        const row = payload.new as { title?: string } | null;
        if (row && typeof row.title === 'string') {
          onChange(row.title === 'MAINTENANCE_ON');
        }
      }
    )
    .subscribe();

  return () => {
    client.removeChannel(channel);
  };
}

// --- Admin System Stats & Old Encrypted Message Purge (Zero-Knowledge Safe) ---

export async function fetchAdminStatsFromSupabase(
  config: SupabaseConfig
): Promise<{ stats: AdminSystemStats; error: string | null }> {
  const client = getSupabaseClient(config);
  if (!client) {
    return {
      stats: { totalMessages: 0, activeEncryptedRooms: 0, pendingReports: 0 },
      error: 'Supabase設定が無効です。',
    };
  }

  const [msgCountRes, msgRoomsRes, roomsRes, pendingReportsRes] = await Promise.all([
    client.from('messages').select('id', { count: 'exact', head: true }),
    client.from('messages').select('room_code').limit(2000),
    client
      .from('rooms')
      .select('room_code')
      .neq('room_code', SYSTEM_MAINTENANCE_ROOM_KEY)
      .limit(2000),
    client
      .from('reports')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending'),
  ]);

  const uniqueHashedRooms = new Set<string>();
  if (Array.isArray(msgRoomsRes.data)) {
    msgRoomsRes.data.forEach((row) => {
      if (row.room_code && row.room_code !== SYSTEM_MAINTENANCE_ROOM_KEY) {
        uniqueHashedRooms.add(String(row.room_code));
      }
    });
  }
  if (Array.isArray(roomsRes.data)) {
    roomsRes.data.forEach((row) => {
      if (row.room_code && row.room_code !== SYSTEM_MAINTENANCE_ROOM_KEY) {
        uniqueHashedRooms.add(String(row.room_code));
      }
    });
  }

  return {
    stats: {
      totalMessages: msgCountRes.count ?? 0,
      activeEncryptedRooms: uniqueHashedRooms.size,
      pendingReports: pendingReportsRes.count ?? 0,
    },
    error: msgCountRes.error?.message || null,
  };
}

export async function purgeOldMessagesFromSupabase(
  config: SupabaseConfig,
  olderThanHours = 24
): Promise<{ deletedCount: number; error: string | null }> {
  const client = getSupabaseClient(config);
  if (!client) return { deletedCount: 0, error: 'Supabase設定が無効です。' };

  const cutoffIso = new Date(Date.now() - olderThanHours * 60 * 60 * 1000).toISOString();
  const { data, error } = await client
    .from('messages')
    .delete()
    .lt('created_at', cutoffIso)
    .select('id');

  if (error) return { deletedCount: 0, error: error.message };
  return { deletedCount: Array.isArray(data) ? data.length : 0, error: null };
}
