/**
 * Lean Schedule Engine for Tracer (<60 lines).
 * Clean milestone sequencing & active milestone tracking.
 */
import {
  Goal,
  SprintMilestone,
  LearningLog,
  PersonalLearningModel,
  MicroMove,
  TeamMember,
  ParallelRebalanceProposal,
  ParallelRebalanceFork,
} from '../types/goal';

export interface ScheduleMetrics {
  activeMilestone: SprintMilestone | null;
  activeMilestoneIndex: number;
  totalMilestones: number;
  completedMilestones: number;
  progressPercentage: number;
  elapsedDays: number;
  targetDays: number;
  isOverdue: boolean;
  daysRemaining: number;
}

export function cleanMilestoneTitle(title: string): string {
  return title.replace(/^(?:M\d+[:.-]?|\b(?:I|II|III|IV|V|VI|VII|VIII|IX|X)\b[:.-]?)\s*/i, '').trim();
}

export function formatExecutiveDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function toCalendarUtcMidnight(val: string | number | Date): number {
  if (typeof val === 'string') {
    const match = val.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    }
  }
  const dt = new Date(val);
  return Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate());
}

export function computeScheduleMetrics(goal: Goal | null): ScheduleMetrics {
  if (!goal) {
    return {
      activeMilestone: null,
      activeMilestoneIndex: -1,
      totalMilestones: 0,
      completedMilestones: 0,
      progressPercentage: 0,
      elapsedDays: 0,
      targetDays: 1,
      isOverdue: false,
      daysRemaining: 0,
    };
  }

  const milestones = [...(goal.milestones || [])].sort((a, b) => a.order - b.order);
  const totalMilestones = milestones.length;
  const completedMilestones = milestones.filter((m) => m.status === 'completed').length;
  const activeMilestoneIndex = milestones.findIndex((m) => m.status !== 'completed');
  const activeMilestone = activeMilestoneIndex !== -1 ? milestones[activeMilestoneIndex] : null;

  const msInDay = 86400000;
  const createdMidnight = toCalendarUtcMidnight(goal.createdAt || Date.now());
  const targetMidnight = toCalendarUtcMidnight(goal.vision?.targetDate || Date.now());
  const todayMidnight = toCalendarUtcMidnight(Date.now());

  const elapsedDays = Math.max(0, Math.round((todayMidnight - createdMidnight) / msInDay));
  const targetDays = Math.max(1, Math.round((targetMidnight - createdMidnight) / msInDay));
  const daysRemaining = Math.round((targetMidnight - todayMidnight) / msInDay);

  return {
    activeMilestone,
    activeMilestoneIndex,
    totalMilestones,
    completedMilestones,
    progressPercentage: totalMilestones > 0 ? Math.round((completedMilestones / totalMilestones) * 100) : 0,
    elapsedDays,
    targetDays,
    isOverdue: daysRemaining < 0,
    daysRemaining,
  };
}

export function sequenceMilestones(milestones: SprintMilestone[], startDateStr: string, intervalDays = 7): SprintMilestone[] {
  const startMidnight = toCalendarUtcMidnight(startDateStr);
  const msInDay = 86400000;
  return milestones.map((m, idx) => {
    const targetMidnight = startMidnight + (idx + 1) * intervalDays * msInDay;
    const target = new Date(targetMidnight);
    return {
      ...m,
      order: idx + 1,
      targetDate: target.toISOString().split('T')[0],
    };
  });
}

/**
 * Computes Personal Learning Model with anti-faking Winsorization and confidence weighting.
 * Clamps individual moves to [0.33x, 3.0x] and overall velocityFactor to [0.4, 2.5].
 * quick_check entries default to neutral 1.0x so rapid bulk checkoffs cannot distort roadmap pacing.
 */
export function computePersonalLearningModel(
  logs: LearningLog[],
  streak: { currentStreak: number; bestStreak: number } = { currentStreak: 0, bestStreak: 0 }
): PersonalLearningModel {
  const totalCompleted = logs.length;
  let totalEst = 0;
  let totalAct = 0;
  let remarks = 0;

  for (const log of logs) {
    const est = log.estimatedMinutes || 25;
    const rawAct = log.actualMinutes || est;
    // Winsorize actual duration: clamp between 33% (3.0x max speed) and 300% (0.33x min speed)
    const clampedAct = Math.max(Math.round(est * 0.33), Math.min(Math.round(est * 3.0), rawAct));

    // Only high-confidence entries (focus_timer, reflection_modal, assistant) influence velocityFactor
    // quick_check entries default to neutral 1.0x so mass checkoffs never corrupt future roadmap generation
    const isHighConfidence =
      log.source === 'focus_timer' ||
      log.source === 'reflection_modal' ||
      log.source === 'assistant' ||
      (Boolean(log.note) && log.note!.trim().length > 3);

    if (isHighConfidence) {
      totalEst += est;
      totalAct += clampedAct;
    } else {
      totalEst += est;
      totalAct += est; // Neutral 1.0x weighting prevents velocity explosion
    }

    if (log.note && log.note.trim()) remarks++;
  }

  const vf = totalAct > 0 ? Number((totalEst / totalAct).toFixed(2)) : 1.0;
  const clampedVf = Math.max(0.4, Math.min(2.5, vf));
  const accuracy =
    totalEst > 0 && totalAct > 0
      ? Math.round(Math.max(0, 100 - (Math.abs(totalAct - totalEst) / totalEst) * 100))
      : 100;

  return {
    velocityFactor: clampedVf,
    totalCompletedMoves: totalCompleted,
    totalActualMinutes: totalAct,
    totalEstimatedMinutes: totalEst,
    estimationAccuracy: accuracy,
    currentStreak: streak.currentStreak,
    bestStreak: streak.bestStreak,
    learningRemarksCount: remarks,
  };
}

export interface ParallelTrackMetrics {
  trackCounts: Record<string, number>;
  workloadDistribution: Record<string, { total: number; completed: number; pending: number; name: string }>;
  bottlenecks: Array<{ moveId: string; moveTitle: string; blocksCount: number; assigneeName: string }>;
  totalMoves: number;
  completedMoves: number;
  blockedMoves: number;
}

/**
 * Pure deterministic dependency resolver (<2ms).
 * Evaluates MicroMove dependencies: moves whose dependencies are fully completed
 * transition from 'blocked' to 'todo'. Moves with incomplete dependencies are marked 'blocked'.
 */
export function resolveMoveUnlocks(moves: MicroMove[]): { moves: MicroMove[]; newlyUnblockedIds: string[] } {
  const completedSet = new Set(
    moves.filter((m) => m.status === 'completed').map((m) => m.id)
  );

  const newlyUnblockedIds: string[] = [];
  const updatedMoves = moves.map((move) => {
    if (move.status === 'completed') return move;

    const deps = move.dependencies || [];
    if (deps.length === 0) {
      if (move.status === 'blocked') {
        newlyUnblockedIds.push(move.id);
        return { ...move, status: 'todo' as const };
      }
      return move;
    }

    const allDepsMet = deps.every((depId) => completedSet.has(depId));
    if (allDepsMet) {
      if (move.status === 'blocked') {
        newlyUnblockedIds.push(move.id);
        return { ...move, status: 'todo' as const };
      }
      return move;
    } else {
      if (move.status !== 'blocked') {
        return { ...move, status: 'blocked' as const };
      }
      return move;
    }
  });

  return { moves: updatedMoves, newlyUnblockedIds };
}

/**
 * Pure deterministic metrics calculation for parallel tracks, workload distribution, and bottlenecks.
 */
export function computeParallelTrackMetrics(
  moves: MicroMove[],
  teamMembers: TeamMember[]
): ParallelTrackMetrics {
  const trackCounts: Record<string, number> = {};
  const workloadDistribution: Record<string, { total: number; completed: number; pending: number; name: string }> = {};

  for (const tm of teamMembers) {
    workloadDistribution[tm.id] = { total: 0, completed: 0, pending: 0, name: tm.name };
  }
  if (!workloadDistribution['user']) {
    workloadDistribution['user'] = { total: 0, completed: 0, pending: 0, name: 'You' };
  }

  let totalMoves = 0;
  let completedMoves = 0;
  let blockedMoves = 0;

  const blockedByMap = new Map<string, number>();

  for (const move of moves) {
    if (move.isPruned) continue;
    totalMoves++;
    const track = move.parallelTrack || 'General';
    trackCounts[track] = (trackCounts[track] || 0) + 1;

    const assigneeId = move.assigneeId || 'user';
    const assigneeName = move.assigneeName || (assigneeId === 'user' ? 'You' : 'Teammate');

    if (!workloadDistribution[assigneeId]) {
      workloadDistribution[assigneeId] = { total: 0, completed: 0, pending: 0, name: assigneeName };
    }

    workloadDistribution[assigneeId].total++;
    if (move.status === 'completed') {
      completedMoves++;
      workloadDistribution[assigneeId].completed++;
    } else {
      workloadDistribution[assigneeId].pending++;
      if (move.status === 'blocked') {
        blockedMoves++;
      }
      for (const depId of move.dependencies || []) {
        blockedByMap.set(depId, (blockedByMap.get(depId) || 0) + 1);
      }
    }
  }

  const bottlenecks: Array<{ moveId: string; moveTitle: string; blocksCount: number; assigneeName: string }> = [];
  for (const move of moves) {
    if (move.status !== 'completed' && blockedByMap.has(move.id)) {
      bottlenecks.push({
        moveId: move.id,
        moveTitle: move.title,
        blocksCount: blockedByMap.get(move.id)!,
        assigneeName: move.assigneeName || 'You',
      });
    }
  }
  bottlenecks.sort((a, b) => b.blocksCount - a.blocksCount);

  return {
    trackCounts,
    workloadDistribution,
    bottlenecks,
    totalMoves,
    completedMoves,
    blockedMoves,
  };
}

/**
 * Generates the 3 Material 3 Schedule Rebalance Forks:
 * 1. Absorb Float: Consumes milestone buffer float to absorb delays without shifting target deadline.
 * 2. Team Parallel Shift: Reassigns blocked/heavy moves to the teammate with the lowest active load.
 * 3. Prune Scope: Marks non-critical path moves (isCriticalPath === false) as pruned.
 */
export function generateParallelRebalanceProposals(
  goal: Goal,
  teamMembers: TeamMember[]
): ParallelRebalanceProposal[] {
  const moves = goal.microMoves || [];
  const activeMoves = moves.filter((m) => !m.isPruned);
  const metrics = computeParallelTrackMetrics(moves, teamMembers);

  // Fork 1: Absorb Float
  const currentFloat = goal.totalFloatBufferDays ?? 4;
  const consumed = goal.consumedFloatDays ?? 0;
  const remainingFloat = Math.max(0, currentFloat - consumed);
  const absorbProposal: ParallelRebalanceProposal = {
    id: 'proposal_absorb_float',
    fork: 'absorb_float',
    title: 'Absorb Buffer Float',
    badge: 'Target Date Intact • Float -2d',
    description: 'Absorb schedule friction by drawing down elastic buffer float without shifting hard delivery targets.',
    impactSummary: 'Delivery deadline preserved with zero scope reduction.',
    diffPreview: {
      metric: 'Buffer Float Remaining',
      before: `${remainingFloat}d available`,
      after: `${Math.max(0, remainingFloat - 2)}d (2d absorbed)`,
    },
    actions: {
      floatExtensionDays: 2,
    },
  };

  // Fork 2: Team Parallel Shift / Split
  const entries = Object.entries(metrics.workloadDistribution);
  entries.sort((a, b) => b[1].pending - a[1].pending);
  const overloaded = entries[0];
  const leastLoaded = entries[entries.length - 1];

  const reassigns: { moveId: string; toAssigneeId: string; toAssigneeName: string }[] = [];
  if (overloaded && leastLoaded && overloaded[0] !== leastLoaded[0]) {
    const candidateMoves = activeMoves.filter(
      (m) => m.status !== 'completed' && (m.assigneeId || 'user') === overloaded[0]
    );
    const toShift = candidateMoves.slice(0, 2);
    for (const m of toShift) {
      reassigns.push({
        moveId: m.id,
        toAssigneeId: leastLoaded[0],
        toAssigneeName: leastLoaded[1].name,
      });
    }
  }

  const shiftProposal: ParallelRebalanceProposal = {
    id: 'proposal_parallel_split',
    fork: 'parallel_split',
    title: 'Team Parallel Shift',
    badge: 'Workload Balanced • 2 Concurrent Tracks',
    description: 'Shift pending moves from overloaded tracks to idle teammates to parallelize execution.',
    impactSummary: reassigns.length > 0
      ? `Reassigns ${reassigns.length} task(s) to ${leastLoaded?.[1]?.name || 'team'} for parallel execution.`
      : 'Balances workload across all active tracks.',
    diffPreview: {
      metric: 'Concurrent Distribution',
      before: overloaded ? `${overloaded[1].name}: ${overloaded[1].pending} active` : 'Asymmetric',
      after: leastLoaded ? `Parallel stream via ${leastLoaded[1].name}` : 'Evenly Distributed',
    },
    actions: {
      reassigns,
    },
  };

  // Fork 3: Prune Non-Critical Scope
  const nonCriticalMoves = activeMoves.filter((m) => !m.isCriticalPath && m.status !== 'completed');
  const pruneIds = nonCriticalMoves.slice(0, 3).map((m) => m.id);

  const pruneProposal: ParallelRebalanceProposal = {
    id: 'proposal_prune_scope',
    fork: 'prune_scope',
    title: 'Prune Non-Critical Scope',
    badge: 'Critical Path Preserved • Scope Trimmed',
    description: 'De-scope non-critical path moves to preserve velocity toward core milestones.',
    impactSummary: `Trims ${pruneIds.length} non-critical move(s) to accelerate velocity toward core milestones.`,
    diffPreview: {
      metric: 'Active Move Volume',
      before: `${activeMoves.length} active moves`,
      after: `${Math.max(1, activeMoves.length - pruneIds.length)} critical-focus moves`,
    },
    actions: {
      prunedMoveIds: pruneIds,
    },
  };

  return [absorbProposal, shiftProposal, pruneProposal];
}

/**
 * Immutably applies the chosen ParallelRebalanceProposal to the Goal.
 */
export function applyParallelRebalance(
  goal: Goal,
  proposal: ParallelRebalanceProposal
): Goal {
  let updatedMoves = [...(goal.microMoves || [])];
  let consumedFloat = goal.consumedFloatDays ?? 0;

  if (proposal.actions.reassigns && proposal.actions.reassigns.length > 0) {
    const reassignMap = new Map(
      proposal.actions.reassigns.map((r) => [r.moveId, r])
    );
    updatedMoves = updatedMoves.map((m) => {
      const r = reassignMap.get(m.id);
      if (r) {
        return {
          ...m,
          assigneeId: r.toAssigneeId,
          assigneeName: r.toAssigneeName,
        };
      }
      return m;
    });
  }

  if (proposal.actions.prunedMoveIds && proposal.actions.prunedMoveIds.length > 0) {
    const pruneSet = new Set(proposal.actions.prunedMoveIds);
    updatedMoves = updatedMoves.map((m) => {
      if (pruneSet.has(m.id)) {
        return {
          ...m,
          isPruned: true,
        };
      }
      return m;
    });
  }

  if (proposal.actions.floatExtensionDays) {
    consumedFloat += proposal.actions.floatExtensionDays;
  }

  const { moves: resolvedMoves } = resolveMoveUnlocks(updatedMoves);

  return {
    ...goal,
    microMoves: resolvedMoves,
    consumedFloatDays: consumedFloat,
  };
}


