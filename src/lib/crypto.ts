/**
 * Zero-Knowledge Client-Side Cryptography Engine (Web Crypto API only)
 * - SHA-256 salted hashing for 6-digit room codes (DB room_code & Realtime channels)
 * - SHA-256 salted hashing for 4-digit room passcodes (DB rooms.passcode)
 * - PBKDF2-HMAC-SHA256 -> AES-256-GCM end-to-end encryption for message content & reply_to
 */

import type { ReplyReference } from '../types/chat';

const ROOM_HASH_SALT = 'roomline::zk::room_v1::9c4e7a2b1d8f3056';
const PASSCODE_HASH_SALT = 'roomline::zk::passcode_v1::5a1f8c3e7b0492d1';
const E2EE_KEY_SALT_PREFIX = 'roomline::zk::aes256gcm_v1::';
const E2EE_PREFIX = 'e2ee:v1:';
const PBKDF2_ITERATIONS = 120000;
const AES_GCM_IV_BYTES = 12;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

// In-memory bidirectional map between local 6-digit room codes and SHA-256 hashed room IDs
const rawToHashMap = new Map<string, string>();
const hashToRawMap = new Map<string, string>();

// In-memory cache of derived non-extractable AES-256-GCM CryptoKeys
const derivedKeyCache = new Map<string, Promise<CryptoKey>>();

function assertWebCrypto(): SubtleCrypto {
  if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
    throw new Error('このブラウザ環境では Web Crypto API (crypto.subtle) が利用できません。');
  }
  return window.crypto.subtle;
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function sha256Hex(input: string): Promise<string> {
  const subtle = assertWebCrypto();
  const digest = await subtle.digest('SHA-256', textEncoder.encode(input));
  return bytesToHex(new Uint8Array(digest));
}

export function isSha256Hex(value: string | null | undefined): boolean {
  return Boolean(value && /^[a-f0-9]{64}$/i.test(value.trim()));
}

export function isEncryptedPayload(value: string | null | undefined): boolean {
  return Boolean(value && value.startsWith(E2EE_PREFIX));
}

/**
 * Constant-time string comparison for fixed-length hashes.
 */
export function timingSafeEqualStrings(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Computes the salted SHA-256 hex digest of a 6-digit room code.
 * Registers the mapping in local memory so Realtime events can resolve back to the local 6-digit code.
 */
export async function hashRoomCode(rawRoomCode: string): Promise<string> {
  const clean = rawRoomCode.replace(/\D/g, '').slice(0, 6);
  const cached = rawToHashMap.get(clean);
  if (cached) return cached;

  const hashed = await sha256Hex(`${ROOM_HASH_SALT}:${clean}`);
  rawToHashMap.set(clean, hashed);
  hashToRawMap.set(hashed, clean);
  return hashed;
}

/**
 * Resolves a hashed room ID received from Supabase back to the user's local 6-digit room code.
 */
export function resolveRawRoomCodeFromHash(hashedOrRaw: string | undefined | null): string | null {
  if (!hashedOrRaw) return null;
  if (/^\d{6}$/.test(hashedOrRaw)) return hashedOrRaw;
  return hashToRawMap.get(hashedOrRaw) || null;
}

/**
 * Computes the salted SHA-256 hex digest of a 4-digit passcode scoped to a specific room.
 */
export async function hashRoomPasscode(
  rawRoomCode: string,
  rawPasscode: string
): Promise<string> {
  const cleanRoom = rawRoomCode.replace(/\D/g, '').slice(0, 6);
  const cleanPass = rawPasscode.replace(/\D/g, '').slice(0, 4);
  return sha256Hex(`${PASSCODE_HASH_SALT}:${cleanRoom}:${cleanPass}`);
}

/**
 * Verifies an entered 4-digit passcode against a stored SHA-256 hash
 * (also supports legacy plain 4-digit passcodes gracefully).
 */
export async function verifyRoomPasscode(
  rawRoomCode: string,
  enteredPasscode: string,
  storedPasscodeOrHash: string
): Promise<boolean> {
  const expected = storedPasscodeOrHash.trim();
  const cleanEntered = enteredPasscode.replace(/\D/g, '').slice(0, 4);
  if (!expected || cleanEntered.length !== 4) return false;

  if (isSha256Hex(expected)) {
    const computed = await hashRoomPasscode(rawRoomCode, cleanEntered);
    return timingSafeEqualStrings(computed.toLowerCase(), expected.toLowerCase());
  }

  // Legacy plaintext compatibility for rooms created before hashing was enabled
  return timingSafeEqualStrings(cleanEntered, expected);
}

/**
 * Derives a non-extractable 256-bit AES-GCM CryptoKey using PBKDF2-HMAC-SHA256
 * from the raw 6-digit room code (and optional raw 4-digit passcode).
 */
export function deriveRoomAesKey(
  rawRoomCode: string,
  rawPasscode?: string | null
): Promise<CryptoKey> {
  const cleanRoom = rawRoomCode.replace(/\D/g, '').slice(0, 6);
  const cleanPass = rawPasscode ? rawPasscode.replace(/\D/g, '').slice(0, 4) : '';
  const cacheKey = `${cleanRoom}::${cleanPass}`;

  const existing = derivedKeyCache.get(cacheKey);
  if (existing) return existing;

  const keyPromise = (async () => {
    const subtle = assertWebCrypto();
    const secretMaterial = cleanPass ? `${cleanRoom}:${cleanPass}` : cleanRoom;
    const baseKey = await subtle.importKey(
      'raw',
      textEncoder.encode(secretMaterial),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    const salt = textEncoder.encode(`${E2EE_KEY_SALT_PREFIX}${cleanRoom}`);
    return subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: PBKDF2_ITERATIONS,
        hash: 'SHA-256',
      },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  })();

  derivedKeyCache.set(cacheKey, keyPromise);
  keyPromise.catch(() => {
    derivedKeyCache.delete(cacheKey);
  });
  return keyPromise;
}

/**
 * Encrypts a UTF-8 string using AES-256-GCM with a fresh random 96-bit IV.
 * Returns `e2ee:v1:<base64(iv || ciphertext_with_tag)>`.
 */
export async function encryptRoomText(
  plaintext: string,
  rawRoomCode: string,
  rawPasscode?: string | null
): Promise<string> {
  if (!plaintext) return '';
  const subtle = assertWebCrypto();
  const key = await deriveRoomAesKey(rawRoomCode, rawPasscode);
  const iv = new Uint8Array(AES_GCM_IV_BYTES);
  window.crypto.getRandomValues(iv);

  const encryptedBuffer = await subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    textEncoder.encode(plaintext)
  );
  const cipherBytes = new Uint8Array(encryptedBuffer);

  const combined = new Uint8Array(iv.length + cipherBytes.length);
  combined.set(iv, 0);
  combined.set(cipherBytes, iv.length);

  return `${E2EE_PREFIX}${bytesToBase64(combined)}`;
}

async function tryDecryptPayload(
  encryptedValue: string,
  rawRoomCode: string,
  rawPasscode?: string | null
): Promise<string | null> {
  if (!isEncryptedPayload(encryptedValue)) {
    return encryptedValue;
  }

  try {
    const subtle = assertWebCrypto();
    const encoded = encryptedValue.slice(E2EE_PREFIX.length);
    const combined = base64ToBytes(encoded);
    if (combined.length <= AES_GCM_IV_BYTES + 16) {
      return null;
    }

    const iv = combined.slice(0, AES_GCM_IV_BYTES);
    const cipherBytes = combined.slice(AES_GCM_IV_BYTES);
    const key = await deriveRoomAesKey(rawRoomCode, rawPasscode);

    const decryptedBuffer = await subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      cipherBytes
    );
    return textDecoder.decode(decryptedBuffer);
  } catch {
    return null;
  }
}

/**
 * Decrypts a room message string.
 * - Empty string stays empty.
 * - Plain legacy text (without `e2ee:v1:` prefix) is returned as-is.
 * - If a room passcode is active, attempts decryption with (roomCode + passcode) first,
 *   then gracefully falls back to base roomCode key for messages sent before a passcode was added.
 */
export async function decryptRoomText(
  value: string | null | undefined,
  rawRoomCode: string,
  rawPasscode?: string | null
): Promise<{ text: string; ok: boolean; wasEncrypted: boolean }> {
  if (!value) {
    return { text: '', ok: true, wasEncrypted: false };
  }
  if (!isEncryptedPayload(value)) {
    return { text: value, ok: true, wasEncrypted: false };
  }

  const primary = await tryDecryptPayload(value, rawRoomCode, rawPasscode);
  if (primary !== null) {
    return { text: primary, ok: true, wasEncrypted: true };
  }

  if (rawPasscode) {
    const fallback = await tryDecryptPayload(value, rawRoomCode, null);
    if (fallback !== null) {
      return { text: fallback, ok: true, wasEncrypted: true };
    }
  }

  return {
    text: '🔒 暗号化されたメッセージ（復号キーが一致しません）',
    ok: false,
    wasEncrypted: true,
  };
}

/**
 * Encrypts a ReplyReference object `{ id, sender_name, content }` as AES-GCM ciphertext string.
 */
export async function encryptReplyReference(
  reply: ReplyReference | null | undefined,
  rawRoomCode: string,
  rawPasscode?: string | null
): Promise<string | null> {
  if (!reply) return null;
  const serialized = JSON.stringify({
    id: String(reply.id || ''),
    sender_name: String(reply.sender_name || ''),
    content: String(reply.content || '').slice(0, 160),
  });
  return encryptRoomText(serialized, rawRoomCode, rawPasscode);
}

/**
 * Decrypts and safely validates a stored `reply_to` string (or legacy object) into a ReplyReference.
 */
export async function decryptReplyReference(
  rawValue: unknown,
  rawRoomCode: string,
  rawPasscode?: string | null
): Promise<ReplyReference | null> {
  if (!rawValue) return null;

  let parsedObj: Record<string, unknown> | null = null;

  if (typeof rawValue === 'string') {
    const trimmed = rawValue.trim();
    if (!trimmed) return null;

    if (isEncryptedPayload(trimmed)) {
      const dec = await decryptRoomText(trimmed, rawRoomCode, rawPasscode);
      if (!dec.ok) {
        return {
          id: '',
          sender_name: '暗号化済み',
          content: '🔒 合言葉を入力すると引用内容が表示されます',
        };
      }
      try {
        const parsed = JSON.parse(dec.text);
        if (parsed && typeof parsed === 'object') {
          parsedObj = parsed as Record<string, unknown>;
        }
      } catch {
        return null;
      }
    } else {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === 'object') {
          parsedObj = parsed as Record<string, unknown>;
        }
      } catch {
        return null;
      }
    }
  } else if (typeof rawValue === 'object') {
    parsedObj = rawValue as Record<string, unknown>;
  }

  if (!parsedObj) return null;

  const id = typeof parsedObj.id === 'string' ? parsedObj.id : '';
  const senderName =
    typeof parsedObj.sender_name === 'string' ? parsedObj.sender_name : '';
  const content = typeof parsedObj.content === 'string' ? parsedObj.content : '';

  if (!id && !senderName && !content) return null;

  return {
    id,
    sender_name: senderName || 'ゲスト',
    content,
  };
}

// ============================================================================
// Per-Message-ID In-Memory AES-GCM Decryption Cache
// Guarantees `crypto.subtle.decrypt` is NEVER re-executed for an already
// decrypted message ID (e.g. on read_by/reactions updates or re-renders).
// ============================================================================

interface CachedDecryptedMessage {
  content: string;
  contentOk: boolean;
  replyTo: ReplyReference | null;
  replyOk: boolean;
  passcodeTag: string;
}

const MAX_DECRYPTED_CACHE_ENTRIES = 4000;
const decryptedMessageCache = new Map<string, CachedDecryptedMessage>();

export function evictDecryptedMessageCache(messageId: string): void {
  if (!messageId) return;
  decryptedMessageCache.delete(messageId);
}

export function evictDecryptedMessageCacheBatch(messageIds: string[]): void {
  for (let i = 0; i < messageIds.length; i++) {
    if (messageIds[i]) {
      decryptedMessageCache.delete(messageIds[i]);
    }
  }
}

export function clearDecryptedMessageCache(): void {
  decryptedMessageCache.clear();
}

export async function decryptMessagePayloadCached(params: {
  messageId: string;
  rawContent: string | null | undefined;
  rawReplyTo: unknown;
  rawRoomCode: string;
  rawPasscode?: string | null;
}): Promise<{
  content: string;
  contentOk: boolean;
  replyTo: ReplyReference | null;
}> {
  const { messageId, rawContent, rawReplyTo, rawRoomCode, rawPasscode } = params;
  const passcodeTag = `${rawRoomCode}::${rawPasscode ? rawPasscode.replace(/\D/g, '').slice(0, 4) : ''}`;

  if (messageId) {
    const cached = decryptedMessageCache.get(messageId);
    if (cached) {
      // Once fully decrypted, NEVER re-decrypt this message ID again.
      // If a previous attempt failed, skip re-decrypting unless the passcode changed.
      if ((cached.contentOk && cached.replyOk) || cached.passcodeTag === passcodeTag) {
        return {
          content: cached.content,
          contentOk: cached.contentOk,
          replyTo: cached.replyTo,
        };
      }
    }
  }

  const [decContent, decReply] = await Promise.all([
    decryptRoomText(rawContent, rawRoomCode, rawPasscode),
    decryptReplyReference(rawReplyTo, rawRoomCode, rawPasscode),
  ]);

  const replyOk =
    !decReply || decReply.content !== '🔒 合言葉を入力すると引用内容が表示されます';

  if (messageId) {
    if (decryptedMessageCache.size >= MAX_DECRYPTED_CACHE_ENTRIES) {
      const oldestKey = decryptedMessageCache.keys().next().value;
      if (oldestKey !== undefined) {
        decryptedMessageCache.delete(oldestKey);
      }
    }
    decryptedMessageCache.set(messageId, {
      content: decContent.text,
      contentOk: decContent.ok,
      replyTo: decReply,
      replyOk,
      passcodeTag,
    });
  }

  return {
    content: decContent.text,
    contentOk: decContent.ok,
    replyTo: decReply,
  };
}

