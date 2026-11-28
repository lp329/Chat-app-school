import React from 'react';
import { Gamepad2, Zap, Palette, Circle, X, Send } from 'lucide-react';
import type { MiniGameId } from '../types/chat';
import { MINI_GAME_CATALOG } from '../lib/minigameData';

interface MiniGameLauncherModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectGame: (gameId: MiniGameId) => void;
}

function renderGameIcon(gameId: MiniGameId) {
  if (gameId === 'reaction') {
    return <Zap className="w-5 h-5" />;
  }
  if (gameId === 'draw_guess') {
    return <Palette className="w-5 h-5" />;
  }
  return <Circle className="w-5 h-5" />;
}

export const MiniGameLauncherModal: React.FC<MiniGameLauncherModalProps> = ({
  isOpen,
  onClose,
  onSelectGame,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-sm">
              <Gamepad2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                オンラインミニゲーム
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                ゲームを選んでルームに対戦募集カードを送ろう
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Game List */}
        <div className="p-4 sm:p-5 space-y-3 max-h-[75vh] overflow-y-auto">
          {MINI_GAME_CATALOG.map((game) => (
            <div
              key={game.id}
              className="rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/60 p-4 transition-colors hover:border-emerald-300 dark:hover:border-emerald-500/50"
            >
              <div className="flex items-start gap-3">
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${game.accentClass}`}
                >
                  {renderGameIcon(game.id)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                      {game.title}
                    </h3>
                    <span className="rounded-md bg-slate-200/80 dark:bg-slate-700 px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:text-slate-200">
                      {game.badge}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                    {game.description}
                  </p>
                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() => onSelectGame(game.id)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs transition-colors cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      対戦募集を送る
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
