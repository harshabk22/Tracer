import { describe, it, expect } from 'vitest';
import { Goal, MicroMove, TeamMember, ParallelRebalanceProposal } from '../../types/goal';
import {
  resolveMoveUnlocks,
  computeParallelTrackMetrics,
  generateParallelRebalanceProposals,
  applyParallelRebalance,
} from '../scheduleEngine';

describe('Parallel Tasks & Team Schedule Ergonomics & End-to-End Flow', () => {
  const mockTeam: TeamMember[] = [
    { id: 'user', name: 'Lead Dev', role: 'Architect', avatar: '👑', isCurrentUser: true },
    { id: 'tm_elena', name: 'Elena Rostova', role: 'Systems Eng', avatar: '⚡', isCurrentUser: false },
    { id: 'tm_marcus', name: 'Marcus Chen', role: 'Designer', avatar: '🎨', isCurrentUser: false },
  ];

  it('guarantees 48dp minimum touch targets across parallel components CSS specifications', async () => {
    // Read source code of parallel components to verify 48dp standards
    const fs = await import('fs');
    const path = await import('path');

    const cardSource = fs.readFileSync(
      path.resolve(__dirname, '../../components/team/ParallelTaskCard.tsx'),
      'utf-8'
    );
    const selectorSource = fs.readFileSync(
      path.resolve(__dirname, '../../components/team/ParallelTrackSelector.tsx'),
      'utf-8'
    );
    const sheetSource = fs.readFileSync(
      path.resolve(__dirname, '../../components/team/ScheduleRebalanceSheet.tsx'),
      'utf-8'
    );
    const bannerSource = fs.readFileSync(
      path.resolve(__dirname, '../../components/team/BatonHandoverBanner.tsx'),
      'utf-8'
    );

    // Verify 48dp minimum height / hit areas
    expect(cardSource).toContain('min-h-[48px]');
    expect(cardSource).toContain('min-w-[48px]');
    expect(cardSource).toContain('min-h-[64px]');

    expect(selectorSource).toContain('min-h-[48px]');

    expect(sheetSource).toContain('min-h-[48px]');
    expect(sheetSource).toContain('safe-area-inset-bottom');

    expect(bannerSource).toContain('min-h-[48px]');
    expect(bannerSource).toContain('min-w-[48px]');
    expect(bannerSource).toContain('role="status"');
    expect(bannerSource).toContain('aria-live="polite"');
  });

  it('executes autonomous multi-step Baton Handover cascade', () => {
    // Pipeline: M1 (Design) -> M2 (Frontend) -> M3 (Security Audit)
    const initialMoves: MicroMove[] = [
      {
        id: 'move_design',
        milestoneId: 'ms_1',
        goalId: 'g_1',
        title: 'Design API Specs',
        description: 'OpenAPI definition',
        estimatedMinutes: 30,
        dateScheduled: '2026-09-18',
        status: 'todo',
        isCriticalPath: true,
        isPrivate: false,
        order: 1,
        assigneeId: 'user',
        assigneeName: 'Lead Dev',
        parallelTrack: 'Architecture',
      },
      {
        id: 'move_frontend',
        milestoneId: 'ms_1',
        goalId: 'g_1',
        title: 'Build UI Views',
        description: 'React components',
        estimatedMinutes: 60,
        dateScheduled: '2026-09-18',
        status: 'blocked',
        dependencies: ['move_design'],
        isCriticalPath: true,
        isPrivate: false,
        order: 2,
        assigneeId: 'tm_marcus',
        assigneeName: 'Marcus Chen',
        parallelTrack: 'Design & UI',
      },
      {
        id: 'move_audit',
        milestoneId: 'ms_1',
        goalId: 'g_1',
        title: 'Perform Security Audit',
        description: 'Verify sanitization',
        estimatedMinutes: 45,
        dateScheduled: '2026-09-19',
        status: 'blocked',
        dependencies: ['move_frontend'],
        isCriticalPath: false,
        isPrivate: false,
        order: 3,
        assigneeId: 'tm_elena',
        assigneeName: 'Elena Rostova',
        parallelTrack: 'Security',
      },
    ];

    // Step 1: Check initial status
    const pass1 = resolveMoveUnlocks(initialMoves);
    expect(pass1.moves.find((m) => m.id === 'move_design')?.status).toBe('todo');
    expect(pass1.moves.find((m) => m.id === 'move_frontend')?.status).toBe('blocked');
    expect(pass1.moves.find((m) => m.id === 'move_audit')?.status).toBe('blocked');
    expect(pass1.newlyUnblockedIds).toHaveLength(0);

    // Step 2: Complete move_design -> move_frontend unblocks (Baton passed to Marcus Chen)
    const afterDesign = pass1.moves.map((m) =>
      m.id === 'move_design' ? { ...m, status: 'completed' as const } : m
    );
    const pass2 = resolveMoveUnlocks(afterDesign);
    expect(pass2.moves.find((m) => m.id === 'move_frontend')?.status).toBe('todo');
    expect(pass2.moves.find((m) => m.id === 'move_audit')?.status).toBe('blocked');
    expect(pass2.newlyUnblockedIds).toEqual(['move_frontend']);

    // Step 3: Complete move_frontend -> move_audit unblocks (Baton passed to Elena Rostova)
    const afterFrontend = pass2.moves.map((m) =>
      m.id === 'move_frontend' ? { ...m, status: 'completed' as const } : m
    );
    const pass3 = resolveMoveUnlocks(afterFrontend);
    expect(pass3.moves.find((m) => m.id === 'move_audit')?.status).toBe('todo');
    expect(pass3.newlyUnblockedIds).toEqual(['move_audit']);
  });

  it('generates resilient parallel rebalance proposals and preserves goal immutability', () => {
    const goal: Goal = {
      id: 'g_e2e',
      title: 'Distributed Tracer Launch',
      category: 'technical',
      vision: { coreOutcome: 'Deployed', targetDate: '2026-10-15' },
      weeklyCapacityHours: 20,
      currentLevel: 'Advanced',
      deadlineFlexibility: 'Moderate Elastic',
      createdAt: '2026-09-01',
      active: true,
      velocityFactor: 1.0,
      totalFloatBufferDays: 4,
      consumedFloatDays: 0,
      status: 'on_track',
      milestones: [],
      microMoves: [
        {
          id: 'm1',
          milestoneId: 'ms1',
          goalId: 'g_e2e',
          title: 'Heavy Engine Work',
          description: '',
          estimatedMinutes: 90,
          dateScheduled: '2026-09-18',
          status: 'todo',
          isCriticalPath: true,
          isPrivate: false,
          order: 1,
          assigneeId: 'user',
          assigneeName: 'Lead Dev',
        },
        {
          id: 'm2',
          milestoneId: 'ms1',
          goalId: 'g_e2e',
          title: 'Optional Polish',
          description: '',
          estimatedMinutes: 30,
          dateScheduled: '2026-09-18',
          status: 'todo',
          isCriticalPath: false,
          isPrivate: false,
          order: 2,
          assigneeId: 'user',
          assigneeName: 'Lead Dev',
        },
      ],
    };

    const proposals = generateParallelRebalanceProposals(goal, mockTeam);
    expect(proposals).toHaveLength(3);

    // Apply parallel split fork
    const splitProposal = proposals.find((p) => p.fork === 'parallel_split')!;
    const balancedGoal = applyParallelRebalance(goal, splitProposal);

    expect(balancedGoal).not.toBe(goal);
    // At least one task was shifted to a teammate
    const assignedTeammates = balancedGoal.microMoves.map((m) => m.assigneeId);
    expect(assignedTeammates.some((id) => id === 'tm_elena' || id === 'tm_marcus')).toBe(true);

    // Apply prune scope fork
    const pruneProposal = proposals.find((p) => p.fork === 'prune_scope')!;
    const prunedGoal = applyParallelRebalance(goal, pruneProposal);
    expect(prunedGoal.microMoves.find((m) => m.id === 'm2')?.isPruned).toBe(true);
    expect(prunedGoal.microMoves.find((m) => m.id === 'm1')?.isPruned).toBeFalsy();
  });
});
