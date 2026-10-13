import React, { useState, useEffect, useRef } from 'react';
import { RotateCcw, X, AlertCircle } from 'lucide-react';
import { UndoItem } from '../../types/goal';

interface UndoToastProps {
  undoAction: UndoItem;
  onUndo: () => void;
  onDismiss: () => void;
  durationMs?: number;
}

export const UndoToast: React.FC<UndoToastProps> = ({
  undoAction,
  onUndo,
  onDismiss,
  durationMs = 5000,
}) => {
  const [timeLeft, setTimeLeft] = useState<number>(durationMs);
  const [isPaused, setIsPaused] = useState<boolean>(false);

  const startTimeRef = useRef<number>(Date.now());
  const remainingTimeRef = useRef<number>(durationMs);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Synchronize when a new undoAction arrives
  useEffect(() => {
    remainingTimeRef.current = durationMs;
    setTimeLeft(durationMs);
    startTimeRef.current = Date.now();
  }, [undoAction.id, durationMs]);

  useEffect(() => {
    if (isPaused) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    startTimeRef.current = Date.now();

    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const newRemaining = Math.max(0, remainingTimeRef.current - elapsed);
      setTimeLeft(newRemaining);

      if (newRemaining <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        onDismiss();
      }
    }, 100);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      remainingTimeRef.current = Math.max(0, remainingTimeRef.current - (Date.now() - startTimeRef.current));
    };
  }, [isPaused, onDismiss]);

  const progressPercent = Math.max(0, Math.min(100, (timeLeft / durationMs) * 100));

  return (
    <div
      className="fixed bottom-20 left-4 right-4 max-w-md mx-auto z-50 animate-in fade-in slide-in-from-bottom-4 duration-200"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      role="status"
      aria-live="polite"
    >
      <div className="relative overflow-hidden rounded-2xl bg-obsidian-surface/95 backdrop-blur-2xl border border-obsidian-border p-3.5 shadow-executive flex flex-col space-y-2">
        {/* Top Progress Countdown Line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-white/[0.06]">
          <div
            className="h-full bg-terracotta transition-all duration-100 ease-linear"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Content Row */}
        <div className="flex items-center justify-between space-x-2 pt-0.5">
          <div className="flex items-center space-x-2.5 min-w-0 flex-1">
            <div className="w-7 h-7 rounded-full bg-terracotta/15 border border-terracotta/30 text-terracotta flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-bone-100 truncate">
                {undoAction.description}
              </p>
              <p className="text-[10px] text-bone-400 font-mono">
                Reversible for {Math.ceil(timeLeft / 1000)}s
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1.5 flex-shrink-0">
            <button
              type="button"
              onClick={() => {
                onUndo();
              }}
              className="px-3.5 min-h-[48px] rounded-xl bg-terracotta hover:bg-terracotta-hover text-white font-bold text-xs flex items-center space-x-1.5 m3-press shadow-sm focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
              title="Undo action"
              aria-label="Undo action"
            >
              <RotateCcw className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Undo</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onDismiss();
              }}
              className="w-12 h-12 min-w-[48px] min-h-[48px] rounded-xl text-bone-400 hover:text-bone-100 hover:bg-obsidian-elevated flex items-center justify-center transition-colors m3-press focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:outline-none"
              title="Dismiss"
              aria-label="Dismiss undo toast"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
