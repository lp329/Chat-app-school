import { getSupabaseClient } from './supabaseService';
import type { MiniGameSyncPayload, SupabaseConfig } from '../types/chat';

export interface MiniGameSyncChannel {
  send: (payload: MiniGameSyncPayload) => Promise<void>;
  unsubscribe: () => void;
}

const MOCK_MINIGAME_CHANNEL_NAME = 'roomline_minigame_sync_mock_v1';

/**
 * Room-scoped Realtime Broadcast channel for Mini-Games (`event: 'minigame-sync'`).
 * Uses the SHA-256 hashed room ID so raw 6-digit codes are never sent to Supabase.
 * Falls back to browser BroadcastChannel in local mock mode for multi-tab play.
 */
export function subscribeToMiniGameSync(
  config: SupabaseConfig,
  isSupabaseConfigured: boolean,
  hashedRoomCode: string,
  selfUserId: string,
  onEvent: (payload: MiniGameSyncPayload) => void
): MiniGameSyncChannel {
  if (!isSupabaseConfigured) {
    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        bc = new BroadcastChannel(MOCK_MINIGAME_CHANNEL_NAME);
        bc.onmessage = (event) => {
          const data = event.data as {
            roomKey?: string;
            payload?: MiniGameSyncPayload;
          } | null;
          if (!data || data.roomKey !== hashedRoomCode || !data.payload) return;
          if (data.payload.fromUserId === selfUserId) return;
          if (
            data.payload.toUserId &&
            data.payload.toUserId !== selfUserId
          ) {
            return;
          }
          onEvent(data.payload);
        };
      } catch {
        bc = null;
      }
    }

    return {
      send: async (payload: MiniGameSyncPayload) => {
        try {
          bc?.postMessage({ roomKey: hashedRoomCode, payload });
        } catch {
          // Ignore BroadcastChannel errors
        }
      },
      unsubscribe: () => {
        try {
          bc?.close();
        } catch {
          // Ignore
        }
        bc = null;
      },
    };
  }

  const client = getSupabaseClient(config);
  if (!client) {
    return {
      send: async () => {},
      unsubscribe: () => {},
    };
  }

  let isSubscribed = false;
  const pendingQueue: MiniGameSyncPayload[] = [];

  const channel = client.channel(`roomline_minigame_${hashedRoomCode}`, {
    config: {
      broadcast: {
        self: false,
      },
    },
  });

  channel
    .on('broadcast', { event: 'minigame-sync' }, ({ payload }) => {
      const msg = payload as MiniGameSyncPayload | undefined;
      if (!msg || !msg.eventType || !msg.matchId) return;
      if (msg.fromUserId === selfUserId) return;
      if (msg.toUserId && msg.toUserId !== selfUserId) return;
      onEvent(msg);
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        isSubscribed = true;
        while (pendingQueue.length > 0) {
          const next = pendingQueue.shift();
          if (next) {
            void channel.send({
              type: 'broadcast',
              event: 'minigame-sync',
              payload: next,
            });
          }
        }
      }
    });

  return {
    send: async (payload: MiniGameSyncPayload) => {
      if (!isSubscribed) {
        pendingQueue.push(payload);
        return;
      }
      try {
        await channel.send({
          type: 'broadcast',
          event: 'minigame-sync',
          payload,
        });
      } catch {
        // Ignore transient network errors
      }
    },
    unsubscribe: () => {
      isSubscribed = false;
      pendingQueue.length = 0;
      client.removeChannel(channel);
    },
  };
}
