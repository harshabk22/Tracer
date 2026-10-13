import { describe, it, expect, beforeEach } from 'vitest';
import { storage } from '../storage';
import { DEFAULT_GOAL } from '../mockData';

if (typeof (globalThis as any).localStorage === 'undefined') {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, String(v)),
    removeItem: (k: string) => store.delete(k),
    clear: () => store.clear(),
  };
}

describe('Storage Resilience & Data Sanitization', () => {
  beforeEach(() => {
    storage.resetAll();
  });

  it('returns clean empty array on empty or missing storage', () => {
    const goals = storage.getGoals();
    expect(goals).toEqual([]);
  });

  it('recovers gracefully from corrupted JSON in localStorage by returning empty array', () => {
    localStorage.setItem('tracer_goals_v1', '{invalid-json-data');
    const goals = storage.getGoals();
    expect(goals).toEqual([]);
  });

  it('sanitizes and self-heals incomplete goal objects missing milestones or microMoves', () => {
    const malformedGoal = {
      id: 'g-custom-1',
      title: 'Partial Goal Without Arrays',
      // missing vision, milestones, microMoves
    };
    localStorage.setItem('tracer_goals_v1', JSON.stringify([malformedGoal]));

    const goals = storage.getGoals();
    expect(goals).toHaveLength(1);
    expect(goals[0].id).toBe('g-custom-1');
    expect(goals[0].milestones).toEqual([]);
    expect(goals[0].microMoves).toEqual([]);
    expect(goals[0].vision).toBeDefined();
    expect(goals[0].totalFloatBufferDays).toBe(8);
  });

  it('preserves valid custom goals and restores them intact', () => {
    const customGoal = {
      ...DEFAULT_GOAL,
      id: 'custom-prod-goal',
      title: 'Production Mobile Release',
    };
    storage.saveGoals([customGoal]);

    const retrieved = storage.getGoals();
    expect(retrieved).toHaveLength(1);
    expect(retrieved[0].id).toBe('custom-prod-goal');
    expect(retrieved[0].title).toBe('Production Mobile Release');
  });

  describe('Workspace State & What-If Draft Persistence', () => {
    it('persists and restores Roadmap workspace tabs with fallback on invalid values', () => {
      expect(storage.getRoadmapWorkspaceTab()).toBe('dag');

      storage.saveRoadmapWorkspaceTab('velocity');
      expect(storage.getRoadmapWorkspaceTab()).toBe('velocity');

      storage.saveRoadmapWorkspaceTab('journal');
      expect(storage.getRoadmapWorkspaceTab()).toBe('journal');

      // Corrupted / invalid value in storage
      localStorage.setItem('tracer_roadmap_workspace_tab_v1', 'nonexistent_tab');
      expect(storage.getRoadmapWorkspaceTab()).toBe('dag');
    });

    it('persists and restores Focus segments with fallback on invalid values', () => {
      expect(storage.getFocusSegment()).toBe('active');

      storage.saveFocusSegment('completed');
      expect(storage.getFocusSegment()).toBe('completed');

      storage.saveFocusSegment('backlog');
      expect(storage.getFocusSegment()).toBe('backlog');

      // Corrupted / invalid value in storage
      localStorage.setItem('tracer_focus_segment_v1', 'corrupted_segment');
      expect(storage.getFocusSegment()).toBe('active');
    });

    it('persists and restores DAG view modes with fallback on invalid values', () => {
      expect(storage.getDagViewMode()).toBe('dag');

      storage.saveDagViewMode('stream');
      expect(storage.getDagViewMode()).toBe('stream');

      // Corrupted / invalid value in storage
      localStorage.setItem('tracer_dag_view_mode_v1', 'invalid_mode');
      expect(storage.getDagViewMode()).toBe('dag');
    });

    it('manages What-If simulation drafts safely scoped by goalId', () => {
      const draftMilestones = [
        {
          id: 'ms-sim-1',
          goalId: 'goal-alpha',
          order: 1,
          title: 'Simulated Phase 1',
          description: '',
          targetDate: '2026-10-01',
          owner: 'Leader',
          bufferFloatDays: 5,
          floatConsumed: 0,
          isCriticalPath: true,
          dependencies: [],
          status: 'pending' as const,
        },
      ];

      // Initially no draft
      expect(storage.getWhatIfDraft('goal-alpha')).toBeNull();

      // Save draft for goal-alpha
      storage.saveWhatIfDraft('goal-alpha', draftMilestones);

      // Successfully retrieves for goal-alpha
      const loaded = storage.getWhatIfDraft('goal-alpha');
      expect(loaded).toHaveLength(1);
      expect(loaded![0].id).toBe('ms-sim-1');
      expect(loaded![0].bufferFloatDays).toBe(5);

      // Scoped: does NOT leak to a different goal
      expect(storage.getWhatIfDraft('goal-beta')).toBeNull();

      // Clear draft
      storage.clearWhatIfDraft();
      expect(storage.getWhatIfDraft('goal-alpha')).toBeNull();
    });

    it('self-heals when What-If simulation draft contains corrupted JSON', () => {
      localStorage.setItem('tracer_whatif_draft_v1', '{corrupted-json-draft');
      expect(storage.getWhatIfDraft('any-goal')).toBeNull();
      // Corrupted item should be safely purged
      expect(localStorage.getItem('tracer_whatif_draft_v1')).toBeNull();
    });

    it('purges all workspace keys when resetAll is invoked', () => {
      storage.saveRoadmapWorkspaceTab('velocity');
      storage.saveFocusSegment('backlog');
      storage.saveDagViewMode('stream');
      storage.saveWhatIfDraft('goal-test', [{ id: 'm1' } as any]);

      storage.resetAll();

      expect(storage.getRoadmapWorkspaceTab()).toBe('dag');
      expect(storage.getFocusSegment()).toBe('active');
      expect(storage.getDagViewMode()).toBe('dag');
      expect(storage.getWhatIfDraft('goal-test')).toBeNull();
    });
  });

  describe('Daily Reflections Persistence', () => {
    it('persists and retrieves daily reflections with structured metadata', () => {
      expect(storage.getDailyReflections()).toEqual([]);

      storage.saveDailyReflection({
        date: '2026-09-13',
        mood: 'smooth',
        note: 'Completed deep work milestone early',
      });

      const reflections = storage.getDailyReflections();
      expect(reflections).toHaveLength(1);
      expect(reflections[0].date).toBe('2026-09-13');
      expect(reflections[0].mood).toBe('smooth');
      expect(reflections[0].note).toBe('Completed deep work milestone early');
      expect(reflections[0].timestamp).toBeDefined();

      expect(storage.getDailyReflection('2026-09-13')).toBe('smooth');
    });

    it('updates reflection in place for the same date', () => {
      storage.saveDailyReflection({
        date: '2026-09-13',
        mood: 'friction',
        note: 'Initial blocker',
      });
      storage.saveDailyReflection({
        date: '2026-09-13',
        mood: 'smooth',
        note: 'Resolved and back on track',
      });

      const reflections = storage.getDailyReflections();
      expect(reflections).toHaveLength(1);
      expect(reflections[0].mood).toBe('smooth');
      expect(reflections[0].note).toBe('Resolved and back on track');
    });

    it('supports legacy (dateStr, mood) signature seamlessly', () => {
      storage.saveDailyReflection('2026-09-14', 'hard');

      expect(storage.getDailyReflection('2026-09-14')).toBe('hard');
      const all = storage.getDailyReflections();
      expect(all.some((r) => r.date === '2026-09-14' && r.mood === 'hard')).toBe(true);
    });

    it('clears reflections upon resetAll()', () => {
      storage.saveDailyReflection({ date: '2026-09-13', mood: 'smooth' });
      expect(storage.getDailyReflections()).toHaveLength(1);

      storage.resetAll();
      expect(storage.getDailyReflections()).toEqual([]);
      expect(storage.getDailyReflection('2026-09-13')).toBeNull();
    });
  });

  describe('Trajectory Ledger & 1-Tap Full Purge', () => {
    it('records trajectory items and bounds ledger to 50 entries', () => {
      expect(storage.getTrajectoryLedger()).toEqual([]);

      for (let i = 1; i <= 60; i++) {
        storage.recordTrajectory({
          id: `traj-${i}`,
          timestamp: Date.now() + i,
          type: 'decomposition',
          action: `Action ${i}`,
          details: `Details ${i}`,
        });
      }

      const ledger = storage.getTrajectoryLedger();
      expect(ledger).toHaveLength(50);
      expect(ledger[0].id).toBe('traj-11');
      expect(ledger[49].id).toBe('traj-60');
    });

    it('purges all data across localStorage, memoryStore, and keys with purgeAllData()', () => {
      storage.saveGoals([{ ...DEFAULT_GOAL, id: 'test-purge-goal' }]);
      storage.saveActiveGoalId('test-purge-goal');
      storage.saveDailyReflection({ date: '2026-09-15', mood: 'smooth' });
      storage.recordTrajectory({
        id: 'traj-purge',
        timestamp: Date.now(),
        type: 'action',
        action: 'Test Purge',
      });

      storage.purgeAllData();

      expect(storage.getGoals()).toEqual([]);
      expect(storage.getActiveGoalId()).toBeNull();
      expect(storage.getDailyReflections()).toEqual([]);
      expect(storage.getTrajectoryLedger()).toEqual([]);
    });

    it('resolves default AI model and custom base URL per provider', () => {
      expect(storage.getAiModel('deepseek')).toBe('deepseek-chat');
      expect(storage.getAiModel('openai')).toBe('gpt-4o');
      expect(storage.getAiModel('custom')).toBe('llama3.3');
      expect(storage.getAiModel('gemini')).toBe('gemini-3.6-flash');

      expect(storage.getCustomApiBaseUrl('deepseek')).toBe('https://api.deepseek.com');
      expect(storage.getCustomApiBaseUrl('openai')).toBe('https://api.openai.com/v1');
      expect(storage.getCustomApiBaseUrl('custom')).toBe('http://localhost:11434/v1');
    });
  });
});
