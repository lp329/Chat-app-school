/**
 * Admin 2-Step Verification Helper (Web Crypto API SHA-256 Digest Comparison Only)
 * No raw admin email, password, or PIN is ever stored in source code.
 */

import { timingSafeEqualStrings } from './crypto';

const ADMIN_ID_SALT = 'roomline::admin::id::';
const ADMIN_PW_SALT = 'roomline::admin::pw::';
const ADMIN_PIN_SALT = 'roomline::admin::pin::';

const EXPECTED_ADMIN_ID_HASH =
  'aa67d4745f3d96acbff91745c0ac6421f3fbf3f579ce00cc4a8adb3f7b509d60';
const EXPECTED_ADMIN_PW_HASH =
  '6b3e07a8e1b21bcf3c7dbfe5d9fedfb4b5c89850a5b61cc064b2990a6cc8eddd';
const EXPECTED_ADMIN_PIN_HASH =
  '97f50ff4dbe29cd972e44dbf595bb75a7afc8c0b80d0455f572ebf508ff9f0c1';

const ADMIN_SESSION_STORAGE_KEY = 'roomline_admin_auth_session_v1';

const encoder = new TextEncoder();

async function digestSha256Hex(value: string): Promise<string> {
  if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
    throw new Error('Web Crypto API が利用できません。');
  }
  const buffer = await window.crypto.subtle.digest('SHA-256', encoder.encode(value));
  const bytes = new Uint8Array(buffer);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

export async function verifyAdminStep1Credentials(
  emailInput: string,
  passwordInput: string
): Promise<boolean> {
  const normalizedId = emailInput.trim().toLowerCase();
  if (!normalizedId || !passwordInput) return false;

  const [idHash, pwHash] = await Promise.all([
    digestSha256Hex(`${ADMIN_ID_SALT}${normalizedId}`),
    digestSha256Hex(`${ADMIN_PW_SALT}${passwordInput}`),
  ]);

  const idOk = timingSafeEqualStrings(idHash, EXPECTED_ADMIN_ID_HASH);
  const pwOk = timingSafeEqualStrings(pwHash, EXPECTED_ADMIN_PW_HASH);
  return idOk && pwOk;
}

export async function verifyAdminStep2Pin(pinInput: string): Promise<boolean> {
  const cleanPin = pinInput.replace(/\D/g, '').slice(0, 4);
  if (cleanPin.length !== 4) return false;

  const pinHash = await digestSha256Hex(`${ADMIN_PIN_SALT}${cleanPin}`);
  return timingSafeEqualStrings(pinHash, EXPECTED_ADMIN_PIN_HASH);
}

export function isAdminSessionActive(): boolean {
  try {
    const raw = sessionStorage.getItem(ADMIN_SESSION_STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { authenticated?: boolean; issuedAt?: number };
    return Boolean(parsed && parsed.authenticated === true && typeof parsed.issuedAt === 'number');
  } catch {
    return false;
  }
}

export function grantAdminSession(): void {
  try {
    sessionStorage.setItem(
      ADMIN_SESSION_STORAGE_KEY,
      JSON.stringify({
        authenticated: true,
        issuedAt: Date.now(),
      })
    );
  } catch {
    // Ignore storage errors
  }
}

export function clearAdminSession(): void {
  try {
    sessionStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
  } catch {
    // Ignore
  }
}
