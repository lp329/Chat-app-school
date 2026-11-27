import { useEffect, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Database,
  Eye,
  EyeOff,
  Loader2,
  Radio,
  RotateCcw,
  ShieldCheck,
  X,
} from 'lucide-react';
import { SUPABASE_SETUP_SQL } from '../lib/constants';
import { testSupabaseConnection } from '../lib/supabaseService';
import type { SupabaseConfig } from '../types/chat';

interface SupabaseSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: SupabaseConfig;
  configSource: 'localStorage' | 'env' | 'none';
  onSave: (config: SupabaseConfig) => void;
  onClear: () => void;
}

export function SupabaseSettingsModal({
  isOpen,
  onClose,
  config,
  configSource,
  onSave,
  onClear,
}: SupabaseSettingsModalProps) {
  const [url, setUrl] = useState(config.url);
  const [anonKey, setAnonKey] = useState(config.anonKey);
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [showSql, setShowSql] = useState(false);
  const [sqlCopied, setSqlCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setUrl(config.url);
      setAnonKey(config.anonKey);
      setTestResult(null);
    }
  }, [isOpen, config.url, config.anonKey]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isConfigured = Boolean(config.url && config.anonKey);
  const canSave = Boolean(url.trim() && anonKey.trim());

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    const res = await testSupabaseConnection(url, anonKey);
    setTestResult(res);
    setTesting(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    onSave({ url: url.trim(), anonKey: anonKey.trim() });
    onClose();
  };

  const handleCopySql = async () => {
    try {
      await navigator.clipboard.writeText(SUPABASE_SETUP_SQL);
      setSqlCopied(true);
      setTimeout(() => setSqlCopied(false), 2000);
    } catch {
      // Fallback ignored
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/75 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="supabase-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-xl max-h-[90vh] flex flex-col bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-blue-600/15 text-blue-400 flex items-center justify-center shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2
                id="supabase-modal-title"
                className="text-base font-semibold text-slate-100 truncate"
              >
                Supabase Realtime 接続設定
              </h2>
              <p className="text-xs text-slate-400 truncate">
                {isConfigured
                  ? configSource === 'env'
                    ? '環境変数から接続中'
                    : 'Supabase接続設定を保存済み'
                  : '現在ローカルモックモードで動作中'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="設定モーダルを閉じる"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto chat-scroll p-6 space-y-5">
          {/* Current mode overview */}
          <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-950/70 border border-slate-800/90">
            <Radio
              className={`w-5 h-5 mt-0.5 shrink-0 ${
                isConfigured ? 'text-emerald-400' : 'text-blue-400'
              }`}
            />
            <div className="text-xs leading-relaxed text-slate-300 space-y-1">
              <p className="font-medium text-slate-100">
                {isConfigured
                  ? 'Supabase Realtime 同期が有効です'
                  : '未設定時はローカルモードで動作します'}
              </p>
              <p className="text-slate-400">
                {isConfigured
                  ? '同じ6桁のルーム番号を入力した他端末とリアルタイムにメッセージが同期されます。'
                  : 'ブラウザ内保存＋同一ブラウザ別タブ同期でUIをすぐお試しいただけます。他端末と同期するにはプロジェクトのURLとAnon Keyを設定してください。'}
              </p>
            </div>
          </div>

          {/* Credentials form */}
          <form id="supabase-config-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="supabase-url-input"
                className="block text-xs font-medium text-slate-300"
              >
                SUPABASE_URL
              </label>
              <input
                id="supabase-url-input"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://your-project-id.supabase.co"
                className="w-full h-11 px-3.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 font-mono transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="supabase-key-input"
                className="block text-xs font-medium text-slate-300"
              >
                SUPABASE_ANON_KEY
              </label>
              <div className="relative">
                <input
                  id="supabase-key-input"
                  type={showKey ? 'text' : 'password'}
                  value={anonKey}
                  onChange={(e) => setAnonKey(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
                  className="w-full h-11 pl-3.5 pr-12 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 font-mono transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((prev) => !prev)}
                  aria-label={showKey ? 'キーを隠す' : 'キーを表示'}
                  className="absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 transition-colors"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-500">
                入力した接続情報はこのブラウザの localStorage にのみ保存されます。
              </p>
            </div>

            {/* Test connection feedback */}
            {testResult && (
              <div
                className={`flex items-start gap-2.5 p-3.5 rounded-xl text-xs leading-relaxed border ${
                  testResult.ok
                    ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-200'
                    : 'bg-rose-950/40 border-rose-800/60 text-rose-200'
                }`}
              >
                <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{testResult.message}</span>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleTest}
                disabled={testing || !canSave}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-45 disabled:pointer-events-none text-xs font-medium text-slate-100 flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
              >
                {testing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ShieldCheck className="w-4 h-4 text-blue-400" />
                )}
                接続テスト
              </button>

              {isConfigured && (
                <button
                  type="button"
                  onClick={() => {
                    onClear();
                    setUrl('');
                    setAnonKey('');
                    setTestResult(null);
                  }}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-800/60 hover:bg-rose-950/60 hover:text-rose-200 text-xs font-medium text-slate-300 flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  ローカルモードに戻す
                </button>
              )}
            </div>
          </form>

          {/* Collapsible SQL setup instructions */}
          <div className="border-t border-slate-800 pt-4">
            <button
              type="button"
              onClick={() => setShowSql((prev) => !prev)}
              className="w-full min-h-[44px] flex items-center justify-between text-left text-xs font-medium text-slate-300 hover:text-white transition-colors"
            >
              <span>Supabase側のテーブル作成SQLを表示（初回セットアップ用）</span>
              {showSql ? (
                <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
              )}
            </button>

            {showSql && (
              <div className="mt-3 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] text-slate-400">
                    Supabase の SQL Editor に貼り付けて実行してください。
                  </p>
                  <button
                    type="button"
                    onClick={handleCopySql}
                    className="min-h-[36px] px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                  >
                    {sqlCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        コピー済み
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        SQLをコピー
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] leading-relaxed text-slate-300 font-mono overflow-x-auto chat-scroll">
                  {SUPABASE_SETUP_SQL}
                </pre>
              </div>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-800 bg-slate-900/95 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 py-2 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
          >
            キャンセル
          </button>
          <button
            type="submit"
            form="supabase-config-form"
            disabled={!canSave}
            className="min-h-[44px] px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-45 disabled:pointer-events-none text-sm font-semibold text-white transition-colors whitespace-nowrap shrink-0"
          >
            保存して接続
          </button>
        </div>
      </div>
    </div>
  );
}
