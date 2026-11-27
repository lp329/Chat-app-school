import { useState } from 'react';
import { AVATAR_COLORS, PRESET_AVATARS } from '../lib/constants';
import type { AvatarType } from '../types/chat';

interface AvatarProps {
  name: string;
  avatarType?: AvatarType;
  avatarValue?: string | null;
  avatarColor?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE_MAP = {
  xs: 'w-7 h-7 text-xs',
  sm: 'w-9 h-9 text-sm',
  md: 'w-11 h-11 text-base',
  lg: 'w-16 h-16 text-xl',
  xl: 'w-24 h-24 text-3xl',
};

function pickColorFromName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index].bgClass;
}

function getInitial(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  return Array.from(trimmed)[0].toUpperCase();
}

export function Avatar({
  name,
  avatarType,
  avatarValue,
  avatarColor,
  size = 'md',
  className = '',
}: AvatarProps) {
  const [imgError, setImgError] = useState(false);

  const isImageUrl =
    !imgError &&
    avatarValue &&
    (avatarType === 'preset' ||
      avatarType === 'custom' ||
      avatarValue.startsWith('/') ||
      avatarValue.startsWith('data:image/') ||
      avatarValue.startsWith('http'));

  const presetMatch = isImageUrl
    ? PRESET_AVATARS.find((p) => p.url === avatarValue)
    : undefined;

  const matchedColor =
    AVATAR_COLORS.find((c) => c.id === avatarColor)?.bgClass || pickColorFromName(name || 'G');

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-full select-none flex items-center justify-center font-semibold text-white ring-1 ring-white/10 ${
        SIZE_MAP[size]
      } ${!isImageUrl ? matchedColor : 'bg-slate-800'} ${className}`}
      aria-label={name ? `${name}のアバター` : 'アバター'}
    >
      {isImageUrl ? (
        <img
          src={avatarValue}
          alt={name || 'プロフィール画像'}
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className={`w-full h-full object-cover ${presetMatch?.zoomClass || ''}`}
        />
      ) : (
        <span>{getInitial(name)}</span>
      )}
    </div>
  );
}
