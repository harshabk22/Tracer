import React, { useState, useMemo } from 'react';
import { useGoal } from '../../context/GoalContext';
import { SprintMilestone } from '../../types/goal';
import { CheckCircle2, Clock, AlertCircle, Share2, Compass, Calendar, Shield, User } from 'lucide-react';
import { soundManager } from '../../services/sound';
import { androidBridge } from '../../services/androidBridge';
import { MilestoneDetailSheet } from './MilestoneDetailSheet';

interface RoadmapTimelineProps {
  onOpenTeamSheet?: () => void;
}

export const RoadmapTimeline: React.FC<RoadmapTimelineProps> = ({ onOpenTeamSheet }) => {
  const { activeGoal, scheduleMetrics, shareFlightPlan, updateMilestone, teamMembers, setActiveTab } = useGoal();
  const [selectedMilestone, setSelectedMilestone] = useState<SprintMilestone | null>(null);

  if (!activeGoal || !activeGoal.milestones || activeGoal.milestones.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-bone-400 select-none">
        <div className="w-16 h-16 rounded-3xl bg-terracotta/15 text-terracotta flex items-center justify-center mb-4 border border-terracotta/25 shadow-surface">
          <Clock className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-bold text-bone-100">No Active Roadmap</h2>
        <p className="text-xs text-bone-400 mt-1.5 mb-6 max-w-[280px] leading-relaxed">
          {activeGoal
            ? 'Your flight plan is missing milestone checkpoints. Synthesize milestones to map your schedule.'
            : 'Create an ambitious flight plan to generate your sequential execution timeline.'}
        </p>
        <button
          onClick={() => {
            soundManager.playTick();
            androidBridge.triggerHaptic('medium');
            setActiveTab('intake');
          }}
          className="min-h-[56px] px-6 rounded-2xl bg-terracotta hover:bg-terracotta-hover text-white font-bold text-sm flex items-center justify-center gap-2 m3-press shadow-surface"
        >
          <span>{activeGoal ? 'Synthesize Milestones' : 'Craft Flight Plan'}</span>
        </button>
      </div>
    );
  }

  const milestones: SprintMilestone[] = [...activeGoal.milestones].sort((a, b) => a.order - b.order);

  const handleShare = async () => {
    soundManager.playTick();
    androidBridge.triggerHaptic('medium');
    if (onOpenTeamSheet) {
      onOpenTeamSheet();
    } else if (shareFlightPlan) {
      await shareFlightPlan();
    }
  };

  const getStatusBadge = (status: SprintMilestone['status']) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-sage/15 text-sage border border-sage/20">
            <CheckCircle2 className="w-3.5 h-3.5" /> Complete
          </span>
        );
      case 'in_progress':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-terracotta/15 text-terracotta border border-terracotta/20">
            <Clock className="w-3.5 h-3.5" /> Active
          </span>
        );
      case 'at_risk':
      case 'delayed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rust/15 text-rust border border-rust/20">
            <AlertCircle className="w-3.5 h-3.5" /> Behind
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-white/[0.06] text-bone-400 border border-white/10">
            Pending
          </span>
        );
    }
  };

  const totalFloat = activeGoal.totalFloatBufferDays ?? milestones.reduce((acc, m) => acc + (m.bufferFloatDays || 0), 0);

  const movesByMilestone = useMemo(() => {
    const map = new Map<string, typeof activeGoal.microMoves>();
    (activeGoal.microMoves || []).forEach(m => {
      const list = map.get(m.milestoneId) || [];
      list.push(m);
      map.set(m.milestoneId, list);
    });
    return map;
  }, [activeGoal.microMoves]);

  return (
    <div className="flex-1 flex flex-col overflow-y-auto px-4 py-4 pb-[calc(env(safe-area-inset-bottom,0px)+88px)] select-none">
      {/* Flight Plan Header Card */}
      <div className="bg-bone-900/80 border border-white/[0.08] rounded-2xl p-4 mb-5 shadow-surface">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5 text-terracotta text-xs font-semibold tracking-wider uppercase mb-1">
              <Compass className="w-3.5 h-3.5" /> Roadmap Timeline
            </div>
            <h2 className="text-xl font-bold text-bone-100">{activeGoal.title}</h2>
            <p className="text-xs text-bone-400 mt-0.5">
              {scheduleMetrics?.progressPercentage ?? 0}% completed • {scheduleMetrics?.completedMilestones ?? 0}/
              {scheduleMetrics?.totalMilestones ?? milestones.length} milestones
            </p>
          </div>
          <button
            onClick={handleShare}
            className="min-h-[48px] min-w-[48px] px-3.5 py-2.5 rounded-xl bg-terracotta/15 hover:bg-terracotta/25 text-terracotta border border-terracotta/30 flex items-center gap-2 text-xs font-semibold m3-press transition-colors focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:outline-none"
            aria-label="Share Flight Plan"
          >
            <Share2 className="w-4 h-4" />
            <span>Share</span>
          </button>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-white/[0.06] h-2 rounded-full mt-3.5 overflow-hidden">
          <div
            className="bg-terracotta h-full rounded-full transition-all duration-300"
            style={{ width: `${Math.min(100, scheduleMetrics?.progressPercentage ?? 0)}%` }}
          />
        </div>

        {/* Metric Readout Pills */}
        <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-white/[0.06] text-center">
          <div className="p-2 rounded-xl bg-bone-800/70 border border-white/[0.06]">
            <div className="flex items-center justify-center gap-1 text-[10px] font-mono text-bone-400">
              <Clock className="w-3 h-3 text-terracotta" />
              <span>Remaining</span>
            </div>
            <p className="text-xs font-bold text-bone-100 mt-0.5 font-mono">
              {scheduleMetrics?.daysRemaining ?? 0}d
            </p>
          </div>
          <div className="p-2 rounded-xl bg-bone-800/70 border border-white/[0.06]">
            <div className="flex items-center justify-center gap-1 text-[10px] font-mono text-bone-400">
              <Calendar className="w-3 h-3 text-amber" />
              <span>Elapsed</span>
            </div>
            <p className="text-xs font-bold text-bone-100 mt-0.5 font-mono">
              {scheduleMetrics?.elapsedDays ?? 0}d
            </p>
          </div>
          <div className="p-2 rounded-xl bg-bone-800/70 border border-white/[0.06]">
            <div className="flex items-center justify-center gap-1 text-[10px] font-mono text-bone-400">
              <Shield className="w-3 h-3 text-sage" />
              <span>Float Buffer</span>
            </div>
            <p className="text-xs font-bold text-bone-100 mt-0.5 font-mono">
              +{totalFloat}d
            </p>
          </div>
        </div>
      </div>

      {/* Vertical Milestone Stream */}
      <div className="relative pl-6 space-y-4">
        {/* Continuous timeline vertical line */}
        <div className="absolute left-[11px] top-3 bottom-4 w-[2px] bg-white/[0.08]" />

        {milestones.map((milestone, idx) => {
          const isDone = milestone.status === 'completed';
          const isActive = milestone.status === 'in_progress';
          const moves = movesByMilestone.get(milestone.id) || [];
          const doneMoves = moves.filter(m => m.status === 'completed').length;
          const pct = moves.length > 0 ? Math.round((doneMoves / moves.length) * 100) : (isDone ? 100 : 0);

          return (
            <div key={milestone.id} className="relative group">
              {/* Node Indicator */}
              <div
                className={`absolute -left-6 top-4 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ring-4 ring-[#141312] z-10 ${
                  isDone
                    ? 'bg-sage text-white'
                    : isActive
                    ? 'bg-terracotta text-white'
                    : 'bg-bone-800 text-bone-400 border border-white/20'
                }`}
              >
                {idx + 1}
              </div>

              {/* Interactive Milestone Card */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => {
                  soundManager.playTick();
                  androidBridge.triggerHaptic('selection');
                  setSelectedMilestone(milestone);
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedMilestone(milestone);
                  }
                }}
                className={`rounded-2xl p-4 transition-all duration-200 border cursor-pointer m3-press min-h-[56px] ${
                  isActive
                    ? 'bg-bone-900/95 border-terracotta/40 shadow-surface'
                    : 'bg-bone-900/60 border-white/[0.08] hover:border-white/20'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5 flex-wrap">
                  <span className="text-[11px] font-mono text-bone-400">Target: {milestone.targetDate}</span>
                  <div className="flex items-center gap-1.5">
                    {milestone.bufferFloatDays && milestone.bufferFloatDays > 0 ? (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-sage/15 text-sage border border-sage/20 font-semibold">
                        +{milestone.bufferFloatDays}d buffer
                      </span>
                    ) : milestone.status === 'delayed' || milestone.status === 'at_risk' ? (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-rust/15 text-rust border border-rust/20 font-semibold">
                        Overdue
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white/[0.05] text-bone-400 border border-white/10">
                        0d buffer
                      </span>
                    )}
                    {getStatusBadge(milestone.status)}
                  </div>
                </div>

                <div className="text-[10px] font-mono font-medium text-bone-400 uppercase tracking-wider mb-1">
                  Phase {idx + 1} of {milestones.length} • {doneMoves}/{moves.length} moves conquered ({pct}%)
                </div>

                <h3 className="text-base font-semibold text-bone-100">{milestone.title}</h3>
                {milestone.description && (
                  <p className="text-xs text-bone-300 mt-1 line-clamp-2">{milestone.description}</p>
                )}

                {/* Milestone Progress Bar */}
                <div className="h-1 w-full bg-white/[0.08] rounded-full overflow-hidden mt-2 mb-1">
                  <div
                    className="h-full bg-sage transition-all duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>

                {/* Shared Owner Chip & Progress */}
                <div className="mt-3 pt-2.5 border-t border-white/[0.06] flex items-center justify-between text-xs text-bone-400">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/[0.05] border border-white/[0.08] text-[11px] font-medium text-bone-300">
                    <User className="w-3 h-3 text-amber" />
                    <span>Shared: {milestone.owner || 'You'}</span>
                  </span>

                  {moves.length > 0 ? (
                    <span className="font-mono text-[11px]">
                      {doneMoves}/{moves.length} moves ({pct}%)
                    </span>
                  ) : (
                    <span className="text-[11px] text-terracotta font-medium">Tap to edit →</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Milestone Detail Sheet */}
      {selectedMilestone && (
        <MilestoneDetailSheet
          milestone={selectedMilestone}
          microMoves={activeGoal.microMoves || []}
          teamMembers={teamMembers || []}
          onClose={() => setSelectedMilestone(null)}
          onUpdateMilestone={updated => {
            updateMilestone(updated);
            setSelectedMilestone(updated);
          }}
        />
      )}
    </div>
  );
};
