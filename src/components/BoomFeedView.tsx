import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Calculator,
  Heart,
  ImagePlus,
  Loader2,
  MessageCircle,
  Send,
  Settings,
  Trash2,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { formatTimeHHMM } from '../lib/constants';
import type {
  BoomPost,
  RealtimeStatus,
  UserProfile,
} from '../types/chat';
import { Avatar } from './Avatar';
import { ImageLightbox, type LightboxImageData } from './ImageLightbox';

interface BoomFeedViewProps {
  posts: BoomPost[];
  loading: boolean;
  realtimeStatus: RealtimeStatus;
  errorMsg: string | null;
  profile: UserProfile;
  onCreatePost: (content: string, imageFile?: File | null) => Promise<string | null>;
  onToggleLike: (post: BoomPost) => Promise<string | null>;
  onAddComment: (post: BoomPost, content: string) => Promise<string | null>;
  onDeletePost: (postId: string) => Promise<string | null>;
  onOpenSettings: () => void;
  onOpenProfile: () => void;
  onActivateCamouflage: () => void;
}

function formatRelativePostTime(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '';
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'たった今';
  if (diffMin < 60) return `${diffMin}分前`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}時間前`;
  const m = date.getMonth() + 1;
  const d = date.getDate();
  return `${m}/${d} ${formatTimeHHMM(isoString)}`;
}

export function BoomFeedView({
  posts,
  loading,
  realtimeStatus,
  errorMsg,
  profile,
  onCreatePost,
  onToggleLike,
  onAddComment,
  onDeletePost,
  onOpenSettings,
  onOpenProfile,
  onActivateCamouflage,
}: BoomFeedViewProps) {
  const [content, setContent] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const [openCommentsMap, setOpenCommentsMap] = useState<Record<string, boolean>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [submittingCommentId, setSubmittingCommentId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<LightboxImageData | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const myName = profile.nickname.trim() || 'ゲスト';

  useEffect(() => {
    if (!imageFile) {
      setImagePreview(null);
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  const handleImagePick = (file: File | null | undefined) => {
    if (!file) return;
    setLocalError(null);
    if (!file.type.startsWith('image/')) {
      setLocalError('画像ファイル（PNG / JPG / WebP / GIF）を選択してください。');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setLocalError('画像サイズは10MB以下にしてください。');
      return;
    }
    setImageFile(file);
  };

  const handleSubmitPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!content.trim() && !imageFile) || submitting) return;
    setLocalError(null);
    setSubmitting(true);
    const err = await onCreatePost(content.trim(), imageFile);
    setSubmitting(false);
    if (err) {
      setLocalError(err);
      return;
    }
    setContent('');
    setImageFile(null);
  };

  const handleToggleComments = (postId: string) => {
    setOpenCommentsMap((prev) => ({ ...prev, [postId]: !prev[postId] }));
  };

  const handleSubmitComment = async (post: BoomPost) => {
    const draft = (commentDrafts[post.id] || '').trim();
    if (!draft || submittingCommentId === post.id) return;

    setLocalError(null);
    setSubmittingCommentId(post.id);
    const err = await onAddComment(post, draft);
    setSubmittingCommentId(null);

    if (err) {
      setLocalError(`コメント送信エラー: ${err}`);
      return;
    }
    setCommentDrafts((prev) => ({ ...prev, [post.id]: '' }));
  };

  const isLikedByMe = (post: BoomPost): boolean => {
    return post.likes.includes(myName) || post.likes.includes(profile.id);
  };

  const isMyPost = (post: BoomPost): boolean => {
    if (post.author_id && profile.id) {
      return post.author_id === profile.id;
    }
    return post.author_name === myName;
  };

  const combinedError = localError || errorMsg;

  return (
    <div className="h-full flex flex-col bg-[#F8FAFC] dark:bg-slate-950 overflow-hidden">
      {/* BOOM Top Header */}
      <header className="shrink-0 h-[68px] px-4 sm:px-6 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 z-20">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-50 tracking-tight">
              BOOM
            </h1>
            <span className="text-xs text-slate-500 dark:text-slate-400 hidden sm:inline">
              タイムライン
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            {realtimeStatus === 'connected' && (
              <>
                <Wifi className="w-3 h-3 text-emerald-500 dark:text-emerald-400 shrink-0" />
                <span className="text-emerald-600 dark:text-emerald-400/90 font-medium">
                  同期中
                </span>
                <span aria-hidden="true">·</span>
              </>
            )}
            {realtimeStatus === 'connecting' && (
              <>
                <Loader2 className="w-3 h-3 text-sky-500 dark:text-sky-400 animate-spin shrink-0" />
                <span>接続中...</span>
                <span aria-hidden="true">·</span>
              </>
            )}
            {realtimeStatus === 'error' && (
              <>
                <WifiOff className="w-3 h-3 text-rose-500 dark:text-rose-400 shrink-0" />
                <span className="text-rose-600 dark:text-rose-400">接続エラー</span>
                <span aria-hidden="true">·</span>
              </>
            )}
            <span className="tabular-nums">{posts.length}件の投稿</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onActivateCamouflage}
            title="電卓画面へ切り替え（緊急隠蔽）"
            aria-label="電卓画面へ切り替え"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Calculator className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onOpenProfile}
            aria-label="プロフィール設定"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Avatar
              name={myName}
              avatarType={profile.avatarType}
              avatarValue={profile.avatarValue}
              avatarColor={profile.avatarColor}
              size="xs"
            />
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="ユーザー設定を開く"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Error banner */}
      {combinedError && (
        <div className="shrink-0 px-4 py-2.5 bg-rose-50 dark:bg-rose-950/80 border-b border-rose-200 dark:border-rose-800/70 text-xs text-rose-700 dark:text-rose-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-500 dark:text-rose-400 shrink-0" />
          <span className="truncate">{combinedError}</span>
        </div>
      )}

      {/* Scrollable Timeline Content */}
      <div className="flex-1 overflow-y-auto chat-scroll">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 pb-24 lg:pb-12 space-y-6">
          {/* Post Composer */}
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-xs dark:shadow-none p-4 sm:p-5">
            <form onSubmit={(e) => void handleSubmitPost(e)} className="space-y-3.5">
              <div className="flex items-start gap-3">
                <Avatar
                  name={myName}
                  avatarType={profile.avatarType}
                  avatarValue={profile.avatarValue}
                  avatarColor={profile.avatarColor}
                  size="md"
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {myName}
                    </span>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">
                      {content.length}/500
                    </span>
                  </div>
                  <textarea
                    rows={3}
                    maxLength={500}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="いまの出来事や写真をタイムラインに投稿しよう..."
                    className="w-full resize-none rounded-xl bg-slate-50 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 leading-relaxed transition-colors"
                  />
                </div>
              </div>

              {/* Attached Image Preview */}
              {imageFile && imagePreview && (
                <div className="relative ml-0 sm:ml-14 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950">
                  <img
                    src={imagePreview}
                    alt="投稿画像のプレビュー"
                    loading="lazy"
                    decoding="async"
                    className="w-full max-h-64 object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setImageFile(null)}
                    aria-label="添付画像を削除"
                    className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-slate-900/80 hover:bg-slate-900 text-white flex items-center justify-center border border-white/15 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Composer Toolbar */}
              <div className="flex items-center justify-between gap-3 pt-1 sm:pl-14">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={submitting}
                    className="min-h-[40px] px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800/80 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-colors whitespace-nowrap"
                  >
                    <ImagePlus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>写真を追加</span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      handleImagePick(e.target.files?.[0]);
                      e.target.value = '';
                    }}
                    className="hidden"
                  />
                </div>

                <button
                  type="submit"
                  disabled={(!content.trim() && !imageFile) || submitting}
                  className="min-h-[42px] px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:scale-[0.99] disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-500 disabled:pointer-events-none text-sm font-semibold text-white flex items-center gap-2 transition-all whitespace-nowrap shadow-xs shadow-emerald-500/20 disabled:shadow-none"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  <span>投稿する</span>
                </button>
              </div>
            </form>
          </section>

          {/* Feed Stream */}
          {loading && posts.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-500 dark:text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-500 dark:text-emerald-400" />
              <p className="text-xs">タイムラインを読み込んでいます...</p>
            </div>
          ) : posts.length === 0 ? (
            <div className="py-16 text-center space-y-2.5">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                まだ投稿はありません
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                上のフォームから最初の投稿をシェアしてみましょう。
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {posts.map((post) => {
                const liked = isLikedByMe(post);
                const commentsOpen = Boolean(openCommentsMap[post.id]);
                const commentDraft = commentDrafts[post.id] || '';
                const mine = isMyPost(post);

                return (
                  <article
                    key={post.id}
                    className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/85 shadow-xs dark:shadow-none overflow-hidden"
                  >
                    {/* Post Header */}
                    <div className="px-4 sm:px-5 pt-4 pb-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar
                          name={post.author_name}
                          avatarValue={post.author_avatar}
                          avatarColor={post.author_color}
                          size="md"
                        />
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                            {post.author_name}
                          </div>
                          <div className="text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">
                            {formatRelativePostTime(post.created_at)}
                          </div>
                        </div>
                      </div>

                      {mine && (
                        <div className="shrink-0">
                          {confirmDeleteId === post.id ? (
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-xs text-slate-600 dark:text-slate-300 dark:hover:text-white transition-colors"
                              >
                                キャンセル
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setConfirmDeleteId(null);
                                  void onDeletePost(post.id);
                                }}
                                className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white transition-colors"
                              >
                                削除
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(post.id)}
                              aria-label="この投稿を削除"
                              className="w-9 h-9 rounded-xl text-slate-400 dark:text-slate-500 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Post Body */}
                    {post.content && (
                      <div className="px-4 sm:px-5 pb-3.5 text-sm text-slate-800 dark:text-slate-100 leading-relaxed whitespace-pre-wrap break-words">
                        {post.content}
                      </div>
                    )}

                    {/* Post Image */}
                    {post.image_url && (
                      <div className="px-4 sm:px-5 pb-3.5">
                        <button
                          type="button"
                          onClick={() =>
                            setLightboxImage({
                              url: post.image_url!,
                              senderName: post.author_name,
                              createdAt: post.created_at,
                              caption: post.content || undefined,
                            })
                          }
                          className="block w-full overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 cursor-zoom-in focus:outline-none"
                        >
                          <img
                            src={post.image_url}
                            alt={post.content || `${post.author_name}の投稿画像`}
                            loading="lazy"
                            decoding="async"
                            referrerPolicy="no-referrer"
                            className="w-full max-h-[420px] object-cover hover:opacity-95 transition-opacity"
                          />
                        </button>
                      </div>
                    )}

                    {/* Reaction Bar */}
                    <div className="px-4 sm:px-5 py-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void onToggleLike(post)}
                        className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-medium flex items-center gap-2 transition-colors ${
                          liked
                            ? 'bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400 hover:bg-rose-100/80 dark:hover:bg-rose-500/20'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/80'
                        }`}
                      >
                        <Heart
                          className={`w-4 h-4 ${liked ? 'fill-rose-500 text-rose-500 dark:fill-rose-400 dark:text-rose-400' : ''}`}
                        />
                        <span>いいね</span>
                        <span className="font-mono tabular-nums">
                          {post.likes.length}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleComments(post.id)}
                        className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-medium flex items-center gap-2 transition-colors ${
                          commentsOpen
                            ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/80'
                        }`}
                      >
                        <MessageCircle className="w-4 h-4" />
                        <span>コメント</span>
                        <span className="font-mono tabular-nums">
                          {post.comments.length}
                        </span>
                      </button>
                    </div>

                    {/* Expandable Comment Section */}
                    {commentsOpen && (
                      <div className="px-4 sm:px-5 py-3.5 bg-slate-50/90 dark:bg-slate-950/60 border-t border-slate-100 dark:border-slate-800/80 space-y-3.5">
                        {post.comments.length === 0 ? (
                          <p className="text-xs text-slate-400 dark:text-slate-500">
                            まだコメントはありません。最初のコメントを書いてみましょう。
                          </p>
                        ) : (
                          <div className="space-y-3">
                            {post.comments.map((comment) => (
                              <div key={comment.id} className="flex items-start gap-2.5">
                                <Avatar
                                  name={comment.author_name}
                                  avatarValue={comment.author_avatar}
                                  avatarColor={comment.author_color}
                                  size="xs"
                                  className="mt-0.5"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-baseline gap-2">
                                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                                      {comment.author_name}
                                    </span>
                                    <span className="text-[10px] text-slate-400 dark:text-slate-500 tabular-nums shrink-0">
                                      {formatRelativePostTime(comment.created_at)}
                                    </span>
                                  </div>
                                  <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap break-words mt-0.5">
                                    {comment.content}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Inline Comment Composer */}
                        <div className="flex items-center gap-2 pt-1">
                          <input
                            type="text"
                            maxLength={240}
                            value={commentDraft}
                            onChange={(e) =>
                              setCommentDrafts((prev) => ({
                                ...prev,
                                [post.id]: e.target.value,
                              }))
                            }
                            onKeyDown={(e) => {
                              if (e.nativeEvent.isComposing || e.keyCode === 229) return;
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                void handleSubmitComment(post);
                              }
                            }}
                            placeholder="コメントを入力..."
                            className="flex-1 min-w-0 h-10 px-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                          />
                          <button
                            type="button"
                            onClick={() => void handleSubmitComment(post)}
                            disabled={
                              !commentDraft.trim() || submittingCommentId === post.id
                            }
                            aria-label="コメントを送信"
                            className="h-10 px-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0"
                          >
                            {submittingCommentId === post.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Send className="w-3.5 h-3.5" />
                            )}
                            <span>送信</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Image Lightbox (Mounted only when open) */}
      {lightboxImage && (
        <ImageLightbox image={lightboxImage} onClose={() => setLightboxImage(null)} />
      )}
    </div>
  );
}
