import { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Check,
  Dices,
  Moon,
  Palette,
  Settings,
  Sun,
  Wallpaper,
  X,
} from 'lucide-react';
import {
  AVATAR_COLORS,
  BUBBLE_THEMES,
  COVER_THEMES,
  PRESET_AVATARS,
  WALLPAPER_THEMES,
  generateGuestName,
} from '../lib/constants';
import { fileToCompactDataUrl } from '../lib/storage';
import type { ThemeMode, UserProfile } from '../types/chat';
import { Avatar } from './Avatar';

interface ProfileEditModalProps {
  isOpen: boolean;
  profile: UserProfile;
  themeMode: ThemeMode;
  onUpdateProfile: (next: UserProfile) => void;
  onChangeThemeMode: (mode: ThemeMode) => void;
  onClose: () => void;
}

export function ProfileEditModal({
  isOpen,
  profile,
  themeMode,
  onUpdateProfile,
  onChangeThemeMode,
  onClose,
}: ProfileEditModalProps) {
  const [draft, setDraft] = useState<UserProfile>(profile);
  const [savedNotice, setSavedNotice] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      setDraft(profile);
      setUploadError(null);
    }
  }, [isOpen, profile]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  if (!isOpen) return null;

  const selectedCover =
    COVER_THEMES.find((c) => c.id === draft.coverTheme) || COVER_THEMES[0];
  const selectedBubble =
    BUBBLE_THEMES.find((b) => b.id === draft.bubbleTheme) || BUBBLE_THEMES[0];
  const selectedWallpaper =
    WALLPAPER_THEMES.find((w) => w.id === draft.wallpaperTheme) || WALLPAPER_THEMES[0];

  const handleApplyChange = (patch: Partial<UserProfile>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    onUpdateProfile(next);
    setSavedNotice(true);
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => setSavedNotice(false), 1800);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);

    if (!file.type.startsWith('image/')) {
      setUploadError('画像ファイル（PNG / JPG / WebP）を選択してください。');
      return;
    }

    try {
      const dataUrl = await fileToCompactDataUrl(file, 240);
      handleApplyChange({ avatarType: 'custom', avatarValue: dataUrl });
    } catch {
      setUploadError('画像の読み込みに失敗しました。別の画像をお試しください。');
    } finally {
      e.target.value = '';
    }
  };

  const displayName = draft.nickname.trim() || 'ゲスト';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 dark:bg-slate-950/80 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-edit-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-2xl max-h-[90dvh] flex flex-col rounded-t-3xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Settings className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2
                id="profile-edit-modal-title"
                className="text-sm font-bold text-slate-900 dark:text-slate-50 truncate"
              >
                ユーザー設定
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                プロフィール・テーマ切替・デザイン設定（自動保存）
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {savedNotice && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                <Check className="w-3.5 h-3.5" />
                保存済
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="閉じる"
              className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden chat-scroll p-5 sm:p-6 space-y-6">
          {/* Light / Dark Appearance Theme Switcher */}
          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-950/70 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                外観テーマ（ライト / ダーク）
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {themeMode === 'dark' ? 'ダークモード適用中' : 'ライトモード適用中'}
              </span>
            </div>

            <div
              className="grid grid-cols-2 gap-2.5"
              role="radiogroup"
              aria-label="テーマ切替"
            >
              <button
                type="button"
                role="radio"
                aria-checked={themeMode === 'light'}
                onClick={() => onChangeThemeMode('light')}
                className={`min-h-[46px] px-3.5 py-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-all ${
                  themeMode === 'light'
                    ? 'border-emerald-500 bg-white text-slate-900 ring-2 ring-emerald-500/20 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <span
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    themeMode === 'light'
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                  }`}
                >
                  <Sun className="w-4 h-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-bold truncate">
                    ライトモード
                  </span>
                  <span className="block text-[10px] text-slate-500 dark:text-slate-400 truncate">
                    明るく見やすい標準配色
                  </span>
                </span>
              </button>

              <button
                type="button"
                role="radio"
                aria-checked={themeMode === 'dark'}
                onClick={() => onChangeThemeMode('dark')}
                className={`min-h-[46px] px-3.5 py-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-all ${
                  themeMode === 'dark'
                    ? 'border-emerald-500 bg-slate-900 text-white ring-2 ring-emerald-500/25 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <span
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    themeMode === 'dark'
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                  }`}
                >
                  <Moon className="w-4 h-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-bold truncate">
                    ダークモード
                  </span>
                  <span className="block text-[10px] text-slate-500 dark:text-slate-400 truncate">
                    暗い場所で目に優しい配色
                  </span>
                </span>
              </button>
            </div>
          </section>

          {/* Compact Live Profile Banner */}
          <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/80">
            <div
              className={`relative h-24 bg-gradient-to-br ${selectedCover.gradientClass} flex items-end justify-end p-3`}
            >
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="min-h-[34px] px-3 py-1.5 rounded-lg bg-white/85 hover:bg-white dark:bg-slate-950/65 dark:hover:bg-slate-950/85 backdrop-blur-md border border-slate-200/80 dark:border-white/10 text-xs font-medium text-slate-800 dark:text-slate-100 flex items-center gap-1.5 transition-colors whitespace-nowrap shadow-xs"
              >
                <Camera className="w-3.5 h-3.5" />
                写真をアップロード
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            <div className="px-4 pt-3 pb-4">
              <div className="flex items-start gap-3.5">
                <div className="relative -mt-10 shrink-0 z-10">
                  <Avatar
                    name={displayName}
                    avatarType={draft.avatarType}
                    avatarValue={draft.avatarValue}
                    avatarColor={draft.avatarColor}
                    size="lg"
                    className="ring-4 ring-white dark:ring-slate-950 shadow-md"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    aria-label="プロフィール画像を変更"
                    className="absolute -bottom-0.5 -right-0.5 w-7 h-7 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center ring-2 ring-white dark:ring-slate-950 transition-colors"
                  >
                    <Camera className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="min-w-0 flex-1 pt-0.5 space-y-0.5">
                  <div className="text-base font-bold leading-snug text-slate-900 dark:text-white truncate">
                    {displayName}
                  </div>
                  <div className="text-xs leading-normal text-slate-500 dark:text-slate-400 truncate">
                    {draft.statusMessage.trim() || 'ひとこと未設定'}
                  </div>
                </div>
              </div>
              {uploadError && (
                <p className="mt-2.5 text-xs text-rose-600 dark:text-rose-400">{uploadError}</p>
              )}
            </div>
          </div>

          {/* Basic Profile Inputs */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="modal-profile-nickname"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                ニックネーム
              </label>
              <div className="flex gap-2">
                <input
                  id="modal-profile-nickname"
                  type="text"
                  maxLength={24}
                  value={draft.nickname}
                  onChange={(e) => handleApplyChange({ nickname: e.target.value })}
                  placeholder="表示名を入力（例: ゆうた）"
                  className="flex-1 min-w-0 h-11 px-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                />
                <button
                  type="button"
                  onClick={() => handleApplyChange({ nickname: generateGuestName() })}
                  className="min-h-[44px] px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                >
                  <Dices className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  ランダム
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="modal-profile-status"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  ひとこと（ステータスメッセージ）
                </label>
                <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono tabular-nums">
                  {draft.statusMessage.length}/60
                </span>
              </div>
              <input
                id="modal-profile-status"
                type="text"
                maxLength={60}
                value={draft.statusMessage}
                onChange={(e) => handleApplyChange({ statusMessage: e.target.value })}
                placeholder="いまの気分やひとことを入力..."
                className="w-full h-11 px-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            {/* Avatar Presets + Monogram Colors */}
            <div className="space-y-2.5">
              <span className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                アバターアイコン
              </span>
              <div className="grid grid-cols-4 gap-2.5">
                {PRESET_AVATARS.map((preset) => {
                  const active =
                    draft.avatarType === 'preset' && draft.avatarValue === preset.url;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() =>
                        handleApplyChange({
                          avatarType: 'preset',
                          avatarValue: preset.url,
                        })
                      }
                      className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-colors ${
                        active
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/15'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <Avatar
                        name={preset.label}
                        avatarType="preset"
                        avatarValue={preset.url}
                        size="sm"
                      />
                      <span className="text-[11px] text-slate-700 dark:text-slate-300 truncate max-w-full">
                        {preset.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-[11px] text-slate-500 mr-1">イニシャル色:</span>
                {AVATAR_COLORS.map((c) => {
                  const active =
                    draft.avatarType === 'initial' && draft.avatarColor === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() =>
                        handleApplyChange({
                          avatarType: 'initial',
                          avatarValue: '',
                          avatarColor: c.id,
                        })
                      }
                      aria-label={`イニシャルアイコン: ${c.label}`}
                      className={`w-9 h-9 rounded-full ${c.bgClass} flex items-center justify-center text-white font-semibold text-xs transition-transform active:scale-95 ${
                        active
                          ? 'ring-2 ring-emerald-500 dark:ring-white ring-offset-2 ring-offset-white dark:ring-offset-slate-900'
                          : 'opacity-85 hover:opacity-100'
                      }`}
                    >
                      {active ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        Array.from(displayName)[0]
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="h-px bg-slate-200 dark:bg-slate-800" />

          {/* Theme Customization */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
              <Palette className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              トーク画面のデザイン
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Bubble Theme */}
              <div className="space-y-2">
                <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                  吹き出しカラー
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {BUBBLE_THEMES.map((bubble) => {
                    const active = draft.bubbleTheme === bubble.id;
                    return (
                      <button
                        key={bubble.id}
                        type="button"
                        onClick={() => handleApplyChange({ bubbleTheme: bubble.id })}
                        className={`min-h-[40px] px-2.5 py-1.5 rounded-xl border transition-colors flex items-center gap-2 ${
                          active
                            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/15 text-emerald-900 dark:text-white font-medium'
                            : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <span
                          className={`w-3.5 h-3.5 rounded-full shrink-0 ${bubble.swatchClass}`}
                        />
                        <span className="text-xs truncate">{bubble.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Wallpaper Theme */}
              <div className="space-y-2">
                <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <Wallpaper className="w-3.5 h-3.5" />
                  トーク壁紙
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {WALLPAPER_THEMES.map((wp) => {
                    const active = draft.wallpaperTheme === wp.id;
                    return (
                      <button
                        key={wp.id}
                        type="button"
                        onClick={() => handleApplyChange({ wallpaperTheme: wp.id })}
                        className={`min-h-[40px] px-2.5 py-1.5 rounded-xl border transition-colors flex items-center gap-2 ${
                          active
                            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/15 text-emerald-900 dark:text-white font-medium'
                            : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <span
                          className={`w-3.5 h-3.5 rounded shrink-0 border border-slate-300 dark:border-slate-700 ${wp.previewClass}`}
                        />
                        <span className="text-xs truncate">{wp.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Cover Theme */}
            <div className="space-y-2">
              <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                プロフィール背景テーマ
              </span>
              <div className="grid grid-cols-3 gap-2">
                {COVER_THEMES.map((theme) => {
                  const active = draft.coverTheme === theme.id;
                  return (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() => handleApplyChange({ coverTheme: theme.id })}
                      className={`min-h-[38px] px-2.5 py-1.5 rounded-xl border text-left transition-colors flex items-center gap-2 ${
                        active
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/15 text-emerald-900 dark:text-white font-medium'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <span
                        className={`w-3.5 h-3.5 rounded-full shrink-0 bg-gradient-to-br ${theme.gradientClass} ring-1 ring-slate-900/10 dark:ring-white/15`}
                      />
                      <span className="text-xs truncate">{theme.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Mini Live Talk Preview */}
            <div
              className={`rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 space-y-2.5 ${selectedWallpaper.bgClass}`}
            >
              <div className="flex items-start gap-2">
                <Avatar
                  name="ミキ"
                  avatarType="preset"
                  avatarValue={PRESET_AVATARS[1].url}
                  size="xs"
                />
                <div className="px-3 py-1.5 rounded-2xl bubble-tail-left bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700/50 text-slate-900 dark:text-slate-100 text-xs shadow-xs">
                  トーク画面のプレビューです
                </div>
              </div>
              <div className="flex justify-end">
                <div
                  className={`px-3 py-1.5 rounded-2xl bubble-tail-right text-xs shadow-xs ${selectedBubble.bubbleClass}`}
                >
                  {displayName} の吹き出しカラー
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end shrink-0 bg-slate-50/90 dark:bg-slate-900">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[42px] px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-sm font-semibold text-white transition-colors shadow-xs shadow-emerald-500/20"
          >
            完了
          </button>
        </div>
      </div>
    </div>
  );
}
