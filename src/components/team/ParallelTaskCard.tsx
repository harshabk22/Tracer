import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check,
  Lock,
  Zap,
  Clock,
  UserCheck,
  ChevronDown,
  AlertCircle,
} from 'lucide-react';
import { MicroMove, TeamMember } from '../../types/goal';
import { soundManager } from '../../services/sound';
import { androidBridge } from '../../services/androidBridge';

interface ParallelTaskCardProps {
  move: MicroMove;
  allMoves: MicroMove[];
  teamMembers: TeamMember[];
  onComplete: (moveId: string) => void;
  onReassign: (moveId: string, toAssigneeId: string, toAssigneeName: string) => void;
}

export const ParallelTaskCard: React.FC<ParallelTaskCardProps> = ({
  move,
  allMoves,
  teamMembers,
  onComplete,
  onReassign,
}) => {
  const [showReassignMenu, setShowReassignMenu] = useState(false);
  const [blockedShake, setBlockedShake] = useState(false);

  const isCompleted = move.status === 'completed';

  // Determine uncompleted dependencies
  const incompleteDeps = (move.dependencies || [])
    .map((depId) => allMoves.find((m) => m.id === depId))
    .filter((m): m is MicroMove => Boolean(m && m.status !== 'completed'));

  const isBlocked = !isCompleted && (move.status === 'blocked' || incompleteDeps.length > 0);

  // Determine downstream moves that this task unblocks
  const downstreamMoves = allMoves.filter(
    (m) => m.status !== 'completed' && (m.dependencies || []).includes(move.id)
  );

  const handleCheckboxClick = () => {
    if (isCompleted) return;

    if (isBlocked) {
      soundManager.playTick();
      androidBridge.triggerHaptic('error');
      setBlockedShake(true);
      setTimeout(() => setBlockedShake(false), 500);
      return;
    }

    soundManager.playTick();
    onComplete(move.id);
  };

  const currentAssigneeName = move.assigneeName || (move.assigneeId === 'user' || !move.assigneeId ? 'You' : 'Teammate');

  return (
    <motion.div
      animate={blockedShake ? { x: [-4, 4, -3, 3, 0] } : {}}
      transition={{ duration: 0.3 }}
      className={`min-h-[64px] rounded-2xl p-3.5 border transition-all duration-200 relative ${
        isCompleted
          ? 'bg-charcoal-canvas/60 border-white/[0.04] text-bone-500'
          : isBlocked
          ? 'bg-charcoal-surface/40 border-white/[0.06] opacity-80'
          : move.isCriticalPath
          ? 'bg-charcoal-surface/95 border-amber/50 shadow-sm shadow-amber/10'
          : 'bg-charcoal-surface/90 border-white/[0.06] hover:border-white/15'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* 48dp Interactive Checkbox Hit-Area */}
        <button
          type="button"
          onClick={handleCheckboxClick}
          aria-label={isCompleted ? `Task completed: ${move.title}` : isBlocked ? `Task blocked: ${move.title}` : `Complete task: ${move.title}`}
          className="w-12 h-12 min-w-[48px] min-h-[48px] -ml-2 -mt-1.5 rounded-xl flex items-center justify-center shrink-0 m3-press focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:outline-none"
        >
          <div
            className={`w-6 h-6 rounded-lg flex items-center justify-center border transition-colors ${
              isCompleted
                ? 'bg-sage border-sage text-white'
                : isBlocked
                ? 'bg-bone-800/80 border-bone-700 text-amber'
                : 'bg-bone-800/90 border-bone-600 hover:border-terracotta text-transparent'
            }`}
          >
            {isCompleted ? (
              <Check className="w-4 h-4 stroke-[2.5]" />
            ) : isBlocked ? (
              <Lock className="w-3.5 h-3.5" />
            ) : null}
          </div>
        </button>

        {/* Card Content */}
        <div className="flex-1 min-w-0 pt-0.5">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h4
              className={`text-sm font-semibold tracking-tight leading-snug ${
                isCompleted
                  ? 'line-through text-bone-500'
                  : isBlocked
                  ? 'text-bone-300'
                  : 'text-bone-100'
              }`}
            >
              {move.title}
            </h4>

            {move.isCriticalPath && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber/15 text-amber border border-amber/30">
                <Zap className="w-2.5 h-2.5 fill-current" />
                Critical Path
              </span>
            )}
          </div>

          {/* Subtitle / Dependency Badges */}
          <div className="flex flex-wrap items-center gap-1.5 mt-1">
            {isBlocked && incompleteDeps.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-rust/15 text-rust border border-rust/30">
                <Lock className="w-3 h-3" />
                Waiting on: {incompleteDeps[0].title}
              </span>
            )}

            {!isCompleted && downstreamMoves.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-sage/15 text-sage border border-sage/30">
                <Zap className="w-3 h-3" />
                Unblocks: {downstreamMoves[0].assigneeName || 'Teammate'}
              </span>
            )}

            <span className="inline-flex items-center gap-1 text-[11px] text-bone-400 font-mono">
              <Clock className="w-3 h-3 text-bone-500" />
              {move.estimatedMinutes}m
            </span>

            {move.parallelTrack && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-bone-800 text-bone-400 border border-bone-700/50">
                {move.parallelTrack}
              </span>
            )}
          </div>
        </div>

        {/* 1-Tap Reassign Avatar Chip (48dp Touch Target) */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => {
              soundManager.playTick();
              androidBridge.triggerHaptic('selection');
              setShowReassignMenu((prev) => !prev);
            }}
            aria-label={`Reassign task. Currently assigned to ${currentAssigneeName}`}
            aria-expanded={showReassignMenu}
            className="h-12 min-h-[48px] px-2.5 rounded-xl bg-charcoal-surface border border-white/[0.08] hover:border-white/20 flex items-center gap-1.5 text-xs text-bone-300 m3-press"
          >
            <span className="w-5 h-5 rounded-full bg-terracotta/20 border border-terracotta/40 text-terracotta flex items-center justify-center text-[10px] font-bold">
              {currentAssigneeName.charAt(0)}
            </span>
            <span className="max-w-[70px] truncate font-medium">{currentAssigneeName}</span>
            <ChevronDown className="w-3 h-3 text-bone-400" />
          </button>

          {/* Transparent Backdrop to dismiss on outside tap */}
          {showReassignMenu && (
            <div
              className="fixed inset-0 z-20"
              aria-hidden="true"
              onClick={() => setShowReassignMenu(false)}
            />
          )}

          {/* Reassign Dropdown Menu */}
          <AnimatePresence>
            {showReassignMenu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -4 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-1.5 z-30 min-w-[160px] bg-charcoal-surface border border-white/10 rounded-2xl shadow-xl overflow-hidden py-1"
              >
                <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-bone-400 border-b border-white/[0.06]">
                  Reassign Task
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onReassign(move.id, 'user', 'You');
                    setShowReassignMenu(false);
                  }}
                  className="w-full text-left min-h-[48px] px-3 py-2 text-xs text-bone-200 hover:bg-bone-800 flex items-center gap-2 m3-press"
                >
                  <span className="w-4 h-4 rounded-full bg-terracotta/20 text-terracotta flex items-center justify-center text-[9px] font-bold">
                    Y
                  </span>
                  <span>You (Lead)</span>
                </button>

                {teamMembers
                  .filter((tm) => !tm.isCurrentUser)
                  .map((tm) => (
                    <button
                      key={tm.id}
                      type="button"
                      onClick={() => {
                        onReassign(move.id, tm.id, tm.name);
                        setShowReassignMenu(false);
                      }}
                      className="w-full text-left min-h-[48px] px-3 py-2 text-xs text-bone-200 hover:bg-bone-800 flex items-center gap-2 m3-press"
                    >
                      <span className="w-4 h-4 rounded-full bg-bone-800 text-bone-300 border border-white/[0.06] flex items-center justify-center text-[9px] font-bold">
                        {tm.name.charAt(0)}
                      </span>
                      <span className="truncate">{tm.name}</span>
                    </button>
                  ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
};
