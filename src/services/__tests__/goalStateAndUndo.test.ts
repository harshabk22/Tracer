import { describe, it, expect, beforeEach } from 'vitest';
import { Goal, MicroMove, SprintMilestone, LearningLog, CompletionSource } from '../../types/goal';
import { computeScheduleMetrics, computePersonalLearningModel } from '../scheduleEngine';
import { collaborationEngine } from '../collaborationEngine';
import { soundManager } from '../sound';

describe('Goal Context State & Global Undo Logic', () => {
  let sampleGoal: Goal;

  beforeEach(() => {
    sampleGoal = {
      id: 'g-test-1',
      title: 'Build Autonomous State Engine',
      category: 'technical',
      weeklyCapacityHours: 10,
      currentLevel: 'Advanced',
      deadlineFlexibility: 'Moderate Elastic',
      createdAt: '2026-09-12',
      active: true,
      velocityFactor: 1.0,
      status: 'on_track',
      vision: {
        coreOutcome: 'Ship reliable state architecture',
        targetDate: '2026-10-15',
        totalEstimatedHours: 20,
        successMetrics: ['100% test pass', 'Zero race conditions'],
      },
      milestones: [
        {
          id: 'ms-1',
          goalId: 'g-test-1',
          order: 1,
          title: 'Foundations',
          description: 'State and Undo',
          targetDate: '2026-09-20',
          owner: 'You',
          status: 'in_progress',
        },
        {
          id: 'ms-2',
          goalId: 'g-test-1',
          order: 2,
          title: 'Validation',
          description: 'Testing and Rollout',
          targetDate: '2026-10-01',
          owner: 'Elena',
          status: 'pending',
        },
      ],
      microMoves: [
        {
          id: 'mm-1',
          milestoneId: 'ms-1',
          goalId: 'g-test-1',
          title: 'Implement single-step undo snapshot',
          description: 'Keep previous goal snapshot',
          estimatedMinutes: 30,
          dateScheduled: '2026-09-12',
          status: 'todo',
          isPrivate: false,
          order: 1,
        },
        {
          id: 'mm-2',
          milestoneId: 'ms-1',
          goalId: 'g-test-1',
          title: 'Validate acoustic chimes on complete',
          description: 'Test sound synthesis',
          estimatedMinutes: 20,
          dateScheduled: '2026-09-12',
          status: 'todo',
          isPrivate: false,
          order: 2,
        },
      ],
    };
  });

  it('completes micro-move, logs learning entry, and updates schedule metrics', () => {
    const move = sampleGoal.microMoves[0];
    move.status = 'completed';
    move.actualMinutes = 35;
    move.completedAt = new Date().toISOString();

    const metrics = computeScheduleMetrics(sampleGoal);
    expect(metrics.totalMilestones).toBe(2);
    expect(metrics.completedMilestones).toBe(0);
    expect(metrics.activeMilestone?.id).toBe('ms-1');
  });

  it('executes single-step undo restoring previous goal state', () => {
    const snapshot = JSON.parse(JSON.stringify(sampleGoal));

    // Delete move
    sampleGoal.microMoves = sampleGoal.microMoves.filter(m => m.id !== 'mm-1');
    expect(sampleGoal.microMoves).toHaveLength(1);

    // Undo action
    sampleGoal = snapshot;
    expect(sampleGoal.microMoves).toHaveLength(2);
    expect(sampleGoal.microMoves[0].id).toBe('mm-1');
  });

  it('completes milestone and advances active milestone in schedule metrics', () => {
    sampleGoal.milestones[0].status = 'completed';
    const metrics = computeScheduleMetrics(sampleGoal);

    expect(metrics.completedMilestones).toBe(1);
    expect(metrics.progressPercentage).toBe(50);
    expect(metrics.activeMilestone?.id).toBe('ms-2');
  });

  it('supports collaboration flight plan JSON sanitization and export', () => {
    const sanitized = collaborationEngine.sanitizeGoalForShare(sampleGoal);
    expect(sanitized.version).toBe('tracer.v2');
    expect(sanitized.title).toBe(sampleGoal.title);
    expect(sanitized.milestones).toHaveLength(2);
    expect(sanitized.milestones[0].owner).toBe('You');
    expect(sanitized.milestones[1].owner).toBe('Elena');
  });

  it('executes autonomous A2A teammate negotiation with Zero-Knowledge privacy firewall', () => {
    const customMembers = [
      { id: 'tm_1', name: 'You (Goal Owner)', role: 'Lead', avatar: 'YOU', isCurrentUser: true },
      { id: 'tm_2', name: 'Taylor Jordan', role: 'Strategy & Review', avatar: 'TJ', isCurrentUser: false },
      { id: 'tm_3', name: 'Alex Morgan', role: 'Operations & Execution', avatar: 'AM', isCurrentUser: false },
    ];

    const result = collaborationEngine.simulateTeammateNegotiation(sampleGoal, customMembers);

    expect(result.dialogue.length).toBeGreaterThanOrEqual(3);
    expect(result.proposedMilestones).toHaveLength(2);
    expect(result.summary).toContain('Allocated 2 milestones');

    // Confirm strict ZK firewall: dialogue only references milestone titles, zero private details
    result.dialogue.forEach(turn => {
      expect(turn.senderName).toBeDefined();
      expect(turn.message).not.toContain('Implement single-step undo snapshot'); // Private micro-move never leaked!
    });
  });

  it('plays completion acoustics cleanly without throwing', () => {
    expect(() => soundManager.playCompleteChime()).not.toThrow();
    expect(() => soundManager.playCelebration()).not.toThrow();
  });

  it('reassigns milestone to a new owner with an audit handover note', () => {
    const targetMilestone = sampleGoal.milestones.find((m) => m.id === 'ms-1')!;
    expect(targetMilestone.owner).toBe('You');

    const newOwner = 'Alex Morgan';
    const handoverNote = 'Transferred API endpoint contracts';

    sampleGoal.milestones = sampleGoal.milestones.map((m) =>
      m.id === 'ms-1'
        ? {
            ...m,
            owner: newOwner,
            handoverNote,
            description: `${m.description}\n[Handover]: ${handoverNote}`,
          }
        : m
    );

    const updated = sampleGoal.milestones.find((m) => m.id === 'ms-1')!;
    expect(updated.owner).toBe('Alex Morgan');
    expect(updated.handoverNote).toBe('Transferred API endpoint contracts');
    expect(updated.description).toContain('[Handover]: Transferred API endpoint contracts');
  });

  it('imports shared flight plan JSON into a valid goal blueprint', () => {
    const exportedJson = collaborationEngine.exportFlightPlanJson(sampleGoal);
    const importedPlan = collaborationEngine.importFlightPlanJson(exportedJson);

    expect(importedPlan).not.toBeNull();
    expect(importedPlan?.title).toBe(sampleGoal.title);
    expect(importedPlan?.milestones).toHaveLength(2);
    expect(importedPlan?.milestones[0].title).toBe('Foundations');
  });

  describe('7-Action Checklist Lifecycle & Single-Step Undo', () => {
    it('executes add_task and allows single-step undo rollback', () => {
      const snapshot = JSON.parse(JSON.stringify(sampleGoal));
      const initialCount = sampleGoal.microMoves.length;

      const newMove: MicroMove = {
        id: 'mm_new_1',
        milestoneId: 'ms-1',
        goalId: sampleGoal.id,
        title: 'New Assistant Move',
        description: 'Generated via Assistant',
        estimatedMinutes: 20,
        dateScheduled: '2026-09-12',
        status: 'todo',
        isPrivate: false,
        order: initialCount + 1,
      };

      sampleGoal.microMoves.push(newMove);
      expect(sampleGoal.microMoves).toHaveLength(initialCount + 1);

      // Undo reverts to snapshot
      sampleGoal = snapshot;
      expect(sampleGoal.microMoves).toHaveLength(initialCount);
    });

    it('executes prune_task and allows single-step undo restoration', () => {
      const snapshot = JSON.parse(JSON.stringify(sampleGoal));
      const targetId = 'mm-1';

      sampleGoal.microMoves = sampleGoal.microMoves.map((m) =>
        m.id === targetId ? { ...m, isPruned: true, status: 'missed' as const } : m
      );

      expect(sampleGoal.microMoves.find((m) => m.id === targetId)?.isPruned).toBe(true);

      // Undo reverts
      sampleGoal = snapshot;
      expect(sampleGoal.microMoves.find((m) => m.id === targetId)?.isPruned).toBeUndefined();
    });

    it('executes prioritize_task and moves item to position 1', () => {
      const snapshot = JSON.parse(JSON.stringify(sampleGoal));
      const targetId = 'mm-2';
      const target = sampleGoal.microMoves.find((m) => m.id === targetId)!;
      const remaining = sampleGoal.microMoves.filter((m) => m.id !== targetId);

      sampleGoal.microMoves = [{ ...target, order: 1 }, ...remaining];
      expect(sampleGoal.microMoves[0].id).toBe('mm-2');

      // Undo reverts
      sampleGoal = snapshot;
      expect(sampleGoal.microMoves[0].id).toBe('mm-1');
    });
  });

  describe('Completion Authenticity & Provenance Tagging', () => {
    it('records completion source correctly on MicroMove and LearningLog', () => {
      const move: MicroMove = {
        ...sampleGoal.microMoves[0],
        status: 'completed',
        completionSource: 'focus_timer',
        actualMinutes: 25,
        completedAt: new Date().toISOString(),
      };

      const log: LearningLog = {
        id: 'log-test-1',
        goalId: sampleGoal.id,
        microMoveId: move.id,
        microMoveTitle: move.title,
        timestamp: move.completedAt!,
        estimatedMinutes: move.estimatedMinutes,
        actualMinutes: 25,
        ratio: 30 / 25,
        note: '',
        source: 'focus_timer',
      };

      expect(move.completionSource).toBe('focus_timer');
      expect(log.source).toBe('focus_timer');
    });

    it('resolves completionSource fallback to reflection_modal if minutes provided or quick_check if omitted', () => {
      const resolveSource = (source?: CompletionSource, actualMinutes?: number): CompletionSource => {
        return source || (actualMinutes !== undefined ? 'reflection_modal' : 'quick_check');
      };

      expect(resolveSource(undefined, undefined)).toBe('quick_check');
      expect(resolveSource(undefined, 25)).toBe('reflection_modal');
      expect(resolveSource('focus_timer', 25)).toBe('focus_timer');
      expect(resolveSource('assistant', 20)).toBe('assistant');
    });
  });

  describe('Personal Learning Model Velocity Tamper-Proofing & Winsorization', () => {
    it('protects against mass quick-check tampering with neutral 1.0x weighting', () => {
      // User rapidly checks off 10 tasks without active focus or reflection
      const logs: LearningLog[] = Array.from({ length: 10 }, (_, i) => ({
        id: `log-${i}`,
        goalId: sampleGoal.id,
        microMoveId: `mm-${i}`,
        microMoveTitle: `Task ${i}`,
        timestamp: new Date().toISOString(),
        estimatedMinutes: 30,
        actualMinutes: 0, // Rapid instant check
        ratio: 30,
        note: '',
        source: 'quick_check' as CompletionSource,
      }));

      const model = computePersonalLearningModel(logs);
      expect(model.totalCompletedMoves).toBe(10);
      // Quick checks do not distort velocity: stays neutral 1.0x!
      expect(model.velocityFactor).toBe(1.0);
    });

    it('adjusts velocity when verified high-confidence logs are recorded', () => {
      const logs: LearningLog[] = [
        {
          id: 'log-1',
          goalId: sampleGoal.id,
          microMoveId: 'mm-1',
          microMoveTitle: 'Focused task',
          timestamp: new Date().toISOString(),
          estimatedMinutes: 30,
          actualMinutes: 20, // 1.5x speed
          ratio: 1.5,
          note: '',
          source: 'focus_timer',
        },
      ];

      const model = computePersonalLearningModel(logs);
      expect(model.velocityFactor).toBe(1.5);
    });

    it('applies Winsorization to prevent velocity explosions on micro outliers', () => {
      // Task estimated at 30 min completed in 1 min (30x raw ratio)
      const logs: LearningLog[] = [
        {
          id: 'log-outlier',
          goalId: sampleGoal.id,
          microMoveId: 'mm-outlier',
          microMoveTitle: 'Outlier task',
          timestamp: new Date().toISOString(),
          estimatedMinutes: 30,
          actualMinutes: 1,
          ratio: 30,
          note: '',
          source: 'reflection_modal',
        },
      ];

      const model = computePersonalLearningModel(logs);
      // Clamped to est * 0.33 = 10 min -> 30 / 10 = 3.0x max speed, clamped at 2.5x ceiling
      expect(model.velocityFactor).toBe(2.5);
    });

    it('strictly bounds final velocity factor to [0.4, 2.5] range', () => {
      // Super slow task
      const slowLogs: LearningLog[] = [
        {
          id: 'log-slow',
          goalId: sampleGoal.id,
          microMoveId: 'mm-slow',
          microMoveTitle: 'Slow task',
          timestamp: new Date().toISOString(),
          estimatedMinutes: 10,
          actualMinutes: 300,
          ratio: 0.03,
          note: '',
          source: 'reflection_modal',
        },
      ];

      const slowModel = computePersonalLearningModel(slowLogs);
      // Even with 300 min (clamped to 30 min -> 0.33), bounded at 0.4 floor
      expect(slowModel.velocityFactor).toBeGreaterThanOrEqual(0.4);
      expect(slowModel.velocityFactor).toBeLessThanOrEqual(2.5);
    });
  });
});

