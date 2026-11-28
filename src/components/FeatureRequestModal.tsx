import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowUpDown,
  Clock,
  Lightbulb,
  Loader2,
  Plus,
  Send,
  ThumbsUp,
  User,
  X,
} from 'lucide-react';
import type {
  FeatureRequest,
  FeatureRequestStatus,
  UserProfile,
} from '../types/chat';

interface FeatureRequestModalProps {
  isOpen: boolean;
  requests: FeatureRequest[];
  loading: boolean;
  errorMsg: string | null;
  profile: UserProfile;
  onCreateRequest: (payload: {
    title: string;
    description: string;
    anonymous: boolean;
  }) => Promise<string | null>;
  onToggleVote: (request: FeatureRequest) => Promise<string | null>;
  onClose: () => void;
}

type SortMode = 'popular' | 'newest';
type FilterStatus = 'all' | FeatureRequestStatus;

const STATUS_BADGE_MAP: Record<
  FeatureRequestStatus,
  { label: string; className: string }
> = {
  検討中: {
    label: '検討中',
    className:
      'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/35',
  },
  開発中: {
    label: '開発中',
    className:
      'bg-sky-50 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-500/35',
  },
  実装済み: {
    label: '実装済み',
    className:
      'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/35',
  },
};

function formatDateShort(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '--/--';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${y}/${m}/${d} ${hh}:${mm}`;
}

export function FeatureRequestModal({
  isOpen,
  requests,
  loading,
  errorMsg,
  profile,
  onCreateRequest,
  onToggleVote,
  onClose,
}: FeatureRequestModalProps) {
  const [sortMode, setSortMode] = useState<SortMode>('popular');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [composerOpen, setComposerOpen] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [votingId, setVotingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const sortedAndFiltered = useMemo(() => {
    const filtered =
      filterStatus === 'all'
        ? requests
        : requests.filter((r) => r.status === filterStatus);

    return [...filtered].sort((a, b) => {
      if (sortMode === 'popular') {
        if (b.votes !== a.votes) return b.votes - a.votes;
      }
      return (
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    });
  }, [requests, sortMode, filterStatus]);

  if (!isOpen) return null;

  const displayNickname = profile.nickname.trim() || 'ゲスト';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle || submitting) return;

    setSubmitting(true);
    setLocalError(null);
    const err = await onCreateRequest({
      title: cleanTitle,
      description: description.trim(),
      anonymous,
    });
    setSubmitting(false);

    if (err) {
      setLocalError(err);
      return;
    }

    setTitle('');
    setDescription('');
    setAnonymous(false);
    setComposerOpen(false);
  };

  const handleVoteClick = async (req: FeatureRequest) => {
    if (votingId === req.id) return;
    setVotingId(req.id);
    setLocalError(null);
    const err = await onToggleVote(req);
    setVotingId(null);
    if (err) {
      setLocalError(err);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 dark:bg-slate-950/80 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="feature-request-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-2xl max-h-[92dvh] flex flex-col rounded-t-3xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Lightbulb className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2
                id="feature-request-modal-title"
                className="text-sm font-bold text-slate-900 dark:text-slate-50 truncate"
              >
                改善要望・投票ボックス
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                ほしい機能や改善案を投稿・投票できます
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sticky Controls Bar */}
        <div className="px-5 py-3 border-b border-slate-200/80 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-950/50 space-y-2.5 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Sort Toggle */}
            <div
              className="inline-flex items-center p-1 rounded-xl bg-slate-200/70 dark:bg-slate-800/90"
              role="group"
              aria-label="並び替え"
            >
              <button
                type="button"
                onClick={() => setSortMode('popular')}
                className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                  sortMode === 'popular'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <ArrowUpDown className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                人気順
              </button>
              <button
                type="button"
                onClick={() => setSortMode('newest')}
                className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                  sortMode === 'newest'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Clock className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                新着順
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setComposerOpen((prev) => !prev);
                setLocalError(null);
              }}
              className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                composerOpen
                  ? 'bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200'
                  : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-xs'
              }`}
            >
              {composerOpen ? (
                <>
                  <X className="w-3.5 h-3.5" />
                  フォームを閉じる
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  要望を投稿する
                </>
              )}
            </button>
          </div>

          {/* Status Filter Strip */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            {(['all', '検討中', '開発中', '実装済み'] as const).map((st) => {
              const active = filterStatus === st;
              const count =
                st === 'all'
                  ? requests.length
                  : requests.filter((r) => r.status === st).length;
              return (
                <button
                  key={st}
                  type="button"
                  onClick={() => setFilterStatus(st)}
                  className={`min-h-[32px] px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                    active
                      ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <span>{st === 'all' ? 'すべて' : st}</span>
                  <span className="font-mono tabular-nums opacity-75">{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden chat-scroll p-5 space-y-4">
          {(localError || errorMsg) && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/70 text-xs text-rose-700 dark:text-rose-200">
              <AlertCircle className="w-4 h-4 text-rose-500 dark:text-rose-400 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{localError || errorMsg}</span>
            </div>
          )}

          {/* New Request Composer */}
          {composerOpen && (
            <form
              onSubmit={handleSubmit}
              className="rounded-2xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/40 dark:bg-emerald-950/20 p-4 space-y-3.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  新しい改善要望を投稿
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  投稿者: {anonymous ? '匿名' : displayNickname}
                </span>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="feature-req-title"
                    className="text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    タイトル{' '}
                    <span className="text-emerald-600 dark:text-emerald-400">
                      必須
                    </span>
                  </label>
                  <span className="text-[11px] font-mono tabular-nums text-slate-400">
                    {title.length}/80
                  </span>
                </div>
                <input
                  id="feature-req-title"
                  type="text"
                  required
                  maxLength={80}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="例: メッセージのピン留め機能がほしい"
                  className="w-full h-11 px-3.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="feature-req-desc"
                    className="text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    詳細内容{' '}
                    <span className="text-slate-400 font-normal">任意</span>
                  </label>
                  <span className="text-[11px] font-mono tabular-nums text-slate-400">
                    {description.length}/500
                  </span>
                </div>
                <textarea
                  id="feature-req-desc"
                  rows={3}
                  maxLength={500}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="どんな場面で役立つか、具体的な要望があれば記入してください..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 resize-none"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <label className="inline-flex items-center gap-2 cursor-pointer select-none min-h-[36px]">
                  <input
                    type="checkbox"
                    checked={anonymous}
                    onChange={(e) => setAnonymous(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    匿名で投稿する
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={!title.trim() || submitting}
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 text-xs font-semibold text-white flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>要望を投稿</span>
                </button>
              </div>
            </form>
          )}

          {/* Request List */}
          {loading && requests.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2.5 text-slate-500 dark:text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />
              <span className="text-xs">改善要望を読み込んでいます...</span>
            </div>
          ) : sortedAndFiltered.length === 0 ? (
            <div className="py-12 px-4 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 space-y-2">
              <Lightbulb className="w-7 h-7 mx-auto text-slate-400 dark:text-slate-600" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                該当する改善要望はまだありません
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                右上の「要望を投稿する」からアイデアを共有してみましょう
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedAndFiltered.map((req) => {
                const statusMeta =
                  STATUS_BADGE_MAP[req.status] || STATUS_BADGE_MAP['検討中'];
                const hasVoted = req.voted_user_ids.includes(profile.id);
                const isVoting = votingId === req.id;

                return (
                  <article
                    key={req.id}
                    className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60 p-4 flex items-start gap-3.5 transition-colors hover:border-slate-300 dark:hover:border-slate-700"
                  >
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-bold ${statusMeta.className}`}
                        >
                          {statusMeta.label}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[160px]">
                          <User className="w-3 h-3 shrink-0" />
                          <span className="truncate">{req.author_name}</span>
                        </span>
                        <span className="text-[11px] font-mono tabular-nums text-slate-400 dark:text-slate-500">
                          {formatDateShort(req.created_at)}
                        </span>
                      </div>

                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-snug break-words">
                        {req.title}
                      </h3>

                      {req.description && (
                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-wrap break-words">
                          {req.description}
                        </p>
                      )}
                    </div>

                    {/* Vote Button */}
                    <button
                      type="button"
                      disabled={isVoting}
                      aria-pressed={hasVoted}
                      aria-label={
                        hasVoted
                          ? `「${req.title}」への投票を取り消す（現在 ${req.votes} 票）`
                          : `「${req.title}」に投票する（現在 ${req.votes} 票）`
                      }
                      onClick={() => void handleVoteClick(req)}
                      className={`min-h-[52px] min-w-[64px] px-3 py-2 rounded-xl border flex flex-col items-center justify-center gap-0.5 transition-all shrink-0 active:scale-95 ${
                        hasVoted
                          ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm shadow-emerald-500/20'
                          : 'bg-slate-50 hover:bg-emerald-50 dark:bg-slate-900 dark:hover:bg-emerald-500/10 border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-500/40 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <ThumbsUp
                        className={`w-4 h-4 ${hasVoted ? 'fill-current' : ''}`}
                      />
                      <span className="text-xs font-bold font-mono tabular-nums">
                        {req.votes}
                      </span>
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900 flex items-center justify-between gap-2 shrink-0">
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            1要望につき1票（再タップで取り消し可能）
          </span>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[38px] px-4 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 transition-colors"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
