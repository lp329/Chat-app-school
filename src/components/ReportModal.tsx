import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Flag,
  Loader2,
  ShieldCheck,
  X,
} from 'lucide-react';
import { REPORT_REASONS } from '../lib/constants';
import type { ReportReason } from '../types/chat';

interface ReportModalProps {
  isOpen: boolean;
  reporterName: string;
  initialTargetUser?: string;
  suggestedTargets?: string[];
  onClose: () => void;
  onSubmitReport: (payload: {
    targetUserName: string;
    reason: ReportReason;
    details: string;
  }) => Promise<string | null>;
}

export function ReportModal({
  isOpen,
  reporterName,
  initialTargetUser = '',
  suggestedTargets = [],
  onClose,
  onSubmitReport,
}: ReportModalProps) {
  const [targetUserName, setTargetUserName] = useState(initialTargetUser);
  const [reason, setReason] = useState<ReportReason>('スパム・荒らし');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTargetUserName(initialTargetUser);
      setReason('スパム・荒らし');
      setDetails('');
      setSubmitting(false);
      setError(null);
      setSubmitted(false);
    }
  }, [isOpen, initialTargetUser]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, submitting, onClose]);

  if (!isOpen) return null;

  const canSubmit = Boolean(targetUserName.trim() && details.trim()) && !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setError(null);
    const err = await onSubmitReport({
      targetUserName: targetUserName.trim(),
      reason,
      details: details.trim(),
    });
    setSubmitting(false);

    if (err) {
      setError(`送信に失敗しました: ${err}`);
      return;
    }
    setSubmitted(true);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 dark:bg-slate-950/80 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-modal-title"
      onClick={() => {
        if (!submitting) onClose();
      }}
    >
      <div
        className="w-full sm:max-w-lg max-h-[90vh] flex flex-col rounded-t-3xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
              <Flag className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2
                id="report-modal-title"
                className="text-sm font-bold text-slate-900 dark:text-slate-50 truncate"
              >
                問題のあるユーザーを通報
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                通報者: {reporterName}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="閉じる"
            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {submitted ? (
          <div className="p-6 text-center space-y-4">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">通報を受け付けました</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                ご報告ありがとうございます。運営チームにて内容を確認し、必要に応じて対応を行います。
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-sm font-semibold text-white transition-colors"
            >
              トーク画面に戻る
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="overflow-y-auto chat-scroll p-5 sm:p-6 space-y-4">
            {/* Zero-knowledge privacy assurance */}
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
              <ShieldCheck className="w-4 h-4 text-sky-500 dark:text-sky-400 shrink-0 mt-0.5" />
              <span>
                ゼロ知識設計のため、暗号化されたトーク履歴やルーム番号は運営へ自動送信されません。以下に入力した内容のみが送信されます。
              </span>
            </div>

            {/* Target user name */}
            <div className="space-y-1.5">
              <label
                htmlFor="report-target-user"
                className="block text-xs font-semibold text-slate-800 dark:text-slate-200"
              >
                対象ユーザー名 <span className="text-rose-500 dark:text-rose-400 font-normal">必須</span>
              </label>
              <input
                id="report-target-user"
                type="text"
                maxLength={40}
                value={targetUserName}
                onChange={(e) => setTargetUserName(e.target.value)}
                placeholder="通報対象のニックネームを入力"
                className="w-full h-11 px-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
              />
              {suggestedTargets.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] text-slate-500">候補:</span>
                  {suggestedTargets.slice(0, 6).map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setTargetUserName(name)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                        targetUserName === name
                          ? 'bg-rose-50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-200 border border-rose-300 dark:border-rose-500/40'
                          : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Reason selection */}
            <div className="space-y-1.5">
              <span className="block text-xs font-semibold text-slate-800 dark:text-slate-200">通報理由</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {REPORT_REASONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setReason(option)}
                    className={`min-h-[42px] px-3 py-2 rounded-xl border text-xs font-medium transition-colors ${
                      reason === option
                        ? 'bg-rose-50 dark:bg-rose-500/20 border-rose-400 dark:border-rose-500/60 text-rose-700 dark:text-rose-100'
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            {/* Details */}
            <div className="space-y-1.5">
              <label
                htmlFor="report-details"
                className="block text-xs font-semibold text-slate-800 dark:text-slate-200"
              >
                詳細内容 <span className="text-rose-500 dark:text-rose-400 font-normal">必須</span>
              </label>
              <textarea
                id="report-details"
                rows={4}
                maxLength={600}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="どのような問題・迷惑行為があったかを具体的にご記入ください"
                className="w-full p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 resize-none"
              />
              <div className="flex justify-end text-[11px] text-slate-400 dark:text-slate-500 font-mono tabular-nums">
                {details.length} / 600
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/70 text-xs text-rose-700 dark:text-rose-200">
                <AlertTriangle className="w-4 h-4 text-rose-500 dark:text-rose-400 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="min-h-[44px] px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={!canSubmit}
                className="min-h-[44px] px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-500 disabled:pointer-events-none text-sm font-semibold text-white flex items-center gap-2 transition-colors"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Flag className="w-4 h-4" />
                )}
                <span>通報を送信する</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
