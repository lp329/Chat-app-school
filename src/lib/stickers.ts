export interface DefaultSticker {
  id: string;
  value: string; // Stored in messages.sticker_url as "preset:<id>"
  label: string;
  sublabel: string;
  bgFrom: string;
  bgTo: string;
  accent: string;
  textColor: string;
  motif:
    | 'ryokai'
    | 'arigatou'
    | 'kusa'
    | 'sorena'
    | 'nemui'
    | 'kami'
    | 'muri'
    | 'otsukare'
    | 'omedetou'
    | 'matte'
    | 'iine'
    | 'matane';
}

export const PRESET_STICKER_PREFIX = 'preset:';

export const DEFAULT_STICKERS: DefaultSticker[] = [
  {
    id: 'ryokai',
    value: 'preset:ryokai',
    label: '了解！',
    sublabel: 'OK!',
    bgFrom: '#065f46',
    bgTo: '#0f766e',
    accent: '#34d399',
    textColor: '#ecfdf5',
    motif: 'ryokai',
  },
  {
    id: 'arigatou',
    value: 'preset:arigatou',
    label: 'ありがとう！',
    sublabel: 'THANKS',
    bgFrom: '#9f1239',
    bgTo: '#be123c',
    accent: '#fda4af',
    textColor: '#fff1f2',
    motif: 'arigatou',
  },
  {
    id: 'kusa',
    value: 'preset:kusa',
    label: '草',
    sublabel: 'LOL',
    bgFrom: '#166534',
    bgTo: '#15803d',
    accent: '#86efac',
    textColor: '#f0fdf4',
    motif: 'kusa',
  },
  {
    id: 'sorena',
    value: 'preset:sorena',
    label: 'それな',
    sublabel: 'TRUE!',
    bgFrom: '#1d4ed8',
    bgTo: '#2563eb',
    accent: '#93c5fd',
    textColor: '#eff6ff',
    motif: 'sorena',
  },
  {
    id: 'nemui',
    value: 'preset:nemui',
    label: '眠い',
    sublabel: 'Zzz...',
    bgFrom: '#312e81',
    bgTo: '#1e1b4b',
    accent: '#a5b4fc',
    textColor: '#eef2ff',
    motif: 'nemui',
  },
  {
    id: 'kami',
    value: 'preset:kami',
    label: '神',
    sublabel: 'GOD TIER',
    bgFrom: '#92400e',
    bgTo: '#b45309',
    accent: '#fde047',
    textColor: '#fefce8',
    motif: 'kami',
  },
  {
    id: 'muri',
    value: 'preset:muri',
    label: '無理',
    sublabel: 'NOPE',
    bgFrom: '#334155',
    bgTo: '#1e293b',
    accent: '#fb7185',
    textColor: '#f8fafc',
    motif: 'muri',
  },
  {
    id: 'otsukare',
    value: 'preset:otsukare',
    label: 'おつかれ',
    sublabel: 'CHEERS',
    bgFrom: '#78350f',
    bgTo: '#9a3412',
    accent: '#fdba74',
    textColor: '#fff7ed',
    motif: 'otsukare',
  },
  {
    id: 'omedetou',
    value: 'preset:omedetou',
    label: 'おめでとう！',
    sublabel: 'CONGRATS',
    bgFrom: '#6d28d9',
    bgTo: '#4f46e5',
    accent: '#f9a8d4',
    textColor: '#faf5ff',
    motif: 'omedetou',
  },
  {
    id: 'matte',
    value: 'preset:matte',
    label: '待って！',
    sublabel: 'WAIT',
    bgFrom: '#0369a1',
    bgTo: '#0284c7',
    accent: '#7dd3fc',
    textColor: '#f0f9ff',
    motif: 'matte',
  },
  {
    id: 'iine',
    value: 'preset:iine',
    label: 'いいね！',
    sublabel: 'NICE!',
    bgFrom: '#0f766e',
    bgTo: '#0284c7',
    accent: '#67e8f9',
    textColor: '#ecfeff',
    motif: 'iine',
  },
  {
    id: 'matane',
    value: 'preset:matane',
    label: 'またね！',
    sublabel: 'SEE YA',
    bgFrom: '#4338ca',
    bgTo: '#6d28d9',
    accent: '#fcd34d',
    textColor: '#eef2ff',
    motif: 'matane',
  },
];

export function findDefaultSticker(stickerUrl?: string | null): DefaultSticker | null {
  if (!stickerUrl || !stickerUrl.startsWith(PRESET_STICKER_PREFIX)) return null;
  const id = stickerUrl.slice(PRESET_STICKER_PREFIX.length);
  return DEFAULT_STICKERS.find((s) => s.id === id) || null;
}

export function getStickerPreviewLabel(stickerUrl?: string | null): string {
  const preset = findDefaultSticker(stickerUrl);
  if (preset) return `スタンプ「${preset.label}」`;
  return 'スタンプを送信しました';
}
