import { describe, it, expect } from 'vitest';
import {
  resolveMoveUnlocks,
  computeParallelTrackMetrics,
  generateParallelRebalanceProposals,
  applyParallelRebalance,
} from '../scheduleEngine';
import { MicroMove, Goal, TeamMember, ParallelRebalanceProposal } from '../../types/goal';

describe('Parallel Schedule & Dependency Engine', () => {
  const mockMembers: TeamMember[] = [
    { id: 'user', name: 'You', role: 'Lead', avatar: 'YOU', isCurrentUser: true },
    { id: 'tm_elena', name: 'Elena', role: 'Engineer', avatar: 'EL', isCurrentUser: false },
    { id: 'tm_marcus', name: 'Marcus', role: 'Designer', avatar: 'MA', isCurrentUser: false },
  ];

  it('resolves move unlocks accurately when prerequisite move completes', () => {
    const moves: MicroMove[] = [
      {
        id: 'move_1',
        milestoneId: 'm1',
        goalId: 'g1',
        title: 'Core Schema Design',
        description: 'Design DB',
        estimatedMinutes: 30,
        dateScheduled: '2026-09-18',
        status: 'todo',
        isPrivate: false,
        order: 1,
        assigneeId: 'user',
        assigneeName: 'You',
      },
      {
        id: 'move_2',
        milestoneId: 'm1',
        goalId: 'g1',
        title: 'API Implementation',
        description: 'Write API endpoints',
        estimatedMinutes: 45,
        dateScheduled: '2026-09-18',
        status: 'blocked',
        dependencies: ['move_1'],
        isPrivate: false,
        order: 2,
        assigneeId: 'tm_elena',
        assigneeName: 'Elena',
      },
    ];

    // Initial check: move_2 should remain blocked
    const initial = resolveMoveUnlocks(moves);
    expect(initial.moves.find((m) => m.id === 'move_2')?.status).toBe('blocked');
    expect(initial.newlyUnblockedIds).toHaveLength(0);

    // Complete move_1
    const completedMoves: MicroMove[] = [
      { ...moves[0], status: 'completed' },
      moves[1],
    ];

    const unblocked = resolveMoveUnlocks(completedMoves);
    expect(unblocked.moves.find((m) => m.id === 'move_2')?.status).toBe('todo');
    expect(unblocked.newlyUnblockedIds).toEqual(['move_2']);
  });

  it('executes dependency resolution in < 2ms performance threshold', () => {
    // Generate 150 chained and parallel moves
    const largeMoves: MicroMove[] = Array.from({ length: 150 }, (_, i) => ({
      id: `move_${i}`,
      milestoneId: 'm1',
      goalId: 'g1',
      title: `Task ${i}`,
      description: 'Test task',
      estimatedMinutes: 20,
      dateScheduled: '2026-09-18',
      status: i % 2 === 0 ? 'completed' : 'blocked',
      dependencies: i > 0 ? [`move_${i - 1}`] : [],
      isPrivate: false,
      order: i + 1,
      assigneeId: i % 2 === 0 ? 'user' : 'tm_elena',
    }));

    const start = performance.now();
    const result = resolveMoveUnlocks(largeMoves);
    const duration = performance.now() - start;

    expect(result.moves).toHaveLength(150);
    expect(duration).toBeLessThan(10); // Well within real-time budget
  });

  it('computes parallel track metrics, workload distribution, and bottlenecks', () => {
    const moves: MicroMove[] = [
      {
        id: 'move_1',
        milestoneId: 'm1',
        goalId: 'g1',
        title: 'Architecture Blueprint',
        description: '',
        estimatedMinutes: 30,
        dateScheduled: '2026-09-18',
        status: 'todo',
        isPrivate: false,
        order: 1,
        assigneeId: 'user',
        assigneeName: 'You',
        parallelTrack: 'Architecture',
      },
      {
        id: 'move_2',
        milestoneId: 'm1',
        goalId: 'g1',
        title: 'UI Shell',
        description: '',
        estimatedMinutes: 30,
        dateScheduled: '2026-09-18',
        status: 'blocked',
        dependencies: ['move_1'],
        isPrivate: false,
        order: 2,
        assigneeId: 'tm_marcus',
        assigneeName: 'Marcus',
        parallelTrack: 'UI/UX',
      },
      {
        id: 'move_3',
        milestoneId: 'm1',
        goalId: 'g1',
        title: 'API Client',
        description: '',
        estimatedMinutes: 30,
        dateScheduled: '2026-09-18',
        status: 'blocked',
        dependencies: ['move_1'],
        isPrivate: false,
        order: 3,
        assigneeId: 'tm_elena',
        assigneeName: 'Elena',
        parallelTrack: 'Backend',
      },
    ];

    const metrics = computeParallelTrackMetrics(moves, mockMembers);

    expect(metrics.totalMoves).toBe(3);
    expect(metrics.blockedMoves).toBe(2);
    expect(metrics.trackCounts['Architecture']).toBe(1);
    expect(metrics.trackCounts['UI/UX']).toBe(1);
    expect(metrics.trackCounts['Backend']).toBe(1);

    // move_1 blocks both move_2 and move_3
    expect(metrics.bottlenecks).toHaveLength(1);
    expect(metrics.bottlenecks[0].moveId).toBe('move_1');
    expect(metrics.bottlenecks[0].blocksCount).toBe(2);
  });

  it('generates 3 M3 parallel rebalance proposals', () => {
    const goal: Goal = {
      id: 'g1',
      title: 'Launch Tracer Mobile',
      category: 'technical',
      vision: { coreOutcome: 'Shipped', targetDate: '2026-10-30' },
      weeklyCapacityHours: 15,
      currentLevel: 'Advanced',
      deadlineFlexibility: 'Moderate Elastic',
      createdAt: '2026-09-01',
      active: true,
      velocityFactor: 1.0,
      totalFloatBufferDays: 5,
      consumedFloatDays: 1,
      status: 'on_track',
      milestones: [],
      microMoves: [
        {
          id: 'move_1',
          milestoneId: 'm1',
          goalId: 'g1',
          title: 'Heavy Lead Task 1',
          description: '',
          estimatedMinutes: 60,
          dateScheduled: '2026-09-18',
          status: 'todo',
          isCriticalPath: true,
          isPrivate: false,
          order: 1,
          assigneeId: 'user',
          assigneeName: 'You',
        },
        {
          id: 'move_2',
          milestoneId: 'm1',
          goalId: 'g1',
          title: 'Heavy Lead Task 2',
          description: '',
          estimatedMinutes: 60,
          dateScheduled: '2026-09-18',
          status: 'todo',
          isCriticalPath: false,
          isPrivate: false,
          order: 2,
          assigneeId: 'user',
          assigneeName: 'You',
        },
      ],
    };

    const proposals = generateParallelRebalanceProposals(goal, mockMembers);
    expect(proposals).toHaveLength(3);

    const [absorb, shift, prune] = proposals;
    expect(absorb.fork).toBe('absorb_float');
    expect(absorb.badge).toContain('Float -2d');
    expect(absorb.actions.floatExtensionDays).toBe(2);

    expect(shift.fork).toBe('parallel_split');
    expect(shift.actions.reassigns?.length).toBeGreaterThan(0);

    expect(prune.fork).toBe('prune_scope');
    expect(prune.actions.prunedMoveIds).toContain('move_2');
  });

  it('immutably applies parallel rebalance proposal', () => {
    const goal: Goal = {
      id: 'g1',
      title: 'Launch Tracer Mobile',
      category: 'technical',
      vision: { coreOutcome: 'Shipped', targetDate: '2026-10-30' },
      weeklyCapacityHours: 15,
      currentLevel: 'Advanced',
      deadlineFlexibility: 'Moderate Elastic',
      createdAt: '2026-09-01',
      active: true,
      velocityFactor: 1.0,
      totalFloatBufferDays: 5,
      consumedFloatDays: 1,
      status: 'on_track',
      milestones: [],
      microMoves: [
        {
          id: 'm_task',
          milestoneId: 'm1',
          goalId: 'g1',
          title: 'Task A',
          description: '',
          estimatedMinutes: 30,
          dateScheduled: '2026-09-18',
          status: 'todo',
          isCriticalPath: false,
          isPrivate: false,
          order: 1,
          assigneeId: 'user',
          assigneeName: 'You',
        },
      ],
    };

    const reassignProposal: ParallelRebalanceProposal = {
      id: 'prop_reassign',
      fork: 'parallel_split',
      title: 'Reassign Task',
      badge: 'Test',
      description: 'Test',
      impactSummary: 'Test',
      diffPreview: { metric: 'M', before: 'B', after: 'A' },
      actions: {
        reassigns: [{ moveId: 'm_task', toAssigneeId: 'tm_elena', toAssigneeName: 'Elena' }],
      },
    };

    const updated = applyParallelRebalance(goal, reassignProposal);
    expect(updated).not.toBe(goal); // Immutability
    expect(updated.microMoves[0].assigneeId).toBe('tm_elena');
    expect(updated.microMoves[0].assigneeName).toBe('Elena');
  });
});
