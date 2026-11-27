import { ShieldAlert, Wrench } from 'lucide-react';

export function MaintenanceOverlay() {
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="maintenance-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 dark:bg-slate-950/95 backdrop-blur-md p-6"
    >
      <div className="w-full max-w-md rounded-3xl border border-amber-300 dark:border-amber-500/30 bg-white dark:bg-slate-900/95 p-7 sm:p-8 text-center shadow-2xl space-y-5">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center">
          <Wrench className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 text-xs font-semibold">
            <ShieldAlert className="w-3.5 h-3.5" />
            システムメンテナンス中
          </div>
          <h1
            id="maintenance-title"
            className="text-xl font-bold text-slate-900 dark:text-white tracking-tight leading-snug"
          >
            現在ROOMLINEはシステムメンテナンス中です
          </h1>
          <p className="text-xs sm:text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            安全性向上およびデータベース保守のため、新規メッセージの送信とトーク機能を一時停止しています。メンテナンス終了後、この画面は自動的に解除されます。
          </p>
        </div>

        <div className="pt-2 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-500">
          暗号化されたトークデータの安全性は引き続き保護されています
        </div>
      </div>
    </div>
  );
}
