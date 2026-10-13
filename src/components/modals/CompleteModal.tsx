import React, { useState } from 'react';
import { MicroMove, CompletionSource } from '../../types/goal';
import { ModalSheet } from '../common/ModalSheet';
import { CheckCircle2, TrendingUp, Clock, MessageSquareQuote, Zap } from 'lucide-react';
import { soundManager } from '../../services/sound';

interface CompleteModalProps {
  move: MicroMove;
  onClose: () => void;
  onComplete: (moveId: string, actualMinutes: number, note: string, source?: CompletionSource) => void;
}

export const CompleteModal: React.FC<CompleteModalProps> = ({ move, onClose, onComplete }) => {
  const [actualMinutes, setActualMinutes] = useState<number>(move.estimatedMinutes);
  const [note, setNote] = useState<string>('');

  const quickDurations = [15, 25, 30, 45, 60];

  const calculatedVf = Math.round((move.estimatedMinutes / Math.max(1, actualMinutes)) * 100) / 100;
  const isAhead = calculatedVf >= 1.0;
  const deltaPercent = Math.round((calculatedVf - 1.0) * 100);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    soundManager.playCompleteChime();
    onComplete(move.id, actualMinutes, note.trim() || 'Sprint completed smoothly.', 'reflection_modal');
    onClose();
  };

  return (
    <ModalSheet
      onClose={onClose}
      title="Complete Move"
      subtitle="Record actual execution time and key reflections"
      icon={CheckCircle2}
      iconBgColor="bg-sage/15 text-sage border border-sage/30"
      maxWidth="max-w-md"
    >
      {/* Task Title preview */}
      <div className="p-3.5 rounded-2xl bg-obsidian-elevated border border-obsidian-border shadow-specular-subtle space-y-1.5">
        <p className="text-xs font-semibold text-bone-100 line-clamp-2 leading-relaxed">{move.title}</p>
        <div className="flex items-center space-x-3 text-[11px] text-bone-400 font-mono">
          <span className="flex items-center space-x-1">
            <Clock className="w-3.5 h-3.5 text-terracotta" />
            <span>Planned: <strong className="text-bone-200">{move.estimatedMinutes}m</strong></span>
          </span>
          <span className="text-bone-600">•</span>
          <span className="flex items-center space-x-1">
            <Zap className={`w-3 h-3 ${move.isCriticalPath ? 'text-amber' : 'text-terracotta'}`} />
            <span>Priority: <strong className={move.isCriticalPath ? 'text-amber' : 'text-bone-200'}>{move.isCriticalPath ? 'Key Milestone' : 'Supporting'}</strong></span>
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 pt-1">
        {/* Actual Duration Selection */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-bone-200">Actual Time Spent:</span>
            <span className="text-terracotta font-mono font-bold text-sm bg-terracotta/10 px-2 py-0.5 rounded-lg border border-terracotta/20">
              {actualMinutes}m
            </span>
          </div>

          {/* Quick preset buttons */}
          <div className="p-1 bg-obsidian-canvas border border-obsidian-border rounded-xl grid grid-cols-5 gap-1">
            {quickDurations.map(m => (
              <button
                type="button"
                key={m}
                onClick={() => {
                  soundManager.playTick();
                  setActualMinutes(m);
                }}
                className={`min-h-[48px] rounded-lg text-xs font-mono font-medium transition-all m3-press focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:outline-none ${
                  actualMinutes === m
                    ? 'bg-terracotta text-white shadow-sm font-semibold'
                    : 'text-bone-400 hover:text-bone-100 hover:bg-obsidian-highlight/50'
                }`}
              >
                {m}m
              </button>
            ))}
          </div>

          <input
            type="range"
            min={5}
            max={90}
            step={5}
            value={actualMinutes}
            onChange={e => setActualMinutes(Number(e.target.value))}
            aria-label="Actual minutes spent"
            className="w-full accent-terracotta cursor-pointer h-2 bg-obsidian-elevated rounded-lg appearance-none focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:ring-offset-2 focus-visible:ring-offset-obsidian-surface"
          />
        </div>

        {/* Real-time calculated velocity factor pill */}
        <div className="p-3 rounded-xl bg-obsidian-elevated border border-obsidian-border flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs">
            <TrendingUp className={`w-4 h-4 ${isAhead ? 'text-sage' : 'text-amber'}`} />
            <span className="text-bone-200 font-medium">Execution Pacing:</span>
          </div>
          <div className="flex items-center space-x-1.5 font-mono text-xs">
            <span
              className={`px-2 py-0.5 rounded-full font-semibold border ${
                isAhead
                  ? 'bg-sage/15 text-sage border-sage/30'
                  : 'bg-amber/15 text-amber border-amber/30'
              }`}
            >
              {isAhead ? 'On Pace' : 'Buffer Needed'}
            </span>
            <span className="text-[10px] text-bone-400">
              ({deltaPercent >= 0 ? `+${deltaPercent}%` : `${deltaPercent}%`})
            </span>
          </div>
        </div>

        {/* Reflection / Remarks */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-bone-200 flex items-center space-x-1.5">
            <MessageSquareQuote className="w-3.5 h-3.5 text-terracotta" />
            <span>Personal Reflection (Private to your device):</span>
          </label>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="e.g. Completed faster by reusing existing service hook..."
            rows={2}
            className="w-full rounded-xl bg-obsidian-elevated border border-obsidian-border p-3 text-xs text-bone-100 placeholder-bone-500 focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta/40 transition-all resize-none"
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          className="w-full min-h-[48px] rounded-xl bg-sage hover:bg-sage-hover active:scale-[0.99] text-white text-xs font-semibold shadow-md transition-all m3-press flex items-center justify-center space-x-2 focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2 focus-visible:ring-offset-obsidian-surface focus-visible:outline-none"
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Save & Complete Move</span>
        </button>
      </form>
    </ModalSheet>
  );
};
