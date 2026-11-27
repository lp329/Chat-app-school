import type { BubbleThemeId, CoverThemeId, WallpaperThemeId } from '../types/chat';

/**
 * Supabase接続設定（コード内の定数または環境変数から設定可能）
 * 未設定の場合はアプリ内の歯車アイコン（接続設定モーダル）から入力・保存でき、
 * 設定前でもローカルモックモードでリアルタイム風のUI確認が可能です。
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
    id: 'blue',
    label: 'コバルトブルー',
    bubbleClass: 'bg-blue-600 text-white',
    tailColor: '#2563eb',
    swatchClass: 'bg-blue-600',
  },
  {
    id: 'sky',
    label: 'オーシャンスカイ',
    bubbleClass: 'bg-sky-600 text-white',
    tailColor: '#0284c7',
    swatchClass: 'bg-sky-600',
  },
  {
    id: 'line-green',
    label: 'ライムグリーン',
    bubbleClass: 'bg-emerald-600 text-white',
    tailColor: '#059669',
    swatchClass: 'bg-emerald-600',
  },
  {
    id: 'indigo',
    label: 'ナイトインディゴ',
    bubbleClass: 'bg-indigo-600 text-white',
    tailColor: '#4f46e5',
    swatchClass: 'bg-indigo-600',
  },
  {
    id: 'rose',
    label: 'ダスティローズ',
    bubbleClass: 'bg-rose-600 text-white',
    tailColor: '#e11d48',
    swatchClass: 'bg-rose-600',
  },
  {
    id: 'amber',
    label: 'ウォームアンバー',
    bubbleClass: 'bg-amber-600 text-white',
    tailColor: '#d97706',
    swatchClass: 'bg-amber-600',
  },
];

export interface CoverThemeOption {
  id: CoverThemeId;
  label: string;
  gradientClass: string;
}

export const COVER_THEMES: CoverThemeOption[] = [
  {
    id: 'midnight',
    label: 'ミッドナイト',
    gradientClass: 'from-slate-900 via-blue-950 to-slate-900',
  },
  {
    id: 'ocean',
    label: 'ディープブルー',
    gradientClass: 'from-blue-950 via-sky-900 to-slate-900',
  },
  {
    id: 'forest',
    label: 'ナイトフォレスト',
    gradientClass: 'from-slate-900 via-emerald-950 to-slate-900',
  },
  {
    id: 'twilight',
    label: 'トワイライト',
    gradientClass: 'from-indigo-950 via-slate-900 to-blue-950',
  },
  {
    id: 'crimson',
    label: 'ダスクローズ',
    gradientClass: 'from-slate-900 via-rose-950 to-slate-900',
  },
  {
    id: 'slate',
    label: 'モノクローム',
    gradientClass: 'from-slate-800 via-slate-900 to-slate-950',
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
    label: 'ダークスレート',
    bgClass: 'bg-[#0b1221]',
    previewClass: 'bg-[#0b1221]',
  },
  {
    id: 'midnight',
    label: 'ミッドナイトネイビー',
    bgClass: 'bg-gradient-to-b from-[#0b1529] via-[#0e1a33] to-[#0a1120]',
    previewClass: 'bg-[#0e1a33]',
  },
  {
    id: 'dots',
    label: 'ドットパターン',
    bgClass: 'bg-[#0c1322] wallpaper-dots',
    previewClass: 'bg-[#0c1322] wallpaper-dots',
  },
  {
    id: 'grid',
    label: 'グリッドライン',
    bgClass: 'bg-[#0b111e] wallpaper-grid',
    previewClass: 'bg-[#0b111e] wallpaper-grid',
  },
  {
    id: 'charcoal',
    label: 'チャコールブラック',
    bgClass: 'bg-[#111318]',
    previewClass: 'bg-[#111318]',
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

export const SUPABASE_SETUP_SQL = `-- 1. messages テーブルを作成
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  room_code text not null,
  sender_name text not null,
  content text not null,
  sender_id text,
  sender_avatar text,
  sender_color text,
  created_at timestamptz not null default now()
);

-- 2. ルーム検索用インデックス
create index if not exists idx_messages_room_code_created_at
  on public.messages (room_code, created_at asc);

-- 3. RLS を有効化し、匿名チャット用に読み書きを許可
alter table public.messages enable row level security;

create policy "Anyone can read room messages"
  on public.messages for select using (true);

create policy "Anyone can insert room messages"
  on public.messages for insert with check (true);

-- 4. Supabase Realtime を有効化
alter publication supabase_realtime add table public.messages;`;
