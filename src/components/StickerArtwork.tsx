import { memo, useState } from 'react';
import { findDefaultSticker, type DefaultSticker } from '../lib/stickers';

interface StickerArtworkProps {
  stickerUrl: string;
  size?: 'picker' | 'chat';
  className?: string;
}

function renderMotifIcon(sticker: DefaultSticker) {
  switch (sticker.motif) {
    case 'ryokai':
      return (
        <g>
          <circle cx="64" cy="48" r="24" fill={sticker.accent} opacity="0.22" />
          <path
            d="M50 49 L60 59 L79 38"
            fill="none"
            stroke={sticker.accent}
            strokeWidth="7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="96" cy="30" r="4" fill={sticker.accent} />
          <circle cx="32" cy="34" r="3" fill={sticker.accent} opacity="0.7" />
        </g>
      );
    case 'arigatou':
      return (
        <g>
          <path
            d="M64 71 C64 71 39 55 39 40 C39 32 45 27 52 27 C57 27 61 30 64 34 C67 30 71 27 76 27 C83 27 89 32 89 40 C89 55 64 71 64 71 Z"
            fill={sticker.accent}
          />
          <path
            d="M50 38 C50 35 53 33 56 34"
            fill="none"
            stroke="#ffffff"
            strokeWidth="3"
            strokeLinecap="round"
            opacity="0.75"
          />
          <circle cx="96" cy="30" r="3.5" fill="#fde68a" />
          <circle cx="30" cy="46" r="3" fill="#fde68a" opacity="0.8" />
        </g>
      );
    case 'kusa':
      return (
        <g>
          <path
            d="M64 68 L64 42"
            stroke={sticker.accent}
            strokeWidth="5"
            strokeLinecap="round"
          />
          <path
            d="M64 49 C50 48 41 37 44 26 C55 26 63 34 64 49 Z"
            fill={sticker.accent}
          />
          <path
            d="M64 44 C78 43 87 32 84 21 C73 21 65 29 64 44 Z"
            fill="#4ade80"
          />
          <path
            d="M36 68 Q64 60 92 68"
            fill="none"
            stroke={sticker.accent}
            strokeWidth="4"
            strokeLinecap="round"
            opacity="0.7"
          />
        </g>
      );
    case 'sorena':
      return (
        <g>
          <circle cx="64" cy="47" r="23" fill={sticker.accent} opacity="0.2" />
          <path
            d="M44 50 L62 50 L62 34 L84 48 L62 62 L62 50"
            fill={sticker.accent}
            stroke={sticker.accent}
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path
            d="M35 32 L41 38 M33 48 L39 48 M35 64 L41 58"
            stroke={sticker.accent}
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        </g>
      );
    case 'nemui':
      return (
        <g>
          <path
            d="M72 28 C58 28 47 39 47 52 C47 64 58 72 71 70 C62 67 57 59 57 50 C57 40 63 32 72 28 Z"
            fill="#fde68a"
          />
          <text
            x="73"
            y="43"
            fill={sticker.accent}
            fontSize="15"
            fontWeight="800"
            fontFamily="sans-serif"
          >
            Z
          </text>
          <text
            x="84"
            y="33"
            fill={sticker.accent}
            fontSize="11"
            fontWeight="700"
            fontFamily="sans-serif"
            opacity="0.8"
          >
            z
          </text>
          <circle cx="38" cy="34" r="2.5" fill="#fde68a" opacity="0.7" />
        </g>
      );
    case 'kami':
      return (
        <g>
          <ellipse
            cx="64"
            cy="27"
            rx="22"
            ry="6"
            fill="none"
            stroke={sticker.accent}
            strokeWidth="4.5"
          />
          <polygon
            points="64,36 69,48 82,49 72,58 75,71 64,64 53,71 56,58 46,49 59,48"
            fill={sticker.accent}
          />
        </g>
      );
    case 'muri':
      return (
        <g>
          <circle cx="64" cy="48" r="22" fill={sticker.accent} opacity="0.16" />
          <path
            d="M49 38 L57 46 M57 38 L49 46"
            stroke={sticker.accent}
            strokeWidth="4.5"
            strokeLinecap="round"
          />
          <path
            d="M71 38 L79 46 M79 38 L71 46"
            stroke={sticker.accent}
            strokeWidth="4.5"
            strokeLinecap="round"
          />
          <path
            d="M50 61 Q57 55 64 61 T78 61"
            fill="none"
            stroke={sticker.accent}
            strokeWidth="4"
            strokeLinecap="round"
          />
        </g>
      );
    case 'otsukare':
      return (
        <g>
          <path
            d="M46 44 L80 44 L77 65 C76 69 72 72 68 72 L58 72 C54 72 50 69 49 65 Z"
            fill={sticker.accent}
          />
          <path
            d="M80 49 C88 49 88 61 78 62"
            fill="none"
            stroke={sticker.accent}
            strokeWidth="4.5"
            strokeLinecap="round"
          />
          <path
            d="M55 37 C53 31 58 29 56 24 M65 37 C63 31 68 29 66 24 M74 37 C72 31 77 29 75 24"
            fill="none"
            stroke="#fde68a"
            strokeWidth="3"
            strokeLinecap="round"
            opacity="0.85"
          />
        </g>
      );
    case 'omedetou':
      return (
        <g>
          <polygon points="44,68 56,34 80,58" fill={sticker.accent} />
          <circle cx="80" cy="30" r="4.5" fill="#fde047" />
          <circle cx="91" cy="44" r="3.5" fill="#67e8f9" />
          <circle cx="67" cy="24" r="3.5" fill="#86efac" />
          <path
            d="M72 39 L84 26 M78 48 L92 43"
            stroke="#fde047"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </g>
      );
    case 'matte':
      return (
        <g>
          <circle
            cx="64"
            cy="49"
            r="22"
            fill="none"
            stroke={sticker.accent}
            strokeWidth="5"
          />
          <path
            d="M64 36 L64 50 L74 55"
            fill="none"
            stroke="#ffffff"
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M56 22 L72 22"
            stroke={sticker.accent}
            strokeWidth="4.5"
            strokeLinecap="round"
          />
        </g>
      );
    case 'iine':
      return (
        <g>
          <circle cx="64" cy="49" r="24" fill={sticker.accent} opacity="0.2" />
          <path
            d="M48 59 L48 45 L56 45 L62 32 C64 29 69 30 69 35 L68 43 L79 43 C83 43 85 46 84 50 L81 61 C80 64 77 66 74 66 L54 66 C50 66 48 63 48 59 Z"
            fill={sticker.accent}
          />
          <rect x="40" y="45" width="7" height="21" rx="3" fill="#ffffff" opacity="0.85" />
        </g>
      );
    case 'matane':
    default:
      return (
        <g>
          <circle cx="64" cy="48" r="22" fill={sticker.accent} opacity="0.2" />
          <circle cx="55" cy="44" r="3.5" fill={sticker.accent} />
          <circle cx="73" cy="44" r="3.5" fill={sticker.accent} />
          <path
            d="M52 55 C56 62 72 62 76 55"
            fill="none"
            stroke={sticker.accent}
            strokeWidth="4.5"
            strokeLinecap="round"
          />
          <path
            d="M89 35 C94 40 94 48 89 53 M95 31 C102 38 102 50 95 57"
            fill="none"
            stroke={sticker.accent}
            strokeWidth="3"
            strokeLinecap="round"
            opacity="0.8"
          />
        </g>
      );
  }
}

export const StickerArtwork = memo(function StickerArtwork({
  stickerUrl,
  size = 'chat',
  className = '',
}: StickerArtworkProps) {
  const [imgError, setImgError] = useState(false);
  const preset = findDefaultSticker(stickerUrl);

  const sizeClass =
    size === 'picker'
      ? 'w-full aspect-square'
      : 'w-32 h-32 sm:w-36 sm:h-36';

  if (preset) {
    const gradId = `sticker_grad_${preset.id}_${size}`;
    const labelFontSize =
      preset.label.length >= 6 ? 18 : preset.label.length >= 4 ? 22 : preset.label.length === 1 ? 30 : 25;

    return (
      <div
        className={`relative select-none overflow-hidden rounded-3xl ${sizeClass} ${className}`}
        aria-label={`スタンプ ${preset.label}`}
      >
        <svg
          viewBox="0 0 128 128"
          className="w-full h-full drop-shadow-md"
          role="img"
          aria-label={preset.label}
        >
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={preset.bgFrom} />
              <stop offset="100%" stopColor={preset.bgTo} />
            </linearGradient>
          </defs>

          {/* Rounded sticker tile with subtle border */}
          <rect
            x="4"
            y="4"
            width="120"
            height="120"
            rx="28"
            fill={`url(#${gradId})`}
            stroke="rgba(255,255,255,0.16)"
            strokeWidth="2.5"
          />

          {/* Subtle top glossy highlight */}
          <path
            d="M24 14 H104"
            stroke="rgba(255,255,255,0.22)"
            strokeWidth="3"
            strokeLinecap="round"
          />

          {/* Expressive vector motif */}
          {renderMotifIcon(preset)}

          {/* Bold Japanese stamp lettering */}
          <text
            x="64"
            y="104"
            textAnchor="middle"
            fill={preset.textColor}
            fontSize={labelFontSize}
            fontWeight="800"
            fontFamily="'Noto Sans JP', 'Plus Jakarta Sans', sans-serif"
            letterSpacing="0.03em"
          >
            {preset.label}
          </text>
        </svg>
      </div>
    );
  }

  // Custom My Sticker image URL
  return (
    <div
      className={`relative select-none overflow-hidden rounded-2xl flex items-center justify-center ${sizeClass} ${
        imgError ? 'bg-slate-800/80 border border-slate-700' : ''
      } ${className}`}
    >
      {!imgError ? (
        <img
          src={stickerUrl}
          alt="オリジナルマイスタンプ"
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className="w-full h-full object-contain rounded-2xl drop-shadow-md"
        />
      ) : (
        <span className="text-xs text-slate-400">スタンプ</span>
      )}
    </div>
  );
});
