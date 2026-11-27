import { useRef, useState } from 'react';
import {
  Camera,
  Check,
  Dices,
  Palette,
  Sparkles,
  User,
  Wallpaper,
} from 'lucide-react';
import {
  AVATAR_COLORS,
  BUBBLE_THEMES,
  COVER_THEMES,
  PRESET_AVATARS,
  WALLPAPER_THEMES,
  generateGuestName,
} from '../lib/constants';
import type { UserProfile } from '../types/chat';
import { Avatar } from './Avatar';

interface ProfileSettingsViewProps {
  profile: UserProfile;
  hasActiveRoom?: boolean;
  onUpdateProfile: (next: UserProfile) => void;
  onBackToLobby: () => void;
}

function resizeImageToDataUrl(file: File, maxSize = 240): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas unavailable'));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = () => reject(new Error('Invalid image'));
      img.src = String(reader.result);
    };
    reader.onerror = () => reject(new Error('Read failed'));
    reader.readAsDataURL(file);
  });
}

export function ProfileSettingsView({
  profile,
  hasActiveRoom = false,
  onUpdateProfile,
  onBackToLobby,
}: ProfileSettingsViewProps) {
  const [draft, setDraft] = useState<UserProfile>(profile);
  const [savedNotice, setSavedNotice] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
    window.clearTimeout((window as unknown as { __profileToast?: number }).__profileToast);
    (window as unknown as { __profileToast?: number }).__profileToast = window.setTimeout(
      () => setSavedNotice(false),
      1800
    );
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
      const dataUrl = await resizeImageToDataUrl(file, 220);
      handleApplyChange({ avatarType: 'custom', avatarValue: dataUrl });
    } catch {
      setUploadError('画像の読み込みに失敗しました。別の画像をお試しください。');
    } finally {
      e.target.value = '';
    }
  };

  const displayName = draft.nickname.trim() || 'ゲスト';

  return (
    <div className="h-full overflow-y-auto chat-scroll bg-slate-950">
      <div className="max-w-4xl mx-auto px-4 sm:px-8 py-6 sm:py-8 pb-24 lg:pb-10 space-y-8">
        {/* Top Bar */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-50 tracking-tight">
              プロフィール設定
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              アイコン・ひとこと・トーク画面の配色を自分好みにカスタマイズできます
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {savedNotice && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400 whitespace-nowrap">
                <Check className="w-4 h-4" />
                自動保存しました
              </span>
            )}
            <button
              type="button"
              onClick={onBackToLobby}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs sm:text-sm font-medium text-slate-100 transition-colors whitespace-nowrap shrink-0"
            >
              {hasActiveRoom ? 'トークルームへ戻る' : 'ロビーへ戻る'}
            </button>
          </div>
        </div>

        {/* LINE-style Live Profile Preview Card */}
        <section className="rounded-2xl overflow-hidden border border-slate-800 bg-slate-900">
          {/* Cover background */}
          <div
            className={`relative h-36 sm:h-44 bg-gradient-to-br ${selectedCover.gradientClass} flex items-end justify-between p-5`}
          >
            <div className="text-xs text-slate-300/80 font-medium">
              プロフィールプレビュー
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="min-h-[40px] px-3.5 py-2 rounded-xl bg-slate-950/60 hover:bg-slate-950/80 backdrop-blur-md border border-white/10 text-xs font-medium text-slate-100 flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
            >
              <Camera className="w-4 h-4" />
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

          {/* Avatar + Identity */}
          <div className="px-6 pb-6">
            <div className="-mt-12 flex flex-col sm:flex-row sm:items-end gap-4">
              <div className="relative w-fit">
                <Avatar
                  name={displayName}
                  avatarType={draft.avatarType}
                  avatarValue={draft.avatarValue}
                  avatarColor={draft.avatarColor}
                  size="xl"
                  className="ring-4 ring-slate-900 shadow-lg"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="プロフィール画像を変更"
                  className="absolute bottom-0 right-0 w-9 h-9 rounded-full bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center ring-2 ring-slate-900 transition-colors"
                >
                  <Camera className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 min-w-0 sm:pb-1">
                <h2 className="text-xl font-bold text-white truncate">{displayName}</h2>
                <p className="text-sm text-slate-400 mt-0.5 line-clamp-2">
                  {draft.statusMessage.trim() || 'ステータスメッセージ未設定'}
                </p>
              </div>
            </div>

            {uploadError && (
              <p className="mt-3 text-xs text-rose-400">{uploadError}</p>
            )}
          </div>
        </section>

        {/* Settings Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Basic Identity Section */}
          <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 space-y-5">
            <div className="flex items-center gap-2.5 text-slate-100 font-semibold text-sm">
              <User className="w-4 h-4 text-blue-400" />
              基本プロフィール
            </div>

            {/* Nickname */}
            <div className="space-y-2">
              <label
                htmlFor="profile-nickname"
                className="block text-xs font-medium text-slate-300"
              >
                ニックネーム
              </label>
              <div className="flex gap-2">
                <input
                  id="profile-nickname"
                  type="text"
                  maxLength={24}
                  value={draft.nickname}
                  onChange={(e) => handleApplyChange({ nickname: e.target.value })}
                  placeholder="表示名を入力（例: ゆうた）"
                  className="flex-1 min-w-0 h-11 px-3.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
                <button
                  type="button"
                  onClick={() => handleApplyChange({ nickname: generateGuestName() })}
                  className="min-h-[44px] px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                >
                  <Dices className="w-4 h-4 text-blue-400" />
                  ランダム
                </button>
              </div>
            </div>

            {/* Status Message (LINE ひとこと) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="profile-status"
                  className="block text-xs font-medium text-slate-300"
                >
                  ひとこと（ステータスメッセージ）
                </label>
                <span className="text-[11px] text-slate-500 tabular-nums">
                  {draft.statusMessage.length}/60
                </span>
              </div>
              <input
                id="profile-status"
                type="text"
                maxLength={60}
                value={draft.statusMessage}
                onChange={(e) => handleApplyChange({ statusMessage: e.target.value })}
                placeholder="いまの気分やひとことを入力..."
                className="w-full h-11 px-3.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            {/* Avatar Presets */}
            <div className="space-y-2.5 pt-1">
              <span className="block text-xs font-medium text-slate-300">
                イラストアイコンを選ぶ
              </span>
              <div className="grid grid-cols-4 gap-3">
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
                      className={`group flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-colors ${
                        active
                          ? 'border-blue-500 bg-blue-500/10'
                          : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                      }`}
                    >
                      <Avatar
                        name={preset.label}
                        avatarType="preset"
                        avatarValue={preset.url}
                        size="md"
                      />
                      <span className="text-[11px] text-slate-300 truncate max-w-full">
                        {preset.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Monogram Color Avatars */}
            <div className="space-y-2.5">
              <span className="block text-xs font-medium text-slate-300">
                またはイニシャルアイコンのカラー
              </span>
              <div className="flex flex-wrap gap-2.5">
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
                      className={`w-11 h-11 rounded-full ${c.bgClass} flex items-center justify-center text-white font-semibold text-sm transition-transform active:scale-95 ${
                        active
                          ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900'
                          : 'opacity-85 hover:opacity-100'
                      }`}
                    >
                      {active ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        Array.from(displayName)[0]
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Visual Theme Customization Section */}
          <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 space-y-5">
            <div className="flex items-center gap-2.5 text-slate-100 font-semibold text-sm">
              <Palette className="w-4 h-4 text-blue-400" />
              トーク画面・デザイン設定
            </div>

            {/* Cover Theme */}
            <div className="space-y-2.5">
              <span className="block text-xs font-medium text-slate-300">
                プロフィール背景テーマ
              </span>
              <div className="grid grid-cols-3 gap-2.5">
                {COVER_THEMES.map((theme) => {
                  const active = draft.coverTheme === theme.id;
                  return (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() => handleApplyChange({ coverTheme: theme.id })}
                      className={`min-h-[44px] px-3 py-2 rounded-xl border text-left transition-colors flex items-center gap-2 ${
                        active
                          ? 'border-blue-500 bg-blue-500/10 text-white'
                          : 'border-slate-800 bg-slate-950/60 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <span
                        className={`w-4 h-4 rounded-full shrink-0 bg-gradient-to-br ${theme.gradientClass} ring-1 ring-white/15`}
                      />
                      <span className="text-xs truncate">{theme.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bubble Color */}
            <div className="space-y-2.5">
              <span className="block text-xs font-medium text-slate-300">
                自分の吹き出しカラー
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {BUBBLE_THEMES.map((bubble) => {
                  const active = draft.bubbleTheme === bubble.id;
                  return (
                    <button
                      key={bubble.id}
                      type="button"
                      onClick={() => handleApplyChange({ bubbleTheme: bubble.id })}
                      className={`min-h-[44px] px-3 py-2 rounded-xl border transition-colors flex items-center gap-2 ${
                        active
                          ? 'border-blue-500 bg-blue-500/10 text-white'
                          : 'border-slate-800 bg-slate-950/60 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <span
                        className={`w-4 h-4 rounded-full shrink-0 ${bubble.swatchClass}`}
                      />
                      <span className="text-xs truncate">{bubble.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Chat Wallpaper */}
            <div className="space-y-2.5">
              <span className="flex items-center gap-1.5 text-xs font-medium text-slate-300">
                <Wallpaper className="w-3.5 h-3.5 text-slate-400" />
                トークルーム壁紙
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {WALLPAPER_THEMES.map((wp) => {
                  const active = draft.wallpaperTheme === wp.id;
                  return (
                    <button
                      key={wp.id}
                      type="button"
                      onClick={() => handleApplyChange({ wallpaperTheme: wp.id })}
                      className={`min-h-[44px] px-3 py-2 rounded-xl border transition-colors flex items-center gap-2 ${
                        active
                          ? 'border-blue-500 bg-blue-500/10 text-white'
                          : 'border-slate-800 bg-slate-950/60 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <span
                        className={`w-4 h-4 rounded-md shrink-0 border border-slate-700 ${wp.previewClass}`}
                      />
                      <span className="text-xs truncate">{wp.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Live Mini Talk Preview */}
            <div className="space-y-2 pt-1">
              <span className="flex items-center gap-1.5 text-xs font-medium text-slate-300">
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                トーク画面プレビュー
              </span>
              <div
                className={`rounded-xl border border-slate-800 p-4 space-y-3 ${selectedWallpaper.bgClass}`}
              >
                {/* Incoming mock bubble */}
                <div className="flex items-start gap-2.5">
                  <Avatar
                    name="ミキ"
                    avatarType="preset"
                    avatarValue={PRESET_AVATARS[1].url}
                    size="xs"
                  />
                  <div className="space-y-1">
                    <span className="block text-[11px] text-slate-400">ミキ</span>
                    <div className="flex items-end gap-1.5">
                      <div className="px-3 py-2 rounded-2xl bubble-tail-left bg-slate-800 text-slate-100 text-xs">
                        ルーム番号ありがとう！今入ったよ
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono tabular-nums">
                        21:04
                      </span>
                    </div>
                  </div>
                </div>

                {/* Outgoing preview bubble */}
                <div className="flex flex-col items-end space-y-1">
                  <span className="text-[11px] text-slate-400">{displayName}</span>
                  <div className="flex items-end gap-1.5">
                    <span className="text-[10px] text-slate-500 font-mono tabular-nums">
                      21:05
                    </span>
                    <div
                      className={`px-3 py-2 rounded-2xl bubble-tail-right text-xs ${selectedBubble.bubbleClass}`}
                    >
                      ようこそ！この配色見やすくていいね
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
