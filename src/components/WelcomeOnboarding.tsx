import { useRef, useState } from 'react';
import { ArrowRight, Camera, Check, Dices, KeyRound } from 'lucide-react';
import {
  AVATAR_COLORS,
  PRESET_AVATARS,
  generateGuestName,
} from '../lib/constants';
import { fileToCompactDataUrl } from '../lib/storage';
import type { UserProfile } from '../types/chat';
import { Avatar } from './Avatar';

interface WelcomeOnboardingProps {
  initialProfile: UserProfile;
  onComplete: (profile: UserProfile) => void;
  onOpenRestoreModal: () => void;
}

export function WelcomeOnboarding({
  initialProfile,
  onComplete,
  onOpenRestoreModal,
}: WelcomeOnboardingProps) {
  const [draft, setDraft] = useState<UserProfile>(initialProfile);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const displayName = draft.nickname.trim() || 'ゲスト';
  const canSubmit = draft.nickname.trim().length > 0;

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
      setDraft((prev) => ({
        ...prev,
        avatarType: 'custom',
        avatarValue: dataUrl,
      }));
    } catch {
      setUploadError('画像の読み込みに失敗しました。別の画像をお試しください。');
    } finally {
      e.target.value = '';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedName = draft.nickname.trim();
    if (!cleanedName) return;
    onComplete({
      ...draft,
      nickname: cleanedName,
      statusMessage: draft.statusMessage.trim(),
    });
  };

  return (
    <div className="min-h-[100dvh] w-full bg-[#F1F5F9] dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/95 shadow-xl shadow-slate-200/70 dark:shadow-2xl dark:shadow-slate-950/70 p-6 sm:p-8 space-y-6">
        {/* Brand & Welcome Heading */}
        <div className="text-center space-y-2.5">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-500 text-white flex items-center justify-center font-bold text-xl shadow-sm">
            R
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight text-balance">
            ようこそ、RoomLineへ
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            プロフィールを設定して、暗号化されたリアルタイムトークを始めましょう
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Avatar Preview + Quick Upload */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <Avatar
                name={displayName}
                avatarType={draft.avatarType}
                avatarValue={draft.avatarValue}
                avatarColor={draft.avatarColor}
                size="xl"
                className="ring-4 ring-slate-100 dark:ring-slate-950 shadow-md"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                aria-label="写真をアップロード"
                title="写真をアップロード"
                className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center ring-2 ring-white dark:ring-slate-900 transition-colors shadow-xs"
              >
                <Camera className="w-4 h-4" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            {uploadError && (
              <p className="text-xs text-rose-600 dark:text-rose-400 text-center">
                {uploadError}
              </p>
            )}
          </div>

          {/* Preset & Monogram Avatar Selector */}
          <div className="space-y-3">
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
                      setDraft((prev) => ({
                        ...prev,
                        avatarType: 'preset',
                        avatarValue: preset.url,
                      }))
                    }
                    className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-colors ${
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

            <div className="flex items-center justify-between gap-2 pt-0.5">
              <span className="text-[11px] text-slate-500 dark:text-slate-500 whitespace-nowrap">
                イニシャル色
              </span>
              <div className="flex items-center gap-2">
                {AVATAR_COLORS.map((c) => {
                  const active =
                    draft.avatarType === 'initial' && draft.avatarColor === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() =>
                        setDraft((prev) => ({
                          ...prev,
                          avatarType: 'initial',
                          avatarValue: '',
                          avatarColor: c.id,
                        }))
                      }
                      aria-label={`イニシャルカラー: ${c.label}`}
                      className={`w-8 h-8 rounded-full ${c.bgClass} flex items-center justify-center text-white text-xs font-semibold transition-transform active:scale-95 ${
                        active
                          ? 'ring-2 ring-slate-900 dark:ring-white ring-offset-2 ring-offset-white dark:ring-offset-slate-900'
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

          {/* Nickname */}
          <div className="space-y-1.5">
            <label
              htmlFor="onboarding-nickname"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              ニックネーム{' '}
              <span className="text-emerald-600 dark:text-emerald-400">必須</span>
            </label>
            <div className="flex gap-2">
              <input
                id="onboarding-nickname"
                type="text"
                maxLength={24}
                required
                autoFocus
                value={draft.nickname}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, nickname: e.target.value }))
                }
                placeholder="表示名を入力（例: ゆうた）"
                className="flex-1 min-w-0 h-11 px-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:bg-white dark:focus:bg-slate-950 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              />
              <button
                type="button"
                onClick={() =>
                  setDraft((prev) => ({ ...prev, nickname: generateGuestName() }))
                }
                className="min-h-[44px] px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
              >
                <Dices className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                ランダム
              </button>
            </div>
          </div>

          {/* Optional Status Message */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="onboarding-status"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                ひとこと <span className="text-slate-400 dark:text-slate-500 font-normal">任意</span>
              </label>
              <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono tabular-nums">
                {draft.statusMessage.length}/60
              </span>
            </div>
            <input
              id="onboarding-status"
              type="text"
              maxLength={60}
              value={draft.statusMessage}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, statusMessage: e.target.value }))
              }
              placeholder="いまの気分やひとことを入力..."
              className="w-full h-11 px-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:bg-white dark:focus:bg-slate-950 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          {/* Primary Start Button */}
          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-500 disabled:pointer-events-none text-sm font-semibold text-white flex items-center justify-center gap-2 transition-colors shadow-sm"
          >
            <span>はじめる</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          {/* Secondary Restore from Transfer Code Button */}
          <button
            type="button"
            onClick={onOpenRestoreModal}
            className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800/80 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/80 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center justify-center gap-2 transition-colors"
          >
            <KeyRound className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>引き継ぎコードから復元する</span>
          </button>

          <p className="text-[11px] text-center text-slate-500 dark:text-slate-500">
            プロフィールは左下のアイコンからいつでも変更できます
          </p>
        </form>
      </div>
    </div>
  );
}
