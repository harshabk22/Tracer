import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Pause,
  Check,
  Plus,
  X,
  Headphones,
  Flame,
  Clock,
  MoreHorizontal,
  ChevronUp,
} from 'lucide-react';
import { useFocusSession } from '../../hooks/useFocusSession';
import { soundManager } from '../../services/sound';
import { androidBridge } from '../../services/androidBridge';
import { CompletionSource } from '../../types/goal';
import { feedback } from '../../services/feedback';

interface FocusSessionHUDProps {
  onCompleteMove?: (
    moveId: string,
    actualMinutes: number,
    note?: string,
    source?: CompletionSource
  ) => void;
  hasActiveSnackbar?: boolean;
}

export const FocusSessionHUD: React.FC<FocusSessionHUDProps> = ({
  onCompleteMove,
  hasActiveSnackbar = false,
}) => {
  const {
    isActive,
    isPaused,
    move,
    remainingSeconds,
    overtimeSeconds,
    progressPct,
    formattedRemaining,
    formattedOvertime,
    droneActive,
    pauseSession,
    resumeSession,
    extendBuffer,
    toggleDrone,
    finishAndComplete,
    cancelSession,
  } = useFocusSession();

  const [showMore, setShowMore] = useState(false);

  if (!isActive || !move) return null;

  const isOvertime = overtimeSeconds > 0;
  const strokeRadius = 18;
  const circumference = 2 * Math.PI * strokeRadius;
  const strokeDashoffset = circumference - (circumference * (100 - progressPct)) / 100;

  const handleComplete = () => {
    const result = finishAndComplete();
    if (result) {
      feedback.complete();
      onCompleteMove?.(result.moveId, result.actualMinutes, 'Deep Work Focus Session completed.', 'focus_timer');
    }
  };

  const handleToggleDrone = () => {
    feedback.selection();
    toggleDrone();
  };

  const handleExtend = () => {
    feedback.selection();
    extendBuffer(5);
  };

  return (
    <AnimatePresence>
      <motion.aside
        aria-label="Deep Work Focus Session"
        initial={{ y: 50, opacity: 0, scale: 0.96 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 50, opacity: 0, scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 450, damping: 32 }}
        className={`fixed ${hasActiveSnackbar ? 'bottom-[168px] sm:bottom-20' : 'bottom-20'} left-3 right-3 sm:left-auto sm:right-6 sm:w-96 z-40 transition-all duration-200 ease-out`}
      >
        <div className="p-3 rounded-2xl bg-obsidian-surface/95 backdrop-blur-2xl border border-obsidian-border shadow-[0_12px_40px_rgba(0,0,0,0.8)]">
          {/* Primary Row: Left (Radial Ring), Center (Title & Readout), Right (Primary 48dp Controls) */}
          <div className="flex items-center justify-between gap-2.5">
            {/* Left: Concentric Radial SVG Countdown Ring */}
            <div className="relative flex items-center justify-center flex-shrink-0 w-12 h-12">
              <svg className="w-12 h-12 -rotate-90 transform" viewBox="0 0 44 44">
                <defs>
                  <linearGradient id="focusProgressGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#D97736" />
                    <stop offset="100%" stopColor="#E28743" />
                  </linearGradient>
                  <linearGradient id="focusOvertimeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#FF9F0A" />
                    <stop offset="100%" stopColor="#FF453A" />
                  </linearGradient>
                </defs>

                {/* Background Track */}
                <circle
                  cx="22"
                  cy="22"
                  r={strokeRadius}
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.08)"
                  strokeWidth="3.5"
                />

                {/* Progress Bar Track */}
                <motion.circle
                  cx="22"
                  cy="22"
                  r={strokeRadius}
                  fill="none"
                  stroke={isOvertime ? 'url(#focusOvertimeGrad)' : 'url(#focusProgressGrad)'}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  animate={{ strokeDashoffset: isOvertime ? 0 : strokeDashoffset }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                />
              </svg>

              <div className="absolute inset-0 flex items-center justify-center">
                {isOvertime ? (
                  <Flame className="w-4 h-4 text-amber animate-pulse" />
                ) : isPaused ? (
                  <Pause className="w-4 h-4 text-bone-400" />
                ) : (
                  <Clock className="w-4 h-4 text-terracotta" />
                )}
              </div>
            </div>

            {/* Center: Mission Metadata & Pacing Readout (Unconstrained & Expanded) */}
            <div className="min-w-0 flex-1 pr-1">
              <div className="flex items-center space-x-1.5 min-w-0">
                <span className="text-[9px] font-mono uppercase tracking-wider text-terracotta font-bold flex-shrink-0">
                  FOCUS
                </span>
                <span className="text-xs font-semibold text-bone-100 truncate block min-w-0">
                  {move.title}
                </span>
              </div>

              <div className="flex items-center space-x-2 text-[11px] font-mono mt-0.5">
                <span className={isOvertime ? 'text-amber font-semibold' : 'text-bone-200'}>
                  {isOvertime ? `+${formattedOvertime} over` : `${formattedRemaining}`}
                </span>
                <span className="text-bone-400 text-[9px]">•</span>
                <span className="text-[10px] text-bone-400">
                  {isPaused ? 'Paused' : isOvertime ? 'Over delivery' : 'Deep work flight'}
                </span>
              </div>
            </div>

            {/* Right: Primary 48dp Controls (Play/Pause, Complete, More Toggle) */}
            <div className="flex items-center space-x-1.5 flex-shrink-0">
              {/* Pause / Resume Button */}
              {isPaused ? (
                <button
                  type="button"
                  onClick={resumeSession}
                  className="w-11 h-11 min-h-[48px] min-w-[48px] rounded-xl bg-terracotta hover:bg-terracotta/90 text-white flex items-center justify-center transition-all m3-press shadow-md"
                  title="Resume focus session"
                  aria-label="Resume session"
                >
                  <Play className="w-4 h-4 fill-white ml-0.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={pauseSession}
                  className="w-11 h-11 min-h-[48px] min-w-[48px] rounded-xl bg-obsidian-elevated hover:bg-obsidian-highlight text-bone-300 hover:text-white border border-obsidian-border flex items-center justify-center transition-all m3-press"
                  title="Pause focus session"
                  aria-label="Pause session"
                >
                  <Pause className="w-4 h-4" />
                </button>
              )}

              {/* Complete Button */}
              <button
                type="button"
                onClick={handleComplete}
                className="w-11 h-11 min-h-[48px] min-w-[48px] rounded-xl bg-sage/20 hover:bg-sage/30 border border-sage/40 text-sage flex items-center justify-center transition-all m3-press shadow-specular"
                title="Finish & log micro-move completion"
                aria-label="Complete micro-move"
              >
                <Check className="w-4 h-4 stroke-[2.5]" />
              </button>

              {/* Expand Secondary Overflow Toggle */}
              <button
                type="button"
                onClick={() => {
                  feedback.selection();
                  setShowMore(prev => !prev);
                }}
                className={`w-11 h-11 min-h-[48px] min-w-[48px] rounded-xl flex items-center justify-center transition-all m3-press border ${
                  showMore
                    ? 'bg-terracotta/20 text-terracotta border-terracotta/40'
                    : 'bg-obsidian-elevated text-bone-400 hover:text-bone-200 border-obsidian-border'
                }`}
                title={showMore ? 'Collapse focus actions' : 'More focus actions'}
                aria-label="More focus actions"
              >
                {showMore ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <MoreHorizontal className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Expandable Secondary Tray (432Hz Drone, +5m Float, Cancel) */}
          <AnimatePresence>
            {showMore && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: 'auto', marginTop: 10 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className="overflow-hidden pt-2 border-t border-white/[0.08] flex items-center justify-between gap-2"
              >
                {/* 432Hz Ambient Focus Drone Toggle */}
                <button
                  type="button"
                  onClick={handleToggleDrone}
                  className={`flex-1 min-h-[48px] px-3 py-2 rounded-xl flex items-center justify-center gap-2 text-xs font-semibold transition-all m3-press border ${
                    droneActive
                      ? 'bg-terracotta/20 text-terracotta border-terracotta/40 shadow-sm'
                      : 'bg-obsidian-elevated text-bone-300 hover:text-bone-100 border-obsidian-border'
                  }`}
                  title={droneActive ? 'Mute 432Hz Focus Drone' : 'Enable 432Hz Alpha Focus Drone'}
                  aria-label="Toggle 432Hz focus audio"
                >
                  <Headphones className={`w-4 h-4 ${droneActive ? 'animate-pulse text-terracotta' : 'text-bone-400'}`} />
                  <span>{droneActive ? '432Hz On' : '432Hz Drone'}</span>
                </button>

                {/* +5m Elastic Float Buffer */}
                <button
                  type="button"
                  onClick={handleExtend}
                  className="flex-1 min-h-[48px] px-3 py-2 rounded-xl bg-obsidian-elevated hover:bg-obsidian-highlight text-bone-200 border border-obsidian-border text-xs font-mono font-semibold flex items-center justify-center gap-1 transition-all m3-press"
                  title="Add 5 minutes elastic float buffer"
                  aria-label="Add 5 minutes buffer"
                >
                  <Plus className="w-3.5 h-3.5 text-terracotta" />
                  <span>+5m Buffer</span>
                </button>

                {/* Cancel/Dismiss Session Button */}
                <button
                  type="button"
                  onClick={() => {
                    feedback.warning();
                    cancelSession();
                  }}
                  className="min-h-[48px] px-3 py-2 rounded-xl bg-rust/15 hover:bg-rust/25 text-rust border border-rust/30 flex items-center justify-center gap-1 text-xs font-semibold transition-colors m3-press"
                  title="Cancel focus session without completing"
                  aria-label="Cancel session"
                >
                  <X className="w-4 h-4" />
                  <span>Cancel</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.aside>
    </AnimatePresence>
  );
};
