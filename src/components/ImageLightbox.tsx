import { useEffect } from 'react';
import { Download, X } from 'lucide-react';
import { formatTimeHHMM } from '../lib/constants';

export interface LightboxImageData {
  url: string;
  senderName: string;
  createdAt: string;
  caption?: string;
}

interface ImageLightboxProps {
  image: LightboxImageData | null;
  onClose: () => void;
}

export function ImageLightbox({ image, onClose }: ImageLightboxProps) {
  useEffect(() => {
    if (!image) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [image, onClose]);

  if (!image) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/92 backdrop-blur-md flex flex-col items-center justify-center p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label="画像の拡大プレビュー"
      onClick={onClose}
    >
      {/* Top toolbar */}
      <div
        className="w-full max-w-4xl flex items-center justify-between gap-4 pb-4 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-100 truncate">
            {image.senderName}
          </div>
          <div className="text-xs text-slate-400 font-mono tabular-nums">
            {formatTimeHHMM(image.createdAt)}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <a
            href={image.url}
            download={`roomline_image_${Date.now()}.png`}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[40px] px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-100 flex items-center gap-1.5 transition-colors whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            保存
          </a>
          <button
            type="button"
            onClick={onClose}
            aria-label="プレビューを閉じる"
            className="min-h-[40px] min-w-[40px] rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main image */}
      <div
        className="flex-1 min-h-0 w-full max-w-4xl flex flex-col items-center justify-center gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={image.url}
          alt={image.caption || `${image.senderName}が送信した画像`}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className="max-w-full max-h-[75vh] object-contain rounded-2xl border border-slate-800 shadow-2xl bg-slate-900"
        />
        {image.caption && (
          <p className="text-sm text-slate-200 bg-slate-900/80 border border-slate-800 rounded-xl px-4 py-2 max-w-2xl text-center whitespace-pre-wrap break-words">
            {image.caption}
          </p>
        )}
      </div>
    </div>
  );
}
