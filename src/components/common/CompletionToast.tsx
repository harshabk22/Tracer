import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle2, RotateCcw, Plus, Minus, MessageSquareQuote, X, Check } from 'lucide-react';

export interface CompletionToastProps {
  moveId: string;
  moveTitle: string;
  actualMinutes: number;
  onAdjustDuration: (moveId: string, deltaMinutes: number) => void;
  onUpdateNote?: (moveId: string, note: string) => void;
  onUndo: () => void;
  onDismiss: () => void;
  durationMs?: number;
}

export const CompletionToast: React.FC<CompletionToastProps> = ({
  moveId,
  moveTitle,
  actualMinutes,
  onAdjustDuration,
  onUpdateNote,
  onUndo,
  onDismiss,
  durationMs = 4000,
}) => {
  const [timeLeft, setTimeLeft] = useState<number>(durationMs);
  const [showNoteInput, setShowNoteInput] = useState<boolean>(false);
  const [note, setNote] = useState<string>('');
  const [isPaused, setIsPaused] = useState<boolean>(false);

  const startTimeRef = useRef<number>(Date.now());
  const remainingTimeRef = useRef<number>(durationMs);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Timer loop with pause support
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

  const handleAdjust = (delta: number) => {
    onAdjustDuration(moveId, delta);
    // Reset timer slightly to give user time to review
    remainingTimeRef.current = Math.max(remainingTimeRef.current, 2500);
    setTimeLeft(remainingTimeRef.current);
    startTimeRef.current = Date.now();
  };

  const handleSaveNote = () => {
    if (onUpdateNote && note.trim()) {
      onUpdateNote(moveId, note.trim());
    }
    setShowNoteInput(false);
    setIsPaused(false);
  };

  const progressPercent = Math.max(0, Math.min(100, (timeLeft / durationMs) * 100));

  return (
    <div
      className="fixed bottom-20 left-4 right-4 max-w-md mx-auto z-50 animate-in fade-in slide-in-from-bottom-4 duration-200"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => !showNoteInput && setIsPaused(false)}
      role="status"
      aria-live="polite"
    >
      <div className="relative overflow-hidden rounded-2xl bg-obsidian-surface/95 backdrop-blur-2xl border border-obsidian-border p-3.5 shadow-executive flex flex-col space-y-2.5">
        {/* Top Progress Countdown Line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-white/[0.06]">
          <div
            className="h-full bg-sage transition-all duration-100 ease-linear"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Primary Row: Title & Completion Info + Undo & Dismiss */}
        <div className="flex items-center justify-between space-x-2 pt-0.5">
          {/* Left: Checkmark and Title & Duration */}
          <div className="flex items-center space-x-2.5 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-full bg-sage/15 border border-sage/30 text-sage flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center space-x-1.5">
                <span className="text-xs font-semibold text-bone-100 truncate max-w-[160px] sm:max-w-[200px]">
                  {moveTitle}
                </span>
              </div>
              <div className="flex items-center space-x-1 text-[11px] text-sage font-mono font-medium">
                <span>Done {actualMinutes}m</span>
              </div>
            </div>
          </div>

          {/* Right: Undo (min 48dp) & Dismiss (min 48dp) */}
          <div className="flex items-center space-x-1.5 flex-shrink-0">
            {/* Undo Action */}
            <button
              type="button"
              onClick={onUndo}
              className="px-3.5 min-h-[48px] rounded-xl bg-rust/15 hover:bg-rust/25 border border-rust/30 text-rust font-semibold text-xs flex items-center space-x-1.5 m3-press focus-visible:ring-2 focus-visible:ring-rust focus-visible:outline-none"
              title="Undo completion"
              aria-label="Undo completion"
            >
              <RotateCcw className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Undo</span>
            </button>

            {/* Dismiss X (48dp target) */}
            <button
              type="button"
              onClick={onDismiss}
              className="w-12 h-12 min-w-[48px] min-h-[48px] rounded-xl text-bone-400 hover:text-bone-100 hover:bg-obsidian-elevated flex items-center justify-center transition-colors m3-press focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:outline-none"
              title="Dismiss toast"
              aria-label="Dismiss toast"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Secondary Row: ±5m Duration Adjusters & Reflection Note Toggle (All ≥48dp Touch Targets) */}
        <div className="flex items-center space-x-2 pt-0.5">
          {/* -5m */}
          <button
            type="button"
            onClick={() => handleAdjust(-5)}
            className="flex-1 min-h-[48px] h-12 rounded-xl bg-obsidian-elevated hover:bg-obsidian-highlight border border-obsidian-border text-bone-100 flex items-center justify-center m3-press text-xs font-mono shadow-specular-subtle space-x-1.5 focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:outline-none"
            title="Decrease duration by 5 minutes"
            aria-label="Decrease 5 minutes"
          >
            <Minus className="w-3.5 h-3.5 text-bone-400" />
            <span>-5m</span>
          </button>

          {/* +5m */}
          <button
            type="button"
            onClick={() => handleAdjust(5)}
            className="flex-1 min-h-[48px] h-12 rounded-xl bg-obsidian-elevated hover:bg-obsidian-highlight border border-obsidian-border text-bone-100 flex items-center justify-center m3-press text-xs font-mono shadow-specular-subtle space-x-1.5 focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:outline-none"
            title="Increase duration by 5 minutes"
            aria-label="Increase 5 minutes"
          >
            <Plus className="w-3.5 h-3.5 text-bone-400" />
            <span>+5m</span>
          </button>

          {/* Note toggle */}
          <button
            type="button"
            onClick={() => {
              const next = !showNoteInput;
              setShowNoteInput(next);
              setIsPaused(next);
            }}
            className={`flex-1 min-h-[48px] h-12 rounded-xl flex items-center justify-center m3-press transition-colors shadow-specular-subtle text-xs font-medium space-x-1.5 focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:outline-none ${
              showNoteInput || note
                ? 'bg-terracotta text-white shadow-sm'
                : 'bg-obsidian-elevated hover:bg-obsidian-highlight border border-obsidian-border text-bone-300 hover:text-bone-100'
            }`}
            title="Add reflection note"
            aria-label="Add reflection note"
          >
            <MessageSquareQuote className="w-4 h-4" />
            <span>{note ? 'Edit Note' : 'Note'}</span>
          </button>
        </div>

        {/* Expandable Quick Note Field (≥48dp Targets) */}
        {showNoteInput && (
          <div className="pt-2 border-t border-obsidian-borderSubtle flex items-center space-x-2 animate-in fade-in duration-150">
            <input
              type="text"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Quick takeaway or remark..."
              autoFocus
              className="flex-1 min-h-[48px] px-3.5 rounded-xl bg-obsidian-elevated border border-obsidian-border text-xs text-bone-100 placeholder-bone-500 focus:outline-none focus:border-terracotta focus:ring-1 focus:ring-terracotta/40"
              onKeyDown={e => {
                if (e.key === 'Enter') handleSaveNote();
                if (e.key === 'Escape') {
                  setShowNoteInput(false);
                  setIsPaused(false);
                }
              }}
            />
            <button
              type="button"
              onClick={handleSaveNote}
              className="min-h-[48px] min-w-[48px] px-4 rounded-xl bg-terracotta hover:bg-terracotta-hover text-white text-xs font-semibold flex items-center justify-center space-x-1.5 m3-press shadow-sm focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
              aria-label="Save note"
            >
              <Check className="w-4 h-4" />
              <span>Save</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
