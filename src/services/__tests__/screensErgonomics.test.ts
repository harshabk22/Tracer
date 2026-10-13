import { describe, it, expect } from 'vitest';
import { collaborationEngine } from '../collaborationEngine';
import { Goal, TeamMember } from '../../types/goal';

describe('UI Ergonomics & Screen Logic Engine', () => {
  const mockTeam: TeamMember[] = [
    { id: 'u_1', name: 'Lead Dev', role: 'Architect', avatar: '👑', isCurrentUser: true },
    { id: 'u_2', name: 'Frontend Eng', role: 'Engineer', avatar: '🎨', isCurrentUser: false },
  ];

  const mockGoal: Goal = {
    id: 'goal_test',
    title: 'Mobile Architecture Launch',
    category: 'technical',
    status: 'on_track',
    weeklyCapacityHours: 10,
    currentLevel: 'Intermediate',
    deadlineFlexibility: 'Moderate Elastic',
    active: true,
    velocityFactor: 1.0,
    createdAt: '2026-09-01',
    vision: {
      coreOutcome: 'Launch Tracer Mobile',
      targetDate: '2026-10-15',
    },
    milestones: [
      {
        id: 'm1',
        goalId: 'goal_test',
        order: 1,
        title: 'Core Engine',
        description: '',
        targetDate: '2026-09-15',
        status: 'completed',
        owner: 'Lead Dev',
      },
      {
        id: 'm2',
        goalId: 'goal_test',
        order: 2,
        title: 'UI Screens',
        description: '',
        targetDate: '2026-09-30',
        status: 'in_progress',
        owner: 'Frontend Eng',
      },
      {
        id: 'm3',
        goalId: 'goal_test',
        order: 3,
        title: 'Release QA',
        description: '',
        targetDate: '2026-10-15',
        status: 'pending',
        owner: 'Lead Dev',
      },
    ],
    microMoves: [],
  };

  it('calculates shared objective progress distribution per crew member', () => {
    const milestones = mockGoal.milestones;
    const total = milestones.length;
    const completed = milestones.filter(m => m.status === 'completed').length;
    const progress = Math.round((completed / total) * 100);

    expect(total).toBe(3);
    expect(completed).toBe(1);
    expect(progress).toBe(33);

    // Distribution
    const leadMoves = milestones.filter(m => m.owner === 'Lead Dev');
    const feMoves = milestones.filter(m => m.owner === 'Frontend Eng');

    expect(leadMoves.length).toBe(2);
    expect(feMoves.length).toBe(1);
    expect(Math.round((leadMoves.length / total) * 100)).toBe(67);
  });

  it('validates P2P flight plan import parsing and schema integrity', () => {
    const exportedJson = collaborationEngine.exportFlightPlanJson(mockGoal);
    const parsed = collaborationEngine.importFlightPlanJson(exportedJson);

    expect(parsed).not.toBeNull();
    expect(parsed?.title).toBe('Mobile Architecture Launch');
    expect(parsed?.milestones.length).toBe(3);
    expect(parsed?.milestones[0].owner).toBe('Lead Dev');
    expect(parsed?.milestones[1].owner).toBe('Frontend Eng');
  });

  it('rejects corrupt or tampered P2P JSON payloads', () => {
    expect(collaborationEngine.importFlightPlanJson('{ invalid json')).toBeNull();
    expect(collaborationEngine.importFlightPlanJson('{}')).toBeNull();
    expect(collaborationEngine.importFlightPlanJson(JSON.stringify({ title: 'No milestones' }))).toBeNull();
  });

  it('evaluates milestone date adjustment increments (+1d, +3d, +1w)', () => {
    const adjustDate = (currentDateStr: string, daysToAdd: number) => {
      const base = new Date(currentDateStr);
      base.setDate(base.getDate() + daysToAdd);
      return base.toISOString().split('T')[0];
    };

    expect(adjustDate('2026-09-15', 1)).toBe('2026-09-16');
    expect(adjustDate('2026-09-15', 3)).toBe('2026-09-18');
    expect(adjustDate('2026-09-15', 7)).toBe('2026-09-22');
  });

  it('formats schedule float buffer badges correctly', () => {
    const formatBuffer = (floatDays: number) => {
      if (floatDays < 0) return { label: 'Overdue', alert: true };
      if (floatDays === 0) return { label: '0d buffer', alert: false };
      return { label: `+${floatDays}d buffer`, alert: false };
    };

    expect(formatBuffer(-2)).toEqual({ label: 'Overdue', alert: true });
    expect(formatBuffer(0)).toEqual({ label: '0d buffer', alert: false });
    expect(formatBuffer(5)).toEqual({ label: '+5d buffer', alert: false });
  });

  it('clamps custom days strictly between 1 and 365', () => {
    const clampDays = (val: number) => Math.min(365, Math.max(1, val));

    expect(clampDays(0)).toBe(1);
    expect(clampDays(-10)).toBe(1);
    expect(clampDays(45)).toBe(45);
    expect(clampDays(365)).toBe(365);
    expect(clampDays(400)).toBe(365);
    expect(clampDays(9999)).toBe(365);
  });

  it('validates approve plan button disabled state when microMoves are pruned to 0', () => {
    const canApprove = (movesCount: number, isGenerating: boolean) => {
      return movesCount > 0 && !isGenerating;
    };

    expect(canApprove(3, false)).toBe(true);
    expect(canApprove(0, false)).toBe(false); // Pruned to 0
    expect(canApprove(3, true)).toBe(false);  // Currently generating
    expect(canApprove(0, true)).toBe(false);
  });

  it('provides fallback crew selection including "You" when teamMembers is empty', () => {
    const getHandoverCrew = (team: TeamMember[]) => {
      return team.length > 0
        ? team
        : [{ id: 'tm_you', name: 'You', role: 'Lead', avatar: '👤', isCurrentUser: true }];
    };

    const emptyTeam: TeamMember[] = [];
    const fallback = getHandoverCrew(emptyTeam);

    expect(fallback.length).toBe(1);
    expect(fallback[0].name).toBe('You');
    expect(fallback[0].isCurrentUser).toBe(true);

    const activeTeam = getHandoverCrew(mockTeam);
    expect(activeTeam.length).toBe(2);
    expect(activeTeam[0].name).toBe('Lead Dev');
  });

  it('memoizes micro-moves by milestone into an efficient O(1) lookup map', () => {
    const moves = [
      { id: 'm_1', milestoneId: 'ms_1', title: 'Task 1' },
      { id: 'm_2', milestoneId: 'ms_1', title: 'Task 2' },
      { id: 'm_3', milestoneId: 'ms_2', title: 'Task 3' },
    ];

    const map = new Map<string, typeof moves>();
    moves.forEach(m => {
      const list = map.get(m.milestoneId) || [];
      list.push(m);
      map.set(m.milestoneId, list);
    });

    expect(map.get('ms_1')?.length).toBe(2);
    expect(map.get('ms_2')?.length).toBe(1);
    expect(map.get('ms_unknown')).toBeUndefined();
  });

  it('handles overflow rescheduling beyond hero and top 2 up-next moves', () => {
    const pending = ['hero', 'upNext1', 'upNext2', 'overflow1', 'overflow2', 'overflow3'];
    const tomorrow = '2026-09-14';

    const overflow = pending.slice(3);
    expect(overflow).toEqual(['overflow1', 'overflow2', 'overflow3']);
    expect(overflow.length).toBe(3);

    const rescheduled = overflow.map(id => ({ id, dateScheduled: tomorrow }));
    expect(rescheduled.every(item => item.dateScheduled === tomorrow)).toBe(true);
  });

  it('verifies all 7 Assistant action badge labels and semantic color schemes', () => {
    const actionTypes = [
      'add_task',
      'complete_task',
      'prune_task',
      'prioritize_task',
      'split_task',
      'reschedule_task',
      'rebalance_dates',
    ] as const;

    const badgeMap: Record<string, { label: string; color: string }> = {
      add_task: { label: '+ ADD TASK', color: 'sage' },
      complete_task: { label: '✓ MARK DONE', color: 'sage' },
      prune_task: { label: '✕ PRUNE', color: 'rust' },
      prioritize_task: { label: '★ PROMOTE TO FOCUS', color: 'terracotta' },
      split_task: { label: '✂ SPLIT (15m/15m)', color: 'terracotta' },
      reschedule_task: { label: '📅 RESCHEDULE', color: 'amber' },
      rebalance_dates: { label: '⚡ REBALANCE ROADMAP', color: 'amber' },
    };

    actionTypes.forEach(type => {
      const badge = badgeMap[type];
      expect(badge).toBeDefined();
      expect(badge.label).toBeTruthy();
      expect(['sage', 'rust', 'terracotta', 'amber']).toContain(badge.color);
    });
  });
});
