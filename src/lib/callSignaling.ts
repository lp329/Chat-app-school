import { getSupabaseClient } from './supabaseService';
import type { SupabaseConfig, WebRtcSignalPayload } from '../types/chat';

export interface CallSignalingChannel {
  send: (payload: WebRtcSignalPayload) => Promise<void>;
  unsubscribe: () => void;
}

const MOCK_WEBRTC_CHANNEL_NAME = 'roomline_webrtc_signal_mock_v1';

/**
 * Subscribes to room-scoped WebRTC signaling over Supabase Realtime Broadcast
 * (`channel.send({ type: 'broadcast', event: 'webrtc-signal', payload })`).
 * Uses the SHA-256 hashed room ID so raw 6-digit room codes never leave the client.
 * Falls back to browser BroadcastChannel when Supabase is not configured (multi-tab local testing).
 */
export function subscribeToCallSignaling(
  config: SupabaseConfig,
  isSupabaseConfigured: boolean,
  hashedRoomCode: string,
  selfUserId: string,
  onSignal: (payload: WebRtcSignalPayload) => void
): CallSignalingChannel {
  if (!isSupabaseConfigured) {
    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        bc = new BroadcastChannel(MOCK_WEBRTC_CHANNEL_NAME);
        bc.onmessage = (event) => {
          const data = event.data as {
            roomKey?: string;
            payload?: WebRtcSignalPayload;
          } | null;
          if (!data || data.roomKey !== hashedRoomCode || !data.payload) return;
          if (data.payload.fromUserId === selfUserId) return;
          if (
            data.payload.toUserId &&
            data.payload.toUserId !== selfUserId
          ) {
            return;
          }
          onSignal(data.payload);
        };
      } catch {
        bc = null;
      }
    }

    return {
      send: async (payload: WebRtcSignalPayload) => {
        try {
          bc?.postMessage({ roomKey: hashedRoomCode, payload });
        } catch {
          // Ignore BroadcastChannel post errors
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
  const pendingQueue: WebRtcSignalPayload[] = [];

  const channel = client.channel(`roomline_webrtc_${hashedRoomCode}`, {
    config: {
      broadcast: {
        self: false,
      },
    },
  });

  channel
    .on('broadcast', { event: 'webrtc-signal' }, ({ payload }) => {
      const signal = payload as WebRtcSignalPayload | undefined;
      if (!signal || !signal.type || !signal.callId) return;
      if (signal.fromUserId === selfUserId) return;
      if (signal.toUserId && signal.toUserId !== selfUserId) return;
      onSignal(signal);
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        isSubscribed = true;
        while (pendingQueue.length > 0) {
          const next = pendingQueue.shift();
          if (next) {
            void channel.send({
              type: 'broadcast',
              event: 'webrtc-signal',
              payload: next,
            });
          }
        }
      }
    });

  return {
    send: async (payload: WebRtcSignalPayload) => {
      if (!isSubscribed) {
        pendingQueue.push(payload);
        return;
      }
      try {
        await channel.send({
          type: 'broadcast',
          event: 'webrtc-signal',
          payload,
        });
      } catch {
        // Ignore transient network send errors
      }
    },
    unsubscribe: () => {
      isSubscribed = false;
      pendingQueue.length = 0;
      client.removeChannel(channel);
    },
  };
}

/**
 * Subtle, pleasant electronic ringtone synthesizer using Web Audio API.
 * Strictly used ONLY for incoming voice/video calls and supports instant mute/stop.
 */
export class CallRingtoneController {
  private ctx: AudioContext | null = null;
  private timerId: number | null = null;
  private isPlaying = false;

  start(): void {
    if (this.isPlaying || typeof window === 'undefined') return;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;

    this.isPlaying = true;
    try {
      this.ctx = new AudioCtx();
    } catch {
      this.isPlaying = false;
      return;
    }

    const playChime = () => {
      if (!this.isPlaying || !this.ctx) return;
      try {
        if (this.ctx.state === 'suspended') {
          void this.ctx.resume().catch(() => {});
        }
        const now = this.ctx.currentTime;
        // Soft two-note electronic chime (E5 -> A5, gentle low volume)
        const notes = [
          { freq: 659.25, start: 0, dur: 0.18 },
          { freq: 880.0, start: 0.2, dur: 0.28 },
        ];
        notes.forEach(({ freq, start, dur }) => {
          if (!this.ctx) return;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + start);

          gain.gain.setValueAtTime(0.0001, now + start);
          gain.gain.exponentialRampToValueAtTime(0.06, now + start + 0.025);
          gain.gain.exponentialRampToValueAtTime(
            0.0001,
            now + start + dur
          );

          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start(now + start);
          osc.stop(now + start + dur + 0.02);
        });
      } catch {
        // Autoplay restriction or closed AudioContext — silently ignore
      }
    };

    playChime();
    this.timerId = window.setInterval(playChime, 2400);
  }

  stop(): void {
    this.isPlaying = false;
    if (this.timerId !== null) {
      window.clearInterval(this.timerId);
      this.timerId = null;
    }
    if (this.ctx) {
      const oldCtx = this.ctx;
      this.ctx = null;
      void oldCtx.close().catch(() => {});
    }
  }
}
