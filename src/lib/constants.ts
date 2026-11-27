import type { BubbleThemeId, CoverThemeId, WallpaperThemeId } from '../types/chat';

/**
 * Supabase接続設定（環境変数 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY のみから自動読み込み）
 */
export const DEFAULT_SUPABASE_URL =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || '';
export const DEFAULT_SUPABASE_ANON_KEY =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() || '';

export interface PresetAvatar {
  id: string;
  label: string;
  url: string;
  zoomClass?: string;
}

export const PRESET_AVATARS: PresetAvatar[] = [
  {
    id: 'shiba',
    label: 'ヘッドホン柴犬',
    url: '/src/assets/images/avatar_shiba_slate_1795765785088.jpg',
  },
  {
    id: 'cat',
    label: '月夜の黒猫',
    url: '/src/assets/images/avatar_cat_night_1795765786199.jpg',
  },
  {
    id: 'astronaut',
    label: '星見の探検家',
    url: '/src/assets/images/avatar_astronaut_blue_1795765788087.jpg',
    zoomClass: 'scale-125',
  },
  {
    id: 'coffee',
    label: '静かな珈琲',
    url: '/src/assets/images/avatar_coffee_botanical_1795765788573.jpg',
  },
];

export interface AvatarColorOption {
  id: string;
  label: string;
  bgClass: string;
  hex: string;
}

export const AVATAR_COLORS: AvatarColorOption[] = [
  { id: 'blue', label: 'コバルト', bgClass: 'bg-blue-600', hex: '#2563eb' },
  { id: 'emerald', label: 'エメラルド', bgClass: 'bg-emerald-600', hex: '#059669' },
  { id: 'indigo', label: 'インディゴ', bgClass: 'bg-indigo-600', hex: '#4f46e5' },
  { id: 'sky', label: 'スカイ', bgClass: 'bg-sky-600', hex: '#0284c7' },
  { id: 'rose', label: 'ローズ', bgClass: 'bg-rose-600', hex: '#e11d48' },
  { id: 'amber', label: 'アンバー', bgClass: 'bg-amber-600', hex: '#d97706' },
  { id: 'violet', label: 'バイオレット', bgClass: 'bg-violet-600', hex: '#7c3aed' },
  { id: 'slate', label: 'スレート', bgClass: 'bg-slate-600', hex: '#475569' },
];

export interface BubbleThemeOption {
  id: BubbleThemeId;
  label: string;
  bubbleClass: string;
  tailColor: string;
  swatchClass: string;
}

export const BUBBLE_THEMES: BubbleThemeOption[] = [
  {
    id: 'line-green',
    label: 'エメラルドグリーン',
    bubbleClass: 'bg-emerald-500 dark:bg-emerald-600 text-white',
    tailColor: '#10b981',
    swatchClass: 'bg-emerald-500',
  },
  {
    id: 'sky',
    label: 'スカイブルー',
    bubbleClass: 'bg-sky-500 dark:bg-sky-600 text-white',
    tailColor: '#0ea5e9',
    swatchClass: 'bg-sky-500',
  },
  {
    id: 'blue',
    label: 'コバルトブルー',
    bubbleClass: 'bg-blue-500 dark:bg-blue-600 text-white',
    tailColor: '#3b82f6',
    swatchClass: 'bg-blue-500',
  },
  {
    id: 'indigo',
    label: 'インディゴ',
    bubbleClass: 'bg-indigo-500 dark:bg-indigo-600 text-white',
    tailColor: '#6366f1',
    swatchClass: 'bg-indigo-500',
  },
  {
    id: 'rose',
    label: 'コーラルローズ',
    bubbleClass: 'bg-rose-500 dark:bg-rose-600 text-white',
    tailColor: '#f43f5e',
    swatchClass: 'bg-rose-500',
  },
  {
    id: 'amber',
    label: 'ウォームアンバー',
    bubbleClass: 'bg-amber-500 dark:bg-amber-600 text-white',
    tailColor: '#f59e0b',
    swatchClass: 'bg-amber-500',
  },
];

export interface CoverThemeOption {
  id: CoverThemeId;
  label: string;
  gradientClass: string;
}

export const COVER_THEMES: CoverThemeOption[] = [
  {
    id: 'forest',
    label: 'フレッシュミント',
    gradientClass:
      'from-emerald-400 via-teal-500 to-sky-500 dark:from-slate-900 dark:via-emerald-950 dark:to-slate-900',
  },
  {
    id: 'ocean',
    label: 'クリアスカイ',
    gradientClass:
      'from-sky-400 via-blue-500 to-indigo-500 dark:from-blue-950 dark:via-sky-900 dark:to-slate-900',
  },
  {
    id: 'midnight',
    label: 'ミッドナイト',
    gradientClass:
      'from-slate-700 via-blue-800 to-slate-800 dark:from-slate-900 dark:via-blue-950 dark:to-slate-900',
  },
  {
    id: 'twilight',
    label: 'トワイライト',
    gradientClass:
      'from-indigo-400 via-violet-500 to-sky-500 dark:from-indigo-950 dark:via-slate-900 dark:to-blue-950',
  },
  {
    id: 'crimson',
    label: 'ダスクローズ',
    gradientClass:
      'from-rose-400 via-pink-500 to-amber-400 dark:from-slate-900 dark:via-rose-950 dark:to-slate-900',
  },
  {
    id: 'slate',
    label: 'モノクローム',
    gradientClass:
      'from-slate-400 via-slate-500 to-slate-600 dark:from-slate-800 dark:via-slate-900 dark:to-slate-950',
  },
];

export interface WallpaperThemeOption {
  id: WallpaperThemeId;
  label: string;
  bgClass: string;
  previewClass: string;
}

export const WALLPAPER_THEMES: WallpaperThemeOption[] = [
  {
    id: 'slate',
    label: 'ソフトブルーグレー',
    bgClass: 'bg-[#EDF2F7] dark:bg-[#0b1221]',
    previewClass: 'bg-[#EDF2F7] dark:bg-[#0b1221]',
  },
  {
    id: 'midnight',
    label: 'クリアスカイ',
    bgClass:
      'bg-gradient-to-b from-[#E6F2FA] via-[#EDF2F7] to-[#E2E8F0] dark:from-[#0b1529] dark:via-[#0e1a33] dark:to-[#0a1120]',
    previewClass: 'bg-[#E6F2FA] dark:bg-[#0e1a33]',
  },
  {
    id: 'dots',
    label: 'ドットパターン',
    bgClass: 'bg-[#EDF2F7] dark:bg-[#0c1322] wallpaper-dots',
    previewClass: 'bg-[#EDF2F7] dark:bg-[#0c1322] wallpaper-dots',
  },
  {
    id: 'grid',
    label: 'グリッドライン',
    bgClass: 'bg-[#F1F5F9] dark:bg-[#0b111e] wallpaper-grid',
    previewClass: 'bg-[#F1F5F9] dark:bg-[#0b111e] wallpaper-grid',
  },
  {
    id: 'charcoal',
    label: 'クールグレー',
    bgClass: 'bg-[#E2E8F0] dark:bg-[#111318]',
    previewClass: 'bg-[#E2E8F0] dark:bg-[#111318]',
  },
];

export interface QuickStamp {
  id: string;
  emoji: string;
  text: string;
}

export const QUICK_STAMPS: QuickStamp[] = [
  { id: 'ok', emoji: '👍', text: '了解しました！' },
  { id: 'thanks', emoji: '🙏', text: 'ありがとうございます！' },
  { id: 'otsukare', emoji: '☕', text: 'おつかれさまです' },
  { id: 'omw', emoji: '🏃', text: '今向かってます！' },
  { id: 'laugh', emoji: '😂', text: 'それは最高ですね！' },
  { id: 'wait', emoji: '⏳', text: '少しお待ちください' },
  { id: 'cheer', emoji: '✨', text: 'いいですね！' },
  { id: 'bye', emoji: '👋', text: 'またあとで！' },
];

const GUEST_ADJECTIVES = [
  '静かな',
  '夜更かし',
  '旅する',
  '気ままな',
  '星見の',
  '珈琲好きの',
  '早起きの',
  '音楽好きの',
  '風まかせの',
  '月夜の',
];

const GUEST_NOUNS = [
  '柴犬',
  '黒猫',
  'ペンギン',
  'フクロウ',
  'キツネ',
  'パンダ',
  'カワウソ',
  'レッサー',
  'シロクマ',
  'コアラ',
];

export function generateGuestName(): string {
  const adj = GUEST_ADJECTIVES[Math.floor(Math.random() * GUEST_ADJECTIVES.length)];
  const noun = GUEST_NOUNS[Math.floor(Math.random() * GUEST_NOUNS.length)];
  const num = Math.floor(10 + Math.random() * 90);
  return `${adj}${noun}${num}`;
}

export function generateRoomCode(): string {
  const num = Math.floor(100000 + Math.random() * 900000);
  return String(num);
}

export function formatRoomCode(code: string): string {
  const clean = code.replace(/\D/g, '').slice(0, 6);
  if (clean.length <= 3) return clean;
  return `${clean.slice(0, 3)} ${clean.slice(3)}`;
}

export function getRoomDisplayTitle(roomCode: string, title?: string | null): string {
  const trimmed = (title || '').trim();
  if (trimmed) return trimmed;
  return `ルーム ${formatRoomCode(roomCode)}`;
}

export function formatTimeHHMM(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '--:--';
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function formatDateDivider(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (isToday) return '今日';

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate();

  if (isYesterday) return '昨日';

  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const w = weekdays[date.getDay()];
  if (date.getFullYear() === now.getFullYear()) {
    return `${m}月${d}日(${w})`;
  }
  return `${date.getFullYear()}年${m}月${d}日(${w})`;
}

export const REACTION_EMOJIS = ['👍', '😂', '❤️', '🔥', '🙏'] as const;

export const OFFICIAL_ROOM_ID = '__ROOMLINE_OFFICIAL__';
export const SYSTEM_MAINTENANCE_ROOM_KEY = '__ROOMLINE_SYSTEM_MAINTENANCE__';
export const REPORT_REASONS = ['スパム・荒らし', '不適切な発言', 'その他'] as const;
