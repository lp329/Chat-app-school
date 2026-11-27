import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { ChatMessage, RealtimeStatus, SupabaseConfig } from '../types/chat';

let cachedClient: SupabaseClient | null = null;
let cachedKey = '';
let supportsExtendedProfileColumns: boolean | null = null;

export function getSupabaseClient(config: SupabaseConfig): SupabaseClient | null {
  const url = config.url.trim();
  const anonKey = config.anonKey.trim();
  if (!url || !anonKey) return null;

  const cacheSignature = `${url}::${anonKey}`;
  if (cachedClient && cachedKey === cacheSignature) {
    return cachedClient;
  }

  try {
    // Validate URL format before creating client
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
    supportsExtendedProfileColumns = null;
    return cachedClient;
  } catch {
    return null;
  }
}

export function resetSupabaseClientCache(): void {
  if (cachedClient) {
    cachedClient.removeAllChannels();
  }
  cachedClient = null;
  cachedKey = '';
  supportsExtendedProfileColumns = null;
}

export async function testSupabaseConnection(
  url: string,
  anonKey: string
): Promise<{ ok: boolean; message: string }> {
  const trimmedUrl = url.trim();
  const trimmedKey = anonKey.trim();
  if (!trimmedUrl || !trimmedKey) {
    return { ok: false, message: 'URLとAnon Keyの両方を入力してください。' };
  }

  try {
    new URL(trimmedUrl);
  } catch {
    return { ok: false, message: '有効なSupabase URL（https://...）を入力してください。' };
  }

  try {
    const client = createClient(trimmedUrl, trimmedKey);
    const { error } = await client.from('messages').select('id').limit(1);
    if (error) {
      if (error.code === '42P01' || error.message.includes('does not exist')) {
        return {
          ok: false,
          message:
            'Supabaseへの認証は通りましたが、messagesテーブルが見つかりません。下のSQLを実行してください。',
        };
      }
      if (error.code === '42501') {
        return {
          ok: false,
          message:
            '権限エラー（RLS）が発生しました。下のSQLでSELECT/INSERTポリシーを追加してください。',
        };
      }
      return { ok: false, message: `接続エラー: ${error.message}` };
    }
    return {
      ok: true,
      message: 'Supabase（messagesテーブル）への接続を確認しました。Realtime同期が利用できます。',
    };
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'ネットワークエラー';
    return { ok: false, message: `接続に失敗しました: ${detail}` };
  }
}

export async function fetchRoomMessagesFromSupabase(
  config: SupabaseConfig,
  roomCode: string
): Promise<{ data: ChatMessage[]; error: string | null }> {
  const client = getSupabaseClient(config);
  if (!client) {
    return { data: [], error: 'Supabase設定が無効です。' };
  }

  const { data, error } = await client
    .from('messages')
    .select('*')
    .eq('room_code', roomCode)
    .order('created_at', { ascending: true });

  if (error) {
    return { data: [], error: error.message };
  }

  return { data: (data as ChatMessage[]) || [], error: null };
}

export interface SendMessagePayload {
  room_code: string;
  sender_name: string;
  content: string;
  sender_id?: string;
  sender_avatar?: string;
  sender_color?: string;
}

export async function sendRoomMessageToSupabase(
  config: SupabaseConfig,
  payload: SendMessagePayload
): Promise<{ data: ChatMessage | null; error: string | null }> {
  const client = getSupabaseClient(config);
  if (!client) {
    return { data: null, error: 'Supabase設定が無効です。' };
  }

  const basePayload = {
    room_code: payload.room_code,
    sender_name: payload.sender_name,
    content: payload.content,
  };

  // Avoid sending large base64 data URLs if custom image is too big for text column safety
  const safeAvatar =
    payload.sender_avatar && payload.sender_avatar.length < 48000
      ? payload.sender_avatar
      : null;

  const fullPayload = {
    ...basePayload,
    sender_id: payload.sender_id || null,
    sender_avatar: safeAvatar,
    sender_color: payload.sender_color || null,
  };

  if (supportsExtendedProfileColumns !== false) {
    const { data, error } = await client
      .from('messages')
      .insert([fullPayload])
      .select()
      .single();

    if (!error && data) {
      supportsExtendedProfileColumns = true;
      return { data: data as ChatMessage, error: null };
    }

    // Fallback gracefully if user created a minimal table without sender_id/sender_avatar/sender_color
    const isMissingColumn =
      error &&
      (error.code === '42703' ||
        error.code === 'PGRST204' ||
        error.message.includes('column') ||
        error.message.includes('schema cache'));

    if (!isMissingColumn) {
      return { data: null, error: error?.message || '送信に失敗しました。' };
    }

    supportsExtendedProfileColumns = false;
  }

  const { data: fallbackData, error: fallbackError } = await client
    .from('messages')
    .insert([basePayload])
    .select()
    .single();

  if (fallbackError) {
    return { data: null, error: fallbackError.message };
  }

  return { data: fallbackData as ChatMessage, error: null };
}

export function subscribeToSupabaseRoom(
  config: SupabaseConfig,
  roomCode: string,
  onInsert: (message: ChatMessage) => void,
  onStatusChange: (status: RealtimeStatus) => void
): () => void {
  const client = getSupabaseClient(config);
  if (!client) {
    onStatusChange('error');
    return () => {};
  }

  onStatusChange('connecting');

  const channelName = `roomline_room_${roomCode}_${Date.now()}`;
  const channel = client
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `room_code=eq.${roomCode}`,
      },
      (payload) => {
        if (payload.new) {
          onInsert(payload.new as ChatMessage);
        }
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        onStatusChange('connected');
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        onStatusChange('error');
      }
    });

  return () => {
    client.removeChannel(channel);
  };
}
