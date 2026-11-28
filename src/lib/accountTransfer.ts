/**
 * Client-Side Encrypted Account Transfer Engine (Web Crypto API only)
 * Uses PBKDF2-HMAC-SHA256 (120,000 iterations, random 128-bit salt) -> AES-256-GCM (random 96-bit IV).
 * Format: `RLBK1:<base64url(salt || iv || ciphertext_with_tag)>`
 */

import { PRESET_AVATARS } from './constants';
import type {
  AccountTransferPayload,
  CustomSticker,
  RoomHistoryItem,
  ThemeMode,
  UserProfile,
} from '../types/chat';

export const ACCOUNT_TRANSFER_PREFIX = 'RLBK1:';
const PBKDF2_ITERATIONS = 120000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function assertWebCrypto(): SubtleCrypto {
  if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
    throw new Error(
      'このブラウザ環境では暗号化・復号機能（Web Crypto API）を利用できません。HTTPS接続をご確認ください。'
    );
  }
  return window.crypto.subtle;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(input: string): Uint8Array<ArrayBuffer> {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padLength = (4 - (normalized.length % 4)) % 4;
  const padded = normalized + '='.repeat(padLength);
  const binary = atob(padded);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function deriveTransferAesKey(
  password: string,
  salt: Uint8Array<ArrayBuffer>
): Promise<CryptoKey> {
  const subtle = assertWebCrypto();
  const baseKey = await subtle.importKey(
    'raw',
    textEncoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

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
}

export function isValidTransferCodeFormat(raw: string): boolean {
  const cleaned = raw.trim().replace(/\s+/g, '');
  return cleaned.startsWith(ACCOUNT_TRANSFER_PREFIX) && cleaned.length > 48;
}

/**
 * Encrypts an AccountTransferPayload with a user-supplied password (PIN or passphrase).
 */
export async function encryptAccountTransferPayload(
  payload: AccountTransferPayload,
  password: string
): Promise<string> {
  const cleanPassword = password.trim();
  if (cleanPassword.length < 4) {
    throw new Error('引き継ぎ用パスワードは4文字以上で設定してください。');
  }

  const subtle = assertWebCrypto();
  const salt = new Uint8Array(new ArrayBuffer(SALT_BYTES));
  const iv = new Uint8Array(new ArrayBuffer(IV_BYTES));
  window.crypto.getRandomValues(salt);
  window.crypto.getRandomValues(iv);

  const key = await deriveTransferAesKey(cleanPassword, salt);
  const plaintextBytes = textEncoder.encode(JSON.stringify(payload));
  const encryptedBuffer = await subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plaintextBytes
  );
  const cipherBytes = new Uint8Array(encryptedBuffer);

  const combined = new Uint8Array(salt.length + iv.length + cipherBytes.length);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(cipherBytes, salt.length + iv.length);

  return `${ACCOUNT_TRANSFER_PREFIX}${bytesToBase64Url(combined)}`;
}

/**
 * Creates a QR-compact variant of the transfer payload when custom base64 images
 * would exceed QR code capacity, preserving user ID, nickname, all rooms, and E2EE passcodes.
 */
export function buildCompactQrPayload(
  payload: AccountTransferPayload
): AccountTransferPayload {
  const compactProfile: UserProfile =
    payload.profile.avatarType === 'custom' &&
    payload.profile.avatarValue.startsWith('data:')
      ? {
          ...payload.profile,
          avatarType: 'initial',
          avatarValue: '',
        }
      : payload.profile;

  const compactStickers = payload.customStickers
    .filter((s) => !s.url.startsWith('data:'))
    .slice(0, 12);

  return {
    ...payload,
    profile: compactProfile,
    customStickers: compactStickers,
    recentRooms: payload.recentRooms.slice(0, 20).map((r) => ({
      ...r,
      lastMessage: (r.lastMessage || '').slice(0, 40),
    })),
  };
}

function sanitizeRestoredPayload(raw: unknown): AccountTransferPayload {
  if (!raw || typeof raw !== 'object') {
    throw new Error('復元データの構造が正しくありません。');
  }

  const obj = raw as Record<string, unknown>;
  const rawProfile = obj.profile as Partial<UserProfile> | undefined;
  if (
    !rawProfile ||
    typeof rawProfile.id !== 'string' ||
    !rawProfile.id.trim()
  ) {
    throw new Error('引き継ぎデータに有効なアカウント情報が含まれていません。');
  }

  const avatarType =
    rawProfile.avatarType === 'preset' ||
    rawProfile.avatarType === 'initial' ||
    rawProfile.avatarType === 'custom'
      ? rawProfile.avatarType
      : 'preset';

  const profile: UserProfile = {
    id: rawProfile.id.trim(),
    nickname:
      typeof rawProfile.nickname === 'string' && rawProfile.nickname.trim()
        ? rawProfile.nickname.trim().slice(0, 24)
        : 'ゲスト',
    statusMessage:
      typeof rawProfile.statusMessage === 'string'
        ? rawProfile.statusMessage.slice(0, 60)
        : '',
    avatarType,
    avatarValue:
      typeof rawProfile.avatarValue === 'string'
        ? rawProfile.avatarValue
        : avatarType === 'preset'
          ? PRESET_AVATARS[0].url
          : '',
    avatarColor:
      typeof rawProfile.avatarColor === 'string' && rawProfile.avatarColor
        ? rawProfile.avatarColor
        : 'emerald',
    coverTheme:
      rawProfile.coverTheme === 'midnight' ||
      rawProfile.coverTheme === 'ocean' ||
      rawProfile.coverTheme === 'forest' ||
      rawProfile.coverTheme === 'twilight' ||
      rawProfile.coverTheme === 'crimson' ||
      rawProfile.coverTheme === 'slate'
        ? rawProfile.coverTheme
        : 'forest',
    bubbleTheme:
      rawProfile.bubbleTheme === 'blue' ||
      rawProfile.bubbleTheme === 'line-green' ||
      rawProfile.bubbleTheme === 'sky' ||
      rawProfile.bubbleTheme === 'indigo' ||
      rawProfile.bubbleTheme === 'rose' ||
      rawProfile.bubbleTheme === 'amber'
        ? rawProfile.bubbleTheme
        : 'line-green',
    wallpaperTheme:
      rawProfile.wallpaperTheme === 'slate' ||
      rawProfile.wallpaperTheme === 'midnight' ||
      rawProfile.wallpaperTheme === 'dots' ||
      rawProfile.wallpaperTheme === 'grid' ||
      rawProfile.wallpaperTheme === 'charcoal'
        ? rawProfile.wallpaperTheme
        : 'slate',
  };

  const recentRooms: RoomHistoryItem[] = Array.isArray(obj.recentRooms)
    ? obj.recentRooms
        .map((item) => {
          const rec = item as Partial<RoomHistoryItem>;
          const code = String(rec.roomCode || '').replace(/\D/g, '').slice(0, 6);
          return {
            roomCode: code,
            title: typeof rec.title === 'string' ? rec.title : '',
            passcode: typeof rec.passcode === 'string' ? rec.passcode : null,
            lastMessage: typeof rec.lastMessage === 'string' ? rec.lastMessage : '',
            lastSender: typeof rec.lastSender === 'string' ? rec.lastSender : '',
            lastAt:
              typeof rec.lastAt === 'string' && rec.lastAt
                ? rec.lastAt
                : new Date().toISOString(),
            unreadCount:
              typeof rec.unreadCount === 'number' ? Math.max(0, rec.unreadCount) : 0,
          };
        })
        .filter((r) => r.roomCode.length === 6)
        .slice(0, 20)
    : [];

  const roomPasscodes: Record<string, string> = {};
  if (obj.roomPasscodes && typeof obj.roomPasscodes === 'object') {
    Object.entries(obj.roomPasscodes as Record<string, unknown>).forEach(
      ([code, pass]) => {
        const cleanCode = code.replace(/\D/g, '').slice(0, 6);
        const cleanPass =
          typeof pass === 'string' ? pass.replace(/\D/g, '').slice(0, 4) : '';
        if (cleanCode.length === 6 && cleanPass.length === 4) {
          roomPasscodes[cleanCode] = cleanPass;
        }
      }
    );
  }

  const customStickers: CustomSticker[] = Array.isArray(obj.customStickers)
    ? obj.customStickers
        .filter(
          (item): item is CustomSticker =>
            Boolean(
              item &&
                typeof (item as CustomSticker).id === 'string' &&
                typeof (item as CustomSticker).url === 'string'
            )
        )
        .slice(0, 30)
    : [];

  const themeMode: ThemeMode = obj.themeMode === 'dark' ? 'dark' : 'light';
  const officialLastReadAt =
    typeof obj.officialLastReadAt === 'string' ? obj.officialLastReadAt : null;

  return {
    version: 1,
    exportedAt:
      typeof obj.exportedAt === 'string' ? obj.exportedAt : new Date().toISOString(),
    profile,
    recentRooms,
    roomPasscodes,
    customStickers,
    themeMode,
    officialLastReadAt,
  };
}

/**
 * Decrypts and validates an encrypted account transfer code using the user's password.
 */
export async function decryptAccountTransferPayload(
  rawTransferCode: string,
  password: string
): Promise<AccountTransferPayload> {
  const cleanedCode = rawTransferCode.trim().replace(/\s+/g, '');
  const cleanPassword = password.trim();

  if (!cleanedCode.startsWith(ACCOUNT_TRANSFER_PREFIX)) {
    throw new Error(
      '引き継ぎコードの形式が正しくありません。「RLBK1:」から始まるコード全体を入力してください。'
    );
  }
  if (cleanPassword.length < 4) {
    throw new Error('引き継ぎ用パスワード（4文字以上）を入力してください。');
  }

  const subtle = assertWebCrypto();
  let combined: Uint8Array<ArrayBuffer>;
  try {
    combined = base64UrlToBytes(cleanedCode.slice(ACCOUNT_TRANSFER_PREFIX.length));
  } catch {
    throw new Error(
      '引き継ぎコードの読み込みに失敗しました。文字列が途中で途切れていないかご確認ください。'
    );
  }

  if (combined.length <= SALT_BYTES + IV_BYTES + 16) {
    throw new Error('引き継ぎコードが破損しています。発行し直してください。');
  }

  const salt = combined.slice(0, SALT_BYTES);
  const iv = combined.slice(SALT_BYTES, SALT_BYTES + IV_BYTES);
  const cipherBytes = combined.slice(SALT_BYTES + IV_BYTES);

  let decryptedBuffer: ArrayBuffer;
  try {
    const key = await deriveTransferAesKey(cleanPassword, salt);
    decryptedBuffer = await subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      cipherBytes
    );
  } catch {
    throw new Error(
      '引き継ぎ用パスワードが一致しないか、コードが破損しています。パスワードをご確認のうえ再度お試しください。'
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(textDecoder.decode(decryptedBuffer));
  } catch {
    throw new Error('復号されたデータの解析に失敗しました。');
  }

  return sanitizeRestoredPayload(parsed);
}
