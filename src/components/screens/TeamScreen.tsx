import React, { useState } from 'react';
import { useGoal } from '../../context/GoalContext';
import {
  Users,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { soundManager } from '../../services/sound';
import { androidBridge } from '../../services/androidBridge';
import { ParallelTrackSelector } from '../team/ParallelTrackSelector';
import { ParallelTaskCard } from '../team/ParallelTaskCard';
import { ScheduleRebalanceSheet } from '../team/ScheduleRebalanceSheet';
import { BatonHandoverBanner } from '../team/BatonHandoverBanner';
import { TeamManagementSheet } from '../team/TeamManagementSheet';

export const TeamScreen: React.FC = () => {
  const {
    teamMembers,
    activeGoal,
    batonHandoverNotice,
    dismissBatonHandoverNotice,
    reassignMicroMove,
    applyParallelRebalanceProposal,
    getParallelRebalanceProposals,
    parallelMetrics,
    completeMicroMove,
  } = useGoal();

  // Parallel Task & Team Schedule State
  const [selectedTrack, setSelectedTrack] = useState<string>('all');
  const [showRebalanceSheet, setShowRebalanceSheet] = useState(false);
  const [showManagementSheet, setShowManagementSheet] = useState(false);

  const allMoves = activeGoal?.microMoves || [];
  const filteredMoves = allMoves.filter((m) => {
    if (m.isPruned) return false;
    if (selectedTrack === 'all') return true;
    if (selectedTrack === 'user') {
      return m.assigneeId === 'user' || !m.assigneeId;
    }
    return m.assigneeId === selectedTrack;
  });

  const proposals = getParallelRebalanceProposals();
  const topBottleneck = parallelMetrics.bottlenecks[0];
  const pendingCount = parallelMetrics.totalMoves - parallelMetrics.completedMoves;

  return (
    <div className="flex-1 flex flex-col overflow-y-auto px-4 py-3 pb-[calc(env(safe-area-inset-bottom,0px)+88px)] select-none text-xs space-y-3">
      {/* Tier 1A: Floating Baton Handover Notice (Conditional) */}
      {batonHandoverNotice && (
        <BatonHandoverBanner
          notice={batonHandoverNotice}
          onDismiss={dismissBatonHandoverNotice}
        />
      )}

      {/* Top Header: Linear / Things 3 Calm Header with 48dp Executive Action Pills */}
      <header className="flex items-center justify-between gap-2 pt-1">
        <div>
          <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <span>Team Flight Plan</span>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-charcoal-surface text-bone-300 border border-white/[0.08] font-semibold">
              {pendingCount} active
            </span>
          </h1>
          <p className="text-[11px] text-bone-400 mt-0.5">
            {activeGoal?.title || 'Shared Roadmap'}
          </p>
        </div>

        {/* 48dp Header Action Buttons (Progressive Disclosure Triggers) */}
        <div className="flex items-center gap-2">
          {/* AI Rebalance Pill */}
          <button
            type="button"
            onClick={() => {
              soundManager.playTick();
              androidBridge.triggerHaptic('selection');
              setShowRebalanceSheet(true);
            }}
            aria-label="Open AI Schedule Rebalance"
            className="min-h-[48px] px-3.5 rounded-xl bg-terracotta/15 hover:bg-terracotta/25 active:bg-terracotta/35 text-terracotta border border-terracotta/35 font-semibold text-xs flex items-center gap-1.5 m3-press transition-colors focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:outline-none"
          >
            <Sparkles className="w-3.5 h-3.5 text-terracotta" />
            <span className="hidden sm:inline">Rebalance</span>
            <span className="font-mono text-[10px]">({proposals.length})</span>
          </button>

          {/* Manage Crew Pill */}
          <button
            type="button"
            onClick={() => {
              soundManager.playTick();
              androidBridge.triggerHaptic('selection');
              setShowManagementSheet(true);
            }}
            aria-label="Manage Team and Deliverables"
            className="min-h-[48px] px-3.5 rounded-xl bg-charcoal-surface hover:bg-bone-800 text-bone-200 border border-white/10 font-semibold text-xs flex items-center gap-1.5 m3-press transition-colors focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
          >
            <Users className="w-3.5 h-3.5 text-bone-400" />
            <span className="hidden sm:inline">Crew</span>
            <span className="font-mono text-[10px]">({teamMembers.length})</span>
          </button>
        </div>
      </header>

      {/* Tier 1B: Team Reality Pulse (3-Second Glance Rule) */}
      {topBottleneck && topBottleneck.blocksCount > 0 ? (
        <div className="bg-amber/15 border border-amber/35 rounded-2xl p-3 flex items-center justify-between gap-2 shadow-sm">
          <div className="flex items-center gap-2.5 min-w-0">
            <AlertTriangle className="w-4 h-4 text-amber shrink-0" />
            <p className="text-xs text-bone-200 truncate">
              <span className="font-semibold text-white">Bottleneck:</span> "{topBottleneck.moveTitle}" blocks {topBottleneck.blocksCount} downstream tasks
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              soundManager.playTick();
              androidBridge.triggerHaptic('light');
              setShowRebalanceSheet(true);
            }}
            className="min-h-[48px] px-3 text-xs font-bold text-amber hover:text-white uppercase tracking-wider underline shrink-0 m3-press flex items-center gap-1"
          >
            <span>Resolve</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      ) : (
        <div className="bg-charcoal-surface border border-white/[0.06] rounded-2xl px-3.5 py-2.5 flex items-center gap-2 text-xs text-bone-300">
          <CheckCircle2 className="w-4 h-4 text-sage shrink-0" />
          <span>All parallel streams in flight • Target pacing on track</span>
        </div>
      )}

      {/* Tier 2A: Parallel Track Filters (Thumb-Zone Swipeable Pills) */}
      <ParallelTrackSelector
        selectedTrack={selectedTrack}
        onSelectTrack={setSelectedTrack}
        teamMembers={teamMembers}
        trackCounts={parallelMetrics.trackCounts}
        workloadDistribution={parallelMetrics.workloadDistribution}
        totalCount={parallelMetrics.totalMoves}
      />

      {/* Tier 2B: Flat, Breathable Task Checklist (Un-nested, 48dp Minimums) */}
      <main className="space-y-2 pt-1" aria-label="Team Task Stream">
        {filteredMoves.length === 0 ? (
          <div className="py-12 text-center text-bone-500 bg-charcoal-surface/40 rounded-2xl border border-white/[0.06]">
            <p className="text-xs font-medium text-bone-300">All tasks clear in this track.</p>
            <p className="text-[11px] text-bone-500 mt-1">Select another track or tap Manage to add deliverables.</p>
          </div>
        ) : (
          filteredMoves.map((move) => (
            <ParallelTaskCard
              key={move.id}
              move={move}
              allMoves={allMoves}
              teamMembers={teamMembers}
              onComplete={completeMicroMove}
              onReassign={reassignMicroMove}
            />
          ))
        )}
      </main>

      {/* Tier 3: Progressive Disclosure Bottom Sheets */}
      {/* 1. Schedule Rebalance Sheet */}
      <ScheduleRebalanceSheet
        isOpen={showRebalanceSheet}
        onClose={() => setShowRebalanceSheet(false)}
        proposals={proposals}
        onApply={applyParallelRebalanceProposal}
      />

      {/* 2. Crew & Flight Plan Management Sheet */}
      <TeamManagementSheet
        isOpen={showManagementSheet}
        onClose={() => setShowManagementSheet(false)}
      />
    </div>
  );
};

export default TeamScreen;
