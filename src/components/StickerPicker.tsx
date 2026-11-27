import { useRef, useState } from 'react';
import {
  Loader2,
  Plus,
  Smile,
  Sparkles,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { QUICK_STAMPS } from '../lib/constants';
import { DEFAULT_STICKERS } from '../lib/stickers';
import type { CustomSticker } from '../types/chat';
import { StickerArtwork } from './StickerArtwork';

type PickerTab = 'default' | 'custom' | 'quick';

interface StickerPickerProps {
  customStickers: CustomSticker[];
  onSendSticker: (stickerUrl: string) => void;
  onSendQuickText: (text: string) => void;
  onAddCustomSticker: (file: File) => Promise<string | null>;
  onDeleteCustomSticker: (stickerId: string) => void;
  onClose: () => void;
}

export function StickerPicker({
  customStickers,
  onSendSticker,
  onSendQuickText,
  onAddCustomSticker,
  onDeleteCustomSticker,
  onClose,
}: StickerPickerProps) {
  const [activeTab, setActiveTab] = useState<PickerTab>('default');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setUploadError(null);
    if (!file.type.startsWith('image/')) {
      setUploadError('画像ファイル（PNG / JPG / WebP / GIF）を選択してください。');
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      setUploadError('マイスタンプ画像は6MB以下にしてください。');
      return;
    }

    setUploading(true);
    const err = await onAddCustomSticker(file);
    setUploading(false);
    if (err) {
      setUploadError(err);
    } else {
      setActiveTab('custom');
    }
  };

  return (
    <div className="shrink-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-3 sm:px-6 py-3">
      <div className="max-w-3xl mx-auto space-y-3">
        {/* Tabs Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab('default')}
              className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                activeTab === 'default'
                  ? 'bg-emerald-500 text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              スタンプ
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('custom')}
              className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                activeTab === 'custom'
                  ? 'bg-emerald-500 text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <Star className="w-3.5 h-3.5" />
              マイスタンプ
              <span className="font-mono tabular-nums text-[10px] opacity-80">
                ({customStickers.length})
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('quick')}
              className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                activeTab === 'quick'
                  ? 'bg-emerald-500 text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <Smile className="w-3.5 h-3.5" />
              クイック返信
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="スタンプピッカーを閉じる"
            className="w-9 h-9 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Hidden file input for My Sticker creation */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={(e) => void handleFileChange(e)}
          className="hidden"
        />

        {uploadError && (
          <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">{uploadError}</p>
        )}

        {/* Tab 1: Default 12 Japanese SVG Stickers */}
        {activeTab === 'default' && (
          <div className="max-h-56 overflow-y-auto chat-scroll pr-1">
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2.5">
              {DEFAULT_STICKERS.map((sticker) => (
                <button
                  key={sticker.id}
                  type="button"
                  onClick={() => onSendSticker(sticker.value)}
                  title={`${sticker.label} を送信`}
                  className="group p-1 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800/80 active:scale-95 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                >
                  <StickerArtwork stickerUrl={sticker.value} size="picker" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tab 2: Custom My Stickers */}
        {activeTab === 'custom' && (
          <div className="max-h-56 overflow-y-auto chat-scroll pr-1 space-y-2.5">
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5">
              {/* + Add My Sticker Tile */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="aspect-square rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 bg-slate-50 dark:bg-slate-950/70 hover:bg-emerald-50 dark:hover:bg-emerald-600/10 text-slate-600 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-300 flex flex-col items-center justify-center gap-1.5 p-2 transition-colors"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin text-emerald-500 dark:text-emerald-400" />
                    <span className="text-[11px] font-medium">登録中...</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-6 h-6 text-emerald-500 dark:text-emerald-400" />
                    <span className="text-[11px] font-medium text-center leading-tight">
                      マイスタンプ追加
                    </span>
                  </>
                )}
              </button>

              {/* Saved Custom Stickers */}
              {customStickers.map((item) => (
                <div
                  key={item.id}
                  className="group relative aspect-square rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-600 p-1.5 transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => onSendSticker(item.url)}
                    title="このマイスタンプを送信"
                    className="w-full h-full flex items-center justify-center active:scale-95 transition-transform focus:outline-none"
                  >
                    <StickerArtwork stickerUrl={item.url} size="picker" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteCustomSticker(item.id);
                    }}
                    title="マイスタンプを削除"
                    aria-label="マイスタンプを削除"
                    className="opacity-0 group-hover:opacity-100 focus:opacity-100 absolute top-1 right-1 w-6 h-6 rounded-full bg-white/95 dark:bg-slate-950/90 hover:bg-rose-600 text-slate-500 dark:text-slate-300 hover:text-white flex items-center justify-center border border-slate-200 dark:border-slate-700 transition-all shadow-xs"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>

            {customStickers.length === 0 && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                好きな画像（PNG透過画像や写真）をアップロードしてオリジナルスタンプとしていつでも送信できます。
              </p>
            )}
          </div>
        )}

        {/* Tab 3: Quick Text Replies */}
        {activeTab === 'quick' && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {QUICK_STAMPS.map((stamp) => (
              <button
                key={stamp.id}
                type="button"
                onClick={() => onSendQuickText(`${stamp.emoji} ${stamp.text}`)}
                className="min-h-[44px] px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950/80 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-left flex items-center gap-2 transition-colors"
              >
                <span className="text-lg shrink-0" aria-hidden="true">
                  {stamp.emoji}
                </span>
                <span className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                  {stamp.text}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
