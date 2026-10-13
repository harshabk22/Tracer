import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGoal } from '../../context/GoalContext';
import { MicroMove } from '../../types/goal';
import { focusSessionEngine } from '../../services/focusSessionEngine';
import { soundManager } from '../../services/sound';
import { androidBridge } from '../../services/androidBridge';
import { useVaultSecurity } from '../../hooks/useVaultSecurity';
import { CompleteModal } from '../modals/CompleteModal';
import {
  Check,
  Play,
  Target,
  Clock,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Calendar,
  ArrowRight,
  RotateCcw,
  Lock,
} from 'lucide-react';

interface FocusScreenProps {
  onOpenAssistant?: () => void;
  onOpenAuthModal?: (options?: { actionType?: 'unlock' | 'destructive' | 'setup'; title?: string }) => void;
}

export const FocusScreen: React.FC<FocusScreenProps> = ({ onOpenAssistant, onOpenAuthModal }) => {
  const {
    activeGoal,
    blockers,
    completeMicroMove,
    undoCompleteMicroMove,
    adjustMoveDuration,
    updateMicroMove,
    promoteToFocus,
    learningModel,
    streak,
    setActiveTab,
    dailyReflection,
    logDailyReflection,
  } = useGoal();

  const { isShieldEnabled, isShielded } = useVaultSecurity();

  const [showAllPending, setShowAllPending] = useState(false);
  const [isTomorrowExpanded, setIsTomorrowExpanded] = useState(false);
  const [isAccomplishmentsExpanded, setIsAccomplishmentsExpanded] = useState(false);
  const [completeMove, setCompleteMove] = useState<MicroMove | null>(null);

  const todayStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();
  const tomorrowStr = (() => {
    const d = new Date(Date.now() + 86400000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  const allGoalMoves = activeGoal?.microMoves || [];
  const isGoalFullyComplete = allGoalMoves.length > 0 && allGoalMoves.every(m => m.status === 'completed');

  // Zero-Guilt Midnight Rollover: uncompleted moves on or before today roll over seamlessly
  const todayMoves = allGoalMoves.filter(m => !m.isPruned && m.dateScheduled <= todayStr);
  const pendingMoves = todayMoves.filter(m => m.status === 'todo' || m.status === 'missed');
  const heroMove = pendingMoves[0] || null;
  const upcomingTodayMoves = pendingMoves.slice(1);
  const nextMove = upcomingTodayMoves[0] || null;
  const is2Strike = heroMove && (heroMove.status === 'missed' || (heroMove as any).missedCount >= 2);

  // Completed Moves (Past Accomplishments)
  const completedTodayMoves = allGoalMoves.filter(
    m => m.status === 'completed' && !m.isPruned && (m.completedAt?.startsWith(todayStr) || m.dateScheduled === todayStr)
  );
  const allCompletedMoves = allGoalMoves.filter(m => m.status === 'completed' && !m.isPruned);
  const displayCompletedMoves = completedTodayMoves.length > 0 ? completedTodayMoves : allCompletedMoves;

  // Tomorrow & Future Horizons
  const tomorrowMoves = allGoalMoves.filter(
    m => !m.isPruned && m.status !== 'completed' && m.dateScheduled === tomorrowStr
  );

  // Metrics
  const completedTodayCount = completedTodayMoves.length;
  const completedTodayMinutes = completedTodayMoves.reduce(
    (acc, m) => acc + (m.actualMinutes || m.estimatedMinutes || 0),
    0
  );
  const pendingTodayCount = pendingMoves.length;
  const pendingTodayMinutes = pendingMoves.reduce((acc, m) => acc + (m.estimatedMinutes || 0), 0);
  const totalTodayCount = completedTodayCount + pendingTodayCount;
  const totalTodayMinutes = completedTodayMinutes + pendingTodayMinutes;
  const progressPercent = totalTodayMinutes > 0
    ? Math.min(100, Math.round((completedTodayMinutes / totalTodayMinutes) * 100))
    : (completedTodayCount > 0 ? 100 : 0);

  const heroIndex = completedTodayCount + 1;
  const tomorrowCount = tomorrowMoves.length;
  const tomorrowMinutes = tomorrowMoves.reduce((acc, m) => acc + (m.estimatedMinutes || 0), 0);

  const heroMilestone = heroMove ? activeGoal?.milestones.find(ms => ms.id === heroMove.milestoneId) : null;
  const currentStreak = streak?.currentStreak ?? learningModel?.currentStreak ?? 0;

  const isAllGoalCompleted = Boolean(
    activeGoal &&
    activeGoal.microMoves.length > 0 &&
    activeGoal.microMoves.every(m => m.status === 'completed' || m.isPruned)
  );

  // Sensory Double-Haptic Cadence on Daily Queue Clearance
  const prevPendingCountRef = useRef(pendingMoves.length);
  useEffect(() => {
    if (prevPendingCountRef.current > 0 && pendingMoves.length === 0 && completedTodayCount > 0) {
      soundManager.playCompleteChime();
      androidBridge.triggerHaptic('success');
      setTimeout(() => {
        androidBridge.triggerHaptic('success');
      }, 160);
    }
    prevPendingCountRef.current = pendingMoves.length;
  }, [pendingMoves.length, completedTodayCount]);

  const scrollToSection = (sectionId: string) => {
    soundManager.playTick();
    androidBridge.triggerHaptic('selection');
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleComplete = (m: MicroMove) => {
    soundManager.playCompleteChime();
    androidBridge.triggerHaptic('complete');
    setCompleteMove(m);
  };

  const handleRescue = (type: 'slice' | 'reschedule') => {
    if (!heroMove) return;
    soundManager.playTick();
    androidBridge.triggerHaptic('medium');
    if (type === 'slice') {
      adjustMoveDuration(heroMove.id, 15 - heroMove.estimatedMinutes);
      updateMicroMove({ ...heroMove, estimatedMinutes: 15, status: 'todo' });
    } else {
      updateMicroMove({ ...heroMove, dateScheduled: tomorrowStr, status: 'todo' });
    }
  };

  const formatCompletionTime = (completedAt?: string) => {
    if (!completedAt) return 'Today';
    try {
      const d = new Date(completedAt);
      if (isNaN(d.getTime())) return 'Today';
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return 'Today';
    }
  };

  if (!activeGoal) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-bone-400 select-none">
        <div className="w-16 h-16 rounded-3xl bg-terracotta/15 text-terracotta flex items-center justify-center mb-4 border border-terracotta/25 shadow-surface">
          <Target className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-bold text-bone-100">No Active Flight Plan</h2>
        <p className="text-xs text-bone-400 mt-1.5 mb-6 max-w-[280px] leading-relaxed">
          Define an ambitious outcome to generate tailored milestones and daily micro-moves through Socratic intake.
        </p>
        <button
          onClick={() => {
            soundManager.playTick();
            androidBridge.triggerHaptic('medium');
            setActiveTab('intake');
          }}
          className="min-h-[56px] px-6 rounded-2xl bg-terracotta hover:bg-terracotta-hover text-white font-bold text-sm flex items-center justify-center gap-2 m3-press shadow-surface"
        >
          <span>Craft Flight Plan</span>
          <ArrowUpRight className="w-4 h-4" />
        </button>

        {/* Quick Launch Ideas */}
        <div className="mt-8 w-full max-w-xs space-y-2">
          <p className="text-[11px] font-mono uppercase tracking-wider text-bone-500 font-semibold">
            Or launch a proven trajectory:
          </p>
          <div className="flex flex-col gap-2">
            {[
              'Launch Android MVP in 30 Days',
              'Run 10km Marathon in 8 Weeks',
              'Master Rust Distributed Systems',
            ].map(idea => (
              <button
                key={idea}
                onClick={() => {
                  soundManager.playTick();
                  androidBridge.triggerHaptic('selection');
                  setActiveTab('intake');
                }}
                className="min-h-[48px] px-3.5 py-2 rounded-xl bg-bone-900/90 hover:bg-bone-800 border border-white/[0.08] text-bone-300 text-xs font-medium text-left flex items-center justify-between m3-press transition-colors"
              >
                <span className="truncate">{idea}</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-terracotta shrink-0 ml-1" />
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const renderCompletedCard = (move: MicroMove) => {
    const formattedTime = formatCompletionTime(move.completedAt);
    const loggedMins = move.actualMinutes || move.estimatedMinutes;
    const sourceLabel = move.completionSource === 'focus_timer'
      ? 'Timer'
      : move.completionSource === 'assistant'
      ? 'Co-Pilot'
      : 'Completed';

    return (
      <div
        key={move.id}
        className="bg-bone-900/80 border border-sage/30 rounded-2xl p-3.5 shadow-surface transition-all"
      >
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex items-start gap-2.5 min-w-0 flex-1">
            <div className="w-6 h-6 rounded-full bg-sage/20 text-sage flex items-center justify-center shrink-0 mt-0.5">
              <Check className="w-3.5 h-3.5 stroke-[3]" />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-semibold text-bone-200 leading-snug">{move.title}</h4>
              <div className="flex items-center gap-2 mt-1 text-[11px] font-mono text-bone-400">
                <span className="text-sage font-medium">⏱️ {loggedMins}m</span>
                <span>•</span>
                <span>🕒 {formattedTime}</span>
                <span>•</span>
                <span className="capitalize">{sourceLabel}</span>
              </div>
              {move.learningRemark && (
                isShieldEnabled && isShielded ? (
                  <button
                    type="button"
                    onClick={() => {
                      soundManager.playTick();
                      androidBridge.triggerHaptic('selection');
                      onOpenAuthModal?.({ actionType: 'unlock', title: 'Decrypt Private Reflection' });
                    }}
                    className="mt-2 min-h-[48px] px-3 py-2 rounded-xl bg-amber/10 hover:bg-amber/20 border border-amber/30 text-amber text-xs font-medium flex items-center gap-2 m3-press transition-colors w-full"
                    title="Authenticate to decrypt private reflection note"
                  >
                    <Lock className="w-3.5 h-3.5 text-amber shrink-0" />
                    <span>Private Reflection Encrypted • Tap to Authenticate</span>
                  </button>
                ) : (
                  <div className="mt-2 text-xs text-bone-300 bg-white/[0.03] border-l-2 border-sage px-2.5 py-1.5 rounded-r italic">
                    &ldquo;{move.learningRemark}&rdquo;
                  </div>
                )
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              soundManager.playTick();
              undoCompleteMicroMove(move.id);
            }}
            className="min-h-[48px] min-w-[48px] p-2 rounded-xl text-bone-400 hover:text-bone-100 hover:bg-white/[0.06] transition-colors m3-press flex items-center justify-center shrink-0"
            title="Undo Completion (Return to Todo)"
            aria-label="Undo task completion"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col overflow-y-auto px-4 py-3 pb-[calc(env(safe-area-inset-bottom,0px)+88px)] select-none">
      {/* 1. Calm Linear Header: Progress Pulse & Streak */}
      <div className="bg-bone-900/80 border border-white/[0.08] rounded-2xl p-3.5 mb-4 shadow-surface select-none">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-bone-100">Today's Focus</span>
            <span className="text-[11px] font-mono text-sage font-semibold px-2 py-0.5 rounded-full bg-sage/15 border border-sage/20">
              {completedTodayCount} of {totalTodayCount} done ({progressPercent}%)
            </span>
          </div>

          {currentStreak > 0 ? (
            <span className="text-[11px] font-mono text-amber-400 font-semibold bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20 flex items-center gap-1">
              🔥 {currentStreak}d streak
            </span>
          ) : (
            <span className="text-[11px] font-mono text-emerald-400 font-semibold bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1">
              ✨ Day 1
            </span>
          )}
        </div>

        {/* Quiet 2px Progress Track */}
        <div className="w-full h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
          <div
            className="h-full rounded-full bg-sage transition-all duration-500 ease-out"
            style={{ width: `${Math.min(100, Math.max(progressPercent, completedTodayCount > 0 ? 6 : 0))}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-[11px] font-mono text-bone-400 pt-1.5">
          <span>{completedTodayMinutes}m focused</span>
          <span>{pendingTodayMinutes > 0 ? `${pendingTodayMinutes}m remaining` : 'Queue cleared'}</span>
        </div>
      </div>

      {/* 2. PRESENT: COMMAND HERO SECTION */}
      <section id="present-section" className="mb-5 scroll-mt-3">
        <div className="flex items-center justify-between px-1 mb-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-terracotta">
            <Target className="w-3.5 h-3.5" />
            <span>Target Now</span>
            {heroMilestone && (
              <span className="text-bone-400 font-normal truncate max-w-[160px]">
                • {heroMilestone.title}
              </span>
            )}
          </div>
          {heroMove && (
            <span className="text-xs font-mono text-bone-400">
              Move #{heroIndex} of {totalTodayCount}
            </span>
          )}
        </div>

        {heroMove ? (
          <div className="bg-bone-900/95 border border-terracotta/40 rounded-3xl p-5 shadow-surface">
            <div className="flex items-center justify-between mb-2">
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase bg-terracotta text-white">
                Focus Task
              </span>
              <span className="text-xs font-mono text-bone-300 flex items-center gap-1 bg-white/[0.06] px-2.5 py-1 rounded-full border border-white/10">
                <Clock className="w-3.5 h-3.5 text-terracotta" /> {heroMove.estimatedMinutes}m Focus
              </span>
            </div>

            <h3 className="text-lg font-bold text-bone-100 leading-snug my-2">{heroMove.title}</h3>
            {heroMove.description && (
              <p className="text-xs text-bone-300 mb-3 line-clamp-3 leading-relaxed">{heroMove.description}</p>
            )}

            {/* Continuity Bridge: Preview of next task */}
            {nextMove && (
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2 my-2.5 flex items-center gap-2 text-xs text-bone-400">
                <ArrowRight className="w-3.5 h-3.5 text-terracotta shrink-0" />
                <span className="truncate">
                  Up next immediately:{' '}
                  <strong className="text-bone-200 font-semibold">{nextMove.title}</strong> ({nextMove.estimatedMinutes}m)
                </span>
              </div>
            )}

            {/* 2-Strike Rescue Protocol Card */}
            {is2Strike && (
              <div className="bg-amber/10 border border-amber/30 rounded-2xl p-3 my-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-amber mb-1">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Resistance Detected • Zero Guilt</span>
                </div>
                <p className="text-[11px] text-bone-400 mb-2.5">
                  Shrink activation barrier • Break resistance into bite-sized momentum
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleRescue('slice')}
                    className="min-h-[48px] px-3 py-2 rounded-xl bg-amber/20 hover:bg-amber/30 text-amber font-semibold text-xs m3-press border border-amber/30"
                  >
                    ✂️ Auto-slice 15m
                  </button>
                  <button
                    onClick={() => handleRescue('reschedule')}
                    className="min-h-[48px] px-3 py-2 rounded-xl bg-white/[0.06] hover:bg-white/10 text-bone-200 font-semibold text-xs m3-press border border-white/10"
                  >
                    📅 Tomorrow
                  </button>
                  {onOpenAssistant && (
                    <button
                      onClick={onOpenAssistant}
                      className="col-span-2 min-h-[48px] px-3 py-2 rounded-xl bg-terracotta/15 hover:bg-terracotta/25 text-terracotta font-semibold text-xs m3-press border border-terracotta/30 flex items-center justify-center gap-1"
                    >
                      <span>Consult Assistant</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Action Deck: 56dp Checkmark + Timer */}
            <div className="flex items-center gap-3 mt-4 pt-2 border-t border-white/[0.08]">
              <button
                onClick={() => {
                  soundManager.playTick();
                  androidBridge.triggerHaptic('medium');
                  focusSessionEngine.startSession(heroMove, heroMove.estimatedMinutes);
                }}
                className="flex-1 min-h-[56px] px-4 rounded-2xl bg-bone-800 hover:bg-bone-700 text-bone-100 font-semibold text-sm flex items-center justify-center gap-2 m3-press border border-white/10"
              >
                <Play className="w-4 h-4 text-terracotta fill-terracotta" />
                <span>Start Timer</span>
              </button>
              <button
                onClick={() => handleComplete(heroMove)}
                className="min-h-[56px] min-w-[56px] px-5 rounded-2xl bg-sage hover:bg-sage-hover text-white font-bold text-sm flex items-center justify-center gap-1.5 m3-press shadow-surface"
                aria-label="Mark Task Done"
              >
                <Check className="w-6 h-6 stroke-[3]" />
                <span>Done</span>
              </button>
            </div>
          </div>
        ) : isAllGoalCompleted ? (
          <div className="bg-bone-900/90 border border-sage/40 rounded-3xl p-6 text-center shadow-surface">
            <div className="w-12 h-12 rounded-2xl bg-sage/15 border border-sage/30 flex items-center justify-center text-sage mx-auto mb-3">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <span className="text-[11px] font-mono text-sage font-bold uppercase tracking-wider">Objective Completed</span>
            <h3 className="text-lg font-bold text-bone-100 mt-1 mb-1.5">{activeGoal.title}</h3>
            <p className="text-xs text-bone-400 mb-5 max-w-xs mx-auto leading-relaxed">
              All milestones and micro-moves across your roadmap have been successfully achieved!
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  soundManager.playTick();
                  androidBridge.triggerHaptic('selection');
                  setActiveTab('roadmap');
                }}
                className="flex-1 min-h-[48px] px-3 rounded-xl bg-bone-800 hover:bg-bone-700 text-bone-200 font-semibold text-xs border border-white/10 m3-press"
              >
                View Roadmap
              </button>
              <button
                onClick={() => {
                  soundManager.playTick();
                  androidBridge.triggerHaptic('medium');
                  setActiveTab('intake');
                }}
                className="flex-1 min-h-[48px] px-3 rounded-xl bg-terracotta hover:bg-terracotta-hover text-white font-semibold text-xs m3-press shadow-surface"
              >
                Launch Next Objective
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-bone-900/80 border border-sage/30 rounded-3xl p-5 text-center shadow-surface">
            <CheckCircle2 className="w-10 h-10 text-sage mx-auto mb-2" />
            <h3 className="text-base font-bold text-bone-100">Today&apos;s Flight Queue Cleared</h3>
            <p className="text-xs text-bone-400 mt-1 mb-4">
              All tasks scheduled for today have been conquered. Rest, recharge, or review your accomplishments below.
            </p>
          </div>
        )}
      </section>

      {/* 3. FUTURE: UPCOMING TRAJECTORY SECTION */}
      <section id="future-section" className="mb-5 scroll-mt-3">
        <div className="flex items-center justify-between px-1 mb-2.5">
          <h2 className="text-xs font-semibold text-bone-300 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-amber" />
            <span>Upcoming Flight Path</span>
            <span className="text-bone-500 font-normal">({upcomingTodayMoves.length} queued • {pendingTodayMinutes}m)</span>
          </h2>
        </div>

        {/* Today's Queued Micro-Moves */}
        {upcomingTodayMoves.length > 0 ? (
          <div className="bg-charcoal-surface rounded-2xl border border-white/[0.06] divide-y divide-white/[0.06] overflow-hidden mb-3">
            {upcomingTodayMoves.slice(0, showAllPending ? undefined : 3).map((move, index) => {
              const stepNumber = heroIndex + index + 1;
              return (
                <div
                  key={move.id}
                  className="p-3.5 flex items-center justify-between gap-3 hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <span className="text-[10px] font-mono font-bold text-bone-400 bg-white/[0.06] px-1.5 py-0.5 rounded shrink-0 mt-0.5">
                      #{stepNumber}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-bone-200 truncate">{move.title}</p>
                      <span className="text-xs font-mono text-bone-400">{move.estimatedMinutes}m</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => {
                        soundManager.playTick();
                        androidBridge.triggerHaptic('light');
                        promoteToFocus(move.id);
                      }}
                      className="min-h-[48px] min-w-[48px] p-2 rounded-xl text-bone-400 hover:text-terracotta m3-press flex items-center justify-center"
                      title="Promote to Focus Task"
                      aria-label="Promote to focus"
                    >
                      <ArrowUpRight className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleComplete(move)}
                      className="min-h-[48px] min-w-[48px] p-2 rounded-xl bg-sage/15 text-sage border border-sage/30 m3-press flex items-center justify-center hover:bg-sage/25 transition-colors"
                      title="Quick Done"
                      aria-label="Complete task"
                    >
                      <Check className="w-5 h-5 stroke-[2.5]" />
                    </button>
                  </div>
                </div>
              );
            })}

            {upcomingTodayMoves.length > 3 && (
              <button
                onClick={() => {
                  soundManager.playTick();
                  androidBridge.triggerHaptic('selection');
                  setShowAllPending(prev => !prev);
                }}
                className="w-full min-h-[48px] py-2 text-center text-xs font-medium text-terracotta hover:text-terracotta-hover transition-colors m3-press"
              >
                {showAllPending
                  ? 'Show fewer tasks'
                  : `+${upcomingTodayMoves.length - 3} more tasks today`}
              </button>
            )}
          </div>
        ) : (
          <div className="bg-charcoal-surface border border-white/[0.06] rounded-2xl p-3 text-center text-xs text-bone-400 mb-3">
            No further tasks queued for today.
          </div>
        )}

        {/* Tomorrow's Horizon Accordion */}
        <div className="bg-bone-900/60 border border-white/[0.08] rounded-2xl overflow-hidden shadow-surface">
          <button
            type="button"
            onClick={() => {
              soundManager.playTick();
              androidBridge.triggerHaptic('selection');
              setIsTomorrowExpanded(prev => !prev);
            }}
            className="w-full flex items-center justify-between p-3.5 text-left m3-press min-h-[48px]"
            aria-label={isTomorrowExpanded ? 'Collapse tomorrow schedule' : 'Expand tomorrow schedule'}
          >
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber shrink-0" />
              <span className="text-xs font-semibold text-bone-200">
                Tomorrow&apos;s Trajectory ({tomorrowCount} {tomorrowCount === 1 ? 'task' : 'tasks'} • {tomorrowMinutes}m)
              </span>
            </div>
            <div className="text-bone-400">
              {isTomorrowExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </button>

          {isTomorrowExpanded && (
            <div className="px-3.5 pb-3.5 pt-1 border-t border-white/[0.06] space-y-2">
              {tomorrowMoves.length > 0 ? (
                tomorrowMoves.map(m => (
                  <div key={m.id} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0 gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-bone-200 truncate">{m.title}</p>
                      <span className="text-[11px] font-mono text-bone-400">{m.estimatedMinutes}m</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        soundManager.playTick();
                        androidBridge.triggerHaptic('medium');
                        updateMicroMove({ ...m, dateScheduled: todayStr, status: 'todo' });
                      }}
                      className="min-h-[48px] min-w-[48px] px-3 py-1.5 rounded-xl bg-terracotta/15 hover:bg-terracotta/25 border border-terracotta/30 text-terracotta font-semibold text-xs flex items-center gap-1.5 m3-press shrink-0"
                      title="Pull into today's active flight path"
                      aria-label={`Work now on ${m.title}`}
                    >
                      <span>⚡ Work Now</span>
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-xs text-bone-400 italic">No tasks explicitly scheduled for tomorrow yet.</p>
              )}
            </div>
          )}
        </div>
      </section>

      {/* 4. PAST: CONQUERED LEDGER & ACCOMPLISHMENTS */}
      <section id="past-section" className="mb-5 scroll-mt-3">
        <div className="flex items-center justify-between px-1 mb-2.5">
          <h2 className="text-xs font-semibold text-bone-300 flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5 text-sage" />
            <span>Conquered & Accomplishments</span>
            <span className="text-bone-500 font-normal">({displayCompletedMoves.length} {displayCompletedMoves.length === 1 ? 'task' : 'tasks'} • {completedTodayMinutes}m logged)</span>
          </h2>
        </div>

        {displayCompletedMoves.length > 0 ? (
          <div className="space-y-2.5">
            {/* Victory summary banner */}
            <div className="bg-sage/10 border border-sage/20 rounded-2xl p-3 flex items-center gap-2.5 text-xs text-sage">
              <span className="text-base shrink-0">🏆</span>
              <span className="font-medium leading-tight">
                <strong>{completedTodayMinutes > 0 ? `${completedTodayMinutes}m` : `${displayCompletedMoves.length} tasks`} Conquered</strong> • Every completed micro-move builds compound momentum.
              </span>
            </div>

            {/* Victory Cards: Top 2 always visible */}
            {displayCompletedMoves.slice(0, 2).map(renderCompletedCard)}

            {/* Expandable overflow accordion if > 2 completed today */}
            {displayCompletedMoves.length > 2 && (
              <>
                <AnimatePresence>
                  {isAccomplishmentsExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25, ease: 'easeInOut' }}
                      className="space-y-2.5 overflow-hidden"
                    >
                      {displayCompletedMoves.slice(2).map(renderCompletedCard)}
                    </motion.div>
                  )}
                </AnimatePresence>

                <button
                  type="button"
                  onClick={() => {
                    soundManager.playTick();
                    setIsAccomplishmentsExpanded((prev) => !prev);
                  }}
                  className="w-full min-h-[48px] px-3 py-2 rounded-xl bg-bone-900/60 hover:bg-bone-900 border border-white/[0.06] text-bone-300 hover:text-bone-100 text-xs font-semibold flex items-center justify-center gap-1.5 m3-press transition-colors"
                >
                  {isAccomplishmentsExpanded ? (
                    <>
                      <ChevronUp className="w-4 h-4 text-terracotta" />
                      <span>Show fewer</span>
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-4 h-4 text-sage" />
                      <span>+{displayCompletedMoves.length - 2} more conquered today</span>
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="bg-bone-900/40 border border-white/[0.06] rounded-2xl p-4 text-center">
            <p className="text-xs text-bone-400">
              No tasks completed yet today. Your first victory awaits in the focus zone above.
            </p>
          </div>
        )}
      </section>

      {/* Dynamic Blocker & Friction Recovery Card */}
      {blockers && blockers.length > 0 && (
        <div className="bg-bone-900/80 border border-amber/30 rounded-3xl p-4 mb-4 shadow-surface">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Friction Logged: {blockers[0].taxonomy}</span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-amber/15 text-amber border border-amber/30 font-semibold">
              {blockers[0].timestamp?.split('T')[0] || todayStr}
            </span>
          </div>
          <p className="text-xs text-bone-300 leading-snug">
            {blockers[0].details || 'Resistance encountered during active execution.'}
          </p>
          {onOpenAssistant && (
            <button
              onClick={() => {
                soundManager.playTick();
                androidBridge.triggerHaptic('selection');
                onOpenAssistant();
              }}
              className="mt-3 w-full min-h-[48px] rounded-xl bg-amber/15 hover:bg-amber/25 border border-amber/30 text-amber text-xs font-semibold flex items-center justify-center gap-1.5 m3-press transition-colors"
            >
              <span>Consult Assistant to Dissolve Blocker</span>
            </button>
          )}
        </div>
      )}

      {/* Dynamic Evening Reflection Deck when tasks are active */}
      {pendingMoves.length > 0 && (
        <div className="bg-bone-900/70 border border-white/[0.08] rounded-2xl p-3.5 mb-4 shadow-surface flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-bone-400 font-bold block">
              Daily Pulse
            </span>
            <span className="text-xs text-bone-200 font-medium truncate block">
              {dailyReflection ? `Logged: ${dailyReflection}` : 'How is execution feeling today?'}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {['Smooth 🟢', 'Friction 🟡', 'Hard 🔴'].map(feel => (
              <button
                key={feel}
                onClick={() => {
                  soundManager.playTick();
                  androidBridge.triggerHaptic('selection');
                  logDailyReflection(feel);
                }}
                className={`min-w-[48px] min-h-[48px] px-2.5 py-1.5 rounded-xl text-xs font-medium m3-press transition-colors border flex items-center justify-center ${
                  dailyReflection && feel.toLowerCase().includes(dailyReflection.toLowerCase())
                    ? 'bg-sage/20 border-sage/40 text-sage font-bold'
                    : 'bg-bone-800 border-white/10 text-bone-300 hover:text-bone-100'
                }`}
              >
                {feel.split(' ')[1] || feel}
              </button>
            ))}
          </div>
        </div>
      )}

      {completeMove && (
        <CompleteModal
          move={completeMove}
          onClose={() => setCompleteMove(null)}
          onComplete={(id, mins, note, source) => {
            completeMicroMove(id, mins, note, source || 'reflection_modal');
            setCompleteMove(null);
          }}
        />
      )}
    </div>
  );
};
